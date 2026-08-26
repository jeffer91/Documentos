const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const { root, copyUnique } = require("./workspace-service.cjs");

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

function docxXml(filePath) {
  const zip = new PizZip(fs.readFileSync(filePath));
  const entry = zip.file("word/document.xml");
  return entry ? entry.asText() : "";
}

function plainTextFromXml(xml) {
  return String(xml || "")
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .trim();
}

function detectTokens(filePath) {
  const text = plainTextFromXml(docxXml(filePath));
  const found = new Set();
  const regex = /\{\{\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_.-]+)\s*\}\}/g;
  let match;
  while ((match = regex.exec(text))) found.add(match[1]);
  return Array.from(found).sort();
}

function importTemplate(userDataPath, sourcePath) {
  if (!sourcePath || path.extname(sourcePath).toLowerCase() !== ".docx") {
    throw new Error("La plantilla debe ser un archivo Word .docx.");
  }
  const stored = copyUnique(sourcePath, templatesDir(userDataPath));
  const item = {
    id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: path.basename(stored),
    localPath: stored,
    tokens: detectTokens(stored),
    importedAt: new Date().toISOString()
  };
  const items = [item].concat(readIndex(userDataPath)).slice(0, 100);
  saveIndex(userDataPath, items);
  return item;
}

function listTemplates(userDataPath) {
  return readIndex(userDataPath).filter((item) => item.localPath && fs.existsSync(item.localPath));
}

function normalizeValue(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join("\n");
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function fillTemplate(templatePath, values, outputPath) {
  const zip = new PizZip(fs.readFileSync(templatePath));
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" }
  });
  const data = {};
  Object.keys(values || {}).forEach((key) => { data[key] = normalizeValue(values[key]); });
  doc.render(data);
  fs.writeFileSync(outputPath, doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }));
  return outputPath;
}

module.exports = {
  importTemplate,
  listTemplates,
  detectTokens,
  fillTemplate,
  plainTextFromXml,
  docxXml
};
