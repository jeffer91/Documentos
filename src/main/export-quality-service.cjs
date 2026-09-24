const fs = require("fs");
const path = require("path");

const SUPPORTED_FORMATS = Object.freeze(["html", "docx", "pdf"]);

function normalizeFormats(formats) {
  const input = Array.isArray(formats) && formats.length ? formats : ["docx", "pdf"];
  const normalized = Array.from(new Set(input.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)));
  const invalid = normalized.filter((item) => !SUPPORTED_FORMATS.includes(item));
  if (invalid.length) throw new Error(`Formato(s) de exportación no soportado(s): ${invalid.join(", ")}.`);
  return normalized;
}

function readHead(filePath, length) {
  if (!filePath || !fs.existsSync(filePath)) return Buffer.alloc(0);
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(Math.max(1, Number(length || 16)));
    const read = fs.readSync(fd, buffer, 0, buffer.length, 0);
    return buffer.subarray(0, read);
  } finally {
    fs.closeSync(fd);
  }
}

function inspectFile(type, filePath) {
  const exists = Boolean(filePath && fs.existsSync(filePath));
  const size = exists ? Number(fs.statSync(filePath).size || 0) : 0;
  let signatureOk = false;
  let reason = "";

  if (!exists) {
    reason = "Archivo no generado.";
  } else if (size <= 0) {
    reason = "Archivo vacío.";
  } else if (type === "html") {
    const head = readHead(filePath, 256).toString("utf8").toLowerCase();
    signatureOk = head.includes("<!doctype html") || head.includes("<html");
    if (!signatureOk) reason = "El archivo no parece HTML válido.";
  } else if (type === "pdf") {
    signatureOk = readHead(filePath, 5).toString("ascii") === "%PDF-";
    if (!signatureOk) reason = "El archivo no tiene firma PDF válida.";
  } else if (type === "docx") {
    const head = readHead(filePath, 4);
    signatureOk = head.length >= 2 && head[0] === 0x50 && head[1] === 0x4b;
    if (!signatureOk) reason = "El archivo no tiene firma DOCX/ZIP válida.";
  }

  const healthy = exists && size > 0 && signatureOk;
  return { type, path: filePath || "", exists, size, signatureOk, healthy, reason };
}

function candidatePath(base, type, htmlPath) {
  if (type === "html") return htmlPath;
  if (type === "docx") return `${base}.docx`;
  if (type === "pdf") return `${base}.pdf`;
  return "";
}

function assessOutputs(base, htmlPath, requestedFormats) {
  const requested = normalizeFormats(requestedFormats);
  const inspected = SUPPORTED_FORMATS.map((type) => inspectFile(type, candidatePath(base, type, htmlPath)));
  const byType = new Map(inspected.map((item) => [item.type, item]));
  const requestedStatus = requested.map((type) => byType.get(type));
  const missingFormats = requestedStatus.filter((item) => !item || !item.healthy).map((item) => item ? item.type : "");
  const generatedFormats = requestedStatus.filter((item) => item && item.healthy).map((item) => item.type);
  const html = byType.get("html");
  return {
    requestedFormats: requested,
    generatedFormats,
    missingFormats,
    complete: missingFormats.length === 0,
    htmlHealthy: Boolean(html && html.healthy),
    files: inspected
  };
}

function writeManifest(manifestPath, payload) {
  const target = path.resolve(manifestPath);
  fs.writeFileSync(target, JSON.stringify(payload || {}, null, 2), "utf8");
  return target;
}

module.exports = {
  SUPPORTED_FORMATS,
  normalizeFormats,
  inspectFile,
  assessOutputs,
  writeManifest
};
