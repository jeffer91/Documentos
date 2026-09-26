const fs = require("fs");
const path = require("path");
const os = require("os");
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
  "src/main/document-outline-service.cjs",
  "src/main/document-data-binding-service.cjs",
  "src/main/alert-policy-service.cjs",
  "src/main/export-quality-service.cjs",
  "src/main/process-hub-service.cjs",
  "src/main/engine-schema-service.cjs",
  "src/main/data-ingestion-service.cjs",
  "src/main/ai-provider-service.cjs",
  "src/main/ai-orchestrator.cjs",
  "src/main/ai-generation-run-service.cjs",
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

function architectureDialogCheck() {
  const rendererSource = fs.readFileSync(path.join(ROOT, "src/renderer/architecture-ui.js"), "utf8");
  return {
    hasInternalDialog:
      rendererSource.includes("function appDialog(options)") &&
      rendererSource.includes('className = "app-dialog-backdrop"') &&
      rendererSource.includes('title: "Crear período"'),
    noNativeDialogs:
      !/window\.(prompt|confirm|alert)\s*\(/.test(rendererSource)
  };
}

function processPeriodArchitectureCheck() {
  const renderer = fs.readFileSync(path.join(ROOT, "src/renderer/architecture-ui.js"), "utf8");
  const hub = fs.readFileSync(path.join(ROOT, "src/main/process-hub-service.cjs"), "utf8");
  const ai = fs.readFileSync(path.join(ROOT, "src/main/ai-orchestrator.cjs"), "utf8");
  return {
    monthSelectors:
      renderer.includes('name: "startMonth"') &&
      renderer.includes('name: "endMonth"') &&
      renderer.includes('type: "select"') &&
      renderer.includes('{ value: "12", label: "Diciembre", short: "DIC" }'),
    yearIncrementals:
      renderer.includes('name: "startYear"') &&
      renderer.includes('name: "endYear"') &&
      renderer.includes('type: "number"') &&
      renderer.includes('step: 1'),
    automaticPeriodIdentity:
      renderer.includes('const code = sameYear') &&
      renderer.includes('const label =') &&
      hub.includes("function normalizePeriodInput(input)"),
    chronologyGuard:
      renderer.includes("El período final no puede ser anterior al período inicial.") &&
      hub.includes("El período final no puede ser anterior al período inicial."),
    processReuse:
      hub.includes("WHERE period_id = ? AND process_key = ? AND population = ? AND status = 'active'") &&
      hub.includes("if (existing) return getDossier(userDataPath, existing.id);"),
    structuredPeriodInDossier:
      hub.includes("p.start_date AS period_start_date") &&
      hub.includes("periodStartMonth:") &&
      hub.includes("periodEndYear:"),
    aiPeriodInheritance:
      ai.includes("const dossier = hub.getDossier(userDataPath, instance.dossierId);") &&
      ai.includes("period: context.period") &&
      ai.includes("Período institucional del proceso:")
  };
}

function formationProcessWorkspaceCheck() {
  const renderer = fs.readFileSync(path.join(ROOT, "src/renderer/architecture-ui.js"), "utf8");
  const registry = fs.readFileSync(path.join(ROOT, "src/main/document-engine-registry.cjs"), "utf8");
  const styles = fs.readFileSync(path.join(ROOT, "src/renderer/styles.css"), "utf8");
  const requiredEngines = ["form.deteccion", "form.plan", "form.informe", "form.seguimiento"];
  return {
    fourDocuments:
      requiredEngines.every((engineId) => renderer.includes(`"${engineId}"`)) &&
      requiredEngines.every((engineId) => registry.includes(`"${engineId}"`)),
    periodSelector:
      renderer.includes("data-formation-period-select") &&
      renderer.includes('data-arch-action="new-formation-period"') &&
      renderer.includes("switchFormationPeriod"),
    automaticFormationDossier:
      renderer.includes("async function ensureFormationDossier") &&
      renderer.includes('processKey: "formacion"') &&
      renderer.includes('population: "all"'),
    directDocumentEntry:
      renderer.includes('if (engines.some((engine) => engine.family === "formacion"))') &&
      renderer.includes("return openFormationProcess(documentId);"),
    cards:
      renderer.includes("process-document-card") &&
      renderer.includes('data-arch-action="process-document"') &&
      styles.includes(".process-document-grid") &&
      styles.includes(".process-document-card.active"),
    editorAndDraft:
      renderer.includes("formationProcessWorkspaceMarkup()") &&
      renderer.includes('data-arch-action="export-draft"') &&
      renderer.includes("sectionIndexMarkup()")
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
    hasProcessUi:
      renderer.includes("¿En qué período vas a trabajar?") &&
      renderer.includes('["preparation", "Preparación"]') &&
      renderer.includes('["document", "Documento"]') &&
      renderer.includes('["review", "Revisión"]') &&
      renderer.includes('["output", "Salida"]') &&
      renderer.includes("openDocument"),
    hasIpc: mainSource.includes("architecture:dashboard") && mainSource.includes("ai-engine:generate-document"),
    hasBridge: preload.includes("getArchitectureDashboard") && preload.includes("generateEngineDocument")
  };
}

function independentEngineCheck() {
  const registry = require(path.join(ROOT, "src/main/document-engine-registry.cjs"));
  const report = registry.registryIndependenceReport();
  const engines = registry.allEngines();
  const regular = registry.getEngine("tit.regular.informe-final");
  const pvc = registry.getEngine("tit.pvc.informe-final");
  const regularFreshBefore = registry.getEngine("tit.regular.informe-final");

  const originalRegularTitle = regularFreshBefore.sections[0].title;
  const originalPvcTitle = pvc.sections[0].title;
  regular.sections[0].title = "MUTACIÓN DE PRUEBA";
  regular.dependencies.push("motor.fake");
  regular.scopeKeys.push("fake");
  if (regular.sections[0].data) regular.sections[0].data.__test = true;

  const regularFreshAfter = registry.getEngine("tit.regular.informe-final");
  const pvcFreshAfter = registry.getEngine("tit.pvc.informe-final");

  const blueprint = registry.blueprintForEngine("tit.regular.informe-final");
  const pvcBlueprint = registry.blueprintForEngine("tit.pvc.informe-final");
  if (blueprint) blueprint.push("MUTACION_BLUEPRINT");
  const blueprintFresh = registry.blueprintForEngine("tit.regular.informe-final");

  return {
    report,
    allOwned:
      engines.length === 33 &&
      engines.every((item) =>
        item.definitionOwner === item.engineId &&
        item.definitionSource === "engine_blueprint" &&
        item.independentDefinition === true &&
        (item.sections || []).every((section) => section.definitionOwner === item.engineId)
      ),
    runtimeIsolation:
      regularFreshAfter.sections[0].title === originalRegularTitle &&
      !regularFreshAfter.dependencies.includes("motor.fake") &&
      !regularFreshAfter.scopeKeys.includes("fake") &&
      !(regularFreshAfter.sections[0].data && regularFreshAfter.sections[0].data.__test),
    crossEngineIsolation:
      pvcFreshAfter.sections[0].title === originalPvcTitle &&
      pvcFreshAfter.sections[0].title !== "MUTACIÓN DE PRUEBA" &&
      regularFreshAfter.sections !== pvcFreshAfter.sections &&
      regularFreshAfter.sections[0] !== pvcFreshAfter.sections[0],
    blueprintIsolation:
      Array.isArray(blueprintFresh) &&
      !blueprintFresh.includes("MUTACION_BLUEPRINT") &&
      Array.isArray(pvcBlueprint) &&
      blueprintFresh !== pvcBlueprint,
    noGenericFallback:
      report.missingBlueprints.length === 0 &&
      report.orphanBlueprints.length === 0 &&
      report.blueprintCount === report.engineCount &&
      report.uniqueDefinitionOwners === report.engineCount
  };
}

function documentOutlineCheck() {
  const outline = require(path.join(ROOT, "src/main/document-outline-service.cjs"));
  const registry = require(path.join(ROOT, "src/main/document-engine-registry.cjs"));
  const schemaSource = fs.readFileSync(path.join(ROOT, "src/main/engine-schema-service.cjs"), "utf8");
  const hubSource = fs.readFileSync(path.join(ROOT, "src/main/process-hub-service.cjs"), "utf8");
  const aiSource = fs.readFileSync(path.join(ROOT, "src/main/ai-orchestrator.cjs"), "utf8");
  const renderer = fs.readFileSync(path.join(ROOT, "src/renderer/architecture-ui.js"), "utf8");

  const reports = registry.allStructureReports();
  const capDetection = registry.getEngine("cap.deteccion");
  const formDetection = registry.getEngine("form.deteccion");
  const planning = registry.getEngine("cap.plan");
  const curricular = registry.getEngine("ccc.acta-colectivos");

  const nested = outline.compileOutline("TEST.NESTED", [
    {
      key: "ROOT",
      title: "Raíz",
      type: "ai",
      children: [{
        key: "CHILD",
        title: "Hijo",
        type: "data_ai",
        contract: {
          purpose: "Probar contrato por nodo.",
          sourcePolicy: "datos",
          visualPolicy: "optional",
          dataNeeds: ["career"],
          promptInstructions: ["Usar solo datos filtrados."]
        },
        children: [{
          key: "GRANDCHILD",
          title: "Nieto",
          type: "derived_ai",
          derivedFrom: ["CHILD"]
        }]
      }]
    }
  ], {}, { allowedVisuals: [] });

  let missingDependencyRejected = false;
  let cycleRejected = false;
  try {
    outline.compileOutline("TEST.MISSING", [
      { key: "A", title: "A", type: "derived_ai", derivedFrom: ["NO_EXISTE"] }
    ], {}, { allowedVisuals: [] });
  } catch (_error) {
    missingDependencyRejected = true;
  }
  try {
    outline.compileOutline("TEST.CYCLE", [
      { key: "A", title: "A", type: "derived_ai", derivedFrom: ["B"] },
      { key: "B", title: "B", type: "derived_ai", derivedFrom: ["A"] }
    ], {}, { allowedVisuals: [] });
  } catch (_error) {
    cycleRejected = true;
  }

  const capKeys = (capDetection.sections || []).map((item) => item.key);
  const formKeys = (formDetection.sections || []).map((item) => item.key);
  const capAnalysis = (capDetection.sections || []).find((item) => item.key === "ANALISIS_RESULTADOS");
  const capNeeds = (capDetection.sections || []).find((item) => item.key === "NECESIDADES_PRIORIZADAS");
  const planConclusions = (planning.sections || []).find((item) => item.key === "CONCLUSIONES");
  const curricularConclusions = (curricular.sections || []).find((item) => item.key === "CONCLUSIONES");
  const curricularRecommendations = (curricular.sections || []).find((item) => item.key === "RECOMENDACIONES");

  return {
    allValid: reports.length === 33 && reports.every((item) => item && item.ok),
    allScaffolded:
      reports.every((item) => ["scaffold", "confirmed"].includes(item.outlineStatus)) &&
      reports.some((item) => item.engineId === "form.deteccion" && item.outlineStatus === "confirmed"),
    nestedTree:
      nested.validation.ok &&
      nested.validation.summary.maxDepth === 3 &&
      nested.validation.summary.nodeCount === 3 &&
      nested.validation.summary.contractedNodes === 1,
    rejectsBadDependencies: missingDependencyRejected && cycleRejected,
    detectionAnalysis: (() => {
      const formRows = outline.flattenTree(formDetection.sections || []).map((row) => row.node);
      const formByKey = new Map(formRows.map((item) => [item.key, item]));
      const roots = formDetection.sections || [];
      const methodology = formByKey.get("METODOLOGIA");
      const analysis = formByKey.get("ANALISIS_INTERPRETACION");
      const prioritization = formByKey.get("PRIORIZACION_INSTITUCIONAL");
      const bibliography = formByKey.get("REFERENCIAS");
      return (
        capKeys.includes("ANALISIS_RESULTADOS") &&
        capKeys.indexOf("RESULTADOS") < capKeys.indexOf("ANALISIS_RESULTADOS") &&
        capKeys.indexOf("ANALISIS_RESULTADOS") < capKeys.indexOf("NECESIDADES_PRIORIZADAS") &&
        capAnalysis && capAnalysis.contract && capAnalysis.contract.visualPolicy === "recommended" &&
        capNeeds && (capNeeds.derivedFrom || []).includes("ANALISIS_RESULTADOS") &&
        roots.length === 14 &&
        formRows.some((item) => item.key === "ANALISIS_GLOBAL") &&
        formRows.some((item) => item.key === "ANALISIS_MAPA_CALOR" && (item.allowedVisuals || []).includes("heatmap")) &&
        formRows.some((item) => item.key === "LINEAS_FORMACION_COORDINACION") &&
        methodology && (methodology.children || []).length === 8 &&
        analysis && (analysis.children || []).length === 9 &&
        !formRows.some((item) => ["CARACTERIZACION_EXPERIENCIA","CARACTERIZACION_VINCULACION","ANALISIS_DISPONIBILIDAD","ANALISIS_CUALITATIVO","ANALISIS_TRIANGULACION"].includes(item.key)) &&
        formDetection.inputMode === "period_careers_synthetic" &&
        formDetection.version === "4.2.0" &&
        prioritization && (prioritization.children || []).length === 5 &&
        bibliography && bibliography.title === "Bibliografía"
      );
    })(),
    planningDependencies:
      planConclusions &&
      JSON.stringify(planConclusions.derivedFrom) === JSON.stringify(["PLANIFICACION", "CRONOGRAMA", "SEGUIMIENTO"]),
    curricularDependencies:
      curricularConclusions &&
      (curricularConclusions.derivedFrom || []).includes("ANALISIS_CURRICULAR") &&
      curricularRecommendations &&
      (curricularRecommendations.derivedFrom || []).includes("CONCLUSIONES"),
    persistedContracts:
      schemaSource.includes("contract: Object.keys(contract).length ? contract : undefined") &&
      hubSource.includes("contract: sectionItem.contract || {}") &&
      hubSource.includes("contract: layout.contract"),
    aiUsesContracts:
      aiSource.includes("Propósito específico de la sección") &&
      aiSource.includes("promptInstructions") &&
      aiSource.includes("contract: section.contract || {}"),
    uiShowsStructure:
      renderer.includes("estructura base") &&
      renderer.includes("Ver respaldo y trazabilidad") &&
      renderer.includes("Recomendación de IA") &&
      renderer.includes("Guardado automáticamente")
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

function dataEngineCheck() {
  const ingestion = require(path.join(ROOT, "src/main/data-ingestion-service.cjs"));
  const source = fs.readFileSync(path.join(ROOT, "src/main/data-ingestion-service.cjs"), "utf8");
  const aiSource = fs.readFileSync(path.join(ROOT, "src/main/ai-orchestrator.cjs"), "utf8");
  const mainSource = fs.readFileSync(path.join(ROOT, "main.cjs"), "utf8");
  const preload = fs.readFileSync(path.join(ROOT, "preload.cjs"), "utf8");
  const hubSource = fs.readFileSync(path.join(ROOT, "src/main/process-hub-service.cjs"), "utf8");
  const schemaSource = fs.readFileSync(path.join(ROOT, "src/main/engine-schema-service.cjs"), "utf8");
  const renderer = fs.readFileSync(path.join(ROOT, "src/renderer/architecture-ui.js"), "utf8");

  return {
    normalizesText:
      ingestion.normalizeText("ENFERMERÍA") === "enfermeria" &&
      ingestion.normalizeText("  Núcleo   1 ") === "nucleo 1",
    fullAggregation:
      source.includes("function filteredRows") &&
      source.includes("calculationComplete: true") &&
      !source.includes("Object.assign({}, query || {}, { limit: 5000 })"),
    canonicalMapping:
      source.includes("function applyMapping") &&
      source.includes("function validateMapping") &&
      source.includes("CANONICAL_FIELD_ALIASES"),
    queryValidation:
      source.includes("function validateQueryFields") &&
      source.includes("no existen o no están mapeados"),
    duplicateGuard:
      source.includes("duplicate_ignored") &&
      source.includes("duplicateIgnored: true"),
    traceability:
      source.includes("__sourceSha256") &&
      source.includes("__mappingHash") &&
      source.includes("querySignature") &&
      source.includes("sourceTrace"),
    privacy:
      source.includes("privacyMinGroup") &&
      source.includes("allowRawRowsForAi") &&
      source.includes("absoluteCountsExposed"),
    aiContract:
      aiSource.includes("no recalcules promedios, porcentajes, conteos ni filtros") &&
      aiSource.includes("calculationComplete: true") &&
      aiSource.includes('scopePolicy: "inclusive"'),
    versionedQueries:
      hubSource.includes("data: sectionItem.data || {}") &&
      schemaSource.includes("data: section.data || {}") &&
      schemaSource.includes("data: layout.data || {}"),
    ipc:
      mainSource.includes("data-imports:suggest-mapping") &&
      mainSource.includes("data-ai-slice"),
    bridge:
      preload.includes("suggestDataMapping") &&
      preload.includes("getAiDataSlice"),
    ui:
      renderer.includes("Mapeo canónico") &&
      renderer.includes('data-arch-action="suggest-mapping"') &&
      renderer.includes('data-arch-action="edit-mapping"')
  };
}

function documentDataBindingCheck() {
  const registry = require(path.join(ROOT, "src/main/document-engine-registry.cjs"));
  const bindings = require(path.join(ROOT, "src/main/document-data-binding-service.cjs"));
  const ingestion = require(path.join(ROOT, "src/main/data-ingestion-service.cjs"));
  const aiSource = fs.readFileSync(path.join(ROOT, "src/main/ai-orchestrator.cjs"), "utf8");
  const mainSource = fs.readFileSync(path.join(ROOT, "main.cjs"), "utf8");
  const renderer = fs.readFileSync(path.join(ROOT, "src/renderer/architecture-ui.js"), "utf8");

  const report = registry.dataPlanReport();
  const engines = registry.allEngines();
  const plagiarismEngine = registry.getEngine("tit.regular.plagio-trabajo");
  const plagiarismSection = plagiarismEngine.sections.find((item) => item.key === "RESULTADO_ANTIPLAGIO");
  const plagiarismBinding = plagiarismSection && plagiarismSection.data && plagiarismSection.data.binding;

  const splitAvailability = {
    hasImports: true,
    availableFields: ["student_id", "plagiarism_percent"],
    imports: [
      { importId: "a", sheets: [{ name: "Estudiantes", canonicalFields: ["student_id"] }] },
      { importId: "b", sheets: [{ name: "Similitud", canonicalFields: ["plagiarism_percent"] }] }
    ]
  };
  const splitResult = bindings.resolveBinding(
    plagiarismBinding,
    { scopeType: "student", scopeKey: "0101" },
    splitAvailability
  );

  const compatibleAvailability = {
    hasImports: true,
    availableFields: ["student_id", "student_name", "career", "plagiarism_percent", "grade"],
    imports: [
      { importId: "notas", sheets: [{ name: "Notas", canonicalFields: ["student_id", "career", "grade"] }] },
      { importId: "plagio", sheets: [{ name: "Antiplagio", canonicalFields: ["student_id", "student_name", "plagiarism_percent"] }] }
    ]
  };
  const compatibleResult = bindings.resolveBinding(
    plagiarismBinding,
    { scopeType: "student", scopeKey: "0101" },
    compatibleAvailability
  );

  const resultsBinding = bindings.bindingFor("tit.regular.informe-final", "RESULTADOS");
  const resultsResult = bindings.resolveBinding(
    resultsBinding,
    { scopeType: "period_population", scopeKey: "regular" },
    compatibleAvailability
  );

  return {
    allPlans:
      report.valid &&
      report.engineCount === 33 &&
      report.plannedEngineCount === 33 &&
      report.enginesWithoutPlan.length === 0 &&
      report.invalidPlans.length === 0,
    engineMetadata:
      engines.every((item) => item.dataPlanStatus === "configured" && Number(item.dataPlanVersion) === 1),
    versionedBindings:
      plagiarismBinding &&
      plagiarismBinding.id === "tit.regular.plagio-trabajo:RESULTADO_ANTIPLAGIO" &&
      plagiarismBinding.requirement === "required",
    rejectsSplitMandatoryFields:
      splitResult.ready === false &&
      splitResult.status === "missing_fields" &&
      splitResult.warnings.some((item) => item.includes("misma hoja")),
    isolatesCompatibleSources:
      compatibleResult.ready === true &&
      compatibleResult.query &&
      JSON.stringify(compatibleResult.query.importIds) === JSON.stringify(["plagio"]) &&
      JSON.stringify(compatibleResult.query.sheet) === JSON.stringify(["Antiplagio"]) &&
      compatibleResult.query.where.some((item) => item.field === "plagiarism_percent" && item.op === "exists") &&
      compatibleResult.query.where.some((item) => item.field === "student_id" && item.value === "0101"),
    prunesOptionalFields:
      resultsResult.ready === true &&
      resultsResult.query &&
      resultsResult.query.dimensions.includes("career") &&
      !resultsResult.query.dimensions.includes("campus") &&
      resultsResult.query.measures.includes("grade"),
    canonicalVocabulary:
      ingestion.CANONICAL_FIELD_ALIASES.plagiarism_percent &&
      ingestion.CANONICAL_FIELD_ALIASES.requirement_status &&
      ingestion.CANONICAL_FIELD_ALIASES.activity_name &&
      ingestion.CANONICAL_FIELD_ALIASES.formation_level &&
      ingestion.CANONICAL_FIELD_ALIASES.subject,
    localizedNumbers:
      ingestion.numericValue("12,5%") === 12.5 &&
      ingestion.numericValue("1.234,50") === 1234.5,
    aiRuntime:
      aiSource.includes("function dataReadinessForSection") &&
      aiSource.includes("instanceDataReadiness") &&
      aiSource.includes('requirement === "required"') &&
      aiSource.includes("requiere datos antes de generar") &&
      aiSource.includes("syntheticFormationProfile") &&
      aiSource.includes("FORMACION_DOCENTE_SINTETICA"),
    backendReadiness:
      mainSource.includes("dataReadiness: instance ? aiOrchestrator.instanceDataReadiness"),
    uiReadiness:
      renderer.includes("Datos listos") &&
      renderer.includes("Datos por revisar") &&
      renderer.includes("Gestionar datos, fuentes y mapeos") &&
      renderer.includes("Mapeo canónico") &&
      renderer.includes("Guardar carreras y generar datos") &&
      renderer.includes("Generar diagnóstico completo")
  };
}

function draftFinalAlertCheck() {
  const alerts = require(path.join(ROOT, "src/main/alert-policy-service.cjs"));
  const hubSource = fs.readFileSync(path.join(ROOT, "src/main/process-hub-service.cjs"), "utf8");
  const apaSource = fs.readFileSync(path.join(ROOT, "src/main/apa7-service.cjs"), "utf8");
  const renderer = fs.readFileSync(path.join(ROOT, "src/renderer/architecture-ui.js"), "utf8");

  const trace = alerts.trace({
    sections: [{
      key: "RESULTADOS",
      title: "Resultados",
      alerts: [
        { type: "inferred", severity: "warning", message: "Dato inferido", blocking: true },
        { type: "review", severity: "info", message: "Revisar redacción", blocking: false }
      ],
      blocks: [{
        key: "tabla-1",
        type: "table",
        alerts: [{ type: "source", severity: "error", message: "Fuente pendiente", blocking: true }]
      }]
    }]
  });

  return {
    traceSummary:
      trace.summary.total === 3 &&
      trace.summary.sectionAlerts === 2 &&
      trace.summary.blockAlerts === 1 &&
      trace.summary.legacyBlockingFlags === 2 &&
      trace.summary.finalizationPolicy === "trace_only",
    blockTrace:
      trace.items.some((item) =>
        item.source === "block" &&
        item.blockKey === "tabla-1" &&
        item.message === "Fuente pendiente"
      ),
    noAlertGate:
      !hubSource.includes('if (pendingAlerts.length) throw new Error("El borrador todavía tiene alertas pendientes.")') &&
      hubSource.includes("alertsDidNotBlockFinal: true"),
    frozenTrace:
      hubSource.includes("alertTrace: Object.assign({}, alertTrace") &&
      hubSource.includes('policy: "trace_only"') &&
      hubSource.includes("frozenWithUnresolvedAlerts"),
    draftIncludesBlockAlerts:
      apaSource.includes("draftAlertsForSection") &&
      apaSource.includes('alert.source === "block"'),
    finalHidesAlerts:
      apaSource.includes("opts.includeAlerts !== false && !opts.final") &&
      renderer.includes("finalFrozenAt") &&
      renderer.includes("no forman parte de la versión final visible"),
    workingCopy:
      hubSource.includes("copiedAlertCount") &&
      hubSource.includes("alerts: sectionItem.alerts")
  };
}

function aiGenerationResilienceCheck() {
  const orchestrator = require(path.join(ROOT, "src/main/ai-orchestrator.cjs"));
  const aiSource = fs.readFileSync(path.join(ROOT, "src/main/ai-orchestrator.cjs"), "utf8");
  const runSource = fs.readFileSync(path.join(ROOT, "src/main/ai-generation-run-service.cjs"), "utf8");
  const providerSource = fs.readFileSync(path.join(ROOT, "src/main/ai-provider-service.cjs"), "utf8");
  const mainSource = fs.readFileSync(path.join(ROOT, "main.cjs"), "utf8");
  const preload = fs.readFileSync(path.join(ROOT, "preload.cjs"), "utf8");
  const renderer = fs.readFileSync(path.join(ROOT, "src/renderer/architecture-ui.js"), "utf8");

  const humanReason = orchestrator.sectionPreservationReason({
    status: "edited",
    locked: false,
    provenance: { source: "human" }
  }, {});
  const lockedReason = orchestrator.sectionPreservationReason({
    status: "approved",
    locked: true,
    provenance: {}
  }, { force: true, overrideHuman: true });
  const retry429 = orchestrator.retryableProviderError(Object.assign(new Error("rate"), { statusCode: 429 }));
  const retry503 = orchestrator.retryableProviderError(Object.assign(new Error("down"), { statusCode: 503 }));
  const noRetry401 = orchestrator.retryableProviderError(Object.assign(new Error("auth"), { statusCode: 401 }));

  return {
    runSchema:
      runSource.includes("ai_generation_runs_v6") &&
      runSource.includes('status TEXT NOT NULL DEFAULT \'running\'') &&
      runSource.includes("nextSectionKey") &&
      runSource.includes("resumable"),
    humanProtection:
      humanReason === "human_edited" &&
      lockedReason === "approved_or_locked" &&
      aiSource.includes("Confirma explícitamente si deseas reemplazarla con IA"),
    retryPolicy:
      retry429 === true &&
      retry503 === true &&
      noRetry401 === false &&
      aiSource.includes("callProviderWithRetries") &&
      providerSource.includes("error.statusCode") &&
      providerSource.includes('timeoutError.code = "ETIMEDOUT"'),
    fallback:
      aiSource.includes("for (const candidate of set.writers") &&
      aiSource.includes("writerPayloadUsable") &&
      aiSource.includes("respuesta no contiene contenido ni bloques utilizables"),
    reviewerBlocks:
      aiSource.includes('reviewerPrompt(engine, section, { content, blocks, alerts }, context)') &&
      aiSource.includes("review_format"),
    reviewStatus:
      aiSource.includes("reviewerCoverageMissing") &&
      aiSource.includes('"reviewed"') &&
      aiSource.includes('"needs_review"'),
    documentMemory:
      aiSource.includes("function documentMemory") &&
      aiSource.includes("priorSections") &&
      aiSource.includes("documentMemory: memory"),
    partialResume:
      aiSource.includes("continueOnError") &&
      aiSource.includes('"partial"') &&
      aiSource.includes("resumeDocument") &&
      aiSource.includes("dependencyProblems"),
    ipc:
      mainSource.includes("ai-engine:resume-document") &&
      mainSource.includes("ai-engine:generation-runs") &&
      mainSource.includes("generationRun: instance ? aiOrchestrator.latestGenerationRun"),
    bridge:
      preload.includes("resumeEngineDocument") &&
      preload.includes("listGenerationRuns"),
    ui:
      renderer.includes("Reanudar pendientes") &&
      renderer.includes("Generación parcial") &&
      renderer.includes("Esta sección tiene cambios manuales") &&
      renderer.includes("needs_review")
  };
}

function exportVisualQualityCheck() {
  const visual = require(path.join(ROOT, "src/main/visual-renderer-service.cjs"));
  const quality = require(path.join(ROOT, "src/main/export-quality-service.cjs"));
  const editorial = require(path.join(ROOT, "src/main/editorial-structure-service.cjs"));
  const exportSource = fs.readFileSync(path.join(ROOT, "src/main/draft-export-service.cjs"), "utf8");
  const apaSource = fs.readFileSync(path.join(ROOT, "src/main/apa7-service.cjs"), "utf8");
  const mainSource = fs.readFileSync(path.join(ROOT, "main.cjs"), "utf8");
  const renderer = fs.readFileSync(path.join(ROOT, "src/renderer/architecture-ui.js"), "utf8");
  const exportWord = fs.readFileSync(path.join(ROOT, "scripts/export-draft.ps1"), "utf8");
  const renderWord = fs.readFileSync(path.join(ROOT, "scripts/render-word.ps1"), "utf8");

  const tools = visual.listTools();
  const visualResults = tools.map((tool) => {
    const payload = visual.samplePayload(tool.id);
    const validation = visual.validateVisualData(tool.id, payload);
    const svg = validation.ok ? visual.renderSvg(tool.id, payload) : "";
    return {
      id: tool.id,
      valid: validation.ok,
      svg: svg.includes("<svg") && svg.includes("viewBox")
    };
  });

  const invalidFoda = visual.validateVisualData("foda", {});
  const invalidLine = visual.validateVisualData("line", { items: [{ label: "Único", value: 1 }] });
  const invalidEditorialVisual = editorial.validateSectionBlocks(
    { title: "Análisis", type: "analysis_ai", allowedVisuals: ["foda"] },
    [
      { type: "prose", role: "context", text: "El análisis siguiente resume los hallazgos cualitativos detectados en el período." },
      { type: "visual", visualType: "foda", title: "FODA vacío", data: {} },
      { type: "prose", role: "analysis", text: "La interpretación posterior debe explicar los resultados del visual generado." }
    ]
  );

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "documentos-export-quality-"));
  let signatures = false;
  let incomplete = false;
  try {
    const base = path.join(temp, "demo");
    const htmlPath = base + ".html";
    fs.writeFileSync(htmlPath, "<!doctype html><html><body>ok</body></html>", "utf8");
    fs.writeFileSync(base + ".pdf", Buffer.from("%PDF-1.7\nquality-check\n", "ascii"));
    fs.writeFileSync(base + ".docx", Buffer.concat([Buffer.from([0x50,0x4b,0x03,0x04]), Buffer.alloc(64, 1)]));
    const all = quality.assessOutputs(base, htmlPath, ["html", "docx", "pdf"]);
    signatures = all.complete && all.generatedFormats.length === 3;
    fs.unlinkSync(base + ".pdf");
    const partial = quality.assessOutputs(base, htmlPath, ["docx", "pdf"]);
    incomplete = !partial.complete && partial.missingFormats.includes("pdf") && partial.generatedFormats.includes("docx");
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }

  return {
    allVisuals:
      tools.length === 14 &&
      visualResults.length === 14 &&
      visualResults.every((item) => item.valid && item.svg),
    rejectsEmptyVisuals:
      !invalidFoda.ok &&
      !invalidLine.ok &&
      !invalidEditorialVisual.ok &&
      invalidEditorialVisual.errors.some((item) => item.includes("FODA necesita")),
    signatures,
    incomplete,
    exportManifest:
      exportSource.includes("manifestPath") &&
      exportSource.includes("missingFormats") &&
      exportSource.includes("converterStatus") &&
      exportSource.includes('status = complete ? "complete" : "incomplete"'),
    uiFailure:
      mainSource.includes("if (!result.complete)") &&
      mainSource.includes("Exportación incompleta") &&
      renderer.includes("Exportación incompleta") &&
      renderer.includes("missingFormats"),
    missingAssets:
      apaSource.includes("missingAssets") &&
      apaSource.includes("Figura pendiente de archivo o renderizado") &&
      exportSource.includes("missingAssets"),
    multipageTables:
      apaSource.includes("display:table-header-group") &&
      apaSource.includes("page-break-inside:auto") &&
      apaSource.includes("break-inside:avoid"),
    wordLayout:
      exportWord.includes("HeadingFormat = -1") &&
      exportWord.includes("AllowBreakAcrossPages = 0") &&
      exportWord.includes("$columnCount -ge 9") &&
      exportWord.includes("$shape.Height -gt 520") &&
      exportWord.includes("Nota\\.") &&
      renderWord.includes("HeadingFormat = -1") &&
      renderWord.includes("AllowBreakAcrossPages = 0") &&
      renderWord.includes("$shape.Height -gt 520")
  };
}

function apaCitationCheck() {
  const citations = require(path.join(ROOT, "src/main/citation-service.cjs"));
  const apaSource = fs.readFileSync(path.join(ROOT, "src/main/apa7-service.cjs"), "utf8");
  const exportSource = fs.readFileSync(path.join(ROOT, "src/main/draft-export-service.cjs"), "utf8");
  const hubSource = fs.readFileSync(path.join(ROOT, "src/main/process-hub-service.cjs"), "utf8");
  const renderer = fs.readFileSync(path.join(ROOT, "src/renderer/architecture-ui.js"), "utf8");

  const article = {
    citationKey: "ARTICLE",
    sourceType: "journal_article",
    author: "Pérez, J.; Gómez, A.",
    corporateAuthor: "",
    year: "2026",
    title: "Resultados académicos",
    publisher: "",
    url: "",
    doi: "10.1000/test",
    metadata: {
      journalTitle: "Revista de Educación",
      volume: "12",
      issue: "2",
      pages: "10-20"
    },
    active: true
  };
  const articleValidation = citations.validateCitation(article);
  article.complete = articleValidation.ok;
  article.validation = articleValidation;

  const badWeb = {
    sourceType: "webpage",
    corporateAuthor: "Institución",
    author: "",
    year: "2026",
    title: "Página",
    url: "",
    metadata: {}
  };

  const sameYear = citations.prepareCitationSet([
    { citationKey: "A", sourceType: "institutional", corporateAuthor: "Institución", year: "2026", title: "Documento A", metadata: {}, active: true },
    { citationKey: "B", sourceType: "institutional", corporateAuthor: "Institución", year: "2026", title: "Documento B", metadata: {}, active: true }
  ]);

  const duplicate = citations.prepareCitationSet([
    Object.assign({}, article, { citationKey: "ARTICLE-A" }),
    Object.assign({}, article, { citationKey: "ARTICLE-B" })
  ]);

  return {
    sourceTypes: citations.sourceTypeOptions().length >= 15,
    articleValid: articleValidation.ok,
    webValidation: citations.validateCitation(badWeb).ok === false,
    multiAuthor: citations.formatInText(article) === "(Pérez & Gómez, 2026)",
    doi: citations.normalizeDoi("10.1000/test") === "https://doi.org/10.1000/test",
    richReference:
      citations.formatReferenceHtml(article).includes("<em>Revista de Educación</em>") &&
      citations.formatReference(article).includes("https://doi.org/10.1000/test"),
    yearSuffix:
      sameYear.citations.some((item) => item.displayYear === "2026a") &&
      sameYear.citations.some((item) => item.displayYear === "2026b"),
    dedupe: duplicate.references.length === 1,
    usedOnly:
      exportSource.includes("resolveInstanceCitations") &&
      exportSource.includes("citationTokensFromInstance") &&
      !exportSource.includes("citations.listCitations(userDataPath, instance.dossierId)"),
    frozen:
      hubSource.includes("citationSnapshot") &&
      exportSource.includes('citationSnapshotMode = "frozen"'),
    htmlReferences:
      apaSource.includes("formatReferenceHtml") &&
      apaSource.includes("No se utilizaron referencias en este documento"),
    ui:
      renderer.includes("citationMetadataTemplate") &&
      renderer.includes("Tipo de fuente APA 7")
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
    const independentEngines = independentEngineCheck();
    if (
      !independentEngines.report.independent ||
      !independentEngines.allOwned ||
      !independentEngines.runtimeIsolation ||
      !independentEngines.crossEngineIsolation ||
      !independentEngines.blueprintIsolation ||
      !independentEngines.noGenericFallback
    ) {
      errors.push("La independencia real de los 33 motores no superó la validación interna.");
    }
  } catch (error) {
    errors.push(`No se pudo validar la independencia de motores: ${error.message}`);
  }

  try {
    const outlines = documentOutlineCheck();
    if (
      !outlines.allValid ||
      !outlines.allScaffolded ||
      !outlines.nestedTree ||
      !outlines.rejectsBadDependencies ||
      !outlines.detectionAnalysis ||
      !outlines.planningDependencies ||
      !outlines.curricularDependencies ||
      !outlines.persistedContracts ||
      !outlines.aiUsesContracts ||
      !outlines.uiShowsStructure
    ) {
      errors.push("La estructura propia por documento del Bloque 2 no superó la validación interna.");
    }
  } catch (error) {
    errors.push(`No se pudo validar la estructura propia por documento: ${error.message}`);
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
    const dataEngine = dataEngineCheck();
    if (
      !dataEngine.normalizesText ||
      !dataEngine.fullAggregation ||
      !dataEngine.canonicalMapping ||
      !dataEngine.queryValidation ||
      !dataEngine.duplicateGuard ||
      !dataEngine.traceability ||
      !dataEngine.privacy ||
      !dataEngine.aiContract ||
      !dataEngine.versionedQueries ||
      !dataEngine.ipc ||
      !dataEngine.bridge ||
      !dataEngine.ui
    ) {
      errors.push("El motor de datos del Bloque 3 no superó la validación interna.");
    }
  } catch (error) {
    errors.push(`No se pudo validar el motor de datos del Bloque 3: ${error.message}`);
  }

  try {
    const documentBindings = documentDataBindingCheck();
    if (
      !documentBindings.allPlans ||
      !documentBindings.engineMetadata ||
      !documentBindings.versionedBindings ||
      !documentBindings.rejectsSplitMandatoryFields ||
      !documentBindings.isolatesCompatibleSources ||
      !documentBindings.prunesOptionalFields ||
      !documentBindings.canonicalVocabulary ||
      !documentBindings.localizedNumbers ||
      !documentBindings.aiRuntime ||
      !documentBindings.backendReadiness ||
      !documentBindings.uiReadiness
    ) {
      errors.push("Los bindings de datos por documento del Bloque 3 no superaron la validación interna.");
    }
  } catch (error) {
    errors.push(`No se pudieron validar los bindings de datos por documento: ${error.message}`);
  }

  try {
    const draftFinalAlerts = draftFinalAlertCheck();
    if (
      !draftFinalAlerts.traceSummary ||
      !draftFinalAlerts.blockTrace ||
      !draftFinalAlerts.noAlertGate ||
      !draftFinalAlerts.frozenTrace ||
      !draftFinalAlerts.draftIncludesBlockAlerts ||
      !draftFinalAlerts.finalHidesAlerts ||
      !draftFinalAlerts.workingCopy
    ) {
      errors.push("El flujo borrador/final y trazabilidad de alertas del Bloque 4 no superó la validación interna.");
    }
  } catch (error) {
    errors.push(`No se pudo validar el flujo borrador/final del Bloque 4: ${error.message}`);
  }

  try {
    const aiGeneration = aiGenerationResilienceCheck();
    if (
      !aiGeneration.runSchema ||
      !aiGeneration.humanProtection ||
      !aiGeneration.retryPolicy ||
      !aiGeneration.fallback ||
      !aiGeneration.reviewerBlocks ||
      !aiGeneration.reviewStatus ||
      !aiGeneration.documentMemory ||
      !aiGeneration.partialResume ||
      !aiGeneration.ipc ||
      !aiGeneration.bridge ||
      !aiGeneration.ui
    ) {
      errors.push("La resiliencia de generación IA del Bloque 6 no superó la validación interna: " + JSON.stringify(aiGeneration));
    }
  } catch (error) {
    errors.push(`No se pudo validar la generación IA del Bloque 6: ${error.message}`);
  }

  try {
    const exportVisualQuality = exportVisualQualityCheck();
    if (
      !exportVisualQuality.allVisuals ||
      !exportVisualQuality.rejectsEmptyVisuals ||
      !exportVisualQuality.signatures ||
      !exportVisualQuality.incomplete ||
      !exportVisualQuality.exportManifest ||
      !exportVisualQuality.uiFailure ||
      !exportVisualQuality.missingAssets ||
      !exportVisualQuality.multipageTables ||
      !exportVisualQuality.wordLayout
    ) {
      errors.push(`La exportación Word/PDF y el motor gráfico del Bloque 5 no superaron la validación interna: ${JSON.stringify(exportVisualQuality)}`);
    }
  } catch (error) {
    errors.push(`No se pudo validar Word/PDF y visuales del Bloque 5: ${error.message}`);
  }

  try {
    const apaCitations = apaCitationCheck();
    if (
      !apaCitations.sourceTypes ||
      !apaCitations.articleValid ||
      !apaCitations.webValidation ||
      !apaCitations.multiAuthor ||
      !apaCitations.doi ||
      !apaCitations.richReference ||
      !apaCitations.yearSuffix ||
      !apaCitations.dedupe ||
      !apaCitations.usedOnly ||
      !apaCitations.frozen ||
      !apaCitations.htmlReferences ||
      !apaCitations.ui
    ) {
      errors.push("El motor APA 7 del Bloque 4 no superó la validación interna.");
    }
  } catch (error) {
    errors.push(`No se pudo validar el motor APA 7 del Bloque 4: ${error.message}`);
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

  try {
    const formationWorkspace = formationProcessWorkspaceCheck();
    if (
      !formationWorkspace.fourDocuments ||
      !formationWorkspace.periodSelector ||
      !formationWorkspace.automaticFormationDossier ||
      !formationWorkspace.directDocumentEntry ||
      !formationWorkspace.cards ||
      !formationWorkspace.editorAndDraft
    ) {
      errors.push("El espacio del proceso de Formación no superó la validación interna: " + JSON.stringify(formationWorkspace));
    }
  } catch (error) {
    errors.push(`No se pudo validar el espacio del proceso de Formación: ${error.message}`);
  }

  try {
    const periodArchitecture = processPeriodArchitectureCheck();
    if (
      !periodArchitecture.monthSelectors ||
      !periodArchitecture.yearIncrementals ||
      !periodArchitecture.automaticPeriodIdentity ||
      !periodArchitecture.chronologyGuard ||
      !periodArchitecture.processReuse ||
      !periodArchitecture.structuredPeriodInDossier ||
      !periodArchitecture.aiPeriodInheritance
    ) {
      errors.push("La arquitectura período → proceso → documentos no superó la validación interna: " + JSON.stringify(periodArchitecture));
    }
  } catch (error) {
    errors.push(`No se pudo validar la herencia del período por proceso: ${error.message}`);
  }

  try {
    const dialogs = architectureDialogCheck();
    if (!dialogs.hasInternalDialog || !dialogs.noNativeDialogs) {
      errors.push("La interfaz de procesos aún depende de diálogos nativos no fiables de Electron.");
    }
  } catch (error) {
    errors.push(`No se pudo validar el sistema de diálogos internos: ${error.message}`);
  }

  console.log("Documentos ITSQMET · diagnóstico v4.0.0");
  console.log("-----------------------------------");
  if (catalog) console.log(`Catálogo: ${catalog.units} unidades · ${catalog.processes} procesos · ${catalog.documents} documentos`);
  warnings.forEach((warning) => console.log(`AVISO: ${warning}`));

  if (errors.length) {
    errors.forEach((error) => console.error(`ERROR: ${error}`));
    process.exitCode = 1;
  } else {
    console.log("OK: v4 validada · jerarquía multinivel, bloques, 14 herramientas visuales, APA 7, paginación y arquitectura v3 compatibles.");
  }
}

main();
