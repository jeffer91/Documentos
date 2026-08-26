const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

function exists(file) {
  try { return Boolean(file && fs.existsSync(file)); } catch (_error) { return false; }
}

function powershellExecutable() {
  return process.platform === "win32" ? "powershell.exe" : "";
}

function runWordAutomation(scriptPath, jobPath) {
  if (process.platform !== "win32") throw new Error("Microsoft Word automático solo está disponible en Windows.");
  const result = childProcess.spawnSync(
    powershellExecutable(),
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-JobPath", jobPath],
    { encoding: "utf8", windowsHide: true, timeout: 180000 }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(String(result.stderr || result.stdout || "No se pudo exportar con Microsoft Word.").trim());
  }
  return true;
}

function libreOfficeCandidates() {
  if (process.platform === "win32") {
    return [
      "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
      "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe"
    ];
  }
  if (process.platform === "darwin") {
    return ["/Applications/LibreOffice.app/Contents/MacOS/soffice"];
  }
  return ["/usr/bin/soffice", "/usr/local/bin/soffice", "soffice"];
}

function canRun(command) {
  try {
    const result = childProcess.spawnSync(command, ["--version"], { encoding: "utf8", timeout: 10000, windowsHide: true });
    return !result.error && result.status === 0;
  } catch (_error) {
    return false;
  }
}

function findLibreOffice() {
  for (const candidate of libreOfficeCandidates()) {
    if ((path.isAbsolute(candidate) && exists(candidate)) || (!path.isAbsolute(candidate) && canRun(candidate))) return candidate;
  }
  return "";
}

function convertWithLibreOffice(docxPath, pdfPath) {
  const soffice = findLibreOffice();
  if (!soffice) throw new Error("No se encontró Microsoft Word ni LibreOffice para convertir el documento a PDF.");
  const outDir = path.dirname(pdfPath);
  const result = childProcess.spawnSync(
    soffice,
    ["--headless", "--convert-to", "pdf", "--outdir", outDir, docxPath],
    { encoding: "utf8", timeout: 180000, windowsHide: true }
  );
  if (result.error || result.status !== 0) {
    throw new Error(String(result.stderr || result.stdout || result.error || "LibreOffice no pudo generar el PDF.").trim());
  }
  const produced = path.join(outDir, `${path.basename(docxPath, path.extname(docxPath))}.pdf`);
  if (!exists(produced)) throw new Error("LibreOffice terminó, pero no generó el PDF esperado.");
  if (produced !== pdfPath) {
    if (exists(pdfPath)) fs.unlinkSync(pdfPath);
    fs.renameSync(produced, pdfPath);
  }
  return pdfPath;
}

function exportPdf(options) {
  const config = options || {};
  const hasBlocks = Array.isArray(config.blocks) && config.blocks.length > 0;

  if (process.platform === "win32") {
    try {
      runWordAutomation(config.scriptPath, config.jobPath);
      if (!exists(config.pdfPath)) throw new Error("Microsoft Word no generó el PDF esperado.");
      return { pdfPath: config.pdfPath, docxPath: config.outputDocx, engine: "Microsoft Word" };
    } catch (wordError) {
      if (hasBlocks) {
        throw new Error(`No se pudo completar la plantilla con tablas/imágenes. Microsoft Word es necesario para estos bloques. Detalle: ${wordError.message}`);
      }
      fs.copyFileSync(config.inputDocx, config.outputDocx);
      return {
        pdfPath: convertWithLibreOffice(config.outputDocx, config.pdfPath),
        docxPath: config.outputDocx,
        engine: "LibreOffice"
      };
    }
  }

  if (hasBlocks) {
    throw new Error("Las plantillas con tablas, gráficos o imágenes requieren Microsoft Word en Windows en esta versión.");
  }
  fs.copyFileSync(config.inputDocx, config.outputDocx);
  return {
    pdfPath: convertWithLibreOffice(config.outputDocx, config.pdfPath),
    docxPath: config.outputDocx,
    engine: "LibreOffice"
  };
}

module.exports = {
  exportPdf,
  findLibreOffice
};
