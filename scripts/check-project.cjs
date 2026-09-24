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
  "src/main/document-engine-registry.cjs",
  "src/main/process-hub-service.cjs",
  "src/main/engine-schema-service.cjs",
  "src/main/data-ingestion-service.cjs",
  "src/main/ai-provider-service.cjs",
  "src/main/ai-orchestrator.cjs",
  "src/main/draft-export-service.cjs",
  "src/main/knowledge-source-service.cjs",
  "src/main/editorial-structure-service.cjs",
  "src/main/visual-renderer-service.cjs",
  "src/main/citation-service.cjs",
  "src/main/apa7-service.cjs",
  "src/renderer/architecture-ui.js",
  "scripts/render-word.ps1",
  "scripts/export-draft.ps1",
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
  const obsoleteFiles = [
    "src/main/ai-service.cjs"
  ].filter((relative) => fs.existsSync(path.join(ROOT, relative)));

  return {
    packageVersion: pkg.version,
    lockVersion: lock.version,
    lockRootVersion: lock.packages && lock.packages[""] ? lock.packages[""].version : "",
    preloadVersion: preloadMatch ? preloadMatch[1] : "",
    obsoleteFiles
  };
}

function architectureV3Check() {
  const registry = require(path.join(ROOT, "src/main/document-engine-registry.cjs"));
  const engines = registry.allEngines();
  const ids = engines.map((item) => item.engineId);
  const finalVariants = engines.filter((item) => item.documentId === "utet-informe-final");
  const renderer = fs.readFileSync(path.join(ROOT, "src/renderer/architecture-ui.js"), "utf8");
  const mainSource = fs.readFileSync(path.join(ROOT, "main.cjs"), "utf8");
  const preload = fs.readFileSync(path.join(ROOT, "preload.cjs"), "utf8");
  return {
    selectedDocuments: registry.SELECTED_DOCUMENT_IDS.length,
    engineCount: engines.length,
    duplicateEngineIds: ids.filter((value, index) => ids.indexOf(value) !== index),
    regularFinal: finalVariants.some((item) => item.engineId === "tit.regular.informe-final"),
    pvcFinal: finalVariants.some((item) => item.engineId === "tit.pvc.informe-final"),
    hasStudentCardinality: engines.some((item) => item.cardinality === "student"),
    hasPeriodSegmentCardinality: engines.some((item) => item.cardinality === "period_segment"),
    hasProcessUi: renderer.includes("Expediente maestro") && renderer.includes("Generar / revisar todo"),
    hasIpc: mainSource.includes("architecture:dashboard") && mainSource.includes("ai-engine:generate-document"),
    hasBridge: preload.includes("getArchitectureDashboard") && preload.includes("generateEngineDocument")
  };
}

function engineLifecycleCheck() {
  const schema = require(path.join(ROOT, "src/main/engine-schema-service.cjs"));
  const registry = require(path.join(ROOT, "src/main/document-engine-registry.cjs"));
  const base = registry.getEngine("tit.regular.informe-final");
  const target = Object.assign({}, base, {
    version: "4.1.0-test",
    sections: [
      ...(base.sections || []).filter((item) => item.key !== "REFERENCIAS"),
      { key: "NUEVA_SECCION", title: "Nueva sección", type: "ai", children: [] }
    ]
  });
  const currentRows = schema.normalizedEngineSections(base).map((item) => ({
    section_key: item.key,
    title: item.title,
    section_type: item.type,
    parent_key: item.parentKey,
    section_level: item.level,
    sort_path: item.sortPath,
    numbering: item.numbering,
    page_break_before: item.pageBreakBefore ? 1 : 0,
    keep_with_next: item.keepWithNext === false ? 0 : 1,
    layout_json: JSON.stringify({
      required: item.required !== false,
      allowedVisuals: item.allowedVisuals || [],
      derivedFrom: item.derivedFrom || [],
      maxWords: item.maxWords || null,
      compact: Boolean(item.compact),
      layout: item.layout || {}
    }),
    active: 1,
    definition_hash: item.definitionHash
  }));
  const plan = schema.planMigration(currentRows, target);
  return {
    deterministicHash: schema.engineDefinitionHash(base) === schema.engineDefinitionHash(base),
    detectsAdded: plan.added.includes("NUEVA_SECCION"),
    detectsArchived: plan.archived.includes("REFERENCIAS"),
    keepsExisting: plan.unchanged.length > 0 || plan.updated.length > 0,
    structuralChange: plan.structuralChange === true
  };
}

function editorialV4Check() {
  const editorial = require(path.join(ROOT, "src/main/editorial-structure-service.cjs"));
  const visual = require(path.join(ROOT, "src/main/visual-renderer-service.cjs"));
  const registry = require(path.join(ROOT, "src/main/document-engine-registry.cjs"));

  const nested = editorial.flattenSections([
    {
      key: "A",
      title: "A",
      children: [{
        key: "B",
        title: "B",
        pageBreakBefore: true,
        children: [{
          key: "C",
          title: "C",
          children: [{
            key: "C1",
            title: "C1",
            children: [{
              key: "C2",
              title: "C2",
              children: [{
                key: "C3",
                title: "C3",
                children: [{ key: "C4", title: "C4" }]
              }]
            }]
          }]
        }]
      }]
    },
    { key: "D", title: "D" }
  ]);

  let duplicateRejected = false;
  let missingKeyRejected = false;
  try {
    editorial.flattenSections([
      { key: "DUP", title: "Uno" },
      { key: "DUP", title: "Dos" }
    ]);
  } catch (_error) {
    duplicateRejected = true;
  }
  try {
    editorial.flattenSections([{ title: "Sin clave" }]);
  } catch (_error) {
    missingKeyRejected = true;
  }

  const hierarchyValidation = editorial.validateHierarchy(nested);

  const validBlocks = editorial.validateSectionBlocks(
    { title: "Resultados", type: "data_ai", allowedVisuals: ["foda"] },
    [
      { type: "prose", role: "context", text: "La siguiente tabla sintetiza los resultados institucionales observados." },
      { type: "table", title: "Resultados", data: { headers: ["Indicador"], rows: [["Cumplimiento"]] } },
      { type: "prose", role: "analysis", text: "Los resultados muestran una tendencia que debe interpretarse con el contexto del período." }
    ]
  );
  const orphanBlocks = editorial.validateSectionBlocks(
    { title: "Resultados", type: "data_ai", allowedVisuals: [] },
    [{ type: "table", title: "Huérfana", data: { headers: ["A"], rows: [["1"]] } }]
  );
  const imageWithoutNarrative = editorial.validateSectionBlocks(
    { title: "Resultados", type: "data_ai", allowedVisuals: [] },
    [{ type: "image", title: "Imagen explicativa", data: { path: "demo.png" } }]
  );
  const bodyAfterTable = editorial.validateSectionBlocks(
    { title: "Resultados", type: "data_ai", allowedVisuals: [] },
    [
      { type: "prose", role: "context", text: "La tabla presenta los datos consolidados del período analizado." },
      { type: "table", title: "Resultados", data: { headers: ["A"], rows: [["1"]] } },
      { type: "prose", role: "body", text: "Este párrafo continúa el texto, pero no constituye análisis de resultados." }
    ]
  );

  const tools = visual.listTools();
  const sampleSvg = visual.renderSvg("foda", {
    strengths: ["Fortaleza"],
    opportunities: ["Oportunidad"],
    weaknesses: ["Debilidad"],
    threats: ["Amenaza"]
  });

  const apaSource = fs.readFileSync(path.join(ROOT, "src/main/apa7-service.cjs"), "utf8");
  const wordSource = fs.readFileSync(path.join(ROOT, "scripts/export-draft.ps1"), "utf8");
  const mainSource = fs.readFileSync(path.join(ROOT, "main.cjs"), "utf8");
  const preload = fs.readFileSync(path.join(ROOT, "preload.cjs"), "utf8");
  const reportEngine = registry.getEngine("tit.regular.informe-final");
  const reportKeys = (reportEngine && reportEngine.sections || []).map((item) => item.key);

  return {
    hierarchy:
      nested.length === 8 &&
      nested[0].numbering === "1" &&
      nested[1].numbering === "1.1" &&
      nested[2].numbering === "1.1.1" &&
      nested[6].numbering === "1.1.1.1.1.1.1" &&
      nested[7].numbering === "2" &&
      hierarchyValidation.ok,
    topLevelPageBreak:
      nested[0].pageBreakBefore === true &&
      nested[7].pageBreakBefore === true &&
      nested.slice(1, 7).every((item) => item.pageBreakBefore === false),
    stableKeys: duplicateRejected && missingKeyRejected,
    deepHierarchyWarning: hierarchyValidation.warnings.some((item) => item.includes("nivel 7")),
    tablePolicy: validBlocks.ok && !orphanBlocks.ok &&
      orphanBlocks.errors.some((item) => item.includes("contexto previo")) &&
      orphanBlocks.errors.some((item) => item.includes("análisis posterior")),
    imagePolicy:
      !imageWithoutNarrative.ok &&
      imageWithoutNarrative.errors.some((item) => item.includes("contexto previo")) &&
      imageWithoutNarrative.errors.some((item) => item.includes("análisis posterior")),
    strictAnalysisRole:
      !bodyAfterTable.ok &&
      bodyAfterTable.errors.some((item) => item.includes("análisis posterior")),
    visualTools: tools.length >= 13 && tools.some((item) => item.id === "ishikawa") &&
      tools.some((item) => item.id === "foda") &&
      tools.some((item) => item.id === "came") &&
      tools.some((item) => item.id === "process_flow") &&
      tools.some((item) => item.id === "cards"),
    svgRenderer: sampleSvg.includes("<svg") && sampleSvg.includes("Fortalezas"),
    apaRenderer:
      apaSource.includes("lineHeight: 2") &&
      apaSource.includes("2.54") &&
      apaSource.includes("apa-reference") &&
      apaSource.includes("Tabla") &&
      apaSource.includes("Figura"),
    wordPagination:
      wordSource.includes("PageBreakBefore") &&
      wordSource.includes("KeepWithNext") &&
      wordSource.includes("WidowControl") &&
      wordSource.includes("Apply-ObjectKeepRules") &&
      wordSource.includes("AllowBreakAcrossPages") &&
      wordSource.includes("$outline -le 9"),
    semanticHeadings:
      apaSource.includes("semanticLevel") &&
      apaSource.includes("data-actual-level") &&
      apaSource.includes("break-before:page"),
    reportSections:
      reportKeys.includes("ANALISIS_RESULTADOS") &&
      reportKeys.includes("RESUMEN_EJECUTIVO") &&
      reportKeys.includes("REFERENCIAS"),
    ipc:
      mainSource.includes("editorial:capabilities") &&
      mainSource.includes("citations:save") &&
      mainSource.includes("instances:set-blocks"),
    bridge:
      preload.includes("getEditorialCapabilities") &&
      preload.includes("saveCitation") &&
      preload.includes("setDocumentSectionBlocks")
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
    if (release.obsoleteFiles.length) {
      errors.push(`Persisten servicios obsoletos de IA: ${release.obsoleteFiles.join(", ")}`);
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
    const architecture = architectureV3Check();
    if (
      architecture.selectedDocuments !== 32 ||
      architecture.engineCount !== 33 ||
      architecture.duplicateEngineIds.length ||
      !architecture.regularFinal ||
      !architecture.pvcFinal ||
      !architecture.hasStudentCardinality ||
      !architecture.hasPeriodSegmentCardinality ||
      !architecture.hasProcessUi ||
      !architecture.hasIpc ||
      !architecture.hasBridge
    ) {
      errors.push("La arquitectura documental v3 no superó la validación interna.");
    }
  } catch (error) {
    errors.push(`No se pudo validar arquitectura v3: ${error.message}`);
  }

  try {
    const lifecycle = engineLifecycleCheck();
    if (
      !lifecycle.deterministicHash ||
      !lifecycle.detectsAdded ||
      !lifecycle.detectsArchived ||
      !lifecycle.keepsExisting ||
      !lifecycle.structuralChange
    ) {
      errors.push("El ciclo de vida de motores no superó la validación interna.");
    }
  } catch (error) {
    errors.push(`No se pudo validar el ciclo de vida de motores: ${error.message}`);
  }

  try {
    const editorialV4 = editorialV4Check();
    if (
      !editorialV4.hierarchy ||
      !editorialV4.topLevelPageBreak ||
      !editorialV4.stableKeys ||
      !editorialV4.deepHierarchyWarning ||
      !editorialV4.tablePolicy ||
      !editorialV4.imagePolicy ||
      !editorialV4.strictAnalysisRole ||
      !editorialV4.semanticHeadings ||
      !editorialV4.visualTools ||
      !editorialV4.svgRenderer ||
      !editorialV4.apaRenderer ||
      !editorialV4.wordPagination ||
      !editorialV4.reportSections ||
      !editorialV4.ipc ||
      !editorialV4.bridge
    ) {
      errors.push("El motor editorial v4 no superó la validación interna.");
    }
  } catch (error) {
    errors.push(`No se pudo validar el motor editorial v4: ${error.message}`);
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

  console.log("Documentos ITSQMET · diagnóstico v4.0.0");
  console.log("-----------------------------------");
  if (catalog) console.log(`Catálogo: ${catalog.units} unidades · ${catalog.processes} procesos · ${catalog.documents} documentos`);
  warnings.forEach((warning) => console.log(`AVISO: ${warning}`));

  if (errors.length) {
    errors.forEach((error) => console.error(`ERROR: ${error}`));
    process.exitCode = 1;
  } else {
    console.log("OK: v4 validada · jerarquía multinivel, bloques, 13 herramientas visuales, APA 7, paginación y arquitectura v3 compatibles.");
  }
}

main();
