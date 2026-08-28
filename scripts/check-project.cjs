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
  "src/main/template-requirements.cjs",
  "src/main/external-ai-exchange.cjs",
  "src/main/source-service.cjs",
  "src/main/project-validator.cjs",
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

function invalidMarkerCheck() {
  const { parseMarkersFromText, validateMarkers } = require(path.join(ROOT, "src/main/template-markers.cjs"));
  const unknownSys = validateMarkers(parseMarkersFromText("{{SYS:CAMPO_QUE_NO_EXISTE}}"));
  const ambiguous = validateMarkers(parseMarkersFromText([
    "{{CAM:DATO|Dato}}",
    "{{AI:DATO|Dato redactado}}"
  ].join("\n")));
  return {
    unknownSysRejected: !unknownSys.ok && unknownSys.errors.some((item) => item.includes("SISTEMA no reconoce")),
    ambiguousRejected: !ambiguous.ok && ambiguous.errors.some((item) => item.includes("varios tipos"))
  };
}

function externalAiProtocolCheck() {
  const { PROTOCOL, parseResponse } = require(path.join(ROOT, "src/main/external-ai-exchange.cjs"));
  const parsed = parseResponse([
    "//FORMATO:" + PROTOCOL + "//",
    "//DOCUMENTO:doc-test//",
    "//PLANTILLA:abc123//",
    "//VERSION-PLANTILLA:2//",
    "//MODO:DOCUMENTO-COMPLETO//",
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
    "//TABLA:RESULTADOS//",
    "//FILA//",
    "//DATO:CARRERA//",
    "Administración",
    "//FIN-DATO:CARRERA//",
    "//DATO:PORCENTAJE//",
    "82",
    "//FIN-DATO:PORCENTAJE//",
    "//FIN-FILA//",
    "//FIN-TABLA:RESULTADOS//",
    "",
    "//FIN-DOCUMENTO//"
  ].join("\n"));

  return {
    protocol: PROTOCOL,
    format: parsed.metadata.format,
    documentId: parsed.metadata.documentId,
    template: parsed.metadata.template,
    templateVersion: parsed.metadata.templateVersion,
    mode: parsed.metadata.mode,
    blockCount: parsed.blocks.length,
    period: parsed.blocks[0] && parsed.blocks[0].value,
    multiline: parsed.blocks[1] && parsed.blocks[1].value,
    tableRows: parsed.blocks[2] && parsed.blocks[2].rows ? parsed.blocks[2].rows.length : 0,
    tableCareer: parsed.blocks[2] && parsed.blocks[2].rows && parsed.blocks[2].rows[0] ? parsed.blocks[2].rows[0].CARRERA : "",
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

function externalOnlyUiCheck() {
  const mainSource = fs.readFileSync(path.join(ROOT, "main.cjs"), "utf8");
  const rendererSource = fs.readFileSync(path.join(ROOT, "src/renderer/app.js"), "utf8");
  const indexSource = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

  return {
    noInternalGeneration:
      !mainSource.includes("analyzeWithAi") &&
      !mainSource.includes('ipcMain.handle("ai:get"') &&
      !mainSource.includes('ipcMain.handle("ai:save"'),
    usesExternalAnalysis:
      mainSource.includes("analysisFromExternalOnly(project, sources)") &&
      mainSource.includes("activeTemplateAttachments(project)"),
    noAiNav:
      !indexSource.includes('data-route="ai"') &&
      !rendererSource.includes("renderAi()") &&
      !rendererSource.includes("getAiProviders") &&
      !rendererSource.includes("saveAiProviders"),
    simpleExternalFlow:
      rendererSource.includes("Copiar prompt para IA externa") &&
      rendererSource.includes("Importar respuesta") &&
      rendererSource.includes("Requisitos de la plantilla") &&
      rendererSource.includes("Ubicación:") &&
      !rendererSource.includes('name="externalAiMode"') &&
      !rendererSource.includes('<h3>IA</h3><span class="status good"')
  };
}

function legacyExternalOnlyCheck() {
  const legacySource = fs.readFileSync(path.join(ROOT, "src/main/legacy-migration-service.cjs"), "utf8");
  const templateSource = fs.readFileSync(path.join(ROOT, "src/main/template-service.cjs"), "utf8");
  const rendererSource = fs.readFileSync(path.join(ROOT, "src/renderer/app.js"), "utf8");
  return {
    legacyDoesNotFallback: !legacySource.includes('project.aiMode || "fallback"'),
    backendRejectsInvalidActive:
      templateSource.includes("if (template && !errors.length) return template;"),
    rendererRejectsInvalidReady:
      rendererSource.includes("function templateIsUsable(item)") &&
      rendererSource.includes("!errors.length")
  };
}

function releaseConsistencyCheck() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf8"));
  const preload = fs.readFileSync(path.join(ROOT, "preload.cjs"), "utf8");
  const preloadMatch = preload.match(/version:\s*"([^"]+)"/);
  const internalFiles = [
    "src/main/ai-provider-service.cjs",
    "src/main/ai-service.cjs"
  ].filter((relative) => fs.existsSync(path.join(ROOT, relative)));

  return {
    packageVersion: pkg.version,
    lockVersion: lock.version,
    lockRootVersion: lock.packages && lock.packages[""] ? lock.packages[""].version : "",
    preloadVersion: preloadMatch ? preloadMatch[1] : "",
    internalFiles
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

  try {
    const legacy = legacyExternalOnlyCheck();
    if (!legacy.legacyDoesNotFallback || !legacy.backendRejectsInvalidActive || !legacy.rendererRejectsInvalidReady) {
      errors.push("La compatibilidad legacy aún podría reactivar IA interna o mostrar plantillas inválidas como listas.");
    }
  } catch (error) {
    errors.push(`No se pudo validar compatibilidad legacy: ${error.message}`);
  }

  try {
    const release = releaseConsistencyCheck();
    const versions = [release.packageVersion, release.lockVersion, release.lockRootVersion, release.preloadVersion];
    if (new Set(versions).size !== 1 || versions.some((value) => !value)) {
      errors.push(`Versiones inconsistentes: ${versions.join(" / ")}`);
    }
    if (release.internalFiles.length) {
      errors.push(`Persisten servicios obsoletos de IA interna: ${release.internalFiles.join(", ")}`);
    }
  } catch (error) {
    errors.push(`No se pudo validar la versión de release: ${error.message}`);
  }

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
    const invalidMarkers = invalidMarkerCheck();
    if (!invalidMarkers.unknownSysRejected || !invalidMarkers.ambiguousRejected) {
      errors.push("La validación negativa de marcadores no superó la prueba interna.");
    }
  } catch (error) {
    errors.push(`No se pudo validar marcadores inválidos: ${error.message}`);
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
      exchange.protocol !== "ITSQMET-DOCUMENTO-V2" ||
      exchange.format !== exchange.protocol ||
      exchange.documentId !== "doc-test" ||
      exchange.template !== "abc123" ||
      String(exchange.templateVersion) !== "2" ||
      exchange.mode !== "DOCUMENTO-COMPLETO" ||
      exchange.blockCount !== 3 ||
      exchange.period !== "Mayo 2026 - Noviembre 2026" ||
      exchange.multiline !== "Primera línea.\nSegunda línea." ||
      exchange.tableRows !== 1 ||
      exchange.tableCareer !== "Administración" ||
      !exchange.ended
    ) {
      errors.push("El protocolo de IA externa no superó la prueba interna.");
    }
  } catch (error) {
    errors.push(`No se pudo validar IA externa: ${error.message}`);
  }

  try {
    const externalOnly = externalOnlyUiCheck();
    if (
      !externalOnly.noInternalGeneration ||
      !externalOnly.usesExternalAnalysis ||
      !externalOnly.noAiNav ||
      !externalOnly.simpleExternalFlow
    ) {
      errors.push("La app aún conserva elementos activos de IA interna o del flujo antiguo.");
    }
  } catch (error) {
    errors.push(`No se pudo validar el flujo exclusivo de IA externa: ${error.message}`);
  }

  console.log("Documentos ITSQMET · diagnóstico v2.8.1");
  console.log("-----------------------------------");
  if (catalog) console.log(`Catálogo: ${catalog.units} unidades · ${catalog.processes} procesos · ${catalog.documents} documentos`);
  warnings.forEach((warning) => console.log(`AVISO: ${warning}`));

  if (errors.length) {
    errors.forEach((error) => console.error(`ERROR: ${error}`));
    process.exitCode = 1;
  } else {
    console.log("OK: estructura, sintaxis, catálogo, requisitos, ubicaciones, datos locales e IA externa V2 correctos.");
  }
}

main();
