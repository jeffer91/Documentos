/* =========================================================
Archivo: check-project.cjs
Ruta: /scripts/check-project.cjs
Funciones principales:
- Revisar que existan los archivos principales de la app.
- Revisar que los archivos no superen el límite recomendado de 700 líneas.
- Mostrar un diagnóstico simple en consola.
========================================================= */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MAX_LINES = 700;

const REQUIRED_FILES = [
  "package.json",
  "main.cjs",
  "preload.cjs",
  "index.html",
  "src/main/document-rules.cjs",
  "src/main/document-generator.cjs",
  "src/main/pdf-generator.cjs",
  "src/main/history-service.cjs",
  "src/main/settings-service.cjs",
  "src/renderer/app.js"
];

function countLines(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return content.split(/\r?\n/).length;
}

function checkRequiredFiles() {
  const missing = [];

  REQUIRED_FILES.forEach(function (relativePath) {
    const absolutePath = path.join(ROOT, relativePath);
    if (!fs.existsSync(absolutePath)) {
      missing.push(relativePath);
    }
  });

  return missing;
}

function checkFileSizes() {
  const tooLarge = [];

  REQUIRED_FILES.forEach(function (relativePath) {
    const absolutePath = path.join(ROOT, relativePath);
    if (!fs.existsSync(absolutePath)) return;

    const lines = countLines(absolutePath);
    if (lines > MAX_LINES) {
      tooLarge.push({ path: relativePath, lines: lines });
    }
  });

  return tooLarge;
}

function runCheck() {
  const missing = checkRequiredFiles();
  const tooLarge = checkFileSizes();

  console.log("Diagnóstico del proyecto Documentos");
  console.log("-----------------------------------");

  if (missing.length === 0) {
    console.log("OK: Archivos principales completos.");
  } else {
    console.log("ERROR: Faltan archivos principales:");
    missing.forEach(function (file) {
      console.log("- " + file);
    });
  }

  if (tooLarge.length === 0) {
    console.log("OK: Ningún archivo principal supera " + MAX_LINES + " líneas.");
  } else {
    console.log("AVISO: Archivos demasiado grandes:");
    tooLarge.forEach(function (item) {
      console.log("- " + item.path + " (" + item.lines + " líneas)");
    });
  }

  if (missing.length > 0) {
    process.exitCode = 1;
  }
}

runCheck();
