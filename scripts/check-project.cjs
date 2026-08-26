const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

const ROOT = path.join(__dirname, "..");
const MAX_LINES = 750;
const REQUIRED_FILES = [
  "package.json",
  "main.cjs",
  "preload.cjs",
  "index.html",
  "src/renderer/styles.css",
  "src/renderer/catalog.js",
  "src/renderer/app.js",
  "src/main/workspace-service.cjs",
  "src/main/template-markers.cjs",
  "src/main/template-service.cjs",
  "src/main/source-service.cjs",
  "src/main/project-validator.cjs",
  "src/main/ai-provider-service.cjs",
  "src/main/ai-service.cjs",
  "src/main/document-composer.cjs",
  "src/main/pdf-service.cjs",
  "src/main/settings-service.cjs",
  "scripts/render-word.ps1"
];

function lineCount(file) {
  return fs.readFileSync(file, "utf8").split(/\r?\n/).length;
}

function syntaxCheck(relative) {
  const full = path.join(ROOT, relative);
  try {
    childProcess.execFileSync(process.execPath, ["--check", full], { stdio: "pipe" });
    return null;
  } catch (error) {
    return String(error.stderr || error.message || error);
  }
}

function catalogCheck() {
  const catalog = require(path.join(ROOT, "src/renderer/catalog.js"));
  const units = catalog.units || [];
  const processes = units.flatMap((unit) => unit.processes || []);
  const documents = processes.flatMap((process) => process.documents || []);
  const ids = documents.map((item) => item.id);

  return {
    units: units.length,
    processes: processes.length,
    documents: documents.length,
    duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index)
  };
}

function markerCheck() {
  const { parseMarkersFromText, validateMarkers } = require(path.join(ROOT, "src/main/template-markers.cjs"));
  const markers = parseMarkersFromText([
    "{{CAMPO!:PERIODO|Período}}",
    "{{TEXTO:OBJETIVO|Objetivo}}",
    "{{IA:CONCLUSIONES|Conclusiones}}",
    "{{TABLA:CRONOGRAMA|Cronograma|Actividad,Responsable,Fecha}}",
    "{{IMAGENES:EVIDENCIAS|Evidencias}}",
    "{{SISTEMA:CODIGO}}",
    "{{GRAFICO:RESULTADOS|Resultados}}"
  ].join("\n"));

  const validation = validateMarkers(markers);
  return {
    count: markers.length,
    ok: validation.ok,
    hasTableColumns: Boolean(markers.find((item) => item.type === "TABLA" && item.columns.length === 3))
  };
}

function main() {
  const errors = [];
  const warnings = [];

  REQUIRED_FILES.forEach((relative) => {
    const full = path.join(ROOT, relative);
    if (!fs.existsSync(full)) {
      errors.push(`Falta ${relative}`);
      return;
    }

    if (lineCount(full) > MAX_LINES) warnings.push(`${relative} supera ${MAX_LINES} líneas`);
    if (/\.(js|cjs)$/.test(relative)) {
      const syntaxError = syntaxCheck(relative);
      if (syntaxError) errors.push(`Sintaxis inválida en ${relative}`);
    }
  });

  let catalog = null;
  try {
    catalog = catalogCheck();
    if (catalog.units !== 2) errors.push(`Catálogo: se esperaban 2 unidades y hay ${catalog.units}`);
    if (catalog.processes !== 19) errors.push(`Catálogo: se esperaban 19 procesos y hay ${catalog.processes}`);
    if (catalog.documents !== 59) errors.push(`Catálogo: se esperaban 59 documentos y hay ${catalog.documents}`);
    if (catalog.duplicateIds.length) errors.push(`Catálogo: IDs duplicados ${catalog.duplicateIds.join(", ")}`);
  } catch (error) {
    errors.push(`No se pudo validar el catálogo: ${error.message}`);
  }

  try {
    const markers = markerCheck();
    if (!markers.ok || markers.count !== 7 || !markers.hasTableColumns) {
      errors.push("El parser de marcadores no superó la prueba interna.");
    }
  } catch (error) {
    errors.push(`No se pudo validar marcadores: ${error.message}`);
  }

  console.log("Documentos ITSQMET · diagnóstico v2.1");
  console.log("-----------------------------------");
  if (catalog) console.log(`Catálogo: ${catalog.units} unidades · ${catalog.processes} procesos · ${catalog.documents} documentos`);
  warnings.forEach((warning) => console.log(`AVISO: ${warning}`));

  if (errors.length) {
    errors.forEach((error) => console.error(`ERROR: ${error}`));
    process.exitCode = 1;
  } else {
    console.log("OK: estructura, sintaxis, catálogo y marcadores correctos.");
  }
}

main();
