const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const connections = new Map();
const CURRENT_SCHEMA_VERSION = 3;

function workspaceRoot(userDataPath) {
  const dir = path.join(userDataPath, "documentos-workspace");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function databasePath(userDataPath) {
  return path.join(workspaceRoot(userDataPath), "documentos.db");
}

function baseSchema(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      short_name TEXT NOT NULL,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      icon TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS processes (
      id TEXT PRIMARY KEY,
      unit_id TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      manual_note TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (unit_id) REFERENCES units(id)
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      process_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT,
      code_pattern TEXT,
      mode TEXT NOT NULL DEFAULT 'template',
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (process_id) REFERENCES processes(id)
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      document_id TEXT,
      unit_id TEXT,
      process_id TEXT,
      name TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      local_path TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      confidence INTEGER NOT NULL DEFAULT 0,
      imported_at TEXT NOT NULL,
      validation_json TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id)
    );

    CREATE INDEX IF NOT EXISTS idx_templates_document
      ON templates(document_id, active);

    CREATE TABLE IF NOT EXISTS template_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      label TEXT,
      required INTEGER NOT NULL DEFAULT 0,
      config TEXT,
      columns_json TEXT,
      raw TEXT NOT NULL,
      valid INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_template_fields_template
      ON template_fields(template_id, sort_order);

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      document_id TEXT,
      template_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      unit_id TEXT,
      unit_name TEXT,
      process_id TEXT,
      process_code TEXT,
      process_name TEXT,
      document_name TEXT,
      document_type TEXT,
      code_pattern TEXT,
      mode TEXT NOT NULL DEFAULT 'template',
      ai_mode TEXT NOT NULL DEFAULT 'fallback',
      generated_code TEXT,
      analysis_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id),
      FOREIGN KEY (template_id) REFERENCES templates(id)
    );

    CREATE INDEX IF NOT EXISTS idx_projects_document
      ON projects(document_id, updated_at);

    CREATE TABLE IF NOT EXISTS project_fields (
      project_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      value_json TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (project_id, field_name),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      marker_name TEXT,
      name TEXT NOT NULL,
      extension TEXT,
      size INTEGER NOT NULL DEFAULT 0,
      local_path TEXT NOT NULL,
      added_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_files_project
      ON files(project_id, kind, marker_name);

    CREATE TABLE IF NOT EXISTS ai_analyses (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      provider TEXT,
      content_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_ai_analyses_project
      ON ai_analyses(project_id, created_at);

    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      generated_code TEXT,
      pdf_path TEXT,
      docx_path TEXT,
      engine TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_generations_project_version
      ON generations(project_id, version);

    CREATE TABLE IF NOT EXISTS document_versions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      template_id TEXT,
      template_version INTEGER,
      document_code TEXT,
      document_version TEXT,
      form_data_json TEXT NOT NULL,
      analysis_json TEXT,
      files_json TEXT,
      ai_mode TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES templates(id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_document_versions_project_version
      ON document_versions(project_id, version);

    CREATE INDEX IF NOT EXISTS idx_document_versions_project
      ON document_versions(project_id, created_at);

    CREATE TABLE IF NOT EXISTS app_errors (
      id TEXT PRIMARY KEY,
      severity TEXT NOT NULL DEFAULT 'error',
      module TEXT NOT NULL,
      action TEXT,
      message TEXT NOT NULL,
      detail TEXT,
      resolved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_app_errors_state
      ON app_errors(resolved, created_at);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      priority INTEGER NOT NULL DEFAULT 9,
      model TEXT,
      endpoint TEXT,
      encrypted_key TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS external_sync_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER NOT NULL DEFAULT 0,
      provider TEXT,
      endpoint TEXT,
      remote_workspace_id TEXT,
      last_sync_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload_json TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sync_queue_status
      ON sync_queue(status, created_at);
  `);

  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO external_sync_config
      (id, enabled, provider, endpoint, remote_workspace_id, last_sync_at, created_at, updated_at)
    VALUES (1, 0, '', '', '', NULL, ?, ?)
  `).run(now, now);
}

function tableHasColumn(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
}

function addColumnIfMissing(db, table, column, sqlType) {
  if (!tableHasColumn(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${sqlType}`);
  }
}

function metaGet(db, key) {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key);
  return row ? row.value : null;
}

function metaSet(db, key, value) {
  db.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES(?, ?)").run(key, String(value));
}

function schemaVersion(db) {
  const pragma = Number(db.pragma("user_version", { simple: true }) || 0);
  if (pragma > 0) return pragma;
  const legacy = Number(metaGet(db, "schema_version") || 0);
  return Number.isFinite(legacy) ? legacy : 0;
}

function setSchemaVersion(db, version) {
  db.pragma(`user_version = ${Number(version)}`);
  metaSet(db, "schema_version", String(version));
}

function migrateToV2(db) {
  addColumnIfMissing(db, "projects", "document_version", "TEXT NOT NULL DEFAULT '1.0'");
  addColumnIfMissing(db, "files", "sha256", "TEXT");
  addColumnIfMissing(db, "files", "integrity_checked_at", "TEXT");
  addColumnIfMissing(db, "templates", "sha256", "TEXT");
  addColumnIfMissing(db, "generations", "pdf_sha256", "TEXT");
  addColumnIfMissing(db, "generations", "docx_sha256", "TEXT");
}

function migrateToV3(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS document_versions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      template_id TEXT,
      template_version INTEGER,
      document_code TEXT,
      document_version TEXT,
      form_data_json TEXT NOT NULL,
      analysis_json TEXT,
      files_json TEXT,
      ai_mode TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES templates(id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_document_versions_project_version
      ON document_versions(project_id, version);

    CREATE INDEX IF NOT EXISTS idx_document_versions_project
      ON document_versions(project_id, created_at);

    CREATE TABLE IF NOT EXISTS app_errors (
      id TEXT PRIMARY KEY,
      severity TEXT NOT NULL DEFAULT 'error',
      module TEXT NOT NULL,
      action TEXT,
      message TEXT NOT NULL,
      detail TEXT,
      resolved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_app_errors_state
      ON app_errors(resolved, created_at);
  `);
}

function applyMigrations(db) {
  baseSchema(db);
  let version = schemaVersion(db);

  if (version < 1) {
    version = 1;
    setSchemaVersion(db, version);
  }

  if (version < 2) {
    const tx = db.transaction(() => migrateToV2(db));
    tx();
    version = 2;
    setSchemaVersion(db, version);
  }

  if (version < 3) {
    const tx = db.transaction(() => migrateToV3(db));
    tx();
    version = 3;
    setSchemaVersion(db, version);
  }

  if (version !== CURRENT_SCHEMA_VERSION) {
    throw new Error(`Versión de base no compatible: ${version}. Esperada: ${CURRENT_SCHEMA_VERSION}.`);
  }
}

function openDatabase(userDataPath) {
  const key = path.resolve(databasePath(userDataPath));
  if (connections.has(key)) return connections.get(key);

  const db = new Database(key);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  applyMigrations(db);
  connections.set(key, db);
  return db;
}

function closeAll() {
  for (const db of connections.values()) {
    try { db.close(); } catch (_error) { /* ignore */ }
  }
  connections.clear();
}

function queueSync(db, entityType, entityId, operation, payload) {
  const config = db.prepare("SELECT enabled FROM external_sync_config WHERE id = 1").get();
  if (!config || !config.enabled) return;

  const now = new Date().toISOString();
  const id = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(`
    INSERT INTO sync_queue
      (id, entity_type, entity_id, operation, payload_json, status, attempts, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?)
  `).run(id, entityType, entityId, operation, JSON.stringify(payload || {}), now, now);
}

function seedCatalog(db, catalog) {
  if (!catalog || !Array.isArray(catalog.units)) return;
  const now = new Date().toISOString();

  const insertUnit = db.prepare(`
    INSERT INTO units(id, short_name, name, full_name, icon, sort_order, updated_at)
    VALUES(@id, @short_name, @name, @full_name, @icon, @sort_order, @updated_at)
    ON CONFLICT(id) DO NOTHING
  `);

  const insertProcess = db.prepare(`
    INSERT INTO processes(id, unit_id, code, name, full_name, manual_note, sort_order, updated_at)
    VALUES(@id, @unit_id, @code, @name, @full_name, @manual_note, @sort_order, @updated_at)
    ON CONFLICT(id) DO NOTHING
  `);

  const insertDocument = db.prepare(`
    INSERT INTO documents(id, process_id, name, type, code_pattern, mode, sort_order, updated_at)
    VALUES(@id, @process_id, @name, @type, @code_pattern, @mode, @sort_order, @updated_at)
    ON CONFLICT(id) DO NOTHING
  `);

  const tx = db.transaction(() => {
    catalog.units.forEach((unit, unitIndex) => {
      insertUnit.run({
        id: unit.id,
        short_name: unit.short || unit.id,
        name: unit.name,
        full_name: unit.fullName || unit.name,
        icon: unit.icon || "",
        sort_order: unitIndex,
        updated_at: now
      });

      (unit.processes || []).forEach((process, processIndex) => {
        insertProcess.run({
          id: process.id,
          unit_id: unit.id,
          code: process.code,
          name: process.name,
          full_name: process.fullName || process.name,
          manual_note: process.manualNote || "",
          sort_order: processIndex,
          updated_at: now
        });

        (process.documents || []).forEach((document, documentIndex) => {
          insertDocument.run({
            id: document.id,
            process_id: process.id,
            name: document.name,
            type: document.type || "",
            code_pattern: document.code || "",
            mode: document.mode || "template",
            sort_order: documentIndex,
            updated_at: now
          });
        });
      });
    });
  });

  tx();
}

function seedCatalogIfEmpty(db, catalog) {
  const row = db.prepare("SELECT COUNT(*) AS total FROM units").get();
  if (!row || Number(row.total || 0) === 0) seedCatalog(db, catalog);
}

function getCatalog(db) {
  const units = db.prepare("SELECT * FROM units ORDER BY sort_order, name").all();
  const processes = db.prepare("SELECT * FROM processes ORDER BY unit_id, sort_order, name").all();
  const documents = db.prepare("SELECT * FROM documents ORDER BY process_id, sort_order, name").all();

  return {
    units: units.map((unit) => ({
      id: unit.id,
      short: unit.short_name,
      name: unit.name,
      fullName: unit.full_name,
      icon: unit.icon,
      processes: processes
        .filter((process) => process.unit_id === unit.id)
        .map((process) => ({
          id: process.id,
          code: process.code,
          name: process.name,
          fullName: process.full_name,
          manualNote: process.manual_note || "",
          documents: documents
            .filter((document) => document.process_id === process.id)
            .map((document) => ({
              id: document.id,
              name: document.name,
              type: document.type,
              code: document.code_pattern,
              mode: document.mode
            }))
        }))
    }))
  };
}

module.exports = {
  CURRENT_SCHEMA_VERSION,
  workspaceRoot,
  databasePath,
  openDatabase,
  closeAll,
  metaGet,
  metaSet,
  queueSync,
  seedCatalog,
  seedCatalogIfEmpty,
  getCatalog
};
