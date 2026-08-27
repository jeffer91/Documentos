const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const { root, copyUnique } = require("./workspace-service.cjs");
const { openDatabase, queueSync, getCatalog } = require("./database-service.cjs");
const { sha256 } = require("./file-integrity-service.cjs");
const { parseMarkersFromText, validateMarkers, enrichMarker } = require("./template-markers.cjs");
const { validateFormulaSyntax } = require("./calculation-service.cjs");

const BLOCK_TYPES = new Set(["DATOS", "TABLA", "IMAGEN", "IMAGENES", "GRAFICO", "GRAFICOS"]);
const USER_TYPES = new Set(["CAMPO", "TEXTO", "FECHA", "NUMERO", "LISTA", "BUSCAR", "DATOS", "TABLA", "IMAGEN", "IMAGENES"]);

function templatesDir(userDataPath) {
  const dir = path.join(root(userDataPath), "templates");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function xmlParts(filePath) {
  const zip = new PizZip(fs.readFileSync(filePath));
  return Object.keys(zip.files)
    .filter((name) => /^word\/(document|header\d+|footer\d+)\.xml$/.test(name))
    .map((name) => ({ name, xml: zip.file(name).asText() }));
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function plainTextFromXml(xml) {
  return decodeXml(String(xml || "")
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function inspectTemplate(filePath) {
  const parts = xmlParts(filePath);
  const text = parts.map((part) => plainTextFromXml(part.xml)).join("\n");
  const markers = parseMarkersFromText(text);
  const validation = validateMarkers(markers);
  markers.filter((marker) => marker.valid && marker.type === "CALC").forEach((marker) => {
    const formula = validateFormulaSyntax(marker.formula);
    if (!formula.ok) validation.errors.push(`{{${marker.raw}}}: fórmula inválida. ${formula.error}`);
  });
  validation.ok = validation.errors.length === 0;
  validation.warnings.push(...findStandaloneBlockWarnings(parts, markers));
  return { parts, text, markers, validation };
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function staticCodeParts(code) {
  return String(code || "")
    .toUpperCase()
    .split("-")
    .filter((part) => part && !["0X", "XX", "AÑO", "MES", "20XX"].includes(part));
}

function allDocumentsFromCatalog(catalog) {
  return (catalog.units || []).flatMap((unit) =>
    (unit.processes || []).flatMap((process) =>
      (process.documents || []).map((document) => ({ unit, process, document }))
    )
  );
}

function inferAssociation(userDataPath, fileName, text) {
  const db = openDatabase(userDataPath);
  const catalog = getCatalog(db);
  const haystack = normalizeSearch(`${fileName} ${text.slice(0, 12000)}`);
  const ranked = allDocumentsFromCatalog(catalog).map(({ unit, process, document }) => {
    let score = 0;
    normalizeSearch(document.name).split(" ").filter((word) => word.length >= 5)
      .forEach((word) => { if (haystack.includes(word)) score += 2; });

    staticCodeParts(document.code).forEach((part) => {
      const token = normalizeSearch(part);
      if (token && haystack.includes(token)) score += token.length >= 4 ? 4 : 1;
    });

    if (haystack.includes(normalizeSearch(process.code))) score += 12;
    if (haystack.includes(unit.id)) score += 3;
    return { unit, process, document, score };
  }).sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const second = ranked[1];
  const margin = best && second ? best.score - second.score : best ? best.score : 0;
  if (!best || best.score < 18 || (second && margin < 5)) return null;

  return {
    unitId: best.unit.id,
    processId: best.process.id,
    documentId: best.document.id,
    confidence: Math.min(100, Math.round(55 + best.score * 1.5 + margin * 2))
  };
}

function findStandaloneBlockWarnings(parts, markers) {
  const warnings = [];
  markers.filter((marker) => marker.valid && marker.isBlock).forEach((marker) => {
    const literal = `{{${marker.raw}}}`;
    const found = parts.some((part) => {
      const paragraphs = part.xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
      return paragraphs.some((paragraph) => plainTextFromXml(paragraph).trim() === literal);
    });
    if (!found) warnings.push(`${literal}: colócalo solo en su propio párrafo para insertar tablas, gráficos o imágenes.`);
  });
  return warnings;
}

function parseJson(value, fallback) {
  if (value == null || value === "") return fallback;
  try { return JSON.parse(value); } catch (_error) { return fallback; }
}

function markerFromRow(row) {
  return enrichMarker({
    raw: row.raw,
    token: row.raw,
    valid: Boolean(row.valid),
    type: row.type,
    name: row.name,
    label: row.label || row.name,
    required: Boolean(row.required),
    config: row.config || "",
    columns: parseJson(row.columns_json, [])
  });
}

function hydrateTemplate(db, row) {
  if (!row) return null;
  const markers = db.prepare("SELECT * FROM template_fields WHERE template_id = ? ORDER BY sort_order, id")
    .all(row.id)
    .map(markerFromRow);

  return {
    id: row.id,
    name: row.name,
    localPath: row.local_path,
    importedAt: row.imported_at,
    active: Boolean(row.active),
    version: row.version,
    unitId: row.unit_id || "",
    processId: row.process_id || "",
    documentId: row.document_id || "",
    confidence: row.confidence || 0,
    markers,
    fields: markers.filter((marker) => marker.valid && (marker.isUserInput || marker.type === "CALC")),
    aiFields: markers.filter((marker) => marker.valid && marker.isAi),
    systemFields: markers.filter((marker) => marker.valid && marker.isSystem),
    validation: parseJson(row.validation_json, { errors: [], warnings: [], ok: true }),
    sha256: row.sha256 || ""
  };
}

function versionFor(db, documentId) {
  if (!documentId) return 1;
  const row = db.prepare("SELECT MAX(version) AS max_version FROM templates WHERE document_id = ?").get(documentId);
  return Number(row && row.max_version || 0) + 1;
}

function saveMarkers(db, templateId, markers) {
  db.prepare("DELETE FROM template_fields WHERE template_id = ?").run(templateId);
  const insert = db.prepare(`
    INSERT INTO template_fields
      (template_id, type, name, label, required, config, columns_json, raw, valid, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  (markers || []).forEach((marker, index) => {
    insert.run(
      templateId,
      marker.type,
      marker.name,
      marker.label || marker.name,
      marker.required ? 1 : 0,
      marker.config || "",
      JSON.stringify(marker.columns || []),
      marker.raw,
      marker.valid === false ? 0 : 1,
      index
    );
  });
}

function importTemplate(userDataPath, sourcePath, association) {
  if (!sourcePath || path.extname(sourcePath).toLowerCase() !== ".docx") {
    throw new Error("La plantilla debe ser un archivo Word .docx.");
  }

  const db = openDatabase(userDataPath);
  const stored = copyUnique(sourcePath, templatesDir(userDataPath));
  const inspected = inspectTemplate(stored);
  const inferred = association && association.documentId
    ? Object.assign({ confidence: 100 }, association)
    : inferAssociation(userDataPath, path.basename(stored), inspected.text);

  const documentId = inferred && inferred.documentId ? inferred.documentId : null;
  const unitId = inferred && inferred.unitId ? inferred.unitId : null;
  const processId = inferred && inferred.processId ? inferred.processId : null;
  const version = versionFor(db, documentId);
  const id = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    if (documentId) db.prepare("UPDATE templates SET active = 0, updated_at = ? WHERE document_id = ?").run(now, documentId);

    db.prepare(`
      INSERT INTO templates
        (id, document_id, unit_id, process_id, name, version, local_path, active, confidence, imported_at, validation_json, sha256, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
    `).run(
      id,
      documentId,
      unitId,
      processId,
      path.basename(stored),
      version,
      stored,
      inferred && inferred.confidence ? inferred.confidence : 0,
      now,
      JSON.stringify(inspected.validation),
      sha256(stored),
      now
    );

    saveMarkers(db, id, inspected.markers);
  });

  tx();
  queueSync(db, "template", id, "create", { documentId, version, name: path.basename(stored) });
  return hydrateTemplate(db, db.prepare("SELECT * FROM templates WHERE id = ?").get(id));
}

function listTemplates(userDataPath) {
  const db = openDatabase(userDataPath);
  return db.prepare("SELECT * FROM templates ORDER BY imported_at DESC").all().map((row) => hydrateTemplate(db, row));
}

function activeTemplateForDocument(userDataPath, documentId) {
  const db = openDatabase(userDataPath);
  const row = db.prepare("SELECT * FROM templates WHERE document_id = ? AND active = 1 ORDER BY version DESC LIMIT 1").get(documentId);
  return hydrateTemplate(db, row);
}

function updateTemplate(userDataPath, templateId, patch) {
  const db = openDatabase(userDataPath);
  const current = db.prepare("SELECT * FROM templates WHERE id = ?").get(templateId);
  if (!current) throw new Error("No se encontró la plantilla.");

  const nextDocumentId = patch && Object.prototype.hasOwnProperty.call(patch, "documentId")
    ? (patch.documentId || null)
    : current.document_id;
  const nextUnitId = patch && Object.prototype.hasOwnProperty.call(patch, "unitId")
    ? (patch.unitId || null)
    : current.unit_id;
  const nextProcessId = patch && Object.prototype.hasOwnProperty.call(patch, "processId")
    ? (patch.processId || null)
    : current.process_id;
  const nextActive = patch && Object.prototype.hasOwnProperty.call(patch, "active")
    ? Boolean(patch.active)
    : Boolean(current.active);
  let nextVersion = current.version;

  if (nextDocumentId && nextDocumentId !== current.document_id) {
    nextVersion = versionFor(db, nextDocumentId);
  }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    if (nextActive && nextDocumentId) {
      db.prepare("UPDATE templates SET active = 0, updated_at = ? WHERE document_id = ? AND id <> ?")
        .run(now, nextDocumentId, templateId);
    }

    db.prepare(`
      UPDATE templates SET
        document_id = ?, unit_id = ?, process_id = ?, active = ?, version = ?, confidence = ?, updated_at = ?
      WHERE id = ?
    `).run(
      nextDocumentId,
      nextUnitId,
      nextProcessId,
      nextActive ? 1 : 0,
      nextVersion,
      patch && patch.documentId ? 100 : current.confidence,
      now,
      templateId
    );
  });

  tx();
  queueSync(db, "template", templateId, "update", {
    documentId: nextDocumentId,
    active: nextActive,
    version: nextVersion
  });

  return hydrateTemplate(db, db.prepare("SELECT * FROM templates WHERE id = ?").get(templateId));
}

module.exports = {
  importTemplate,
  listTemplates,
  activeTemplateForDocument,
  updateTemplate,
  plainTextFromXml,
  inferAssociation
};
