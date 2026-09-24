const fs = require("fs");
const os = require("os");
const path = require("path");
const assert = require("assert");
const { app } = require("electron");
const database = require("../src/main/database-service.cjs");
const workspace = require("../src/main/workspace-service.cjs");
const backupService = require("../src/main/backup-service.cjs");
const errorService = require("../src/main/error-service.cjs");
const { applyCalculations } = require("../src/main/calculation-service.cjs");
const externalAiExchange = require("../src/main/external-ai-exchange.cjs");
const templateRequirements = require("../src/main/template-requirements.cjs");
const templateService = require("../src/main/template-service.cjs");
const processHub = require("../src/main/process-hub-service.cjs");
const outlineService = require("../src/main/document-outline-service.cjs");
const editorial = require("../src/main/editorial-structure-service.cjs");
const visualRenderer = require("../src/main/visual-renderer-service.cjs");
const citationService = require("../src/main/citation-service.cjs");
const dataIngestion = require("../src/main/data-ingestion-service.cjs");
const dataBindings = require("../src/main/document-data-binding-service.cjs");
const aiOrchestrator = require("../src/main/ai-orchestrator.cjs");
const draftExport = require("../src/main/draft-export-service.cjs");
const documentEngineRegistry = require("../src/main/document-engine-registry.cjs");
const { validateProject, validateSystemFields, validateExtractedData } = require("../src/main/project-validator.cjs");
const PizZip = require("pizzip");
const XLSX = require("xlsx");
const catalog = require("../src/renderer/catalog.js");

async function run() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "documentos-smoke-"));

  try {
    const db = database.openDatabase(temp);
    database.seedCatalogIfEmpty(db, catalog);

    const storedCatalog = database.getCatalog(db);
    const units = storedCatalog.units || [];
    const processes = units.flatMap((unit) => unit.processes || []);
    const documents = processes.flatMap((process) => process.documents || []);

    assert.strictEqual(units.length, 2);
    assert.strictEqual(processes.length, 19);
    assert.strictEqual(documents.length, 59);
    assert.strictEqual(
      Number(db.pragma("user_version", { simple: true })),
      database.CURRENT_SCHEMA_VERSION
    );
    assert.strictEqual(database.CURRENT_SCHEMA_VERSION, 6);
    assert.strictEqual(
      db.prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table' AND name = 'ai_providers'").get().total,
      0,
      "La base no debe conservar la tabla de proveedores de IA interna."
    );

    const locationDocx = path.join(temp, "ubicaciones.docx");
    const locationZip = new PizZip();
    locationZip.file("word/document.xml", "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body><w:p><w:pPr><w:pStyle w:val=\"Ttulo2\"/></w:pPr><w:r><w:t>5. Resultados del Diagnóstico</w:t></w:r></w:p><w:p><w:r><w:t>{{CAM!:PERIODO|Período}}</w:t></w:r></w:p></w:body></w:document>");
    locationZip.file("word/header1.xml", "<w:hdr xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:p><w:r><w:t>{{SYS:CODIGO}} {{SYS:CODIGO}}</w:t></w:r></w:p></w:hdr>");
    fs.writeFileSync(locationDocx, locationZip.generate({ type: "nodebuffer" }));
    const locationTemplate = templateService.importTemplate(temp, locationDocx, {
      unitId: "UTET",
      processId: "utet-95",
      documentId: "utet-informe-final"
    });
    const locationCode = locationTemplate.markers.find((item) => item.name === "CODIGO");
    const locationPeriod = locationTemplate.markers.find((item) => item.name === "PERIODO");
    assert.ok(locationCode && locationCode.locations.includes("Encabezado"));
    assert.strictEqual(locationCode.occurrenceCount, 2);
    assert.ok(locationPeriod && locationPeriod.locations.includes("Cuerpo del documento"));
    assert.strictEqual(locationPeriod.occurrenceCount, 1);
    assert.ok(locationPeriod.contexts.includes("5. Resultados del Diagnóstico"));

    const locationProject = workspace.createProject(temp, {
      unitId: "UTET",
      unitName: "Unidad de Titulación y Eficiencia Terminal",
      processId: "utet-95",
      processCode: "UTET-PRO-95",
      processName: "Evaluación semestral del proceso de titulación",
      documentId: "utet-informe-final",
      documentName: "Informe Final del Proceso de Titulación",
      documentType: "INF",
      documentVersion: "1.0",
      codePattern: "UTET-INF-0X-PRO-95-AÑO-MES",
      mode: "template",
      aiMode: "external",
      template: { id: locationTemplate.id }
    });
    const locationRequirements = templateRequirements.getRequirements(temp, locationProject.id);
    const hydratedCodeRequirement = locationRequirements.requirements.find((item) => item.name === "CODIGO");
    assert.ok(hydratedCodeRequirement.locations.includes("Encabezado"));
    assert.strictEqual(hydratedCodeRequirement.occurrenceCount, 2);
    const hydratedPeriodRequirement = locationRequirements.requirements.find((item) => item.name === "PERIODO");
    assert.ok(hydratedPeriodRequirement.contexts.includes("5. Resultados del Diagnóstico"));

    const invalidBlockDocx = path.join(temp, "bloque-en-encabezado.docx");
    const invalidBlockZip = new PizZip();
    invalidBlockZip.file("word/document.xml", "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body><w:p><w:r><w:t>Plantilla de prueba</w:t></w:r></w:p></w:body></w:document>");
    invalidBlockZip.file("word/header1.xml", "<w:hdr xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:p><w:r><w:t>{{IMG!:FIRMA|Firma}}</w:t></w:r></w:p></w:hdr>");
    fs.writeFileSync(invalidBlockDocx, invalidBlockZip.generate({ type: "nodebuffer" }));
    const invalidBlockTemplate = templateService.importTemplate(temp, invalidBlockDocx, {
      unitId: "UTET",
      processId: "utet-95",
      documentId: "utet-informe-final"
    });
    assert.ok(
      (invalidBlockTemplate.validation.errors || []).some((error) => error.includes("deben estar en el cuerpo del documento")),
      "Los bloques en encabezado o pie deben bloquear la plantilla."
    );
    assert.strictEqual(invalidBlockTemplate.active, false);
    const stillActiveAfterInvalid = templateService.activeTemplateForDocument(temp, "utet-informe-final");
    assert.strictEqual(stillActiveAfterInvalid.id, locationTemplate.id, "Una plantilla inválida no debe reemplazar la activa.");

    const mismatchDocx = path.join(temp, "Deteccion_Necesidades_Capacitacion.docx");
    const mismatchZip = new PizZip();
    mismatchZip.file("word/document.xml", "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body><w:p><w:r><w:t>Detección de Necesidades de Capacitación</w:t></w:r></w:p><w:p><w:r><w:t>{{CAM!:PERIODO|Período}}</w:t></w:r></w:p></w:body></w:document>");
    fs.writeFileSync(mismatchDocx, mismatchZip.generate({ type: "nodebuffer" }));
    const mismatchTemplate = templateService.importTemplate(temp, mismatchDocx, {
      unitId: "UGPA",
      processId: "ugpa-31",
      documentId: "ugpa-necesidades-formacion"
    });
    assert.ok(
      (mismatchTemplate.validation.warnings || []).some((warning) => warning.includes("Posible plantilla incorrecta")),
      "Debe advertir cuando una plantilla de Capacitación se carga en Formación."
    );

    const mismatchProject = workspace.createProject(temp, {
      unitId: "UGPA",
      unitName: "Unidad de Gestión de Procesos Académicos",
      processId: "ugpa-31",
      processCode: "UGPA-PRO-31",
      processName: "Formación Docente",
      documentId: "ugpa-necesidades-formacion",
      documentName: "Detección de Necesidades de Formación",
      documentType: "RGI",
      documentVersion: "1.0",
      codePattern: "UGPA-RGI1-0X-PRO-31-AÑO-MES",
      mode: "template",
      aiMode: "external",
      template: { id: mismatchTemplate.id }
    });
    const mismatchRequirements = templateRequirements.getRequirements(temp, mismatchProject.id);
    assert.ok(
      String(mismatchRequirements.associationWarning || "").includes("UGPA-PRO-70"),
      "La advertencia debe seguir apareciendo al abrir una plantilla ya guardada."
    );

    const source = path.join(temp, "fuente.txt");
    fs.writeFileSync(source, "Fuente de prueba", "utf8");

    let project = workspace.createProject(temp, {
      unitId: "UTET",
      unitName: "Unidad de Titulación y Eficiencia Terminal",
      processId: "utet-95",
      processCode: "UTET-PRO-95",
      processName: "Evaluación semestral del proceso de titulación",
      documentId: "utet-informe-final",
      documentName: "Informe Final del Proceso de Titulación",
      documentType: "INF",
      documentVersion: "1.0",
      codePattern: "UTET-INF-0X-PRO-95-AÑO-MES",
      mode: "template"
    });

    project.formData = { PERIODO: "Prueba" };
    project = workspace.saveProject(temp, project);
    assert.strictEqual(project.formData.PERIODO, "Prueba");
    assert.strictEqual(project.documentVersion, "1.0");

    const added = workspace.addAttachments(temp, project.id, "source", [source], "");
    assert.strictEqual(added.added.length, 1);
    assert.strictEqual(added.added[0].sha256.length, 64);
    assert.ok(
      fs.existsSync(workspace.objectPathForHash(temp, added.added[0].sha256)),
      "El archivo debe preservarse en el almacén histórico por hash."
    );

    assert.strictEqual(workspace.nextDocumentVersion(temp, project.id), 1);

    const currentDir = path.join(workspace.generatedDir(temp, project.id), "current");
    fs.mkdirSync(currentDir, { recursive: true });
    const pdf = path.join(currentDir, "documento.pdf");
    const docx = path.join(currentDir, "documento.docx");

    fs.writeFileSync(pdf, "pdf-actual-v1");
    fs.writeFileSync(docx, "docx-actual-v1");

    project = workspace.addGeneration(temp, project.id, {
      version: 1,
      code: "PRUEBA-01",
      engine: "Smoke",
      outputs: [
        { type: "pdf", path: pdf, primary: true },
        { type: "docx", path: docx, primary: false }
      ]
    });

    assert.strictEqual(project.informationVersionCount, 1);
    assert.strictEqual(workspace.nextDocumentVersion(temp, project.id), 2);

    project.formData.PERIODO = "Prueba 2";
    project = workspace.saveProject(temp, project);
    fs.writeFileSync(pdf, "pdf-actual-v2");
    fs.writeFileSync(docx, "docx-actual-v2");

    project = workspace.addGeneration(temp, project.id, {
      version: 2,
      code: "PRUEBA-02",
      engine: "Smoke",
      outputs: [
        { type: "pdf", path: pdf, primary: true },
        { type: "docx", path: docx, primary: false }
      ]
    });

    const versions = workspace.listDocumentVersions(temp, project.id);
    assert.strictEqual(versions.length, 2);
    assert.strictEqual(versions[0].version, 2);
    assert.strictEqual(versions[1].version, 1);
    assert.strictEqual(
      db.prepare("SELECT COUNT(*) AS total FROM generations WHERE project_id = ?").get(project.id).total,
      1
    );
    assert.strictEqual(fs.readFileSync(pdf, "utf8"), "pdf-actual-v2");

    const currentAttachment = project.attachments[0];
    fs.unlinkSync(currentAttachment.localPath);
    db.prepare("DELETE FROM files WHERE id = ?").run(currentAttachment.id);

    project = workspace.restoreDocumentVersion(temp, project.id, 1);
    assert.strictEqual(project.formData.PERIODO, "Prueba");
    assert.strictEqual(project.status, "draft");
    assert.strictEqual(project.attachments.length, 1);
    assert.ok(fs.existsSync(project.attachments[0].localPath));
    assert.strictEqual(
      fs.readFileSync(project.attachments[0].localPath, "utf8"),
      "Fuente de prueba"
    );


    const extTemplateId = "tpl-external-ai-smoke";
    const extNow = new Date().toISOString();
    db.prepare(`
      INSERT INTO templates
        (id, document_id, unit_id, process_id, name, version, local_path, active, confidence, imported_at, validation_json, sha256, deleted, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, 1, 100, ?, ?, ?, 0, ?)
    `).run(
      extTemplateId,
      "utet-informe-final",
      "UTET",
      "utet-95",
      "plantilla-ia-externa.docx",
      path.join(temp, "plantilla-ia-externa.docx"),
      extNow,
      JSON.stringify({ errors: [], warnings: [], ok: true }),
      "abc123",
      extNow
    );

    const insertExternalField = db.prepare(`
      INSERT INTO template_fields(template_id, type, name, label, required, config, columns_json, raw, valid, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, '[]', ?, 1, ?)
    `);
    insertExternalField.run(extTemplateId, "CAMPO", "PERIODO_EXT", "Período externo", 1, "", "CAMPO!:PERIODO_EXT|Período externo", 0);
    insertExternalField.run(extTemplateId, "LISTA", "MODALIDAD_EXT", "Modalidad externa", 1, "Presencial,En línea", "LISTA!:MODALIDAD_EXT|Modalidad externa|Presencial,En línea", 1);
    insertExternalField.run(extTemplateId, "IA", "CONCLUSION_EXT", "Conclusión externa", 0, "", "IA:CONCLUSION_EXT|Conclusión externa", 2);
    db.prepare(`
      INSERT INTO template_fields(template_id, type, name, label, required, config, columns_json, raw, valid, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      extTemplateId,
      "TABLA",
      "RESULTADOS_EXT",
      "Resultados externos",
      1,
      "Carrera:CAMPO,Porcentaje:NUMERO",
      JSON.stringify(["Carrera", "Porcentaje"]),
      "TAB:RESULTADOS_EXT|Resultados externos|Carrera:CAMPO,Porcentaje:NUMERO",
      3
    );
    db.prepare(`
      INSERT INTO template_fields(template_id, type, name, label, required, config, columns_json, raw, valid, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, '[]', ?, 1, ?)
    `).run(
      extTemplateId,
      "SISTEMA",
      "CODIGO",
      "Codigo",
      0,
      "",
      "SYS:CODIGO",
      4
    );

    let externalProject = workspace.createProject(temp, {
      unitId: "UTET",
      unitName: "Unidad de Titulación y Eficiencia Terminal",
      processId: "utet-95",
      processCode: "UTET-PRO-95",
      processName: "Evaluación semestral del proceso de titulación",
      documentId: "utet-informe-final",
      documentName: "Informe Final del Proceso de Titulación",
      documentType: "INF",
      documentVersion: "1.0",
      codePattern: "UTET-INF-0X-PRO-95-AÑO-MES",
      mode: "template",
      template: { id: extTemplateId }
    });

    const reqBeforeImport = templateRequirements.getRequirements(temp, externalProject.id);
    const tableReqBefore = reqBeforeImport.requirements.find((item) => item.name === "RESULTADOS_EXT");
    assert.ok(tableReqBefore);
    assert.strictEqual(tableReqBefore.status, "missing");
    assert.ok(reqBeforeImport.summary.blocking >= 1);


    const savedGuide = externalAiExchange.saveGuide(temp, externalProject.id, "Usar lenguaje institucional.");
    assert.strictEqual(savedGuide.guide, "Usar lenguaje institucional.");

    const builtPrompt = externalAiExchange.buildPrompt(temp, externalProject.id, "manual_ai", savedGuide.guide);
    assert.ok(builtPrompt.prompt.includes("Usar lenguaje institucional."));
    assert.ok(builtPrompt.prompt.includes("CONCLUSION_EXT"));
    assert.ok(builtPrompt.prompt.includes("//VERSION-PLANTILLA:1//"));
    assert.ok(builtPrompt.prompt.includes("Tipo: REDACCION"));
    assert.ok(builtPrompt.fieldsText.includes("//CAMPO:PERIODO_EXT//"));
    assert.ok(builtPrompt.fieldsText.includes("//TABLA:RESULTADOS_EXT//"));
    assert.strictEqual(builtPrompt.tableCount, 1);

    const externalResponse = [
      "//FORMATO:" + externalAiExchange.PROTOCOL + "//",
      "//DOCUMENTO:utet-informe-final//",
      "//PLANTILLA:abc123//",
      "//VERSION-PLANTILLA:1//",
      "//MODO:DOCUMENTO-COMPLETO//",
      "",
      "//CAMPO:PERIODO_EXT//",
      "Mayo 2026 - Noviembre 2026",
      "//FIN:PERIODO_EXT//",
      "",
      "//CAMPO:MODALIDAD_EXT//",
      "presencial",
      "//FIN:MODALIDAD_EXT//",
      "",
      "//CAMPO:CONCLUSION_EXT//",
      "El diagnóstico se completó con la información proporcionada.",
      "//FIN:CONCLUSION_EXT//",
      "",
      "//TABLA:RESULTADOS_EXT//",
      "//FILA//",
      "//DATO:CARRERA//",
      "Administración",
      "//FIN-DATO:CARRERA//",
      "//DATO:PORCENTAJE//",
      "82",
      "//FIN-DATO:PORCENTAJE//",
      "//FIN-FILA//",
      "//FIN-TABLA:RESULTADOS_EXT//",
      "",
      "//FIN-DOCUMENTO//"
    ].join("\n");

    const emptyTableResponse = externalResponse
      .replace("Administración", "")
      .replace("82", "");
    const emptyTablePreview = externalAiExchange.previewResponse(temp, externalProject.id, emptyTableResponse, "manual_ai");
    assert.ok(emptyTablePreview.items.some((item) => item.name === "RESULTADOS_EXT" && item.status === "error"));

    const malformedResponse = externalResponse.replace("//DATO:CARRERA//", "//DATO:CARRERA_MAL//").replace("//FIN-DATO:CARRERA//", "//FIN-DATO:CARRERA_MAL//");
    const malformedPreview = externalAiExchange.previewResponse(temp, externalProject.id, malformedResponse, "manual_ai");
    assert.strictEqual(malformedPreview.canImport, false);
    assert.ok(malformedPreview.summary.errors >= 1);
    assert.ok(malformedPreview.items.some((item) => item.name === "RESULTADOS_EXT" && item.status === "error"));

    assert.throws(
      () => externalAiExchange.applyResponse(temp, externalProject.id, malformedResponse, "manual_ai", false),
      /RESULTADOS_EXT|Resultados externos|columna/i,
      "El backend también debe impedir importar una respuesta con errores."
    );

    const externalPreview = externalAiExchange.previewResponse(temp, externalProject.id, externalResponse, "manual_ai");
    assert.strictEqual(externalPreview.canImport, true);
    assert.strictEqual(externalPreview.summary.valid, 4);
    assert.strictEqual(externalPreview.summary.errors, 0);

    const externalApplied = externalAiExchange.applyResponse(temp, externalProject.id, externalResponse, "manual_ai", false);
    externalProject = externalApplied.project;
    assert.strictEqual(externalProject.formData.PERIODO_EXT, "Mayo 2026 - Noviembre 2026");
    assert.strictEqual(externalProject.formData.MODALIDAD_EXT, "Presencial");
    assert.strictEqual(
      externalProject.analysis.externalGeneratedFields.CONCLUSION_EXT,
      "El diagnóstico se completó con la información proporcionada."
    );
    assert.strictEqual(externalProject.formData.RESULTADOS_EXT.length, 1);
    assert.strictEqual(externalProject.formData.RESULTADOS_EXT[0].Carrera, "Administración");
    assert.strictEqual(externalProject.formData.RESULTADOS_EXT[0].Porcentaje, 82);
    const reqAfterImport = templateRequirements.getRequirements(temp, externalProject.id);
    const tableReqAfter = reqAfterImport.requirements.find((item) => item.name === "RESULTADOS_EXT");
    assert.strictEqual(tableReqAfter.status, "ready");

    const reqBeforeNumber = templateRequirements.getRequirements(temp, externalProject.id);
    const codeReqBefore = reqBeforeNumber.requirements.find((item) => item.name === "CODIGO");
    assert.ok(codeReqBefore);
    assert.strictEqual(codeReqBefore.literal, "{{SYS:CODIGO}}");
    assert.strictEqual(codeReqBefore.status, "warning");
    assert.ok(reqBeforeNumber.summary.blocking >= 1);

    externalProject.formData.NUMERO_DOCUMENTO = "07";
    externalProject = workspace.saveProject(temp, externalProject);
    const reqAfterNumber = templateRequirements.getRequirements(temp, externalProject.id);
    const codeReqAfter = reqAfterNumber.requirements.find((item) => item.name === "CODIGO");
    assert.strictEqual(codeReqAfter.status, "ready");
    assert.ok(String(codeReqAfter.value).includes("07"));

    const deterministic = externalAiExchange.analysisFromExternalOnly(externalProject, {
      tables: [{ markerName: "BASE", headers: ["A"], rows: [["1"]] }],
      charts: [{ markerName: "GRAFICO", title: "Prueba", data: [{ label: "A", value: 1 }, { label: "B", value: 2 }] }],
      extractionWarnings: ["aviso"],
      dataSummary: [{ name: "base.xlsx", markerName: "BASE" }],
      textSources: []
    });
    assert.strictEqual(deterministic.tables.length, 1);
    assert.strictEqual(deterministic.charts.length, 1);
    assert.strictEqual(deterministic.missingData.length, 1);
    assert.strictEqual(deterministic.sourceTrace[0].name, "base.xlsx");


    const externalOnlyAnalysis = externalAiExchange.analysisFromExternalOnly(externalProject);
    assert.strictEqual(
      externalOnlyAnalysis.generatedFields.CONCLUSION_EXT,
      "El diagnóstico se completó con la información proporcionada."
    );

    externalProject.formData.UNRELATED_EXT = "Debe conservarse";
    externalProject = workspace.saveProject(temp, externalProject);

    externalProject = externalAiExchange.undoLastImport(temp, externalProject.id).project;
    assert.strictEqual(Object.prototype.hasOwnProperty.call(externalProject.formData, "PERIODO_EXT"), false);
    assert.strictEqual(externalProject.formData.UNRELATED_EXT, "Debe conservarse");
    assert.strictEqual(externalProject.analysis, null);

    const systemRequired = validateSystemFields({
      template: {
        systemFields: [{ valid: true, required: true, name: "ELABORADO_POR", label: "Elaborado por", raw: "SYS!:ELABORADO_POR" }]
      }
    }, {});
    assert.strictEqual(systemRequired.ok, false);
    assert.ok(systemRequired.errors[0].includes("{{SYS!:ELABORADO_POR}}"));

    const dataValidationProject = {
      attachments: [{ kind: "data", markerName: "BASE", name: "base.xlsx" }],
      template: {
        fields: [{ valid: true, required: true, type: "DATOS", name: "BASE", label: "Base", raw: "DAT!:BASE|Base" }]
      }
    };
    const unreadableData = validateExtractedData(dataValidationProject, { tables: [], extractionWarnings: ["base.xlsx: error de lectura"] });
    assert.strictEqual(unreadableData.ok, false);
    const readableData = validateExtractedData(dataValidationProject, {
      tables: [{ markerName: "BASE", headers: ["A"], rows: [["1"]] }],
      extractionWarnings: []
    });
    assert.strictEqual(readableData.ok, true);

    const truncatedRequiredData = validateExtractedData(dataValidationProject, {
      tables: [{ markerName: "BASE", headers: ["A"], rows: [["1"]] }],
      truncations: [{ markerName: "BASE", message: "base.xlsx excede el límite seguro." }],
      extractionWarnings: []
    });
    assert.strictEqual(truncatedRequiredData.ok, false);
    assert.ok(truncatedRequiredData.errors[0].includes("información incompleta"));

    const requiredGraph = validateExtractedData({
      attachments: [],
      template: {
        fields: [{ valid: true, type: "DATOS", name: "BASE", label: "Base", required: false }],
        markers: [{ valid: true, required: true, type: "GRAFICO", name: "RESUMEN", label: "Gráfico resumen", raw: "GRA!:RESUMEN|Gráfico resumen" }]
      }
    }, { tables: [], charts: [], extractionWarnings: [] });
    assert.strictEqual(requiredGraph.ok, false);

    const emptyManualTable = validateProject({
      mode: "template",
      codePattern: "",
      formData: { TABLA_REQ: [{}] },
      attachments: [],
      template: {
        localPath: locationDocx,
        sha256: "",
        validation: { errors: [], warnings: [] },
        systemFields: [],
        fields: [{
          valid: true,
          required: true,
          type: "TABLA",
          name: "TABLA_REQ",
          label: "Tabla requerida",
          columnDefs: [{ label: "Dato", type: "CAMPO" }]
        }]
      }
    });
    assert.strictEqual(emptyManualTable.ok, false);
    assert.ok(emptyManualTable.errors.some((error) => error.includes("filas vacías")));

    const invalidOptionalTypes = validateProject({
      mode: "template",
      codePattern: "",
      formData: {
        NUM_OPC: "abc",
        FECHA_OPC: "mañana",
        TAB_OPC: [{ Porcentaje: "no-numero" }]
      },
      attachments: [],
      template: {
        localPath: locationDocx,
        sha256: "",
        validation: { errors: [], warnings: [] },
        systemFields: [],
        fields: [
          { valid: true, required: false, type: "NUMERO", name: "NUM_OPC", label: "Número opcional" },
          { valid: true, required: false, type: "FECHA", name: "FECHA_OPC", label: "Fecha opcional" },
          {
            valid: true,
            required: false,
            type: "TABLA",
            name: "TAB_OPC",
            label: "Tabla opcional",
            columnDefs: [{ label: "Porcentaje", type: "NUMERO" }]
          }
        ]
      }
    });
    assert.strictEqual(invalidOptionalTypes.ok, false);
    assert.ok(invalidOptionalTypes.errors.some((error) => error.includes("Número opcional")));
    assert.ok(invalidOptionalTypes.errors.some((error) => error.includes("Fecha opcional")));
    assert.ok(invalidOptionalTypes.errors.some((error) => error.includes("Tabla opcional")));

    const calculation = applyCalculations({
      formData: { APROBADOS: 90, REPROBADOS: 10 },
      template: {
        markers: [
          { valid: true, type: "CALC", name: "TOTAL", label: "Total", formula: "SUM(APROBADOS,REPROBADOS)" },
          { valid: true, type: "CALC", name: "APROBACION", label: "Aprobación", formula: "PERCENT(APROBADOS,TOTAL)" }
        ]
      }
    }, { calculationData: [] });
    assert.strictEqual(calculation.ok, true, "Cálculo determinístico");
    assert.strictEqual(calculation.project.formData.TOTAL, 100);
    assert.strictEqual(calculation.project.formData.APROBACION, 90);

    // Arquitectura editorial v4
    processHub.ensureSchema(db);
    const sectionColumns = db.prepare("PRAGMA table_info(document_sections_v3)").all().map((item) => item.name);
    assert.ok(sectionColumns.includes("parent_key"));
    assert.ok(sectionColumns.includes("section_level"));
    assert.ok(sectionColumns.includes("numbering"));
    assert.strictEqual(
      db.prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type='table' AND name='document_blocks_v4'").get().total,
      1
    );

    const periodV4 = processHub.createPeriod(temp, { code: "SMOKE-V4", label: "Smoke V4" });
    const dossierV4 = processHub.createDossier(temp, {
      periodId: periodV4.id,
      processKey: "titulacion_regular",
      population: "regular",
      label: "Titulación Regular Smoke"
    });
    let instanceV4 = processHub.ensureDocumentInstance(temp, dossierV4.id, "tit.regular.informe-final", {
      type: "period_population",
      key: "regular"
    });
    assert.ok(instanceV4.sections.some((item) => item.key === "ANALISIS_RESULTADOS"));
    assert.ok(instanceV4.sections.some((item) => item.key === "RESUMEN_EJECUTIVO"));
    assert.ok(instanceV4.sections.every((item) => Number(item.level || 0) >= 1));
    assert.ok(instanceV4.sections.filter((item) => item.level === 1).every((item) => item.pageBreakBefore === true));
    assert.ok(instanceV4.engineSchemaHash, "Las instancias nuevas deben guardar el hash del motor.");
    assert.strictEqual(instanceV4.migrationRevision, 0);
    assert.strictEqual(instanceV4.engineState, "current");

    // Nuevo Bloque 1: independencia real de los 33 motores.
    const independenceReport = documentEngineRegistry.registryIndependenceReport();
    assert.strictEqual(independenceReport.engineCount, 33);
    assert.strictEqual(independenceReport.blueprintCount, 33);
    assert.strictEqual(independenceReport.uniqueDefinitionOwners, 33);
    assert.strictEqual(independenceReport.independent, true);
    assert.deepStrictEqual(independenceReport.missingBlueprints, []);
    assert.deepStrictEqual(independenceReport.orphanBlueprints, []);

    const regularOwned = documentEngineRegistry.getEngine("tit.regular.informe-final");
    const pvcOwned = documentEngineRegistry.getEngine("tit.pvc.informe-final");
    assert.strictEqual(regularOwned.definitionOwner, "tit.regular.informe-final");
    assert.strictEqual(pvcOwned.definitionOwner, "tit.pvc.informe-final");
    assert.strictEqual(regularOwned.definitionSource, "engine_blueprint");
    assert.strictEqual(pvcOwned.definitionSource, "engine_blueprint");
    assert.ok(regularOwned.sections.every((item) => item.definitionOwner === regularOwned.engineId));
    assert.ok(pvcOwned.sections.every((item) => item.definitionOwner === pvcOwned.engineId));
    assert.notStrictEqual(regularOwned.sections, pvcOwned.sections);
    assert.notStrictEqual(regularOwned.sections[0], pvcOwned.sections[0]);

    const regularOriginalTitle = regularOwned.sections[0].title;
    const pvcOriginalTitle = pvcOwned.sections[0].title;
    regularOwned.sections[0].title = "Título mutado solo en copia";
    regularOwned.dependencies.push("fake.dependency");
    regularOwned.scopeKeys.push("fake-scope");
    regularOwned.sections[0].data.runtimeMutation = true;

    const regularReloadedOwned = documentEngineRegistry.getEngine("tit.regular.informe-final");
    const pvcReloadedOwned = documentEngineRegistry.getEngine("tit.pvc.informe-final");
    assert.strictEqual(regularReloadedOwned.sections[0].title, regularOriginalTitle);
    assert.strictEqual(pvcReloadedOwned.sections[0].title, pvcOriginalTitle);
    assert.ok(!regularReloadedOwned.dependencies.includes("fake.dependency"));
    assert.ok(!regularReloadedOwned.scopeKeys.includes("fake-scope"));
    assert.strictEqual(regularReloadedOwned.sections[0].data.runtimeMutation, undefined);

    const regularBlueprintCopy = documentEngineRegistry.blueprintForEngine("tit.regular.informe-final");
    regularBlueprintCopy.push("FAKE_SECTION");
    assert.ok(!documentEngineRegistry.blueprintForEngine("tit.regular.informe-final").includes("FAKE_SECTION"));

    // Los perfiles antiguos pueden coincidir como metadato, pero ya no construyen la estructura.
    assert.strictEqual(regularReloadedOwned.profile, "report");
    assert.strictEqual(pvcReloadedOwned.profile, "report");
    assert.notStrictEqual(regularReloadedOwned.definitionOwner, pvcReloadedOwned.definitionOwner);

    // Nuevo Bloque 2: estructura propia, multinivel y validada por documento.
    const allStructureReports = documentEngineRegistry.allStructureReports();
    assert.strictEqual(allStructureReports.length, 33);
    assert.ok(allStructureReports.every((item) => item.ok));
    assert.ok(allStructureReports.every((item) => item.outlineStatus === "scaffold"));

    const nestedOutline = outlineService.compileOutline("SMOKE.OUTLINE", [
      {
        key: "METODOLOGIA_DEMO",
        title: "Metodología",
        type: "semi_stable_ai",
        children: [{
          key: "DISENO_DEMO",
          title: "Diseño",
          type: "semi_stable_ai",
          contract: {
            purpose: "Definir el diseño metodológico.",
            sourcePolicy: "fuentes_institucionales",
            visualPolicy: "optional",
            dataNeeds: [],
            promptInstructions: ["Mantener coherencia con el objetivo."]
          },
          children: [{
            key: "POBLACION_DEMO",
            title: "Población",
            type: "data_ai",
            children: [{
              key: "MUESTRA_DEMO",
              title: "Muestra",
              type: "data_ai",
              derivedFrom: ["POBLACION_DEMO"]
            }]
          }]
        }]
      }
    ], {}, { allowedVisuals: [] });
    assert.strictEqual(nestedOutline.validation.ok, true);
    assert.strictEqual(nestedOutline.validation.summary.maxDepth, 4);
    assert.strictEqual(nestedOutline.validation.summary.nodeCount, 4);
    assert.strictEqual(nestedOutline.validation.summary.contractedNodes, 1);

    assert.throws(
      () => outlineService.compileOutline("SMOKE.MISSING", [
        { key: "A", title: "A", type: "derived_ai", derivedFrom: ["NO_EXISTE"] }
      ], {}, { allowedVisuals: [] }),
      /no existe/
    );
    assert.throws(
      () => outlineService.compileOutline("SMOKE.CYCLE", [
        { key: "A", title: "A", type: "derived_ai", derivedFrom: ["B"] },
        { key: "B", title: "B", type: "derived_ai", derivedFrom: ["A"] }
      ], {}, { allowedVisuals: [] }),
      /circular/
    );

    const capDetectionEngine = documentEngineRegistry.getEngine("cap.deteccion");
    const capDetectionKeys = capDetectionEngine.sections.map((item) => item.key);
    assert.ok(capDetectionKeys.includes("ANALISIS_RESULTADOS"));
    assert.ok(capDetectionKeys.indexOf("RESULTADOS") < capDetectionKeys.indexOf("ANALISIS_RESULTADOS"));
    assert.ok(capDetectionKeys.indexOf("ANALISIS_RESULTADOS") < capDetectionKeys.indexOf("NECESIDADES_PRIORIZADAS"));
    const capAnalysis = capDetectionEngine.sections.find((item) => item.key === "ANALISIS_RESULTADOS");
    assert.strictEqual(capAnalysis.contract.visualPolicy, "recommended");
    assert.ok(capAnalysis.allowedVisuals.includes("ishikawa"));
    assert.ok(capAnalysis.allowedVisuals.includes("foda"));
    assert.ok(capAnalysis.allowedVisuals.includes("came"));
    const capNeeds = capDetectionEngine.sections.find((item) => item.key === "NECESIDADES_PRIORIZADAS");
    assert.deepStrictEqual(capNeeds.derivedFrom, ["RESULTADOS", "ANALISIS_RESULTADOS"]);

    const capDossier = processHub.createDossier(temp, {
      periodId: periodV4.id,
      processKey: "capacitacion",
      population: "all",
      label: "Capacitación Smoke"
    });
    const capDetectionInstance = processHub.ensureDocumentInstance(temp, capDossier.id, "cap.deteccion", {
      type: "period",
      key: periodV4.id
    });
    const persistedAnalysis = capDetectionInstance.sections.find((item) => item.key === "ANALISIS_RESULTADOS");
    assert.ok(persistedAnalysis);
    assert.strictEqual(persistedAnalysis.contract.visualPolicy, "recommended");
    assert.ok(persistedAnalysis.contract.promptInstructions.some((item) => item.includes("Ishikawa")));

    const planningEngine = documentEngineRegistry.getEngine("cap.plan");
    const planningConclusions = planningEngine.sections.find((item) => item.key === "CONCLUSIONES");
    assert.deepStrictEqual(planningConclusions.derivedFrom, ["PLANIFICACION", "CRONOGRAMA", "SEGUIMIENTO"]);

    const curricularEngine = documentEngineRegistry.getEngine("ccc.acta-colectivos");
    const curricularConclusions = curricularEngine.sections.find((item) => item.key === "CONCLUSIONES");
    const curricularRecommendations = curricularEngine.sections.find((item) => item.key === "RECOMENDACIONES");
    assert.deepStrictEqual(curricularConclusions.derivedFrom, ["ANALISIS_CURRICULAR", "ACUERDOS"]);
    assert.deepStrictEqual(curricularRecommendations.derivedFrom, ["ANALISIS_CURRICULAR", "ACUERDOS", "CONCLUSIONES"]);

    // Jerarquía multinivel y reglas editoriales.
    const hierarchyInstance = processHub.ensureDocumentInstance(temp, dossierV4.id, "tit.regular.informe-final", {
      type: "period_population",
      key: "hierarchy-block-2"
    });
    const hierarchyBaseEngine = documentEngineRegistry.getEngine("tit.regular.informe-final");
    const hierarchyEngine = Object.assign({}, hierarchyBaseEngine, {
      version: "4.0.0-hierarchy-smoke",
      sections: [{
        key: "METODOLOGIA_SMOKE",
        title: "Metodología",
        type: "semi_stable_ai",
        children: [{
          key: "DISENO_SMOKE",
          title: "Diseño",
          type: "semi_stable_ai",
          pageBreakBefore: true,
          children: [{
            key: "POBLACION_SMOKE",
            title: "Población",
            type: "data_ai",
            children: [{
              key: "MUESTRA_SMOKE",
              title: "Muestra",
              type: "data_ai"
            }]
          }]
        }]
      }]
    });
    const hierarchyMigration = processHub.synchronizeEngineInstance(temp, hierarchyInstance.id, hierarchyEngine);
    assert.strictEqual(hierarchyMigration.migrated, true);
    const hierarchyReloaded = processHub.getDocumentInstance(temp, hierarchyInstance.id);
    assert.deepStrictEqual(
      hierarchyReloaded.sections.map((item) => item.numbering),
      ["1", "1.1", "1.1.1", "1.1.1.1"]
    );
    assert.deepStrictEqual(
      hierarchyReloaded.sections.map((item) => item.level),
      [1, 2, 3, 4]
    );
    assert.strictEqual(hierarchyReloaded.sections[0].pageBreakBefore, true);
    assert.ok(hierarchyReloaded.sections.slice(1).every((item) => item.pageBreakBefore === false));
    assert.ok(hierarchyReloaded.sections.every((item) => item.keepWithNext === true));
    assert.strictEqual(hierarchyReloaded.sections[1].parentKey, "METODOLOGIA_SMOKE");
    assert.strictEqual(hierarchyReloaded.sections[2].parentKey, "DISENO_SMOKE");
    assert.strictEqual(editorial.validateHierarchy(hierarchyReloaded.sections).ok, true);

    assert.throws(
      () => editorial.flattenSections([{ key: "DUP_SMOKE", title: "A" }, { key: "DUP_SMOKE", title: "B" }]),
      /duplicada/
    );
    assert.throws(
      () => editorial.flattenSections([{ title: "Sin key" }]),
      /key estable/
    );

    const imageNarrativeValidation = editorial.validateSectionBlocks(
      { title: "Resultados", type: "data_ai", allowedVisuals: [] },
      [{ type: "image", title: "Imagen explicativa", data: { path: "demo.png" } }]
    );
    assert.strictEqual(imageNarrativeValidation.ok, false);
    assert.ok(imageNarrativeValidation.errors.some((item) => item.includes("contexto previo")));
    assert.ok(imageNarrativeValidation.errors.some((item) => item.includes("análisis posterior")));

    // Bloque 3: motor de datos completo, filtrable y seguro para IA.
    const largeDataPath = path.join(temp, "datos-complexivo-6001.xlsx");
    const largeRows = [["Cédula", "Carrera", "Sede", "Núcleo", "Componente", "Nota"]];
    for (let i = 1; i <= 6001; i += 1) {
      largeRows.push([
        `EST-${String(i).padStart(5, "0")}`,
        "Enfermería",
        i % 2 === 0 ? "Norte" : "Sur",
        i <= 5997 ? "Núcleo 1" : "Núcleo especial",
        "Teórico",
        i <= 5000 ? 0 : 100
      ]);
    }
    const largeWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(largeWorkbook, XLSX.utils.aoa_to_sheet(largeRows), "Notas");
    XLSX.writeFile(largeWorkbook, largeDataPath);

    const importedData = dataIngestion.importDataFile(temp, dossierV4.id, largeDataPath, { type: "dossier", key: "" });
    assert.strictEqual(importedData.profile.totalRows, 6001);
    const suggestions = dataIngestion.suggestMapping(temp, importedData.id);
    assert.strictEqual(suggestions.sheets[0].suggestions.career.source, "Carrera");
    assert.strictEqual(suggestions.sheets[0].suggestions.student_id.source, "Cédula");
    assert.strictEqual(suggestions.sheets[0].suggestions.core.source, "Núcleo");
    assert.strictEqual(suggestions.sheets[0].suggestions.grade.source, "Nota");

    const mappedData = dataIngestion.setMapping(temp, importedData.id, {
      fields: {
        student_id: "Cédula",
        career: "Carrera",
        campus: "Sede",
        core: "Núcleo",
        component: "Componente",
        grade: "Nota"
      }
    });
    assert.strictEqual(mappedData.mappingValidation.ok, true);
    assert.throws(
      () => dataIngestion.setMapping(temp, importedData.id, { fields: { career: "Columna inexistente" } }),
      /no encontró/
    );

    // Nuevo Bloque 3: bindings de datos reales por documento.
    const dataPlanReport = documentEngineRegistry.dataPlanReport();
    assert.strictEqual(dataPlanReport.valid, true);
    assert.strictEqual(dataPlanReport.engineCount, 33);
    assert.strictEqual(dataPlanReport.plannedEngineCount, 33);
    assert.deepStrictEqual(dataPlanReport.enginesWithoutPlan, []);
    assert.deepStrictEqual(dataPlanReport.invalidPlans, []);

    const capNoData = aiOrchestrator.instanceDataReadiness(temp, capDetectionInstance.id);
    const capNoDataResults = capNoData.sections.find((item) => item.sectionKey === "RESULTADOS");
    assert.ok(capNoDataResults);
    assert.strictEqual(capNoDataResults.status, "no_imports");
    assert.strictEqual(capNoDataResults.ready, false);

    const regularReadiness = aiOrchestrator.instanceDataReadiness(temp, instanceV4.id);
    const regularResultsReady = regularReadiness.sections.find((item) => item.sectionKey === "RESULTADOS");
    assert.ok(regularResultsReady);
    assert.strictEqual(regularResultsReady.ready, true);
    assert.strictEqual(regularResultsReady.status, "ready");
    assert.ok(regularResultsReady.availableFields.includes("career"));
    assert.ok(regularResultsReady.availableFields.includes("grade"));

    const planInstance = processHub.ensureDocumentInstance(temp, dossierV4.id, "tit.regular.plan-complexivo", {
      type: "period",
      key: ""
    });
    const planReadiness = aiOrchestrator.instanceDataReadiness(temp, planInstance.id);
    const planSchedule = planReadiness.sections.find((item) => item.sectionKey === "CRONOGRAMA");
    assert.ok(planSchedule);
    assert.strictEqual(planSchedule.ready, false);
    assert.strictEqual(planSchedule.status, "missing_fields");
    assert.ok(planSchedule.missingAny.some((group) => group.includes("event_date")));

    const plagiarismInstance = processHub.ensureDocumentInstance(temp, dossierV4.id, "tit.regular.plagio-trabajo", {
      type: "student",
      key: "EST-06001"
    });
    let plagiarismReadiness = aiOrchestrator.instanceDataReadiness(temp, plagiarismInstance.id);
    let plagiarismSectionReadiness = plagiarismReadiness.sections.find((item) => item.sectionKey === "RESULTADO_ANTIPLAGIO");
    assert.ok(plagiarismSectionReadiness);
    assert.strictEqual(plagiarismSectionReadiness.ready, false);
    assert.strictEqual(plagiarismSectionReadiness.status, "missing_fields");
    assert.ok(plagiarismSectionReadiness.missingAll.includes("plagiarism_percent"));

    const plagiarismPath = path.join(temp, "antiplagio-estudiantes.xlsx");
    const plagiarismWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      plagiarismWorkbook,
      XLSX.utils.aoa_to_sheet([
        ["Cédula", "Estudiante", "Porcentaje de plagio", "Título documento"],
        ["EST-06001", "Estudiante 6001", "12,5%", "Trabajo de titulación 6001"],
        ["EST-06000", "Estudiante 6000", "7%", "Trabajo de titulación 6000"]
      ]),
      "Antiplagio"
    );
    XLSX.writeFile(plagiarismWorkbook, plagiarismPath);

    const plagiarismImport = dataIngestion.importDataFile(temp, dossierV4.id, plagiarismPath, { type: "dossier", key: "" });
    const plagiarismSuggestions = dataIngestion.suggestMapping(temp, plagiarismImport.id);
    assert.strictEqual(plagiarismSuggestions.sheets[0].suggestions.student_id.source, "Cédula");
    assert.strictEqual(plagiarismSuggestions.sheets[0].suggestions.plagiarism_percent.source, "Porcentaje de plagio");
    dataIngestion.setMapping(temp, plagiarismImport.id, {
      fields: {
        student_id: "Cédula",
        student_name: "Estudiante",
        plagiarism_percent: "Porcentaje de plagio",
        document_title: "Título documento"
      }
    });

    plagiarismReadiness = aiOrchestrator.instanceDataReadiness(temp, plagiarismInstance.id);
    plagiarismSectionReadiness = plagiarismReadiness.sections.find((item) => item.sectionKey === "RESULTADO_ANTIPLAGIO");
    assert.strictEqual(plagiarismSectionReadiness.ready, true);
    assert.strictEqual(plagiarismSectionReadiness.status, "ready");

    const plagiarismLiveInstance = processHub.getDocumentInstance(temp, plagiarismInstance.id);
    const plagiarismLiveSection = plagiarismLiveInstance.sections.find((item) => item.key === "RESULTADO_ANTIPLAGIO");
    const resolvedPlagiarism = aiOrchestrator.dataReadinessForSection(
      temp,
      plagiarismLiveInstance,
      plagiarismLiveSection
    );
    assert.strictEqual(resolvedPlagiarism.ready, true);
    assert.deepStrictEqual(resolvedPlagiarism.query.importIds, [plagiarismImport.id]);
    assert.deepStrictEqual(resolvedPlagiarism.query.sheet, ["Antiplagio"]);
    assert.ok(resolvedPlagiarism.query.where.some((item) => item.field === "plagiarism_percent" && item.op === "exists"));
    assert.ok(resolvedPlagiarism.query.where.some((item) => item.field === "student_id" && item.value === "EST-06001"));

    const plagiarismSlice = dataIngestion.aiSlice(temp, dossierV4.id, resolvedPlagiarism.query);
    assert.strictEqual(plagiarismSlice.population.total, 1);
    assert.strictEqual(plagiarismSlice.summary.numeric.plagiarism_percent.average, 12.5);
    assert.strictEqual(plagiarismSlice.sampleRows.length, 1);
    assert.strictEqual(plagiarismSlice.sampleRows[0].student_id, "EST-06001");
    assert.strictEqual(plagiarismSlice.sampleRows[0].plagiarism_percent, "12,5%");
    assert.ok(plagiarismSlice.sourceTrace.every((item) => item.importId === plagiarismImport.id));

    assert.strictEqual(dataIngestion.numericValue("12,5%"), 12.5);
    assert.strictEqual(dataIngestion.numericValue("1.234,50"), 1234.5);

    const regularLive = processHub.getDocumentInstance(temp, instanceV4.id);
    const regularResultsSection = regularLive.sections.find((item) => item.key === "RESULTADOS");
    const regularResolved = aiOrchestrator.dataReadinessForSection(temp, regularLive, regularResultsSection);
    assert.strictEqual(regularResolved.ready, true);
    assert.deepStrictEqual(regularResolved.query.importIds, [importedData.id]);
    assert.deepStrictEqual(regularResolved.query.sheet, ["Notas"]);
    assert.ok(!regularResolved.query.importIds.includes(plagiarismImport.id));

    const splitBinding = dataBindings.bindingFor("tit.regular.plagio-trabajo", "RESULTADO_ANTIPLAGIO");
    const splitReadiness = dataBindings.resolveBinding(splitBinding, { scopeType: "student", scopeKey: "EST-1" }, {
      hasImports: true,
      availableFields: ["student_id", "plagiarism_percent"],
      imports: [
        { importId: "one", sheets: [{ name: "A", canonicalFields: ["student_id"] }] },
        { importId: "two", sheets: [{ name: "B", canonicalFields: ["plagiarism_percent"] }] }
      ]
    });
    assert.strictEqual(splitReadiness.ready, false);
    assert.ok(splitReadiness.warnings.some((item) => item.includes("misma hoja")));

    const pagedData = dataIngestion.queryData(temp, dossierV4.id, {
      scopeType: "period_population",
      scopeKey: "regular",
      scopePolicy: "inclusive",
      where: [
        { field: "career", op: "eq", value: "enfermeria" },
        { field: "component", op: "eq", value: "teorico" }
      ],
      select: ["student_id", "career", "core", "grade"],
      limit: 5000
    });
    assert.strictEqual(pagedData.total, 6001);
    assert.strictEqual(pagedData.returnedRows, 5000);
    assert.strictEqual(pagedData.truncated, true);
    assert.strictEqual(pagedData.sourceTrace.length, 1);
    assert.throws(
      () => dataIngestion.queryData(temp, dossierV4.id, {
        where: [{ field: "campo_inexistente", op: "eq", value: "x" }]
      }),
      /no existen o no están mapeados/
    );

    const fullSummary = dataIngestion.summarize(temp, dossierV4.id, {
      scopeType: "period_population",
      scopeKey: "regular",
      scopePolicy: "inclusive",
      where: [
        { field: "career", op: "eq", value: "ENFERMERÍA" },
        { field: "component", op: "eq", value: "TEÓRICO" }
      ],
      dimensions: ["core", "campus"],
      measures: ["grade"],
      groupBy: ["core"]
    });
    assert.strictEqual(fullSummary.total, 6001);
    assert.strictEqual(fullSummary.analyzedRows, 6001);
    assert.strictEqual(fullSummary.calculationComplete, true);
    assert.strictEqual(fullSummary.numeric.grade.count, 6001);
    assert.strictEqual(fullSummary.numeric.grade.average, 16.6806);
    assert.ok(fullSummary.numeric.grade.average > 0, "El promedio debe usar las 6001 filas, no solo las primeras 5000.");
    assert.strictEqual(fullSummary.percentages.core.find((item) => item.value === "Núcleo especial").count, 4);
    assert.strictEqual(fullSummary.groups.length, 2);
    assert.strictEqual(fullSummary.sourceTrace[0].sheets[0].firstRow, 2);
    assert.strictEqual(fullSummary.sourceTrace[0].sheets[0].lastRow, 6002);
    assert.strictEqual(fullSummary.querySignature.length, 64);
    assert.strictEqual(fullSummary.sourceTrace[0].mappingHash.length, 64);
    assert.strictEqual(fullSummary.inputSourceTrace[0].mappingHash.length, 64);

    const zeroSummary = dataIngestion.summarize(temp, dossierV4.id, {
      where: [{ field: "career", op: "eq", value: "Carrera inexistente" }],
      dimensions: ["core"],
      measures: ["grade"]
    });
    assert.strictEqual(zeroSummary.total, 0);
    assert.strictEqual(zeroSummary.sourceTrace.length, 0);
    assert.strictEqual(zeroSummary.inputSourceTrace.length, 2);
    assert.strictEqual(zeroSummary.querySignature.length, 64);

    const aggregateSlice = dataIngestion.aiSlice(temp, dossierV4.id, {
      where: [{ field: "career", op: "eq", value: "Enfermería" }],
      dimensions: ["core"],
      measures: ["grade"],
      groupBy: ["core"],
      privacyMinGroup: 5
    });
    assert.strictEqual(aggregateSlice.population.calculationComplete, true);
    assert.strictEqual(aggregateSlice.population.absoluteCountsExposed, false);
    assert.strictEqual(aggregateSlice.sampleRows.length, 0);
    const protectedCore = aggregateSlice.summary.percentages.core.find((item) => item.suppressed);
    assert.ok(protectedCore);
    assert.strictEqual(protectedCore.value, "Grupo protegido");
    assert.strictEqual(protectedCore.percentage, null);
    assert.ok(aggregateSlice.note.includes("todas las filas filtradas"));

    const studentSlice = dataIngestion.aiSlice(temp, dossierV4.id, {
      where: [
        { field: "student_id", op: "eq", value: "EST-06001" },
        { field: "grade", op: "exists" }
      ],
      measures: ["grade"],
      privacyMode: "student_specific",
      includeSampleRows: true,
      select: ["student_id", "career", "grade"],
      sampleLimit: 5
    });
    assert.strictEqual(studentSlice.sampleRows.length, 1);
    assert.deepStrictEqual(Object.keys(studentSlice.sampleRows[0]).sort(), ["career", "grade", "student_id"]);
    assert.strictEqual(studentSlice.sampleRows[0].student_id, "EST-06001");
    assert.strictEqual(studentSlice.sampleRows[0].grade, 100);
    assert.strictEqual(studentSlice.population.total, 1);
    assert.strictEqual(studentSlice.population.privacyMode, "student_specific");
    assert.strictEqual(studentSlice.summary.numeric.grade.suppressed, false);
    assert.strictEqual(studentSlice.summary.numeric.grade.average, 100);

    const rawDenied = dataIngestion.aiSlice(temp, dossierV4.id, {
      where: [{ field: "student_id", op: "eq", value: "EST-06001" }],
      includeSampleRows: true,
      select: ["student_id", "grade"]
    });
    assert.strictEqual(rawDenied.sampleRows.length, 0);
    assert.ok(rawDenied.warnings.some((item) => item.includes("modo de privacidad")));

    // Los filtros de datos forman parte del esquema versionado de cada motor.
    const queryContractInstance = processHub.ensureDocumentInstance(temp, dossierV4.id, "tit.regular.informe-final", {
      type: "period_population",
      key: "data-query-contract"
    });
    const baseQueryEngine = documentEngineRegistry.getEngine("tit.regular.informe-final");
    const dataQueryEngine = Object.assign({}, baseQueryEngine, {
      version: "4.0.0-data-query-smoke",
      sections: (baseQueryEngine.sections || []).map((section) => section.key === "RESULTADOS"
        ? Object.assign({}, section, {
            data: {
              query: {
                where: [
                  { field: "career", op: "eq", value: "Enfermería" },
                  { field: "component", op: "eq", value: "Teórico" }
                ],
                dimensions: ["core"],
                measures: ["grade"]
              }
            }
          })
        : section)
    });
    const queryContractMigration = processHub.synchronizeEngineInstance(temp, queryContractInstance.id, dataQueryEngine);
    assert.strictEqual(queryContractMigration.migrated, true);
    assert.ok(queryContractMigration.plan.updated.includes("RESULTADOS"));
    let queryContractReloaded = processHub.getDocumentInstance(temp, queryContractInstance.id);
    let queryResultsSection = queryContractReloaded.sections.find((section) => section.key === "RESULTADOS");
    assert.ok(queryResultsSection.data.query);
    assert.strictEqual(queryResultsSection.data.query.where[0].field, "career");

    const changedDataQueryEngine = Object.assign({}, dataQueryEngine, {
      sections: (dataQueryEngine.sections || []).map((section) => section.key === "RESULTADOS"
        ? Object.assign({}, section, {
            data: {
              query: {
                where: [
                  { field: "career", op: "eq", value: "Enfermería" },
                  { field: "core", op: "eq", value: "Núcleo 1" }
                ],
                dimensions: ["campus"],
                measures: ["grade"]
              }
            }
          })
        : section)
    });
    const queryContractMigrationTwo = processHub.synchronizeEngineInstance(temp, queryContractInstance.id, changedDataQueryEngine);
    assert.strictEqual(queryContractMigrationTwo.migrated, true);
    assert.ok(queryContractMigrationTwo.plan.updated.includes("RESULTADOS"));
    queryContractReloaded = processHub.getDocumentInstance(temp, queryContractInstance.id);
    queryResultsSection = queryContractReloaded.sections.find((section) => section.key === "RESULTADOS");
    assert.strictEqual(queryResultsSection.data.query.where[1].field, "core");

    const duplicateData = dataIngestion.importDataFile(temp, dossierV4.id, largeDataPath, { type: "dossier", key: "" });
    assert.strictEqual(duplicateData.id, importedData.id);
    assert.strictEqual(duplicateData.duplicateIgnored, true);
    assert.strictEqual(dataIngestion.listImports(temp, dossierV4.id).length, 2);

    // Bloque 1: migraciones de motores sin secciones fantasma ni pérdida histórica.
    const currentEngine = documentEngineRegistry.getEngine("tit.regular.informe-final");
    const legacySectionId = "section-legacy-smoke";
    const tsLegacy = new Date().toISOString();
    db.prepare(`
      INSERT INTO document_sections_v3
        (id, instance_id, section_key, section_order, title, section_type, status, content,
         data_json, provenance_json, alerts_json, locked, generated_at, updated_at, created_at,
         parent_key, section_level, sort_path, numbering, page_break_before, keep_with_next,
         layout_json, active, archived_at, archived_reason, definition_hash)
      VALUES (?, ?, 'LEGACY_SMOKE', 999, 'Sección histórica', 'ai', 'edited', 'Contenido histórico que debe conservarse.',
              '{}', '{}', '[]', 0, NULL, ?, ?, '', 1, '9999', '99', 1, 1,
              '{}', 1, NULL, '', 'legacy-definition')
    `).run(legacySectionId, instanceV4.id, tsLegacy, tsLegacy);
    db.prepare(`
      UPDATE document_instances_v3
      SET engine_version = '3.9.0-test', engine_schema_hash = 'legacy-hash',
          stale = 1, stale_reason = 'Cambió el dato maestro: prueba smoke'
      WHERE id = ?
    `).run(instanceV4.id);

    const migratedEngine = Object.assign({}, currentEngine, {
      version: "4.1.0-test",
      sections: (currentEngine.sections || [])
        .filter((item) => item.key !== "REFERENCIAS")
        .concat([{ key: "NUEVA_SMOKE", title: "Nueva sección smoke", type: "ai", required: false, children: [] }])
    });
    const migrationOne = processHub.synchronizeEngineInstance(temp, instanceV4.id, migratedEngine);
    assert.strictEqual(migrationOne.migrated, true);
    let migratedRow = db.prepare("SELECT * FROM document_instances_v3 WHERE id = ?").get(instanceV4.id);
    assert.strictEqual(migratedRow.engine_version, "4.1.0-test");
    assert.ok(migratedRow.engine_schema_hash && migratedRow.engine_schema_hash !== "legacy-hash");
    assert.strictEqual(Number(migratedRow.migration_revision), 1);
    assert.strictEqual(Number(migratedRow.migration_pending), 1);
    assert.strictEqual(Number(migratedRow.stale), 1, "El stale previo de datos debe conservarse.");

    let migratedInstance = processHub.getDocumentInstance(temp, instanceV4.id);
    assert.ok(migratedInstance.sections.some((item) => item.key === "NUEVA_SMOKE"));
    assert.ok(!migratedInstance.sections.some((item) => item.key === "LEGACY_SMOKE"));
    assert.ok(!migratedInstance.sections.some((item) => item.key === "REFERENCIAS"));
    const migrationPendingOne = migratedInstance.sections.filter((item) => item.status === "migration_pending");
    assert.ok(migrationPendingOne.some((item) => item.key === "NUEVA_SMOKE"));
    assert.strictEqual(migratedInstance.stale, true);

    // Revisar una sección no debe perder otras pendientes; al resolver la última, se limpia el stale de migración.
    migratedInstance = processHub.updateSection(temp, instanceV4.id, "NUEVA_SMOKE", {
      content: "Contenido revisado de la nueva sección.",
      status: "edited"
    });
    assert.strictEqual(migratedInstance.sections.some((item) => item.status === "migration_pending"), false);
    assert.strictEqual(migratedInstance.migrationPending, false);
    assert.strictEqual(migratedInstance.stale, true, "Resolver la migración no debe borrar un stale ajeno al motor.");
    assert.ok(migratedInstance.staleReason.includes("Cambió el dato maestro"));

    db.prepare("UPDATE document_instances_v3 SET stale = 0, stale_reason = '' WHERE id = ?").run(instanceV4.id);

    const archivedAfterOne = processHub.listArchivedSections(temp, instanceV4.id);
    assert.ok(archivedAfterOne.some((item) => item.key === "LEGACY_SMOKE" && item.content.includes("Contenido histórico")));
    assert.ok(archivedAfterOne.some((item) => item.key === "REFERENCIAS"));

    const historyOne = processHub.listEngineMigrations(temp, instanceV4.id);
    assert.strictEqual(historyOne.length, 1);
    assert.strictEqual(historyOne[0].fromVersion, "3.9.0-test");
    assert.strictEqual(historyOne[0].toVersion, "4.1.0-test");
    assert.ok(historyOne[0].actions.added.includes("NUEVA_SMOKE"));
    assert.ok(historyOne[0].actions.archived.includes("LEGACY_SMOKE"));
    assert.ok(historyOne[0].actions.archived.includes("REFERENCIAS"));

    const reintroducedEngine = Object.assign({}, migratedEngine, {
      version: "4.2.0-test",
      sections: (migratedEngine.sections || []).concat([
        { key: "LEGACY_SMOKE", title: "Sección histórica reactivada", type: "ai", required: false, children: [] }
      ])
    });
    const migrationTwo = processHub.synchronizeEngineInstance(temp, instanceV4.id, reintroducedEngine);
    assert.strictEqual(migrationTwo.migrated, true);
    const reactivatedRow = db.prepare(`
      SELECT * FROM document_sections_v3
      WHERE instance_id = ? AND section_key = 'LEGACY_SMOKE'
    `).get(instanceV4.id);
    assert.strictEqual(Number(reactivatedRow.active), 1);
    assert.strictEqual(reactivatedRow.content, "Contenido histórico que debe conservarse.");
    assert.strictEqual(reactivatedRow.archived_at, null);
    migratedInstance = processHub.getDocumentInstance(temp, instanceV4.id);
    assert.ok(migratedInstance.sections.some((item) => item.key === "LEGACY_SMOKE" && item.status === "migration_pending"));
    assert.strictEqual(migratedInstance.stale, true);
    assert.strictEqual(processHub.listEngineMigrations(temp, instanceV4.id).length, 2);

    // Un cambio solo de versión no obliga a revisar contenido si el esquema y reglas no cambiaron.
    const versionOnlyInstance = processHub.ensureDocumentInstance(temp, dossierV4.id, "tit.regular.informe-final", {
      type: "period_population",
      key: "regular-version-only"
    });
    const versionOnlyEngine = Object.assign({}, currentEngine, { version: "4.0.1-smoke" });
    const versionOnlyMigration = processHub.synchronizeEngineInstance(temp, versionOnlyInstance.id, versionOnlyEngine);
    assert.strictEqual(versionOnlyMigration.migrated, true);
    const versionOnlyReloaded = processHub.getDocumentInstance(temp, versionOnlyInstance.id);
    assert.strictEqual(versionOnlyReloaded.engineVersion, "4.0.1-smoke");
    assert.strictEqual(versionOnlyReloaded.migrationPending, false);
    assert.strictEqual(versionOnlyReloaded.sections.some((item) => item.status === "migration_pending"), false);

    // Una final congelada jamás se migra aunque el motor cambie después.
    const frozenAtSmoke = new Date().toISOString();
    const snapshotBeforeFreeze = processHub.getDocumentInstance(temp, instanceV4.id);
    const frozenSnapshotSmoke = {
      engineId: snapshotBeforeFreeze.engineId,
      engineVersion: snapshotBeforeFreeze.engineVersion,
      engineSchemaHash: snapshotBeforeFreeze.engineSchemaHash,
      migrationRevision: snapshotBeforeFreeze.migrationRevision,
      scopeType: snapshotBeforeFreeze.scopeType,
      scopeKey: snapshotBeforeFreeze.scopeKey,
      sections: snapshotBeforeFreeze.sections,
      frozenAt: frozenAtSmoke
    };
    db.prepare("UPDATE document_instances_v3 SET final_frozen_at = ?, frozen_snapshot_json = ?, status = 'final' WHERE id = ?")
      .run(frozenAtSmoke, JSON.stringify(frozenSnapshotSmoke), instanceV4.id);
    db.prepare("UPDATE document_sections_v3 SET content = 'MUTACIÓN LIVE QUE NO DEBE VERSE' WHERE instance_id = ? AND section_key = 'INTRODUCCION'")
      .run(instanceV4.id);
    const futureEngine = Object.assign({}, reintroducedEngine, {
      version: "5.0.0-test",
      sections: (reintroducedEngine.sections || []).filter((item) => item.key !== "NUEVA_SMOKE")
    });
    const frozenMigration = processHub.synchronizeEngineInstance(temp, instanceV4.id, futureEngine);
    assert.strictEqual(frozenMigration.migrated, false);
    assert.strictEqual(frozenMigration.frozen, true);
    migratedRow = db.prepare("SELECT * FROM document_instances_v3 WHERE id = ?").get(instanceV4.id);
    assert.strictEqual(migratedRow.engine_version, "4.2.0-test");
    assert.strictEqual(Number(migratedRow.migration_revision), 2);
    assert.strictEqual(processHub.listEngineMigrations(temp, instanceV4.id).length, 2);
    const frozenVisible = processHub.getDocumentInstance(temp, instanceV4.id);
    const frozenIntro = frozenVisible.sections.find((item) => item.key === "INTRODUCCION");
    assert.ok(frozenIntro);
    assert.notStrictEqual(frozenIntro.content, "MUTACIÓN LIVE QUE NO DEBE VERSE");

    const instanceBlocksV4 = processHub.ensureDocumentInstance(temp, dossierV4.id, "tit.regular.informe-final", {
      type: "period_population",
      key: "regular-blocks"
    });
    const blockResult = processHub.setSectionBlocks(temp, instanceBlocksV4.id, "RESULTADOS", [
      { type: "prose", role: "context", text: "La tabla siguiente presenta el resultado consolidado del período analizado." },
      { type: "table", title: "Resultado consolidado", data: { headers: ["Indicador", "Porcentaje"], rows: [["Cumplimiento", "85%"]] } },
      { type: "prose", role: "analysis", text: "El porcentaje evidencia un nivel de cumplimiento alto respecto del criterio observado." }
    ]);
    assert.strictEqual(blockResult.validation.ok, true);
    const instanceBlocksReloaded = processHub.getDocumentInstance(temp, instanceBlocksV4.id);
    const resultsSection = instanceBlocksReloaded.sections.find((item) => item.key === "RESULTADOS");
    assert.strictEqual(resultsSection.blocks.length, 3);
    assert.strictEqual(resultsSection.blocks[1].type, "table");

    const orphanValidation = editorial.validateSectionBlocks(
      { title: "Prueba", type: "data_ai", allowedVisuals: [] },
      [{ type: "table", title: "Tabla aislada", data: { headers: ["A"], rows: [["1"]] } }]
    );
    assert.strictEqual(orphanValidation.ok, false);

    const visualSvg = visualRenderer.renderSvg("cards", {
      title: "Núcleos",
      items: [
        { title: "Núcleo 1", value: "85%" },
        { title: "Núcleo 2", value: "88%" },
        { title: "Núcleo 3", value: "91%" },
        { title: "Núcleo 4", value: "87%" }
      ]
    });
    assert.ok(visualSvg.includes("<svg"));
    assert.ok(visualSvg.includes("Núcleo 4"));

    // Bloque 4: APA 7 tipado, referencias usadas y snapshot bibliográfico.
    const articleCitation = citationService.upsertCitation(temp, dossierV4.id, {
      citationKey: "APA:ARTICLE",
      sourceType: "journal_article",
      author: "Pérez, J.; Gómez, A.",
      year: "2026",
      title: "Resultados académicos",
      doi: "10.1000/apa-smoke",
      metadata: {
        journalTitle: "Revista de Educación",
        volume: "12",
        issue: "2",
        pages: "10-20"
      }
    });
    assert.strictEqual(articleCitation.complete, true);
    assert.strictEqual(articleCitation.doi, "https://doi.org/10.1000/apa-smoke");
    assert.strictEqual(citationService.formatInText(articleCitation), "(Pérez & Gómez, 2026)");
    assert.ok(citationService.formatReference(articleCitation).includes("Revista de Educación"));
    assert.ok(citationService.formatReferenceHtml(articleCitation).includes("<em>Revista de Educación</em>"));

    assert.strictEqual(
      citationService.formatInText({
        sourceType: "journal_article",
        author: "Pérez, J.; Gómez, A.; Ruiz, C.",
        year: "2026",
        title: "Prueba",
        metadata: {}
      }),
      "(Pérez et al., 2026)"
    );

    const invalidWeb = citationService.upsertCitation(temp, dossierV4.id, {
      citationKey: "APA:WEB-INCOMPLETE",
      sourceType: "webpage",
      corporateAuthor: "Institución web",
      year: "2026",
      title: "Página sin URL"
    });
    assert.strictEqual(invalidWeb.complete, false);
    assert.ok(invalidWeb.validation.errors.some((item) => item.includes("URL")));

    const removableCitation = citationService.upsertCitation(temp, dossierV4.id, {
      citationKey: "APA:REMOVABLE",
      sourceId: "SOURCE-REMOVABLE",
      sourceType: "institutional",
      corporateAuthor: "Institución removible",
      year: "2026",
      title: "Documento removible"
    });
    assert.strictEqual(removableCitation.complete, true);
    citationService.deactivateCitationBySource(temp, dossierV4.id, "SOURCE-REMOVABLE");
    assert.strictEqual(citationService.getCitation(temp, dossierV4.id, "APA:REMOVABLE"), null);

    const legalCitation = citationService.upsertCitation(temp, dossierV4.id, {
      citationKey: "APA:LAW",
      sourceType: "law",
      year: "2026",
      title: "Ley de prueba",
      url: "https://example.test/ley",
      metadata: {
        legalNumber: "Ley No. 001",
        officialPublication: "Registro Oficial de prueba",
        jurisdiction: "Ecuador",
        shortTitle: "Ley de prueba"
      }
    });
    assert.strictEqual(legalCitation.complete, true);
    assert.ok(citationService.formatInText(legalCitation).includes("Ley de prueba"));

    const suffixSet = citationService.prepareCitationSet([
      {
        citationKey: "APA:SUFFIX-A",
        sourceType: "institutional",
        corporateAuthor: "Institución",
        year: "2026",
        title: "Documento A",
        metadata: {},
        active: true,
        complete: true
      },
      {
        citationKey: "APA:SUFFIX-B",
        sourceType: "institutional",
        corporateAuthor: "Institución",
        year: "2026",
        title: "Documento B",
        metadata: {},
        active: true,
        complete: true
      }
    ]);
    assert.deepStrictEqual(
      suffixSet.references.map((item) => item.displayYear),
      ["2026a", "2026b"]
    );

    const duplicateReferenceSet = citationService.prepareCitationSet([
      Object.assign({}, articleCitation, { citationKey: "APA:DUP-A" }),
      Object.assign({}, articleCitation, { citationKey: "APA:DUP-B" })
    ]);
    assert.strictEqual(duplicateReferenceSet.citations.length, 2);
    assert.strictEqual(duplicateReferenceSet.references.length, 1);

    const usedCitation = citationService.upsertCitation(temp, dossierV4.id, {
      citationKey: "APA:USED",
      sourceType: "institutional",
      corporateAuthor: "Nexum Tec",
      year: "2026",
      title: "Reglamento original congelado",
      publisher: "Nexum Tec",
      metadata: { documentCode: "UTET-RGI-SMOKE", reviewedByHuman: true }
    });
    assert.strictEqual(usedCitation.complete, true);

    const unusedCitation = citationService.upsertCitation(temp, dossierV4.id, {
      citationKey: "APA:UNUSED",
      sourceType: "book",
      author: "Autor, A.",
      year: "2025",
      title: "Libro que no debe aparecer",
      publisher: "Editorial de prueba"
    });
    assert.strictEqual(unusedCitation.complete, true);

    let apaInstance = processHub.ensureDocumentInstance(temp, dossierV4.id, "tit.regular.informe-final", {
      type: "period_population",
      key: "apa-block-4"
    });
    for (const sectionItem of apaInstance.sections) {
      const content = sectionItem.key === "INTRODUCCION"
        ? "La introducción se sustenta en la normativa institucional [[CITE:APA:USED]]."
        : "Contenido validado para la prueba editorial y bibliográfica.";
      apaInstance = processHub.updateSection(temp, apaInstance.id, sectionItem.key, {
        content,
        status: "edited",
        alerts: []
      });
    }

    const apaResultBlocks = processHub.setSectionBlocks(temp, apaInstance.id, "RESULTADOS", [
      { type: "prose", role: "context", text: "La siguiente tabla resume un dato sustentado en la misma fuente." },
      { type: "table", title: "Resultado bibliográfico", data: { headers: ["Dato"], rows: [["[[CITE:APA:USED]]"]] } },
      { type: "prose", role: "analysis", text: "El resultado se interpreta con base en la normativa citada." }
    ]);
    assert.strictEqual(apaResultBlocks.validation.ok, true);
    apaInstance = processHub.getDocumentInstance(temp, apaInstance.id);

    const tokenKeys = citationService.citationTokensFromInstance(apaInstance);
    assert.deepStrictEqual(tokenKeys, ["APA:USED"]);
    const usedResolution = citationService.resolveInstanceCitations(temp, apaInstance);
    assert.strictEqual(usedResolution.ok, true);
    assert.strictEqual(usedResolution.references.length, 1);
    assert.strictEqual(usedResolution.references[0].citationKey, "APA:USED");
    assert.ok(!usedResolution.references.some((item) => item.citationKey === "APA:UNUSED"));

    const frozenApa = processHub.freezeFinal(temp, apaInstance.id);
    assert.ok(frozenApa.finalFrozenAt);
    assert.ok(frozenApa.frozenSnapshot.citationSnapshot);
    assert.deepStrictEqual(frozenApa.frozenSnapshot.citationSnapshot.keys, ["APA:USED"]);
    assert.strictEqual(frozenApa.frozenSnapshot.citationSnapshot.references.length, 1);
    assert.strictEqual(
      frozenApa.frozenSnapshot.citationSnapshot.references[0].title,
      "Reglamento original congelado"
    );

    citationService.upsertCitation(temp, dossierV4.id, {
      citationKey: "APA:USED",
      title: "Reglamento MODIFICADO después de congelar"
    });

    const finalApaExport = draftExport.exportInstance(
      temp,
      frozenApa.id,
      { final: true, formats: ["html"] },
      path.join(__dirname, "..")
    );
    assert.strictEqual(finalApaExport.citationSnapshotMode, "frozen");
    assert.strictEqual(finalApaExport.referenceCount, 1);
    const finalApaHtml = fs.readFileSync(finalApaExport.outputs.find((item) => item.type === "html").path, "utf8");
    assert.ok(finalApaHtml.includes("Reglamento original congelado"));
    assert.ok(!finalApaHtml.includes("Reglamento MODIFICADO después de congelar"));
    assert.ok(!finalApaHtml.includes("Libro que no debe aparecer"));
    assert.ok(!finalApaHtml.includes("Resultados académicos"));
    assert.ok(!finalApaHtml.includes("[[CITE:APA:USED]]"));
    assert.ok(finalApaHtml.includes("Nexum Tec, 2026"));

    errorService.record(temp, {
      module: "smoke",
      action: "test",
      message: "Error de prueba"
    });
    assert.strictEqual(errorService.countOpen(temp), 1);
    errorService.resolveAll(temp);
    assert.strictEqual(errorService.countOpen(temp), 0);

    const backupRoot = path.join(temp, "backups");
    fs.mkdirSync(backupRoot, { recursive: true });
    const backup = await backupService.createBackup(temp, backupRoot);
    assert.ok(fs.existsSync(path.join(backup.path, "documentos.db")));

    console.log(
      "SMOKE OK: Electron, SQLite v6, catálogo, arquitectura v4, jerarquía, bloques, visuales, APA/citas, IA, cálculos, integridad, versiones y respaldo."
    );
  } finally {
    database.closeAll();
    try {
      fs.rmSync(temp, { recursive: true, force: true });
    } catch (_error) {
      // ignore
    }
  }
}

app.whenReady()
  .then(run)
  .then(() => app.quit())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
    app.quit();
  });
