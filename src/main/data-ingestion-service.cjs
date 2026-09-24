const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("xlsx");
const { workspaceRoot } = require("./database-service.cjs");
const { sha256 } = require("./file-integrity-service.cjs");
const hub = require("./process-hub-service.cjs");

const MAX_UI_ROWS = 5000;
const DEFAULT_UI_ROWS = 500;
const MAX_AI_SAMPLE_ROWS = 50;

const CANONICAL_FIELD_ALIASES = Object.freeze({
  student_id: ["cédula", "cedula", "identificación", "identificacion", "documento", "dni"],
  student_name: ["estudiante", "nombre completo", "nombres y apellidos", "apellidos y nombres", "nombres"],
  career: ["carrera", "programa", "programa académico", "programa academico"],
  campus: ["sede", "campus"],
  core: ["núcleo", "nucleo"],
  component: ["componente", "tipo de evaluación", "tipo de evaluacion", "evaluación", "evaluacion"],
  grade: ["nota", "calificación", "calificacion", "puntaje"],
  modality: ["modalidad"],
  level: ["nivel", "grado", "tipo de carrera"],
  period: ["período", "periodo"],
  status: ["estado", "resultado"]
});

function id(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function now() {
  return new Date().toISOString();
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function hashObject(value) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function normalizeText(value) {
  return String(value == null ? "" : value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cleanHeader(value, index) {
  const text = String(value == null ? "" : value).trim();
  return text || `Columna ${index + 1}`;
}

function normalizeScalar(value) {
  if (value instanceof Date) return value.toISOString();
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  return String(value).trim();
}

function inferType(values) {
  const present = values.filter((value) => value !== "" && value != null);
  if (!present.length) return "empty";
  const numeric = present.filter((value) => typeof value === "number" || (String(value).trim() !== "" && Number.isFinite(Number(value))));
  if (numeric.length / present.length >= 0.9) return "number";
  const bool = present.filter((value) => value === true || value === false || /^(sí|si|no|true|false)$/i.test(String(value)));
  if (bool.length / present.length >= 0.9) return "boolean";
  const dates = present.filter((value) => /^\d{4}-\d{2}-\d{2}/.test(String(value)) || /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(String(value)));
  if (dates.length / present.length >= 0.8) return "date";
  return "text";
}

function sheetRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
  if (!raw.length) return { headers: [], rows: [] };
  const width = raw.reduce((max, row) => Math.max(max, row.length), 0);
  const headers = Array.from({ length: width }, (_item, index) => cleanHeader(raw[0] && raw[0][index], index));
  const seen = new Map();
  const uniqueHeaders = headers.map((header) => {
    const count = (seen.get(header) || 0) + 1;
    seen.set(header, count);
    return count === 1 ? header : `${header} (${count})`;
  });
  const rows = raw.slice(1)
    .filter((row) => row.some((value) => String(value == null ? "" : value).trim() !== ""))
    .map((row) => {
      const result = {};
      uniqueHeaders.forEach((header, index) => { result[header] = normalizeScalar(row[index]); });
      return result;
    });
  return { headers: uniqueHeaders, rows };
}

function profileSheet(headers, rows) {
  const columns = headers.map((header) => {
    const sampleValues = rows.slice(0, 500).map((row) => row[header]);
    let nonEmpty = 0;
    const distinct = new Set();
    const examples = [];
    rows.forEach((row) => {
      const value = row[header];
      if (value === "" || value == null) return;
      nonEmpty += 1;
      const text = String(value);
      distinct.add(text);
      if (examples.length < 5 && !examples.includes(text)) examples.push(text);
    });
    return {
      name: header,
      type: inferType(sampleValues),
      nonEmpty,
      completeness: rows.length ? Number(((nonEmpty / rows.length) * 100).toFixed(2)) : 0,
      distinct: distinct.size,
      examples
    };
  });
  return { rowCount: rows.length, columnCount: headers.length, columns };
}

function importDataFile(userDataPath, dossierId, sourcePath, scope) {
  const db = hub.dbFor(userDataPath);
  const dossier = hub.getDossier(userDataPath, dossierId);
  if (!dossier) throw new Error("Expediente no válido.");
  if (!sourcePath || !fs.existsSync(sourcePath)) throw new Error("Archivo de datos no encontrado.");
  const extension = path.extname(sourcePath).toLowerCase();
  if (![".xlsx", ".xls", ".csv"].includes(extension)) throw new Error("Solo se admiten Excel y CSV.");

  const scopeType = String(scope && scope.type || "dossier");
  const scopeKey = String(scope && scope.key || "");
  const sourceHash = sha256(sourcePath);
  const duplicate = db.prepare(`
    SELECT id FROM data_imports_v3
    WHERE dossier_id = ? AND sha256 = ? AND scope_type = ? AND scope_key = ? AND status = 'ready'
    ORDER BY created_at DESC LIMIT 1
  `).get(dossierId, sourceHash, scopeType, scopeKey);
  if (duplicate) {
    hub.audit(db, {
      dossierId,
      entityType: "data_import",
      entityId: duplicate.id,
      action: "duplicate_ignored",
      detail: { sourceName: path.basename(sourcePath), sha256: sourceHash, scopeType, scopeKey }
    });
    return Object.assign({}, getImport(userDataPath, duplicate.id), { duplicateIgnored: true });
  }

  const importId = id("import");
  const dir = path.join(workspaceRoot(userDataPath), "dossiers", dossierId, "imports", importId);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, path.basename(sourcePath));
  fs.copyFileSync(sourcePath, target);
  const workbook = XLSX.readFile(target, { cellDates: true });
  const profiles = [];
  const sheets = [];
  workbook.SheetNames.forEach((sheetName) => {
    const parsed = sheetRows(workbook, sheetName);
    const profile = profileSheet(parsed.headers, parsed.rows);
    profiles.push(Object.assign({ name: sheetName }, profile));
    sheets.push({ name: sheetName, headers: parsed.headers, rows: parsed.rows });
  });

  const ts = now();
  db.prepare(`
    INSERT INTO data_imports_v3
      (id, dossier_id, scope_type, scope_key, source_name, local_path, sha256, status, profile_json, mapping_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', ?, '{}', ?, ?)
  `).run(
    importId,
    dossierId,
    scopeType,
    scopeKey,
    path.basename(sourcePath),
    target,
    sourceHash,
    JSON.stringify({ sheets: profiles, totalRows: profiles.reduce((sum, item) => sum + item.rowCount, 0) }),
    ts,
    ts
  );

  const insertSheet = db.prepare(`
    INSERT INTO data_sheets_v3
      (id, import_id, sheet_name, headers_json, rows_json, row_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  sheets.forEach((sheet) => {
    insertSheet.run(
      id("sheet"),
      importId,
      sheet.name,
      JSON.stringify(sheet.headers),
      JSON.stringify(sheet.rows),
      sheet.rows.length,
      ts
    );
  });

  hub.audit(db, {
    dossierId,
    entityType: "data_import",
    entityId: importId,
    action: "import",
    detail: {
      sourceName: path.basename(sourcePath),
      sha256: sourceHash,
      scopeType,
      scopeKey,
      sheets: profiles
    }
  });
  hub.markDossierStale(userDataPath, dossierId, `Se importaron datos nuevos: ${path.basename(sourcePath)}`);
  return getImport(userDataPath, importId);
}

function getImport(userDataPath, importId) {
  const db = hub.dbFor(userDataPath);
  const row = db.prepare("SELECT * FROM data_imports_v3 WHERE id = ?").get(importId);
  if (!row) return null;
  return {
    id: row.id,
    dossierId: row.dossier_id,
    scopeType: row.scope_type,
    scopeKey: row.scope_key,
    sourceName: row.source_name,
    localPath: row.local_path,
    sha256: row.sha256,
    status: row.status,
    profile: JSON.parse(row.profile_json || "{}"),
    mapping: JSON.parse(row.mapping_json || "{}"),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function listImports(userDataPath, dossierId) {
  const db = hub.dbFor(userDataPath);
  return db.prepare("SELECT id FROM data_imports_v3 WHERE dossier_id = ? ORDER BY created_at DESC").all(dossierId)
    .map((row) => getImport(userDataPath, row.id));
}

function headersForImport(db, importId) {
  return db.prepare("SELECT sheet_name, headers_json FROM data_sheets_v3 WHERE import_id = ? ORDER BY created_at").all(importId)
    .map((row) => ({
      sheet: row.sheet_name,
      headers: JSON.parse(row.headers_json || "[]")
    }));
}

function mappingFieldSpecs(mapping, sheetName) {
  const input = mapping && typeof mapping === "object" ? mapping : {};
  const base = input.fields && typeof input.fields === "object"
    ? input.fields
    : Object.fromEntries(Object.entries(input).filter(([key]) => !["sheets", "sheetFields", "version"].includes(key)));
  const perSheetRoot = input.sheets || input.sheetFields || {};
  const perSheet = perSheetRoot && perSheetRoot[sheetName];
  const perSheetFields = perSheet && typeof perSheet === "object"
    ? (perSheet.fields && typeof perSheet.fields === "object" ? perSheet.fields : perSheet)
    : {};
  return Object.assign({}, base || {}, perSheetFields || {});
}

function sourceCandidates(spec) {
  if (Array.isArray(spec)) return spec.map(String);
  if (spec && typeof spec === "object") {
    if (Array.isArray(spec.sources)) return spec.sources.map(String);
    if (spec.source != null) return [String(spec.source)];
  }
  return spec == null ? [] : [String(spec)];
}

function findHeader(row, candidate) {
  if (Object.prototype.hasOwnProperty.call(row, candidate)) return candidate;
  const normalized = normalizeText(candidate);
  return Object.keys(row).find((key) => !key.startsWith("__") && normalizeText(key) === normalized) || "";
}

function applyMapping(row, mapping, sheetName) {
  const fields = mappingFieldSpecs(mapping, sheetName);
  const mapped = {};
  Object.entries(fields).forEach(([canonical, spec]) => {
    for (const candidate of sourceCandidates(spec)) {
      const header = findHeader(row, candidate);
      if (header) {
        mapped[canonical] = row[header];
        break;
      }
    }
  });
  return mapped;
}

function validateMapping(userDataPath, importId, mapping) {
  const db = hub.dbFor(userDataPath);
  const current = getImport(userDataPath, importId);
  if (!current) throw new Error("Importación no válida.");
  const sheets = headersForImport(db, importId);
  const errors = [];
  const warnings = [];

  sheets.forEach((sheet) => {
    const normalizedHeaders = new Set(sheet.headers.map(normalizeText));
    const fields = mappingFieldSpecs(mapping, sheet.sheet);
    Object.entries(fields).forEach(([canonical, spec]) => {
      const candidates = sourceCandidates(spec);
      if (!candidates.length) {
        warnings.push(`${sheet.sheet}: el campo canónico "${canonical}" no tiene columna de origen.`);
        return;
      }
      const exists = candidates.some((candidate) => normalizedHeaders.has(normalizeText(candidate)));
      if (!exists) {
        warnings.push(`${sheet.sheet}: "${canonical}" no encontró ninguna de estas columnas: ${candidates.join(", ")}.`);
      }
    });
  });

  return { ok: errors.length === 0, errors, warnings };
}

function setMapping(userDataPath, importId, mapping) {
  const db = hub.dbFor(userDataPath);
  const current = getImport(userDataPath, importId);
  if (!current) throw new Error("Importación no válida.");
  const validation = validateMapping(userDataPath, importId, mapping || {});
  if (!validation.ok) throw new Error(validation.errors.join(" | "));
  const ts = now();
  db.prepare("UPDATE data_imports_v3 SET mapping_json = ?, updated_at = ? WHERE id = ?")
    .run(JSON.stringify(mapping || {}), ts, importId);
  hub.audit(db, {
    dossierId: current.dossierId,
    entityType: "data_import",
    entityId: importId,
    action: "map",
    detail: { mapping: mapping || {}, warnings: validation.warnings }
  });
  hub.markDossierStale(userDataPath, current.dossierId, `Cambió el mapeo de datos: ${current.sourceName}`);
  return Object.assign({}, getImport(userDataPath, importId), { mappingValidation: validation });
}

function suggestMapping(userDataPath, importId) {
  const db = hub.dbFor(userDataPath);
  const current = getImport(userDataPath, importId);
  if (!current) throw new Error("Importación no válida.");
  const sheets = headersForImport(db, importId);
  return {
    importId,
    sourceName: current.sourceName,
    sheets: sheets.map((sheet) => {
      const suggestions = {};
      Object.entries(CANONICAL_FIELD_ALIASES).forEach(([canonical, aliases]) => {
        let best = null;
        sheet.headers.forEach((header) => {
          const normalizedHeader = normalizeText(header);
          aliases.forEach((alias) => {
            const normalizedAlias = normalizeText(alias);
            let confidence = 0;
            if (normalizedHeader === normalizedAlias) confidence = 1;
            else if (normalizedHeader.includes(normalizedAlias) || normalizedAlias.includes(normalizedHeader)) confidence = 0.8;
            if (!best || confidence > best.confidence) {
              if (confidence > 0) best = { source: header, confidence };
            }
          });
        });
        if (best) suggestions[canonical] = best;
      });
      return { sheet: sheet.sheet, suggestions };
    }),
    note: "Las sugerencias no se aplican automáticamente. Deben confirmarse antes de guardar el mapeo."
  };
}

function importMatchesScope(importRow, input) {
  const scopeType = String(input && input.scopeType || "");
  const scopeKey = String(input && input.scopeKey || "");
  if (!scopeType && !scopeKey) return true;
  const policy = String(input && input.scopePolicy || "inclusive");
  const exact = String(importRow.scope_type || "") === scopeType && String(importRow.scope_key || "") === scopeKey;
  if (policy === "exact") return exact;
  const dossierWide = String(importRow.scope_type || "dossier") === "dossier" && String(importRow.scope_key || "") === "";
  return dossierWide || exact;
}

function selectedImports(db, dossierId, options) {
  const all = db.prepare("SELECT * FROM data_imports_v3 WHERE dossier_id = ? AND status = 'ready' ORDER BY created_at").all(dossierId);
  const ids = options && Array.isArray(options.importIds) && options.importIds.length
    ? new Set(options.importIds.map(String))
    : null;
  return all.filter((row) => (!ids || ids.has(String(row.id))) && importMatchesScope(row, options || {}));
}

function sheetSelected(sheetName, input) {
  if (!input || input.sheet == null) return true;
  if (Array.isArray(input.sheet)) return input.sheet.map(String).includes(String(sheetName));
  return String(input.sheet) === String(sheetName);
}

function allRows(userDataPath, dossierId, options) {
  const db = hub.dbFor(userDataPath);
  const imports = selectedImports(db, dossierId, options || {});
  const rows = [];
  imports.forEach((importRow) => {
    const mapping = JSON.parse(importRow.mapping_json || "{}");
    const sheets = db.prepare("SELECT * FROM data_sheets_v3 WHERE import_id = ? ORDER BY created_at").all(importRow.id);
    sheets.forEach((sheet) => {
      if (!sheetSelected(sheet.sheet_name, options || {})) return;
      const parsedRows = JSON.parse(sheet.rows_json || "[]");
      parsedRows.forEach((row, index) => {
        const mapped = applyMapping(row, mapping, sheet.sheet_name);
        rows.push(Object.assign({}, row, mapped, {
          __importId: importRow.id,
          __sourceName: importRow.source_name,
          __sourceSha256: importRow.sha256,
          __scopeType: importRow.scope_type,
          __scopeKey: importRow.scope_key,
          __sheet: sheet.sheet_name,
          __row: index + 2
        }));
      });
    });
  });
  return rows;
}

function compare(value, operator, expected) {
  const op = String(operator || "eq").toLowerCase();
  if (op === "exists") return value !== "" && value != null;
  if (op === "empty") return value === "" || value == null;
  if (op === "contains") return normalizeText(value).includes(normalizeText(expected));
  if (op === "startswith") return normalizeText(value).startsWith(normalizeText(expected));
  if (op === "endswith") return normalizeText(value).endsWith(normalizeText(expected));
  if (op === "eq_sensitive") return String(value) === String(expected);
  if (op === "neq_sensitive") return String(value) !== String(expected);
  if (op === "in") {
    const set = Array.isArray(expected) ? expected : String(expected || "").split(",").map((item) => item.trim());
    const normalized = new Set(set.map(normalizeText));
    return normalized.has(normalizeText(value));
  }
  if (op === "not_in") {
    const set = Array.isArray(expected) ? expected : String(expected || "").split(",").map((item) => item.trim());
    const normalized = new Set(set.map(normalizeText));
    return !normalized.has(normalizeText(value));
  }
  const leftNumber = Number(value);
  const rightNumber = Number(expected);
  if (["gt", "gte", "lt", "lte"].includes(op) && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    if (op === "gt") return leftNumber > rightNumber;
    if (op === "gte") return leftNumber >= rightNumber;
    if (op === "lt") return leftNumber < rightNumber;
    return leftNumber <= rightNumber;
  }
  if (op === "between" && Array.isArray(expected) && expected.length >= 2) {
    const min = Number(expected[0]);
    const max = Number(expected[1]);
    return Number.isFinite(leftNumber) && Number.isFinite(min) && Number.isFinite(max) && leftNumber >= min && leftNumber <= max;
  }
  if (op === "neq") return normalizeText(value) !== normalizeText(expected);
  return normalizeText(value) === normalizeText(expected);
}

function rowMatches(row, input) {
  const all = Array.isArray(input && input.where) ? input.where : [];
  if (!all.every((condition) => compare(row[condition.field], condition.op, condition.value))) return false;
  const any = Array.isArray(input && input.anyOf) ? input.anyOf : [];
  if (any.length && !any.some((condition) => compare(row[condition.field], condition.op, condition.value))) return false;
  return true;
}

function distinctRows(rows, fields) {
  const keys = Array.isArray(fields) ? fields.filter(Boolean) : [];
  if (!keys.length) return rows;
  const seen = new Set();
  return rows.filter((row) => {
    const signature = keys.map((field) => normalizeText(row[field])).join("\u241f");
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function filteredRows(userDataPath, dossierId, query) {
  const input = query || {};
  const sourceRows = allRows(userDataPath, dossierId, input);
  const filtered = sourceRows.filter((row) => rowMatches(row, input));
  const rows = distinctRows(filtered, input.distinctBy);
  return {
    sourceRows: sourceRows.length,
    beforeDistinct: filtered.length,
    duplicateRowsRemoved: filtered.length - rows.length,
    rows
  };
}

function projectRow(row, select, includeProvenance) {
  const fields = Array.isArray(select) && select.length
    ? select
    : Object.keys(row).filter((key) => !key.startsWith("__"));
  const next = {};
  fields.forEach((field) => { next[field] = row[field]; });
  if (includeProvenance) {
    next.__provenance = {
      importId: row.__importId,
      sourceName: row.__sourceName,
      sha256: row.__sourceSha256,
      sheet: row.__sheet,
      row: row.__row
    };
  }
  return next;
}

function sourceTrace(rows, includeMatchedCounts) {
  const map = new Map();
  (rows || []).forEach((row) => {
    const key = String(row.__importId || "");
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        importId: key,
        sourceName: row.__sourceName || "",
        sha256: row.__sourceSha256 || "",
        scopeType: row.__scopeType || "",
        scopeKey: row.__scopeKey || "",
        sheets: new Map(),
        matchedRows: 0
      });
    }
    const item = map.get(key);
    item.matchedRows += 1;
    const sheet = String(row.__sheet || "");
    if (!item.sheets.has(sheet)) item.sheets.set(sheet, { name: sheet, firstRow: null, lastRow: null });
    const sheetTrace = item.sheets.get(sheet);
    const rowNumber = Number(row.__row || 0);
    if (rowNumber > 0) {
      if (sheetTrace.firstRow == null || rowNumber < sheetTrace.firstRow) sheetTrace.firstRow = rowNumber;
      if (sheetTrace.lastRow == null || rowNumber > sheetTrace.lastRow) sheetTrace.lastRow = rowNumber;
    }
  });
  return Array.from(map.values()).map((item) => {
    const trace = {
      importId: item.importId,
      sourceName: item.sourceName,
      sha256: item.sha256,
      scopeType: item.scopeType,
      scopeKey: item.scopeKey,
      sheets: Array.from(item.sheets.values()).map((sheet) => ({
        name: sheet.name,
        firstRow: sheet.firstRow,
        lastRow: sheet.lastRow
      }))
    };
    if (includeMatchedCounts) trace.matchedRows = item.matchedRows;
    return trace;
  });
}

function queryData(userDataPath, dossierId, query) {
  const input = query || {};
  const filtered = filteredRows(userDataPath, dossierId, input);
  const total = filtered.rows.length;
  const limit = Math.max(1, Math.min(Number(input.limit || DEFAULT_UI_ROWS), MAX_UI_ROWS));
  const pageRows = filtered.rows.slice(0, limit).map((row) => projectRow(row, input.select, input.includeProvenance === true));
  return {
    total,
    returnedRows: pageRows.length,
    rows: pageRows,
    truncated: total > limit,
    sourceRows: filtered.sourceRows,
    duplicateRowsRemoved: filtered.duplicateRowsRemoved,
    sourceTrace: sourceTrace(filtered.rows, true)
  };
}

function numericStats(rows, field) {
  const values = rows.map((row) => Number(row[field])).filter(Number.isFinite);
  if (!values.length) return null;
  let min = values[0];
  let max = values[0];
  let sum = 0;
  values.forEach((value) => {
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
  });
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
  return {
    count: values.length,
    min,
    max,
    sum: Number(sum.toFixed(4)),
    average: Number((sum / values.length).toFixed(4)),
    median: Number(median.toFixed(4))
  };
}

function dimensionSummary(rows, field) {
  const counts = new Map();
  rows.forEach((row) => {
    const raw = row[field] == null || row[field] === "" ? "Sin dato" : String(row[field]);
    const normalized = normalizeText(raw);
    if (!counts.has(normalized)) counts.set(normalized, { value: raw, count: 0 });
    counts.get(normalized).count += 1;
  });
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)))
    .map((item) => ({
      value: item.value,
      count: item.count,
      percentage: rows.length ? Number(((item.count / rows.length) * 100).toFixed(2)) : 0
    }));
}

function groupedSummary(rows, groupBy, measures) {
  const fields = Array.isArray(groupBy) ? groupBy.filter(Boolean) : [];
  if (!fields.length) return [];
  const groups = new Map();
  rows.forEach((row) => {
    const values = {};
    fields.forEach((field) => { values[field] = row[field] == null || row[field] === "" ? "Sin dato" : row[field]; });
    const key = fields.map((field) => normalizeText(values[field])).join("\u241f");
    if (!groups.has(key)) groups.set(key, { values, rows: [] });
    groups.get(key).rows.push(row);
  });
  return Array.from(groups.values()).map((group) => {
    const numeric = {};
    (measures || []).forEach((field) => {
      const stats = numericStats(group.rows, field);
      if (stats) numeric[field] = stats;
    });
    return {
      values: group.values,
      count: group.rows.length,
      percentage: rows.length ? Number(((group.rows.length / rows.length) * 100).toFixed(2)) : 0,
      numeric
    };
  }).sort((a, b) => b.count - a.count);
}

function summarize(userDataPath, dossierId, query) {
  const input = query || {};
  const filtered = filteredRows(userDataPath, dossierId, input);
  const rows = filtered.rows;
  const summary = {
    total: rows.length,
    analyzedRows: rows.length,
    sourceRows: filtered.sourceRows,
    duplicateRowsRemoved: filtered.duplicateRowsRemoved,
    percentages: {},
    numeric: {},
    groups: [],
    sourceTrace: sourceTrace(rows, true),
    calculationComplete: true
  };

  const dimensions = Array.isArray(input.dimensions) ? input.dimensions : [];
  dimensions.forEach((field) => {
    summary.percentages[field] = dimensionSummary(rows, field);
  });

  const measures = Array.isArray(input.measures) ? input.measures : [];
  measures.forEach((field) => {
    const stats = numericStats(rows, field);
    if (stats) summary.numeric[field] = stats;
  });

  summary.groups = groupedSummary(rows, input.groupBy, measures);
  summary.querySignature = hashObject({
    importHashes: summary.sourceTrace.map((item) => item.sha256),
    sheetNames: summary.sourceTrace.flatMap((item) => item.sheets.map((sheet) => sheet.name)),
    where: input.where || [],
    anyOf: input.anyOf || [],
    distinctBy: input.distinctBy || [],
    dimensions,
    measures,
    groupBy: input.groupBy || []
  });

  return summary;
}

function suppressDimension(items, minimum, includeCounts) {
  return (items || []).map((item) => {
    const suppressed = item.count < minimum;
    const out = {
      value: suppressed ? "Grupo protegido" : item.value,
      percentage: suppressed ? null : item.percentage,
      suppressed
    };
    if (includeCounts) out.count = suppressed ? null : item.count;
    return out;
  });
}

function suppressNumeric(item, minimum, includeCounts) {
  const suppressed = item.count < minimum;
  const out = {
    min: suppressed ? null : item.min,
    max: suppressed ? null : item.max,
    average: suppressed ? null : item.average,
    median: suppressed ? null : item.median,
    sum: suppressed ? null : item.sum,
    suppressed
  };
  if (includeCounts) out.count = suppressed ? null : item.count;
  return out;
}

function aiSlice(userDataPath, dossierId, query) {
  const input = query || {};
  const summary = summarize(userDataPath, dossierId, input);
  const privacyMinGroup = Math.max(2, Number(input.privacyMinGroup || 5));
  const includeCounts = input.includeCountsForAi === true;
  const safePercentages = {};
  Object.entries(summary.percentages || {}).forEach(([field, items]) => {
    safePercentages[field] = suppressDimension(items, privacyMinGroup, includeCounts);
  });

  const safeNumeric = {};
  Object.entries(summary.numeric || {}).forEach(([field, item]) => {
    safeNumeric[field] = suppressNumeric(item, privacyMinGroup, includeCounts);
  });

  const safeGroups = (summary.groups || []).map((group) => {
    const suppressed = group.count < privacyMinGroup;
    const out = {
      values: suppressed
        ? Object.fromEntries(Object.keys(group.values || {}).map((field) => [field, "Grupo protegido"]))
        : group.values,
      percentage: suppressed ? null : group.percentage,
      numeric: {}
    };
    Object.entries(group.numeric || {}).forEach(([field, item]) => {
      out.numeric[field] = suppressNumeric(item, privacyMinGroup, includeCounts);
    });
    if (includeCounts) out.count = suppressed ? null : group.count;
    out.suppressed = suppressed;
    return out;
  });

  const privacyMode = String(input.privacyMode || "aggregate").toLowerCase();
  const rawRowsAllowed = input.includeSampleRows === true &&
    (input.allowRawRowsForAi === true || ["individual", "student_specific"].includes(privacyMode));
  const hasExplicitSelect = Array.isArray(input.select) && input.select.length > 0;
  let sampleRows = [];
  const warnings = [];
  if (input.includeSampleRows === true && !rawRowsAllowed) {
    warnings.push("No se enviaron filas crudas a la IA porque el modo de privacidad no lo permite.");
  } else if (rawRowsAllowed && !hasExplicitSelect) {
    warnings.push("No se enviaron filas crudas a la IA porque falta una lista select explícita de campos permitidos.");
  } else if (rawRowsAllowed && hasExplicitSelect) {
    sampleRows = queryData(userDataPath, dossierId, Object.assign({}, input, {
      limit: Math.min(Math.max(1, Number(input.sampleLimit || 20)), MAX_AI_SAMPLE_ROWS),
      includeProvenance: false
    })).rows;
  }

  return {
    filters: input.where || [],
    anyOf: input.anyOf || [],
    distinctBy: input.distinctBy || [],
    querySignature: summary.querySignature,
    population: {
      calculationComplete: true,
      absoluteCountsExposed: includeCounts
    },
    summary: {
      percentages: safePercentages,
      numeric: safeNumeric,
      groups: safeGroups,
      protectedMinimumGroupSize: privacyMinGroup
    },
    sourceTrace: (summary.sourceTrace || []).map((item) => ({
      importId: item.importId,
      sourceName: item.sourceName,
      sha256: item.sha256,
      scopeType: item.scopeType,
      scopeKey: item.scopeKey,
      sheets: item.sheets
    })),
    sampleRows,
    warnings,
    note: "Las métricas fueron calculadas por la aplicación sobre todas las filas filtradas. La IA debe interpretar los agregados y no recalcularlos. Las filas crudas se omiten por defecto y los grupos pequeños están protegidos."
  };
}

module.exports = {
  MAX_UI_ROWS,
  CANONICAL_FIELD_ALIASES,
  normalizeText,
  importDataFile,
  getImport,
  listImports,
  validateMapping,
  setMapping,
  suggestMapping,
  queryData,
  summarize,
  aiSlice
};
