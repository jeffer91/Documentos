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

    const savedGuide = externalAiExchange.saveGuide(temp, externalProject.id, "Usar lenguaje institucional.");
    assert.strictEqual(savedGuide.guide, "Usar lenguaje institucional.");

    const builtPrompt = externalAiExchange.buildPrompt(temp, externalProject.id, "manual_ai", savedGuide.guide);
    assert.ok(builtPrompt.prompt.includes("Usar lenguaje institucional."));
    assert.ok(builtPrompt.prompt.includes("CONCLUSION_EXT"));
    assert.ok(builtPrompt.prompt.includes("//VERSION-PLANTILLA:1//"));
    assert.ok(builtPrompt.prompt.includes("Tipo: REDACCION"));
    assert.ok(builtPrompt.fieldsText.includes("//CAMPO:PERIODO_EXT//"));

    const externalResponse = [
      "//FORMATO:" + externalAiExchange.PROTOCOL + "//",
      "//DOCUMENTO:utet-informe-final//",
      "//PLANTILLA:abc123//",
      "//VERSION-PLANTILLA:1//",
      "//MODO:MANUALES+IA//",
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
      "//FIN-DOCUMENTO//"
    ].join("\n");

    const externalPreview = externalAiExchange.previewResponse(temp, externalProject.id, externalResponse, "manual_ai");
    assert.strictEqual(externalPreview.canImport, true);
    assert.strictEqual(externalPreview.summary.valid, 3);
    assert.strictEqual(externalPreview.summary.errors, 0);

    const externalApplied = externalAiExchange.applyResponse(temp, externalProject.id, externalResponse, "manual_ai", false);
    externalProject = externalApplied.project;
    assert.strictEqual(externalProject.formData.PERIODO_EXT, "Mayo 2026 - Noviembre 2026");
    assert.strictEqual(externalProject.formData.MODALIDAD_EXT, "Presencial");
    assert.strictEqual(
      externalProject.analysis.externalGeneratedFields.CONCLUSION_EXT,
      "El diagnóstico se completó con la información proporcionada."
    );

    const mergedExternal = externalAiExchange.mergeExternalGeneratedFields(externalProject, {
      provider: "Local",
      generatedFields: { CONCLUSION_EXT: "Texto interno" },
      fieldSources: {},
      keyFindings: [],
      missingData: [],
      tables: [],
      charts: [],
      sourceTrace: [],
      notes: ""
    });
    assert.strictEqual(
      mergedExternal.generatedFields.CONCLUSION_EXT,
      "El diagnóstico se completó con la información proporcionada."
    );

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
      "SMOKE OK: Electron, SQLite, catálogo, cálculos, IA externa exclusiva, integridad, objetos históricos, versiones informativas, errores y respaldo."
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
