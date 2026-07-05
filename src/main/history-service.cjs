/* =========================================================
Archivo: history-service.cjs
Ruta: /src/main/history-service.cjs
Funciones principales:
- Guardar historial local de documentos generados.
- Leer los últimos documentos generados.
- Mantener el historial en una carpeta segura de Electron.
========================================================= */

const fs = require("fs");
const path = require("path");

const HISTORY_FILE = "generated-documents-history.json";
const MAX_ITEMS = 50;

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getHistoryPath(userDataPath) {
  ensureDir(userDataPath);
  return path.join(userDataPath, HISTORY_FILE);
}

function readHistory(userDataPath) {
  const filePath = getHistoryPath(userDataPath);

  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function writeHistory(userDataPath, items) {
  const filePath = getHistoryPath(userDataPath);
  fs.writeFileSync(filePath, JSON.stringify(items.slice(0, MAX_ITEMS), null, 2), "utf8");
}

function addHistoryItem(userDataPath, data) {
  const current = readHistory(userDataPath);
  const item = {
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    typeKey: data.typeKey || "",
    typeLabel: data.typeLabel || "",
    title: data.title || "",
    code: data.code || "",
    outputType: data.outputType || "docx",
    filePath: data.filePath || ""
  };

  const next = [item].concat(current).slice(0, MAX_ITEMS);
  writeHistory(userDataPath, next);
  return item;
}

module.exports = {
  addHistoryItem,
  readHistory
};
