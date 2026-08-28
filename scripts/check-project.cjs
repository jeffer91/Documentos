const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

const ROOT = path.join(__dirname, "..");
const MAX_LINES = 800;
const REQUIRED_FILES = [
  "package.json",
  "package-lock.json",
  "main.cjs",
  "preload.cjs",
  "index.html",
  "src/renderer/styles.css",
  "src/renderer/catalog.js",
  "src/renderer/app.js",
  "src/main/database-service.cjs",
  "src/main/calculation-service.cjs",
  "src/main/backup-service.cjs",
  "src/main/file-integrity-service.cjs",
  "src/main/error-service.cjs",
  "src/main/legacy-migration-service.cjs",
  "src/main/sync-service.cjs",
  "src/main/workspace-service.cjs",
  "src/main/template-markers.cjs",
  "src/main/template-service.cjs",
  "src/main/external-ai-exchange.cjs",
  "src/main/source-service.cjs",
  "src/main/project-validator.cjs",
  "src/main/ai-provider-service.cjs",
  "src/main/ai-service.cjs",
  "src/main/document-composer.cjs",
  "src/main/pdf-service.cjs",
  "src/main/settings-service.cjs",
  "scripts/render-word.ps1",
  "scripts/smoke-electron.cjs",
  "docs/ARQUITECTURA_DATOS.md",
  "docs/ALIAS_CAMPOS.md"
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
    "{{TXT:OBJETIVO|Objetivo}}",
    "{{LST:MODALIDAD|Modalidad|Presencial,En línea}}",
    "{{NUM:APROBADOS|Aprobados}}",
    "{{CAL:TOTAL|Total|SUM(APROBADOS,5)}}",
    "{{IA:CONCLUSIONES|Conclusiones}}",
    "{{TAB:CRONOGRAMA|Cronograma|Actividad:TEXTO,Responsable:CAMPO,Fecha:FECHA}}",
    "{{IMGS:EVIDENCIAS|Evidencias}}",
    "{{SYS:CODIGO}}",
    "{{GRA:RESULTADOS|Resultados}}"
  ].join("\n"));
  const validation = validateMarkers(markers);
  return {
    count: markers.length,
    ok: validation.ok,
    hasTableColumns: Boolean(markers.find((item) => item.type === "TABLA" && item.columnDefs.length === 3 && item.columnDefs[2].type === "FECHA")),
    hasAliases: Boolean(markers.find((item) => item.aliasUsed === "CAL" && item.type === "CALC")),
    hasList: Boolean(markers.find((item) => item.type === "LISTA" && item.options.length === 2))
  };
}

function externalAiProtocolCheck() {
  const { PROTOCOL, parseResponse } = require(path.join(ROOT, "src/main/external-ai-exchange.cjs"));
  const parsed = parseResponse([
    "//FORMATO:" + PROTOCOL + "//",
    "//DOCUMENTO:doc-test//",
    "//PLANTILLA:abc123//",
    "//MODO:MANUALES+IA//",
    "",
    "//CAMPO:PERIODO//",
    "Mayo 2026 - Noviembre 2026",
    "//FIN:PERIODO//",
    "",
    "//CAMPO:CONCLUSIONES//",
    "Primera línea.",
    "Segunda línea.",
    "//FIN:CONCLUSIONES//",
    "",
    "//FIN-DOCUMENTO//"
  ].join("\n"));

  return {
    protocol: PROTOCOL,
    format: parsed.metadata.format,
    documentId: parsed.metadata.documentId,
    template: parsed.metadata.template,
    mode: parsed.metadata.mode,
    blockCount: parsed.blocks.length,
    period: parsed.blocks[0] && parsed.blocks[0].value,
    multiline: parsed.blocks[1] && parsed.blocks[1].value,
    ended: parsed.ended
  };
}

function calculationCheck() {
  const { applyCalculations } = require(path.join(ROOT, "src/main/calculation-service.cjs"));
  const project = {
    formData: {
      APROBADOS: 80,
      REPROBADOS: 20,
      ACTIVIDADES: [
        { Planificado: 10, Ejecutado: 8 },
        { Planificado: 20, Ejecutado: 18 }
      ]
    },
    template: {
      markers: [
        { valid: true, type: "CALC", name: "TOTAL", label: "Total", formula: "SUM(APROBADOS,REPROBADOS)" },
        { valid: true, type: "CALC", name: "PORCENTAJE", label: "Porcentaje", formula: "PERCENT(APROBADOS,TOTAL)" },
        { valid: true, type: "CALC", name: "PLANIFICADO", label: "Planificado", formula: "SUM(ACTIVIDADES.Planificado)" },
        { valid: true, type: "CALC", name: "ESTADO", label: "Estado", formula: "IF(PORCENTAJE>=80,\"Cumplido\",\"No cumplido\")" }
      ]
    }
  };
  const result = applyCalculations(project, { calculationData: [] });
  return {
    ok: result.ok,
    total: result.project.formData.TOTAL,
    porcentaje: result.project.formData.PORCENTAJE,
    planificado: result.project.formData.PLANIFICADO,
    estado: result.project.formData.ESTADO
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
    if (!markers.ok || markers.count !== 10 || !markers.hasTableColumns || !markers.hasAliases || !markers.hasList) {
      errors.push("El parser de marcadores no superó la prueba interna.");
    }
  } catch (error) {
    errors.push(`No se pudo validar marcadores: ${error.message}`);
  }

  try {
    const calculation = calculationCheck();
    if (!calculation.ok || calculation.total !== 100 || calculation.porcentaje !== 80 || calculation.planificado !== 30 || calculation.estado !== "Cumplido") {
      errors.push("El motor de cálculos no superó la prueba interna.");
    }
  } catch (error) {
    errors.push(`No se pudo validar cálculos: ${error.message}`);
  }

  try {
    const exchange = externalAiProtocolCheck();
    if (
      exchange.protocol !== "ITSQMET-CAMPOS-V1" ||
      exchange.format !== exchange.protocol ||
      exchange.documentId !== "doc-test" ||
      exchange.template !== "abc123" ||
      exchange.mode !== "MANUALES+IA" ||
      exchange.blockCount !== 2 ||
      exchange.period !== "Mayo 2026 - Noviembre 2026" ||
      exchange.multiline !== "Primera línea.\nSegunda línea." ||
      !exchange.ended
    ) {
      errors.push("El protocolo de IA externa no superó la prueba interna.");
    }
  } catch (error) {
    errors.push(`No se pudo validar IA externa: ${error.message}`);
  }

  console.log("Documentos ITSQMET · diagnóstico v2.7");
  console.log("-----------------------------------");
  if (catalog) console.log(`Catálogo: ${catalog.units} unidades · ${catalog.processes} procesos · ${catalog.documents} documentos`);
  warnings.forEach((warning) => console.log(`AVISO: ${warning}`));

  if (errors.length) {
    errors.forEach((error) => console.error(`ERROR: ${error}`));
    process.exitCode = 1;
  } else {
    console.log("OK: estructura, sintaxis, catálogo, marcadores e IA externa correctos.");
  }
}

main();
