const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { workspaceRoot } = require("./database-service.cjs");
const { sha256 } = require("./file-integrity-service.cjs");
const hub = require("./process-hub-service.cjs");

function id(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function now() {
  return new Date().toISOString();
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
    const values = rows.slice(0, 500).map((row) => row[header]);
    const nonEmpty = values.filter((value) => value !== "" && value != null);
    const distinct = new Set(nonEmpty.map((value) => String(value))).size;
    return {
      name: header,
      type: inferType(values),
      nonEmpty: nonEmpty.length,
      distinct,
      examples: Array.from(new Set(nonEmpty.slice(0, 8).map((value) => String(value)))).slice(0, 5)
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

  const importId = id("import");
  const dir = path.join(workspaceRoot(userDataPath), "dossiers", dossierId, "imports", importId);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, path.basename(sourcePath));
  fs.copyFileSync(sourcePath, target);
  const hash = sha256(target);
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
    String(scope && scope.type || "dossier"),
    String(scope && scope.key || ""),
    path.basename(sourcePath),
    target,
    hash,
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
    detail: { sourceName: path.basename(sourcePath), sha256: hash, sheets: profiles }
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

function setMapping(userDataPath, importId, mapping) {
  const db = hub.dbFor(userDataPath);
  const current = getImport(userDataPath, importId);
  if (!current) throw new Error("Importación no válida.");
  const ts = now();
  db.prepare("UPDATE data_imports_v3 SET mapping_json = ?, updated_at = ? WHERE id = ?")
    .run(JSON.stringify(mapping || {}), ts, importId);
  hub.audit(db, {
    dossierId: current.dossierId,
    entityType: "data_import",
    entityId: importId,
    action: "map",
    detail: { mapping: mapping || {} }
  });
  hub.markDossierStale(userDataPath, current.dossierId, `Cambió el mapeo de datos: ${current.sourceName}`);
  return getImport(userDataPath, importId);
}

function allRows(userDataPath, dossierId, options) {
  const db = hub.dbFor(userDataPath);
  const imports = options && Array.isArray(options.importIds) && options.importIds.length
    ? options.importIds
    : db.prepare("SELECT id FROM data_imports_v3 WHERE dossier_id = ? AND status = 'ready'").all(dossierId).map((row) => row.id);
  const rows = [];
  imports.forEach((importId) => {
    const sheets = db.prepare("SELECT * FROM data_sheets_v3 WHERE import_id = ? ORDER BY created_at").all(importId);
    sheets.forEach((sheet) => {
      if (options && options.sheet && String(options.sheet) !== String(sheet.sheet_name)) return;
      const parsedRows = JSON.parse(sheet.rows_json || "[]");
      parsedRows.forEach((row, index) => rows.push(Object.assign({
        __importId: importId,
        __sheet: sheet.sheet_name,
        __row: index + 2
      }, row)));
    });
  });
  return rows;
}

function compare(value, operator, expected) {
  const op = String(operator || "eq").toLowerCase();
  if (op === "exists") return value !== "" && value != null;
  if (op === "empty") return value === "" || value == null;
  if (op === "contains") return String(value || "").toLowerCase().includes(String(expected || "").toLowerCase());
  if (op === "in") {
    const set = Array.isArray(expected) ? expected : String(expected || "").split(",").map((item) => item.trim());
    return set.map(String).includes(String(value));
  }
  const leftNumber = Number(value);
  const rightNumber = Number(expected);
  if (["gt", "gte", "lt", "lte"].includes(op) && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    if (op === "gt") return leftNumber > rightNumber;
    if (op === "gte") return leftNumber >= rightNumber;
    if (op === "lt") return leftNumber < rightNumber;
    return leftNumber <= rightNumber;
  }
  if (op === "neq") return String(value) !== String(expected);
  return String(value) === String(expected);
}

function queryData(userDataPath, dossierId, query) {
  const input = query || {};
  let rows = allRows(userDataPath, dossierId, input);
  (input.where || []).forEach((condition) => {
    rows = rows.filter((row) => compare(row[condition.field], condition.op, condition.value));
  });
  const total = rows.length;
  if (Array.isArray(input.select) && input.select.length) {
    rows = rows.map((row) => {
      const next = {};
      input.select.forEach((field) => { next[field] = row[field]; });
      return next;
    });
  }
  const limit = Math.max(1, Math.min(Number(input.limit || 500), 5000));
  return { total, rows: rows.slice(0, limit), truncated: total > limit };
}

function summarize(userDataPath, dossierId, query) {
  const result = queryData(userDataPath, dossierId, Object.assign({}, query || {}, { limit: 5000 }));
  const rows = result.rows;
  const summary = {
    total: result.total,
    filteredRows: rows.length,
    percentages: {},
    numeric: {}
  };
  const dimensions = query && Array.isArray(query.dimensions) ? query.dimensions : [];
  dimensions.forEach((field) => {
    const counts = {};
    rows.forEach((row) => {
      const key = String(row[field] == null || row[field] === "" ? "Sin dato" : row[field]);
      counts[key] = (counts[key] || 0) + 1;
    });
    summary.percentages[field] = Object.keys(counts).sort().map((key) => ({
      value: key,
      count: counts[key],
      percentage: rows.length ? Number(((counts[key] / rows.length) * 100).toFixed(2)) : 0
    }));
  });
  const measures = query && Array.isArray(query.measures) ? query.measures : [];
  measures.forEach((field) => {
    const values = rows.map((row) => Number(row[field])).filter(Number.isFinite);
    if (!values.length) return;
    summary.numeric[field] = {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      average: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4))
    };
  });
  return summary;
}

function aiSlice(userDataPath, dossierId, query) {
  const input = query || {};
  const summary = summarize(userDataPath, dossierId, input);
  const privacyMinGroup = Math.max(2, Number(input.privacyMinGroup || 5));
  const safePercentages = {};
  Object.entries(summary.percentages || {}).forEach(([field, items]) => {
    safePercentages[field] = (items || []).map((item) => ({
      value: item.count < privacyMinGroup ? "Grupo protegido" : item.value,
      percentage: item.count < privacyMinGroup ? null : item.percentage,
      suppressed: item.count < privacyMinGroup
    }));
  });
  const safeNumeric = {};
  Object.entries(summary.numeric || {}).forEach(([field, item]) => {
    safeNumeric[field] = {
      min: item.count < privacyMinGroup ? null : item.min,
      max: item.count < privacyMinGroup ? null : item.max,
      average: item.count < privacyMinGroup ? null : item.average,
      suppressed: item.count < privacyMinGroup
    };
  });
  const sample = input.includeSampleRows === true
    ? queryData(userDataPath, dossierId, Object.assign({}, input, { limit: Math.min(Number(input.sampleLimit || 20), 50) }))
    : { rows: [] };
  return {
    filters: input.where || [],
    summary: {
      percentages: safePercentages,
      numeric: safeNumeric,
      protectedMinimumGroupSize: privacyMinGroup
    },
    sampleRows: sample.rows,
    note: "Las métricas fueron calculadas por la aplicación. La IA debe interpretarlas, no recalcularlas. Los grupos pequeños están protegidos."
  };
}

module.exports = {
  importDataFile,
  getImport,
  listImports,
  setMapping,
  queryData,
  summarize,
  aiSlice
};
