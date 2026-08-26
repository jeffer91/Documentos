const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

function exists(file) {
  try { return Boolean(file && fs.existsSync(file)); } catch (_error) { return false; }
}

function powershellExecutable() {
  return process.platform === "win32" ? "powershell.exe" : "";
}

function spawnProcess(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(command, args, Object.assign({
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    }, options || {}));

    let stdout = "";
    let stderr = "";
    let finished = false;
    const timeoutMs = Number(options && options.timeoutMs || 180000);

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      try { child.kill(); } catch (_error) { /* ignore */ }
      reject(new Error(`El proceso excedió ${Math.round(timeoutMs / 1000)} segundos.`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(String(stderr || stdout || `Proceso terminado con código ${code}`).trim()));
    });
  });
}

async function runWordAutomation(scriptPath, jobPath) {
  if (process.platform !== "win32") {
    throw new Error("Microsoft Word automático solo está disponible en Windows.");
  }

  await spawnProcess(
    powershellExecutable(),
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-JobPath", jobPath],
    { timeoutMs: 180000 }
  );
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
    const result = childProcess.spawnSync(command, ["--version"], {
      encoding: "utf8",
      timeout: 10000,
      windowsHide: true
    });
    return !result.error && result.status === 0;
  } catch (_error) {
    return false;
  }
}

function findLibreOffice() {
  for (const candidate of libreOfficeCandidates()) {
    if ((path.isAbsolute(candidate) && exists(candidate)) || (!path.isAbsolute(candidate) && canRun(candidate))) {
      return candidate;
    }
  }
  return "";
}

async function convertWithLibreOffice(docxPath, pdfPath) {
  const soffice = findLibreOffice();
  if (!soffice) {
    throw new Error("No se encontró Microsoft Word ni LibreOffice para convertir el documento a PDF.");
  }

  const outDir = path.dirname(pdfPath);
  await spawnProcess(
    soffice,
    ["--headless", "--convert-to", "pdf", "--outdir", outDir, docxPath],
    { timeoutMs: 180000 }
  );

  const produced = path.join(outDir, `${path.basename(docxPath, path.extname(docxPath))}.pdf`);
  if (!exists(produced)) throw new Error("LibreOffice terminó, pero no generó el PDF esperado.");

  if (produced !== pdfPath) {
    if (exists(pdfPath)) fs.unlinkSync(pdfPath);
    fs.renameSync(produced, pdfPath);
  }

  return pdfPath;
}

async function exportPdf(options) {
  const config = options || {};
  const hasBlocks = Array.isArray(config.blocks) && config.blocks.length > 0;

  if (process.platform === "win32") {
    try {
      await runWordAutomation(config.scriptPath, config.jobPath);
      if (!exists(config.pdfPath)) throw new Error("Microsoft Word no generó el PDF esperado.");
      return { pdfPath: config.pdfPath, docxPath: config.outputDocx, engine: "Microsoft Word" };
    } catch (wordError) {
      if (hasBlocks) {
        throw new Error(`No se pudo completar la plantilla con tablas/imágenes. Microsoft Word es necesario para estos bloques. Detalle: ${wordError.message}`);
      }

      fs.copyFileSync(config.inputDocx, config.outputDocx);
      return {
        pdfPath: await convertWithLibreOffice(config.outputDocx, config.pdfPath),
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
    pdfPath: await convertWithLibreOffice(config.outputDocx, config.pdfPath),
    docxPath: config.outputDocx,
    engine: "LibreOffice"
  };
}

module.exports = {
  exportPdf,
  findLibreOffice
};
