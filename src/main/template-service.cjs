const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const { root, copyUnique } = require("./workspace-service.cjs");
const { openDatabase, queueSync, getCatalog } = require("./database-service.cjs");
const { sha256 } = require("./file-integrity-service.cjs");
const { parseMarkersFromText, parseMarkerInner, validateMarkers, enrichMarker } = require("./template-markers.cjs");
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

function partLocation(name) {
  if (/^word\/header\d+\.xml$/.test(name)) return "Encabezado";
  if (/^word\/footer\d+\.xml$/.test(name)) return "Pie de página";
  return "Cuerpo del documento";
}

function headingLevelFromParagraph(paragraph) {
  const match = String(paragraph || "").match(/<w:pStyle\b[^>]*w:val="([^"]+)"/i);
  if (!match) return 0;
  const normalized = decodeXml(match[1])
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toUpperCase();
  const heading = normalized.match(/^(?:HEADING|TITULO)([1-6])$/);
  return heading ? Number(heading[1]) : 0;
}

function addMarkerOccurrences(text, location, context, byRaw) {
  const regex = /\{\{\s*([^{}]+?)\s*\}\}/g;
  let match;
  while ((match = regex.exec(String(text || "")))) {
    const parsed = parseMarkerInner(match[1]);
    if (!parsed || !byRaw.has(parsed.raw)) continue;
    const meta = byRaw.get(parsed.raw);
    meta.count += 1;
    meta.locations.add(location);
    if (context) meta.contexts.add(context);
  }
}

function attachMarkerLocations(parts, markers) {
  const byRaw = new Map((markers || []).map((marker) => [
    marker.raw,
    { count: 0, locations: new Set(), contexts: new Set() }
  ]));

  (parts || []).forEach((part) => {
    const location = partLocation(part.name);
    const paragraphs = part.xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];

    if (location !== "Cuerpo del documento") {
      paragraphs.forEach((paragraph) => {
        addMarkerOccurrences(plainTextFromXml(paragraph), location, location, byRaw);
      });
      return;
    }

    const headings = {};
    paragraphs.forEach((paragraph) => {
      const paragraphText = plainTextFromXml(paragraph).trim();
      const level = headingLevelFromParagraph(paragraph);
      if (level && paragraphText) {
        headings[level] = paragraphText;
        for (let deeper = level + 1; deeper <= 6; deeper += 1) delete headings[deeper];
      }

      let context = "";
      for (let candidate = 6; candidate >= 1; candidate -= 1) {
        if (headings[candidate]) {
          context = headings[candidate];
          break;
        }
      }
      addMarkerOccurrences(paragraphText, location, context || location, byRaw);
    });
  });

  (markers || []).forEach((marker) => {
    const meta = byRaw.get(marker.raw);
    marker.occurrenceCount = meta ? meta.count : 0;
    marker.locations = meta ? Array.from(meta.locations) : [];
    marker.contexts = meta ? Array.from(meta.contexts) : [];
  });
  return markers;
}

function blockLocationErrors(markers) {
  return (markers || [])
    .filter((marker) =>
      marker.valid &&
      marker.isBlock &&
      (marker.locations || []).some((location) => location !== "Cuerpo del documento")
    )
    .map((marker) =>
      `{{${marker.raw}}}: los bloques de tablas, datos, imágenes o gráficos deben estar en el cuerpo del documento; no se admiten en encabezados ni pies de página.`
    );
}

function inspectTemplate(filePath) {
  const parts = xmlParts(filePath);
  const text = parts.map((part) => plainTextFromXml(part.xml)).join("\n");
  const markers = attachMarkerLocations(parts, parseMarkersFromText(text));
  const validation = validateMarkers(markers);
  markers.filter((marker) => marker.valid && marker.type === "CALC").forEach((marker) => {
    const formula = validateFormulaSyntax(marker.formula);
    if (!formula.ok) validation.errors.push(`{{${marker.raw}}}: fórmula inválida. ${formula.error}`);
  });
  validation.errors.push(...blockLocationErrors(markers));
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
    const normalizedDocumentName = normalizeSearch(document.name);
    if (normalizedDocumentName && haystack.includes(normalizedDocumentName)) score += 30;
    normalizedDocumentName.split(" ").filter((word) => word.length >= 5)
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
    processCode: best.process.code,
    documentName: best.document.name,
    confidence: Math.min(100, Math.round(55 + best.score * 1.5 + margin * 2))
  };
}

function detectAssociationForFile(userDataPath, filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const parts = xmlParts(filePath);
  const text = parts.map((part) => plainTextFromXml(part.xml)).join("\n");
  return inferAssociation(userDataPath, path.basename(filePath), text);
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
  let markers = db.prepare("SELECT * FROM template_fields WHERE template_id = ? ORDER BY sort_order, id")
    .all(row.id)
    .map(markerFromRow);

  try {
    if (row.local_path && fs.existsSync(row.local_path)) {
      markers = attachMarkerLocations(xmlParts(row.local_path), markers);
    }
  } catch (_error) {
    // La ubicación es informativa; un fallo aquí no invalida la plantilla.
  }

  const storedValidation = parseJson(row.validation_json, { errors: [], warnings: [], ok: true });
  const liveValidation = validateMarkers(markers);
  const validation = {
    errors: Array.from(new Set([].concat(
      storedValidation.errors || [],
      liveValidation.errors || [],
      blockLocationErrors(markers)
    ))),
    warnings: Array.from(new Set([].concat(storedValidation.warnings || [], liveValidation.warnings || [])))
  };
  validation.ok = validation.errors.length === 0;

  return {
    id: row.id,
    name: row.name,
    localPath: row.local_path,
    importedAt: row.imported_at,
    active: Boolean(row.active),
    deleted: Boolean(row.deleted),
    version: row.version,
    unitId: row.unit_id || "",
    processId: row.process_id || "",
    documentId: row.document_id || "",
    confidence: row.confidence || 0,
    markers,
    fields: markers.filter((marker) => marker.valid && (marker.isUserInput || marker.type === "CALC")),
    aiFields: markers.filter((marker) => marker.valid && marker.isAi),
    systemFields: markers.filter((marker) => marker.valid && marker.isSystem),
    validation,
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
  const detected = inferAssociation(userDataPath, path.basename(stored), inspected.text);
  const inferred = association && association.documentId
    ? Object.assign({ confidence: 100 }, association)
    : detected;

  if (
    association && association.documentId &&
    detected && detected.documentId &&
    detected.documentId !== association.documentId &&
    Number(detected.confidence || 0) >= 70
  ) {
    const catalog = getCatalog(db);
    const all = allDocumentsFromCatalog(catalog);
    const selected = all.find((item) => item.document.id === association.documentId);
    const suggested = all.find((item) => item.document.id === detected.documentId);
    const selectedLabel = selected
      ? selected.process.code + " · " + selected.document.name
      : association.documentId;
    const suggestedLabel = suggested
      ? suggested.process.code + " · " + suggested.document.name
      : detected.documentId;
    inspected.validation.warnings.unshift(
      "Posible plantilla incorrecta: el contenido parece corresponder a " + suggestedLabel +
      ", pero fue cargado en " + selectedLabel + ". Verifica antes de generar."
    );
  }

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
  return db.prepare("SELECT * FROM templates WHERE COALESCE(deleted, 0) = 0 ORDER BY imported_at DESC").all().map((row) => hydrateTemplate(db, row));
}

function activeTemplateForDocument(userDataPath, documentId) {
  const db = openDatabase(userDataPath);
  const row = db.prepare("SELECT * FROM templates WHERE document_id = ? AND active = 1 AND COALESCE(deleted, 0) = 0 ORDER BY version DESC LIMIT 1").get(documentId);
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

function deleteTemplate(userDataPath, templateId) {
  const db = openDatabase(userDataPath);
  const current = db.prepare("SELECT * FROM templates WHERE id = ?").get(templateId);
  if (!current) throw new Error("No se encontró la plantilla.");

  const now = new Date().toISOString();
  db.prepare("UPDATE templates SET active = 0, deleted = 1, updated_at = ? WHERE id = ?")
    .run(now, templateId);

  queueSync(db, "template", templateId, "delete", {
    documentId: current.document_id || "",
    version: current.version
  });

  return { id: templateId, documentId: current.document_id || "", deleted: true };
}

module.exports = {
  importTemplate,
  listTemplates,
  activeTemplateForDocument,
  updateTemplate,
  deleteTemplate,
  plainTextFromXml,
  inferAssociation,
  detectAssociationForFile
};
