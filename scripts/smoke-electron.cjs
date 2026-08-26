const fs = require("fs");
const os = require("os");
const path = require("path");
const assert = require("assert");
const { app } = require("electron");
const database = require("../src/main/database-service.cjs");
const workspace = require("../src/main/workspace-service.cjs");
const backupService = require("../src/main/backup-service.cjs");
const errorService = require("../src/main/error-service.cjs");
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

    project = workspace.restoreDocumentVersion(temp, project.id, 1);
    assert.strictEqual(project.formData.PERIODO, "Prueba");
    assert.strictEqual(project.status, "draft");

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
      "SMOKE OK: Electron, SQLite, catálogo, integridad, versiones informativas, errores y respaldo."
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
