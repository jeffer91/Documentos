const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const catalog = require("../renderer/catalog.js");
const { root, copyUnique } = require("./workspace-service.cjs");
const { parseMarkersFromText, validateMarkers } = require("./template-markers.cjs");

const INDEX = "templates.json";

function templatesDir(userDataPath) {
  const dir = path.join(root(userDataPath), "templates");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function indexPath(userDataPath) {
  return path.join(templatesDir(userDataPath), INDEX);
}

function readIndex(userDataPath) {
  const file = indexPath(userDataPath);
  if (!fs.existsSync(file)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch (_error) {
    return [];
  }
}

function saveIndex(userDataPath, items) {
  fs.writeFileSync(indexPath(userDataPath), JSON.stringify(items, null, 2), "utf8");
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

function plainText(filePath) {
  return xmlParts(filePath).map((part) => plainTextFromXml(part.xml)).join("\n");
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

function inferAssociation(fileName, text) {
  const haystack = normalizeSearch(`${fileName} ${text.slice(0, 12000)}`);
  const ranked = catalog.allDocuments().map(({ unit, process, document }) => {
    let score = 0;
    const nameWords = normalizeSearch(document.name).split(" ").filter((word) => word.length >= 5);
    nameWords.forEach((word) => { if (haystack.includes(word)) score += 2; });
    staticCodeParts(document.code).forEach((part) => {
      const token = normalizeSearch(part);
      if (token && haystack.includes(token)) score += token.length >= 4 ? 4 : 1;
    });
    if (haystack.includes(normalizeSearch(process.code))) score += 12;
    if (haystack.includes(unit.id)) score += 3;
    return { unit, process, document, score };
  }).sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < 10) return null;
  return {
    unitId: best.unit.id,
    processId: best.process.id,
    documentId: best.document.id,
    confidence: Math.min(100, Math.round(best.score * 4))
  };
}

function findStandaloneBlockWarnings(parts, markers) {
  const warnings = [];
  markers.filter((marker) => marker.valid && marker.isBlock).forEach((marker) => {
    const literal = `{{${marker.raw}}}`;
    const found = parts.some((part) => {
      const paragraphs = part.xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
      return paragraphs.some((paragraph) => {
        const text = plainTextFromXml(paragraph).trim();
        return text === literal;
      });
    });
    if (!found) warnings.push(`${literal}: pon este marcador solo en su propio párrafo para insertar tablas o imágenes.`);
  });
  return warnings;
}

function versionFor(items, documentId) {
  const versions = items.filter((item) => item.documentId === documentId).map((item) => Number(item.version || 0)).filter(Number.isFinite);
  return versions.length ? Math.max(...versions) + 1 : 1;
}

function importTemplate(userDataPath, sourcePath, association) {
  if (!sourcePath || path.extname(sourcePath).toLowerCase() !== ".docx") {
    throw new Error("La plantilla debe ser un archivo Word .docx.");
  }

  const stored = copyUnique(sourcePath, templatesDir(userDataPath));
  const parts = xmlParts(stored);
  const text = parts.map((part) => plainTextFromXml(part.xml)).join("\n");
  const markers = parseMarkersFromText(text);
  const validation = validateMarkers(markers);
  validation.warnings.push(...findStandaloneBlockWarnings(parts, markers));

  const inferred = association && association.documentId ? association : inferAssociation(path.basename(stored), text);
  const items = readIndex(userDataPath);
  const documentId = inferred && inferred.documentId ? inferred.documentId : "";
  const version = versionFor(items, documentId || `unassigned:${path.basename(stored)}`);

  if (documentId) {
    items.forEach((item) => {
      if (item.documentId === documentId) item.active = false;
    });
  }

  const item = {
    id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: path.basename(stored),
    localPath: stored,
    importedAt: new Date().toISOString(),
    active: true,
    version,
    unitId: inferred && inferred.unitId ? inferred.unitId : "",
    processId: inferred && inferred.processId ? inferred.processId : "",
    documentId,
    confidence: inferred && inferred.confidence ? inferred.confidence : (association && association.documentId ? 100 : 0),
    markers,
    fields: markers.filter((marker) => marker.valid && marker.isUserInput),
    aiFields: markers.filter((marker) => marker.valid && marker.isAi),
    systemFields: markers.filter((marker) => marker.valid && marker.isSystem),
    validation
  };

  items.unshift(item);
  saveIndex(userDataPath, items.slice(0, 200));
  return item;
}

function listTemplates(userDataPath) {
  return readIndex(userDataPath).filter((item) => item.localPath && fs.existsSync(item.localPath));
}

function activeTemplateForDocument(userDataPath, documentId) {
  return listTemplates(userDataPath).find((item) => item.documentId === documentId && item.active) || null;
}

function updateTemplate(userDataPath, templateId, patch) {
  const items = readIndex(userDataPath);
  const item = items.find((entry) => entry.id === templateId);
  if (!item) throw new Error("No se encontró la plantilla.");

  if (patch && patch.documentId && patch.documentId !== item.documentId) {
    items.forEach((entry) => {
      if (entry.documentId === patch.documentId) entry.active = false;
    });
  }

  ["unitId", "processId", "documentId", "active"].forEach((key) => {
    if (patch && Object.prototype.hasOwnProperty.call(patch, key)) item[key] = patch[key];
  });

  if (item.active && item.documentId) {
    items.forEach((entry) => {
      if (entry.id !== item.id && entry.documentId === item.documentId) entry.active = false;
    });
  }

  saveIndex(userDataPath, items);
  return item;
}

module.exports = {
  importTemplate,
  listTemplates,
  activeTemplateForDocument,
  updateTemplate,
  plainText,
  plainTextFromXml,
  inferAssociation
};
