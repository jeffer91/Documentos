const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { openDatabase, closeAll, workspaceRoot, CURRENT_SCHEMA_VERSION } = require("./database-service.cjs");

function stamp() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ].join("");
}

function copyDirIfExists(source, target) {
  if (!fs.existsSync(source)) return;
  fs.cpSync(source, target, { recursive: true, force: true });
}

async function createBackup(userDataPath, destinationRoot) {
  if (!destinationRoot) throw new Error("Selecciona una carpeta para guardar el respaldo.");

  const sourceRoot = workspaceRoot(userDataPath);
  const backupDir = path.join(destinationRoot, `Documentos-Backup-${stamp()}`);
  fs.mkdirSync(backupDir, { recursive: false });

  const db = openDatabase(userDataPath);
  await db.backup(path.join(backupDir, "documentos.db"));

  copyDirIfExists(path.join(sourceRoot, "templates"), path.join(backupDir, "templates"));
  copyDirIfExists(path.join(sourceRoot, "projects"), path.join(backupDir, "projects"));

  fs.writeFileSync(
    path.join(backupDir, "backup-manifest.json"),
    JSON.stringify({
      app: "Documentos ITSQMET",
      createdAt: new Date().toISOString(),
      schemaVersion: CURRENT_SCHEMA_VERSION
    }, null, 2),
    "utf8"
  );

  return { path: backupDir };
}

function validateBackup(backupDir) {
  const dbPath = path.join(backupDir || "", "documentos.db");
  if (!backupDir || !fs.existsSync(dbPath)) {
    throw new Error("La carpeta seleccionada no contiene un respaldo válido.");
  }

  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'").get();
    if (!row) throw new Error("El respaldo no contiene la estructura esperada.");
  } finally {
    db.close();
  }
}

function restoreBackup(userDataPath, backupDir) {
  validateBackup(backupDir);

  closeAll();
  const currentRoot = workspaceRoot(userDataPath);
  const parent = path.dirname(currentRoot);
  const safetyDir = path.join(parent, `documentos-workspace-antes-restaurar-${stamp()}`);

  fs.renameSync(currentRoot, safetyDir);

  try {
    fs.mkdirSync(currentRoot, { recursive: true });
    fs.copyFileSync(path.join(backupDir, "documentos.db"), path.join(currentRoot, "documentos.db"));
    copyDirIfExists(path.join(backupDir, "templates"), path.join(currentRoot, "templates"));
    copyDirIfExists(path.join(backupDir, "projects"), path.join(currentRoot, "projects"));
  } catch (error) {
    try { fs.rmSync(currentRoot, { recursive: true, force: true }); } catch (_error) { /* ignore */ }
    fs.renameSync(safetyDir, currentRoot);
    throw error;
  }

  return { restored: true, safetyPath: safetyDir };
}

module.exports = { createBackup, restoreBackup, validateBackup };
