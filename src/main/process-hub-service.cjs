const crypto = require("crypto");
const { openDatabase, queueSync } = require("./database-service.cjs");
const registry = require("./document-engine-registry.cjs");
const editorial = require("./editorial-structure-service.cjs");
const citations = require("./citation-service.cjs");
const engineSchema = require("./engine-schema-service.cjs");
const alertPolicy = require("./alert-policy-service.cjs");

function id(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

function now() {
  return new Date().toISOString();
}

function json(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch (_error) { return fallback; }
}

function ensureColumn(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((item) => item.name);
  if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS periods_v3 (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dossiers_v3 (
      id TEXT PRIMARY KEY,
      period_id TEXT NOT NULL,
      process_key TEXT NOT NULL,
      population TEXT NOT NULL DEFAULT 'all',
      label TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(period_id) REFERENCES periods_v3(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_dossiers_v3_unique
      ON dossiers_v3(period_id, process_key, population);

    CREATE TABLE IF NOT EXISTS dossier_segments_v3 (
      id TEXT PRIMARY KEY,
      dossier_id TEXT NOT NULL,
      segment_type TEXT NOT NULL,
      segment_key TEXT NOT NULL,
      label TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(dossier_id) REFERENCES dossiers_v3(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_dossier_segments_v3_unique
      ON dossier_segments_v3(dossier_id, segment_type, segment_key);

    CREATE TABLE IF NOT EXISTS master_data_v3 (
      id TEXT PRIMARY KEY,
      dossier_id TEXT NOT NULL,
      data_key TEXT NOT NULL,
      scope_type TEXT NOT NULL DEFAULT 'dossier',
      scope_key TEXT NOT NULL DEFAULT '',
      value_json TEXT NOT NULL,
      provenance_json TEXT NOT NULL DEFAULT '{}',
      revision INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(dossier_id) REFERENCES dossiers_v3(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_master_data_v3_unique
      ON master_data_v3(dossier_id, data_key, scope_type, scope_key);

    CREATE TABLE IF NOT EXISTS master_data_history_v3 (
      id TEXT PRIMARY KEY,
      master_data_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      value_json TEXT NOT NULL,
      provenance_json TEXT NOT NULL DEFAULT '{}',
      reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS document_instances_v3 (
      id TEXT PRIMARY KEY,
      dossier_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      engine_id TEXT NOT NULL,
      engine_version TEXT NOT NULL,
      scope_type TEXT NOT NULL DEFAULT 'period',
      scope_key TEXT NOT NULL DEFAULT '',
      label TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      stale INTEGER NOT NULL DEFAULT 0,
      stale_reason TEXT NOT NULL DEFAULT '',
      final_frozen_at TEXT,
      frozen_snapshot_json TEXT,
      project_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(dossier_id) REFERENCES dossiers_v3(id) ON DELETE CASCADE,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_document_instances_v3_unique
      ON document_instances_v3(dossier_id, engine_id, scope_type, scope_key);

    CREATE TABLE IF NOT EXISTS document_sections_v3 (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL,
      section_key TEXT NOT NULL,
      section_order INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL,
      section_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      content TEXT NOT NULL DEFAULT '',
      data_json TEXT NOT NULL DEFAULT '{}',
      provenance_json TEXT NOT NULL DEFAULT '{}',
      alerts_json TEXT NOT NULL DEFAULT '[]',
      locked INTEGER NOT NULL DEFAULT 0,
      generated_at TEXT,
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(instance_id) REFERENCES document_instances_v3(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_document_sections_v3_unique
      ON document_sections_v3(instance_id, section_key);

    CREATE TABLE IF NOT EXISTS data_imports_v3 (
      id TEXT PRIMARY KEY,
      dossier_id TEXT NOT NULL,
      scope_type TEXT NOT NULL DEFAULT 'dossier',
      scope_key TEXT NOT NULL DEFAULT '',
      source_name TEXT NOT NULL,
      local_path TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ready',
      profile_json TEXT NOT NULL DEFAULT '{}',
      mapping_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(dossier_id) REFERENCES dossiers_v3(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS data_sheets_v3 (
      id TEXT PRIMARY KEY,
      import_id TEXT NOT NULL,
      sheet_name TEXT NOT NULL,
      headers_json TEXT NOT NULL DEFAULT '[]',
      rows_json TEXT NOT NULL DEFAULT '[]',
      row_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(import_id) REFERENCES data_imports_v3(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS document_blocks_v4 (
      id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL,
      block_key TEXT NOT NULL,
      block_order INTEGER NOT NULL DEFAULT 0,
      block_type TEXT NOT NULL DEFAULT 'prose',
      role TEXT NOT NULL DEFAULT 'body',
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      caption TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      visual_type TEXT NOT NULL DEFAULT '',
      data_json TEXT NOT NULL DEFAULT '{}',
      provenance_json TEXT NOT NULL DEFAULT '{}',
      alerts_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'generated',
      locked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(section_id) REFERENCES document_sections_v3(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_document_blocks_v4_unique
      ON document_blocks_v4(section_id, block_key);
    CREATE INDEX IF NOT EXISTS idx_document_blocks_v4_order
      ON document_blocks_v4(section_id, block_order);

    CREATE TABLE IF NOT EXISTS engine_migrations_v4 (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL,
      migration_revision INTEGER NOT NULL,
      from_version TEXT NOT NULL DEFAULT '',
      to_version TEXT NOT NULL DEFAULT '',
      from_schema_hash TEXT NOT NULL DEFAULT '',
      to_schema_hash TEXT NOT NULL DEFAULT '',
      actions_json TEXT NOT NULL DEFAULT '{}',
      before_schema_json TEXT NOT NULL DEFAULT '[]',
      after_schema_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      FOREIGN KEY(instance_id) REFERENCES document_instances_v3(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_engine_migrations_v4_revision
      ON engine_migrations_v4(instance_id, migration_revision);
    CREATE INDEX IF NOT EXISTS idx_engine_migrations_v4_instance
      ON engine_migrations_v4(instance_id, created_at);

    CREATE TABLE IF NOT EXISTS ai_jobs_v3 (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL,
      section_key TEXT,
      role TEXT NOT NULL DEFAULT 'writer',
      provider_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      attempt INTEGER NOT NULL DEFAULT 0,
      request_json TEXT NOT NULL DEFAULT '{}',
      response_json TEXT NOT NULL DEFAULT '{}',
      error_text TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(instance_id) REFERENCES document_instances_v3(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_events_v3 (
      id TEXT PRIMARY KEY,
      dossier_id TEXT,
      instance_id TEXT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      detail_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_events_v3_dossier
      ON audit_events_v3(dossier_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_jobs_v3_instance
      ON ai_jobs_v3(instance_id, created_at);
  `);

  ensureColumn(db, "document_sections_v3", "parent_key", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "document_sections_v3", "section_level", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "document_sections_v3", "sort_path", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "document_sections_v3", "numbering", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "document_sections_v3", "page_break_before", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "document_sections_v3", "keep_with_next", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "document_sections_v3", "layout_json", "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(db, "document_sections_v3", "active", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "document_sections_v3", "archived_at", "TEXT");
  ensureColumn(db, "document_sections_v3", "archived_reason", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "document_sections_v3", "definition_hash", "TEXT NOT NULL DEFAULT ''");

  ensureColumn(db, "document_instances_v3", "engine_schema_hash", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "document_instances_v3", "migration_revision", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "document_instances_v3", "last_migrated_at", "TEXT");
  ensureColumn(db, "document_instances_v3", "migration_pending", "INTEGER NOT NULL DEFAULT 0");
}

function dbFor(userDataPath) {
  const db = openDatabase(userDataPath);
  ensureSchema(db);
  return db;
}

function audit(db, event) {
  const ts = now();
  db.prepare(`
    INSERT INTO audit_events_v3
      (id, dossier_id, instance_id, entity_type, entity_id, action, detail_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id("audit"),
    event.dossierId || null,
    event.instanceId || null,
    event.entityType || "unknown",
    event.entityId || "",
    event.action || "update",
    JSON.stringify(event.detail || {}),
    ts
  );
}

function createPeriod(userDataPath, input) {
  const db = dbFor(userDataPath);
  const ts = now();
  const code = String(input && input.code || "").trim();
  const label = String(input && input.label || code).trim();
  if (!code) throw new Error("El período necesita un código.");
  const periodId = id("period");
  db.prepare(`
    INSERT INTO periods_v3
      (id, code, label, start_date, end_date, status, metadata_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)
  `).run(
    periodId, code, label,
    String(input && input.startDate || ""),
    String(input && input.endDate || ""),
    JSON.stringify(input && input.metadata || {}),
    ts, ts
  );
  audit(db, { entityType: "period", entityId: periodId, action: "create", detail: { code, label } });
  queueSync(db, "period_v3", periodId, "create", { code, label });
  return getPeriod(userDataPath, periodId);
}

function getPeriod(userDataPath, periodId) {
  const db = dbFor(userDataPath);
  const row = db.prepare("SELECT * FROM periods_v3 WHERE id = ?").get(periodId);
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    startDate: row.start_date || "",
    endDate: row.end_date || "",
    status: row.status,
    metadata: json(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function listPeriods(userDataPath) {
  const db = dbFor(userDataPath);
  return db.prepare("SELECT id FROM periods_v3 ORDER BY start_date DESC, created_at DESC").all()
    .map((row) => getPeriod(userDataPath, row.id));
}

function createDossier(userDataPath, input) {
  const db = dbFor(userDataPath);
  const periodId = String(input && input.periodId || "");
  const processKey = String(input && input.processKey || "").trim();
  const population = String(input && input.population || "all").trim() || "all";
  const period = getPeriod(userDataPath, periodId);
  if (!period) throw new Error("Período no válido.");
  if (!processKey) throw new Error("Selecciona un proceso.");
  const ts = now();
  const dossierId = id("dossier");
  const label = String(input && input.label || `${processKey} · ${period.label}`).trim();
  db.prepare(`
    INSERT INTO dossiers_v3
      (id, period_id, process_key, population, label, status, metadata_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)
  `).run(dossierId, periodId, processKey, population, label, JSON.stringify(input && input.metadata || {}), ts, ts);
  audit(db, { dossierId, entityType: "dossier", entityId: dossierId, action: "create", detail: { periodId, processKey, population } });
  return getDossier(userDataPath, dossierId);
}

function getDossier(userDataPath, dossierId) {
  const db = dbFor(userDataPath);
  const row = db.prepare(`
    SELECT d.*, p.code AS period_code, p.label AS period_label
    FROM dossiers_v3 d
    JOIN periods_v3 p ON p.id = d.period_id
    WHERE d.id = ?
  `).get(dossierId);
  if (!row) return null;
  return {
    id: row.id,
    periodId: row.period_id,
    periodCode: row.period_code,
    periodLabel: row.period_label,
    processKey: row.process_key,
    population: row.population,
    label: row.label,
    status: row.status,
    metadata: json(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function listDossiers(userDataPath, periodId) {
  const db = dbFor(userDataPath);
  const rows = periodId
    ? db.prepare("SELECT id FROM dossiers_v3 WHERE period_id = ? ORDER BY created_at DESC").all(periodId)
    : db.prepare("SELECT id FROM dossiers_v3 ORDER BY created_at DESC").all();
  return rows.map((row) => getDossier(userDataPath, row.id));
}

function upsertSegment(userDataPath, dossierId, input) {
  const db = dbFor(userDataPath);
  const dossier = getDossier(userDataPath, dossierId);
  if (!dossier) throw new Error("Expediente no válido.");
  const type = String(input && input.type || "segment").trim();
  const key = String(input && input.key || "").trim();
  const label = String(input && input.label || key).trim();
  if (!key) throw new Error("El segmento necesita una clave.");
  const ts = now();
  const existing = db.prepare(`
    SELECT id FROM dossier_segments_v3 WHERE dossier_id = ? AND segment_type = ? AND segment_key = ?
  `).get(dossierId, type, key);
  const segmentId = existing ? existing.id : id("segment");
  db.prepare(`
    INSERT INTO dossier_segments_v3
      (id, dossier_id, segment_type, segment_key, label, metadata_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(dossier_id, segment_type, segment_key)
    DO UPDATE SET label = excluded.label, metadata_json = excluded.metadata_json, updated_at = excluded.updated_at
  `).run(segmentId, dossierId, type, key, label, JSON.stringify(input && input.metadata || {}), ts, ts);
  audit(db, { dossierId, entityType: "segment", entityId: segmentId, action: existing ? "update" : "create", detail: { type, key, label } });
  return { id: segmentId, dossierId, type, key, label, metadata: input && input.metadata || {} };
}

function listSegments(userDataPath, dossierId) {
  const db = dbFor(userDataPath);
  return db.prepare("SELECT * FROM dossier_segments_v3 WHERE dossier_id = ? ORDER BY segment_type, label").all(dossierId)
    .map((row) => ({
      id: row.id,
      dossierId: row.dossier_id,
      type: row.segment_type,
      key: row.segment_key,
      label: row.label,
      metadata: json(row.metadata_json, {})
    }));
}

function markInstancesStale(db, dossierId, reason) {
  const ts = now();
  db.prepare(`
    UPDATE document_instances_v3
    SET stale = 1, stale_reason = ?, updated_at = ?
    WHERE dossier_id = ? AND final_frozen_at IS NULL
  `).run(String(reason || "Los datos maestros cambiaron."), ts, dossierId);
}

function markDossierStale(userDataPath, dossierId, reason) {
  const db = dbFor(userDataPath);
  markInstancesStale(db, dossierId, reason);
}

function markEngineDependentsStale(db, dossierId, sourceEngineId, reason) {
  const dependentIds = registry.allEngines()
    .filter((engine) => Array.isArray(engine.dependencies) && engine.dependencies.includes(sourceEngineId))
    .map((engine) => engine.engineId);
  if (!dependentIds.length) return;
  const placeholders = dependentIds.map(() => "?").join(",");
  const ts = now();
  db.prepare(`
    UPDATE document_instances_v3
    SET stale = 1, stale_reason = ?, updated_at = ?
    WHERE dossier_id = ?
      AND final_frozen_at IS NULL
      AND engine_id IN (${placeholders})
  `).run(String(reason || `Cambió una dependencia: ${sourceEngineId}`), ts, dossierId, ...dependentIds);
}

function setMasterData(userDataPath, dossierId, input) {
  const db = dbFor(userDataPath);
  const dossier = getDossier(userDataPath, dossierId);
  if (!dossier) throw new Error("Expediente no válido.");
  const dataKey = String(input && input.key || "").trim();
  const scopeType = String(input && input.scopeType || "dossier");
  const scopeKey = String(input && input.scopeKey || "");
  if (!dataKey) throw new Error("El dato maestro necesita una clave.");
  const ts = now();
  const existing = db.prepare(`
    SELECT * FROM master_data_v3
    WHERE dossier_id = ? AND data_key = ? AND scope_type = ? AND scope_key = ?
  `).get(dossierId, dataKey, scopeType, scopeKey);
  const nextRevision = existing ? Number(existing.revision || 1) + 1 : 1;
  const masterId = existing ? existing.id : id("master");
  if (existing) {
    db.prepare(`
      INSERT INTO master_data_history_v3
        (id, master_data_id, revision, value_json, provenance_json, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id("mh"), existing.id, existing.revision,
      existing.value_json, existing.provenance_json,
      String(input && input.reason || ""), ts
    );
  }
  db.prepare(`
    INSERT INTO master_data_v3
      (id, dossier_id, data_key, scope_type, scope_key, value_json, provenance_json, revision, updated_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(dossier_id, data_key, scope_type, scope_key)
    DO UPDATE SET
      value_json = excluded.value_json,
      provenance_json = excluded.provenance_json,
      revision = excluded.revision,
      updated_at = excluded.updated_at
  `).run(
    masterId, dossierId, dataKey, scopeType, scopeKey,
    JSON.stringify(input && Object.prototype.hasOwnProperty.call(input, "value") ? input.value : null),
    JSON.stringify(input && input.provenance || { source: "manual", verified: false }),
    nextRevision, ts, ts
  );
  markInstancesStale(db, dossierId, `Cambió el dato maestro: ${dataKey}`);
  audit(db, { dossierId, entityType: "master_data", entityId: masterId, action: existing ? "update" : "create", detail: { dataKey, scopeType, scopeKey, revision: nextRevision } });
  queueSync(db, "master_data_v3", masterId, existing ? "update" : "create", { dossierId, dataKey, scopeType, scopeKey, revision: nextRevision });
  return getMasterData(userDataPath, dossierId, dataKey, scopeType, scopeKey);
}

function getMasterData(userDataPath, dossierId, dataKey, scopeType, scopeKey) {
  const db = dbFor(userDataPath);
  const row = db.prepare(`
    SELECT * FROM master_data_v3
    WHERE dossier_id = ? AND data_key = ? AND scope_type = ? AND scope_key = ?
  `).get(dossierId, dataKey, scopeType || "dossier", scopeKey || "");
  if (!row) return null;
  return {
    id: row.id,
    dossierId: row.dossier_id,
    key: row.data_key,
    scopeType: row.scope_type,
    scopeKey: row.scope_key,
    value: json(row.value_json, null),
    provenance: json(row.provenance_json, {}),
    revision: row.revision,
    updatedAt: row.updated_at
  };
}

function listMasterData(userDataPath, dossierId) {
  const db = dbFor(userDataPath);
  return db.prepare("SELECT * FROM master_data_v3 WHERE dossier_id = ? ORDER BY data_key, scope_type, scope_key").all(dossierId)
    .map((row) => ({
      id: row.id,
      dossierId: row.dossier_id,
      key: row.data_key,
      scopeType: row.scope_type,
      scopeKey: row.scope_key,
      value: json(row.value_json, null),
      provenance: json(row.provenance_json, {}),
      revision: row.revision,
      updatedAt: row.updated_at
    }));
}

function sectionLayout(sectionItem) {
  return {
    required: sectionItem.required !== false,
    allowedVisuals: sectionItem.allowedVisuals || [],
    derivedFrom: sectionItem.derivedFrom || [],
    maxWords: sectionItem.maxWords || null,
    compact: Boolean(sectionItem.compact),
    data: sectionItem.data || {},
    contract: sectionItem.contract || {},
    layout: sectionItem.layout || {}
  };
}

function insertSectionDefinition(db, instanceId, sectionItem, ts) {
  db.prepare(`
    INSERT INTO document_sections_v3
      (id, instance_id, section_key, section_order, title, section_type, status, content, data_json, provenance_json, alerts_json, locked,
       parent_key, section_level, sort_path, numbering, page_break_before, keep_with_next, layout_json,
       active, archived_at, archived_reason, definition_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', '', '{}', '{}', '[]', 0, ?, ?, ?, ?, ?, ?, ?, 1, NULL, '', ?, ?, ?)
  `).run(
    id("section"), instanceId, sectionItem.key, sectionItem.order || 0, sectionItem.title, sectionItem.type,
    sectionItem.parentKey || "", Number(sectionItem.level || 1), sectionItem.sortPath || "",
    sectionItem.numbering || "", sectionItem.pageBreakBefore ? 1 : 0, sectionItem.keepWithNext === false ? 0 : 1,
    JSON.stringify(sectionLayout(sectionItem)), sectionItem.definitionHash || engineSchema.sectionDefinitionHash(sectionItem),
    ts, ts
  );
}

function initializeSections(db, instanceId, engine) {
  const ts = now();
  engineSchema.normalizedEngineSections(engine).forEach((sectionItem) => {
    insertSectionDefinition(db, instanceId, sectionItem, ts);
  });
}

function migrationSnapshot(rows) {
  return (rows || []).map((row) => ({
    key: row.section_key,
    title: row.title,
    type: row.section_type,
    order: row.section_order,
    parentKey: row.parent_key || "",
    level: Number(row.section_level || 1),
    numbering: row.numbering || "",
    active: Number(row.active == null ? 1 : row.active) !== 0,
    definitionHash: row.definition_hash || ""
  }));
}

function synchronizeEngineInstance(userDataPath, instanceId, engineOverride) {
  const db = dbFor(userDataPath);
  const instanceRow = db.prepare("SELECT * FROM document_instances_v3 WHERE id = ?").get(instanceId);
  if (!instanceRow) throw new Error("Documento no válido.");
  if (instanceRow.final_frozen_at) {
    return {
      migrated: false,
      frozen: true,
      instance: getDocumentInstance(userDataPath, instanceId)
    };
  }

  const engine = engineOverride || registry.getEngine(instanceRow.engine_id);
  if (!engine) throw new Error("Motor documental no válido.");

  const currentRows = db.prepare("SELECT * FROM document_sections_v3 WHERE instance_id = ? ORDER BY section_order, id").all(instanceId);
  const plan = engineSchema.planMigration(currentRows, engine);
  const nextHash = engineSchema.engineDefinitionHash(engine);
  const previousHash = String(instanceRow.engine_schema_hash || "");
  const previousVersion = String(instanceRow.engine_version || "");
  const nextVersion = String(engine.version || previousVersion || "");
  const versionChanged = previousVersion !== nextVersion;
  const definitionChanged = Boolean(previousHash && previousHash !== nextHash);
  const needsMigration =
    plan.structuralChange ||
    versionChanged ||
    !previousHash ||
    previousHash !== nextHash;

  if (!needsMigration) {
    return {
      migrated: false,
      frozen: false,
      plan,
      instance: getDocumentInstance(userDataPath, instanceId)
    };
  }

  const ts = now();
  const nextRevision = Number(instanceRow.migration_revision || 0) + 1;
  const beforeSnapshot = migrationSnapshot(currentRows);
  const migrate = db.transaction(() => {
    const currentByKey = new Map(currentRows.map((row) => [row.section_key, row]));

    plan.target.forEach((sectionItem) => {
      const current = currentByKey.get(sectionItem.key);
      if (!current) {
        insertSectionDefinition(db, instanceId, sectionItem, ts);
        return;
      }
      db.prepare(`
        UPDATE document_sections_v3
        SET section_order = ?, title = ?, section_type = ?,
            parent_key = ?, section_level = ?, sort_path = ?, numbering = ?,
            page_break_before = ?, keep_with_next = ?, layout_json = ?,
            active = 1, archived_at = NULL, archived_reason = '',
            definition_hash = ?, updated_at = ?
        WHERE id = ?
      `).run(
        sectionItem.order || 0, sectionItem.title, sectionItem.type,
        sectionItem.parentKey || "", Number(sectionItem.level || 1), sectionItem.sortPath || "",
        sectionItem.numbering || "", sectionItem.pageBreakBefore ? 1 : 0,
        sectionItem.keepWithNext === false ? 0 : 1,
        JSON.stringify(sectionLayout(sectionItem)),
        sectionItem.definitionHash || engineSchema.sectionDefinitionHash(sectionItem),
        ts, current.id
      );
    });

    plan.archived.forEach((key) => {
      db.prepare(`
        UPDATE document_sections_v3
        SET active = 0, archived_at = ?, archived_reason = ?, updated_at = ?
        WHERE instance_id = ? AND section_key = ? AND active = 1
      `).run(ts, `La sección ya no existe en el motor ${nextVersion}.`, ts, instanceId, key);
    });

    const migrationReviewKeys = Array.from(new Set(
      plan.structuralChange
        ? [].concat(plan.added, plan.reactivated, plan.updated)
        : definitionChanged
          ? plan.target.map((sectionItem) => sectionItem.key)
          : []
    ));
    if (migrationReviewKeys.length) {
      const placeholders = migrationReviewKeys.map(() => "?").join(",");
      db.prepare(`
        UPDATE document_sections_v3
        SET status = 'migration_pending', locked = 0, updated_at = ?
        WHERE instance_id = ? AND active = 1 AND section_key IN (${placeholders})
      `).run(ts, instanceId, ...migrationReviewKeys);
    }

    const structuralImpact = migrationReviewKeys.length > 0;
    db.prepare(`
      UPDATE document_instances_v3
      SET document_id = ?, label = ?, engine_version = ?, engine_schema_hash = ?, migration_revision = ?, last_migrated_at = ?,
          migration_pending = CASE WHEN ? THEN 1 ELSE migration_pending END,
          updated_at = ?
      WHERE id = ?
    `).run(
      engine.documentId || instanceRow.document_id,
      engine.label || instanceRow.label,
      nextVersion,
      nextHash,
      nextRevision,
      ts,
      structuralImpact ? 1 : 0,
      ts,
      instanceId
    );

    const afterRows = db.prepare("SELECT * FROM document_sections_v3 WHERE instance_id = ? ORDER BY section_order, id").all(instanceId);
    const actions = {
      added: plan.added,
      reactivated: plan.reactivated,
      updated: plan.updated,
      archived: plan.archived,
      reviewRequired: migrationReviewKeys,
      versionChanged,
      definitionChanged,
      baselineEstablished: !previousHash
    };
    db.prepare(`
      INSERT INTO engine_migrations_v4
        (id, instance_id, migration_revision, from_version, to_version, from_schema_hash, to_schema_hash,
         actions_json, before_schema_json, after_schema_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id("migration"), instanceId, nextRevision, previousVersion, nextVersion, previousHash, nextHash,
      JSON.stringify(actions), JSON.stringify(beforeSnapshot), JSON.stringify(migrationSnapshot(afterRows)), ts
    );

    audit(db, {
      dossierId: instanceRow.dossier_id,
      instanceId,
      entityType: "engine_schema",
      entityId: instanceRow.engine_id,
      action: "migrate",
      detail: {
        migrationRevision: nextRevision,
        fromVersion: previousVersion,
        toVersion: nextVersion,
        fromSchemaHash: previousHash,
        toSchemaHash: nextHash,
        actions
      }
    });
  });

  migrate();
  return {
    migrated: true,
    frozen: false,
    plan,
    migrationRevision: nextRevision,
    instance: getDocumentInstance(userDataPath, instanceId)
  };
}

function ensureCurrentDocumentInstance(userDataPath, instanceId) {
  const db = dbFor(userDataPath);
  const row = db.prepare("SELECT * FROM document_instances_v3 WHERE id = ?").get(instanceId);
  if (!row) throw new Error("Documento no válido.");
  if (!row.final_frozen_at) synchronizeEngineInstance(userDataPath, instanceId);
  return getDocumentInstance(userDataPath, instanceId);
}

function listEngineMigrations(userDataPath, instanceId) {
  return dbFor(userDataPath)
    .prepare("SELECT * FROM engine_migrations_v4 WHERE instance_id = ? ORDER BY migration_revision DESC")
    .all(instanceId)
    .map((row) => ({
      id: row.id,
      instanceId: row.instance_id,
      revision: row.migration_revision,
      fromVersion: row.from_version,
      toVersion: row.to_version,
      fromSchemaHash: row.from_schema_hash,
      toSchemaHash: row.to_schema_hash,
      actions: json(row.actions_json, {}),
      beforeSchema: json(row.before_schema_json, []),
      afterSchema: json(row.after_schema_json, []),
      createdAt: row.created_at
    }));
}

function ensureDocumentInstance(userDataPath, dossierId, engineId, scope) {
  const db = dbFor(userDataPath);
  const dossier = getDossier(userDataPath, dossierId);
  if (!dossier) throw new Error("Expediente no válido.");
  const engine = registry.getEngine(engineId);
  if (!engine) throw new Error("Motor documental no válido.");
  const scopeType = String(scope && scope.type || engine.cardinality || "period");
  const scopeKey = String(scope && scope.key || "");
  let row = db.prepare(`
    SELECT * FROM document_instances_v3
    WHERE dossier_id = ? AND engine_id = ? AND scope_type = ? AND scope_key = ?
  `).get(dossierId, engineId, scopeType, scopeKey);

  if (!row) {
    const ts = now();
    const instanceId = id("doc");
    const schemaHash = engineSchema.engineDefinitionHash(engine);
    db.prepare(`
      INSERT INTO document_instances_v3
        (id, dossier_id, document_id, engine_id, engine_version, engine_schema_hash,
         migration_revision, scope_type, scope_key, label, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'draft', ?, ?)
    `).run(
      instanceId, dossierId, engine.documentId, engine.engineId, engine.version, schemaHash,
      scopeType, scopeKey, engine.label, ts, ts
    );
    initializeSections(db, instanceId, engine);
    audit(db, {
      dossierId,
      instanceId,
      entityType: "document_instance",
      entityId: instanceId,
      action: "create",
      detail: { engineId, engineVersion: engine.version, engineSchemaHash: schemaHash, scopeType, scopeKey }
    });
    row = db.prepare("SELECT * FROM document_instances_v3 WHERE id = ?").get(instanceId);
  } else if (!row.final_frozen_at) {
    synchronizeEngineInstance(userDataPath, row.id, engine);
  }

  return getDocumentInstance(userDataPath, row.id);
}

function rowToBlock(row) {
  return {
    id: row.id,
    key: row.block_key,
    order: row.block_order,
    type: row.block_type,
    role: row.role,
    title: row.title || "",
    text: row.content || "",
    caption: row.caption || "",
    note: row.note || "",
    visualType: row.visual_type || "",
    data: json(row.data_json, {}),
    provenance: json(row.provenance_json, {}),
    alerts: json(row.alerts_json, []),
    status: row.status,
    locked: Boolean(row.locked),
    updatedAt: row.updated_at
  };
}

function listBlocksForSection(db, sectionId) {
  return db.prepare("SELECT * FROM document_blocks_v4 WHERE section_id = ? ORDER BY block_order, id")
    .all(sectionId)
    .map(rowToBlock);
}

function rowToSection(row, db) {
  const layout = json(row.layout_json, {});
  return {
    id: row.id,
    key: row.section_key,
    order: row.section_order,
    title: row.title,
    type: row.section_type,
    parentKey: row.parent_key || "",
    level: Number(row.section_level || 1),
    sortPath: row.sort_path || "",
    numbering: row.numbering || "",
    pageBreakBefore: Boolean(row.page_break_before),
    keepWithNext: row.keep_with_next !== 0,
    required: layout.required !== false,
    allowedVisuals: Array.isArray(layout.allowedVisuals) ? layout.allowedVisuals : [],
    derivedFrom: Array.isArray(layout.derivedFrom) ? layout.derivedFrom : [],
    maxWords: layout.maxWords || null,
    compact: Boolean(layout.compact),
    contract: layout.contract && typeof layout.contract === "object" ? layout.contract : {},
    layout: layout.layout || {},
    status: row.status,
    content: row.content || "",
    data: Object.assign({}, layout.data || {}, json(row.data_json, {})),
    provenance: json(row.provenance_json, {}),
    alerts: json(row.alerts_json, []),
    blocks: db ? listBlocksForSection(db, row.id) : [],
    locked: Boolean(row.locked),
    active: Number(row.active == null ? 1 : row.active) !== 0,
    archivedAt: row.archived_at || null,
    archivedReason: row.archived_reason || "",
    definitionHash: row.definition_hash || "",
    generatedAt: row.generated_at,
    updatedAt: row.updated_at
  };
}

function getDocumentInstance(userDataPath, instanceId) {
  const db = dbFor(userDataPath);
  const row = db.prepare("SELECT * FROM document_instances_v3 WHERE id = ?").get(instanceId);
  if (!row) return null;
  const frozenSnapshot = json(row.frozen_snapshot_json, null);
  const liveSections = db.prepare("SELECT * FROM document_sections_v3 WHERE instance_id = ? AND active = 1 ORDER BY sort_path, section_order, id").all(instanceId).map((sectionRow) => rowToSection(sectionRow, db));
  const sections = row.final_frozen_at && frozenSnapshot && Array.isArray(frozenSnapshot.sections)
    ? frozenSnapshot.sections
    : liveSections;
  const archivedSectionCount = db.prepare("SELECT COUNT(*) AS total FROM document_sections_v3 WHERE instance_id = ? AND active = 0").get(instanceId).total;
  const engine = registry.getEngine(row.engine_id);
  const migrationPending = Boolean(row.migration_pending) || (!row.final_frozen_at && liveSections.some((sectionItem) => sectionItem.status === "migration_pending"));
  return {
    id: row.id,
    dossierId: row.dossier_id,
    documentId: row.document_id,
    engineId: row.engine_id,
    engineVersion: row.engine_version,
    currentEngineVersion: engine ? engine.version : row.engine_version,
    engineSchemaHash: row.engine_schema_hash || "",
    currentEngineSchemaHash: engine ? engineSchema.engineDefinitionHash(engine) : "",
    migrationRevision: Number(row.migration_revision || 0),
    lastMigratedAt: row.last_migrated_at || null,
    migrationPending,
    archivedSectionCount: Number(archivedSectionCount || 0),
    engineState: row.final_frozen_at
      ? ((engine && (row.engine_version !== engine.version || !row.engine_schema_hash || row.engine_schema_hash !== engineSchema.engineDefinitionHash(engine)))
        ? "frozen_historical"
        : "frozen_current")
      : (migrationPending || (engine && (row.engine_version !== engine.version || !row.engine_schema_hash || row.engine_schema_hash !== engineSchema.engineDefinitionHash(engine)))
        ? "migration_pending"
        : "current"),
    engine,
    scopeType: row.scope_type,
    scopeKey: row.scope_key,
    label: row.label,
    status: row.status,
    stale: Boolean(row.stale) || migrationPending,
    staleReason: [
      row.stale_reason || "",
      migrationPending ? "La migración del motor tiene secciones pendientes de revisión." : ""
    ].filter(Boolean).join(" · "),
    finalFrozenAt: row.final_frozen_at,
    frozenSnapshot,
    alertTrace: row.final_frozen_at && frozenSnapshot && frozenSnapshot.alertTrace
      ? frozenSnapshot.alertTrace
      : alertPolicy.trace({ sections }),
    projectId: row.project_id || "",
    sections,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function listDocumentInstances(userDataPath, dossierId) {
  const db = dbFor(userDataPath);
  return db.prepare("SELECT id FROM document_instances_v3 WHERE dossier_id = ? ORDER BY created_at DESC").all(dossierId)
    .map((row) => getDocumentInstance(userDataPath, row.id));
}

function listArchivedSections(userDataPath, instanceId) {
  const db = dbFor(userDataPath);
  const exists = db.prepare("SELECT id FROM document_instances_v3 WHERE id = ?").get(instanceId);
  if (!exists) throw new Error("Documento no válido.");
  return db.prepare(`
    SELECT * FROM document_sections_v3
    WHERE instance_id = ? AND active = 0
    ORDER BY archived_at DESC, section_order, id
  `).all(instanceId).map((row) => rowToSection(row, db));
}

function refreshInstanceAfterContentChange(db, instanceId, ts) {
  const pending = Number(db.prepare(`
    SELECT COUNT(*) AS total
    FROM document_sections_v3
    WHERE instance_id = ? AND active = 1 AND status = 'migration_pending'
  `).get(instanceId).total || 0);

  db.prepare(`
    UPDATE document_instances_v3
    SET status = 'draft', migration_pending = ?, updated_at = ?
    WHERE id = ?
  `).run(pending > 0 ? 1 : 0, ts, instanceId);

  return pending;
}

function replaceSectionBlocks(db, sectionId, blocks) {
  const normalized = editorial.normalizeBlocks(blocks || []);
  const lockedRows = db.prepare("SELECT block_key FROM document_blocks_v4 WHERE section_id = ? AND locked = 1").all(sectionId);
  const lockedKeys = new Set(lockedRows.map((row) => row.block_key));
  db.prepare("DELETE FROM document_blocks_v4 WHERE section_id = ? AND locked = 0").run(sectionId);
  const ts = now();
  const insert = db.prepare(`
    INSERT INTO document_blocks_v4
      (id, section_id, block_key, block_order, block_type, role, title, content, caption, note, visual_type,
       data_json, provenance_json, alerts_json, status, locked, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(section_id, block_key) DO UPDATE SET
      block_order = excluded.block_order,
      block_type = excluded.block_type,
      role = excluded.role,
      title = excluded.title,
      content = excluded.content,
      caption = excluded.caption,
      note = excluded.note,
      visual_type = excluded.visual_type,
      data_json = excluded.data_json,
      provenance_json = excluded.provenance_json,
      alerts_json = excluded.alerts_json,
      status = excluded.status,
      locked = excluded.locked,
      updated_at = excluded.updated_at
  `);
  normalized.forEach((block, index) => {
    if (lockedKeys.has(block.key)) return;
    insert.run(
      id("block"), sectionId, block.key, index + 1, block.type, block.role, block.title || "", block.text || "",
      block.caption || "", block.note || "", block.visualType || "", JSON.stringify(block.data || {}),
      JSON.stringify(block.provenance || {}), JSON.stringify(block.alerts || []), block.status || "generated",
      block.locked ? 1 : 0, ts, ts
    );
  });
  return listBlocksForSection(db, sectionId);
}

function setSectionBlocks(userDataPath, instanceId, sectionKey, blocks) {
  const db = dbFor(userDataPath);
  const instance = getDocumentInstance(userDataPath, instanceId);
  if (!instance) throw new Error("Documento no válido.");
  if (instance.finalFrozenAt) throw new Error("La versión final está congelada.");
  const sectionRow = db.prepare("SELECT * FROM document_sections_v3 WHERE instance_id = ? AND section_key = ? AND active = 1").get(instanceId, sectionKey);
  if (!sectionRow) throw new Error("Sección no válida.");
  const normalized = editorial.normalizeBlocks(blocks || []);
  const validation = editorial.validateSectionBlocks(rowToSection(sectionRow, db), normalized);
  const updatedBlocks = replaceSectionBlocks(db, sectionRow.id, normalized);
  const content = editorial.plainTextFromBlocks(updatedBlocks);
  const ts = now();
  const currentProvenance = json(sectionRow.provenance_json, {});
  db.prepare(`
    UPDATE document_sections_v3
    SET content = ?, status = 'edited', provenance_json = ?, updated_at = ?
    WHERE id = ?
  `).run(
    content,
    JSON.stringify(Object.assign({}, currentProvenance, { blockEditedBy: "human", blockEditedAt: ts })),
    ts,
    sectionRow.id
  );
  refreshInstanceAfterContentChange(db, instanceId, ts);
  audit(db, {
    dossierId: instance.dossierId,
    instanceId,
    entityType: "section_blocks",
    entityId: sectionKey,
    action: "replace",
    detail: { blockCount: updatedBlocks.length, errors: validation.errors, warnings: validation.warnings }
  });
  markEngineDependentsStale(db, instance.dossierId, instance.engineId, `Cambió ${instance.label}: ${sectionKey}`);
  return { blocks: updatedBlocks, validation, instance: getDocumentInstance(userDataPath, instanceId) };
}

function updateSection(userDataPath, instanceId, sectionKey, patch) {
  const db = dbFor(userDataPath);
  const instance = getDocumentInstance(userDataPath, instanceId);
  if (!instance) throw new Error("Documento no válido.");
  if (instance.finalFrozenAt) throw new Error("La versión final está congelada. Crea una nueva versión de trabajo.");
  const current = db.prepare("SELECT * FROM document_sections_v3 WHERE instance_id = ? AND section_key = ? AND active = 1").get(instanceId, sectionKey);
  if (!current) throw new Error("Sección no válida.");
  if (current.locked && patch && patch.force !== true) throw new Error("La sección está aprobada y bloqueada.");
  const ts = now();
  let content = patch && Object.prototype.hasOwnProperty.call(patch, "content") ? String(patch.content || "") : current.content;
  const data = patch && Object.prototype.hasOwnProperty.call(patch, "data") ? patch.data : json(current.data_json, {});
  const provenance = patch && Object.prototype.hasOwnProperty.call(patch, "provenance") ? patch.provenance : json(current.provenance_json, {});
  const alerts = patch && Object.prototype.hasOwnProperty.call(patch, "alerts") ? patch.alerts : json(current.alerts_json, []);
  const locked = patch && Object.prototype.hasOwnProperty.call(patch, "locked") ? Boolean(patch.locked) : Boolean(current.locked);
  if (patch && Object.prototype.hasOwnProperty.call(patch, "blocks")) {
    const blockResult = replaceSectionBlocks(db, current.id, patch.blocks || []);
    if (!Object.prototype.hasOwnProperty.call(patch, "content")) {
      content = editorial.plainTextFromBlocks(blockResult);
    }
  }
  const status = String(patch && patch.status || (content ? "edited" : current.status));
  db.prepare(`
    UPDATE document_sections_v3
    SET content = ?, status = ?, data_json = ?, provenance_json = ?, alerts_json = ?, locked = ?, generated_at = ?, updated_at = ?
    WHERE instance_id = ? AND section_key = ?
  `).run(
    content, status, JSON.stringify(data || {}), JSON.stringify(provenance || {}),
    JSON.stringify(alerts || []), locked ? 1 : 0,
    status === "generated" || status === "reviewed" || status === "approved" ? ts : current.generated_at,
    ts, instanceId, sectionKey
  );
  refreshInstanceAfterContentChange(db, instanceId, ts);
  audit(db, { dossierId: instance.dossierId, instanceId, entityType: "section", entityId: sectionKey, action: "update", detail: { status, locked, alertCount: (alerts || []).length } });
  markEngineDependentsStale(db, instance.dossierId, instance.engineId, `Cambió ${instance.label}: ${sectionKey}`);
  return getDocumentInstance(userDataPath, instanceId);
}

function freezeFinal(userDataPath, instanceId) {
  const db = dbFor(userDataPath);
  const instance = getDocumentInstance(userDataPath, instanceId);
  if (!instance) throw new Error("Documento no válido.");
  if (instance.engineState === "migration_pending") {
    throw new Error("El motor documental cambió. Migra el borrador antes de aprobar la versión final.");
  }
  const migrationReview = instance.sections.filter((sectionItem) => sectionItem.status === "migration_pending");
  if (migrationReview.length) {
    throw new Error(`La migración del motor tiene ${migrationReview.length} sección(es) pendientes de revisión.`);
  }
  const editorialValidation = editorial.validateDocumentInstance(instance);
  if (!editorialValidation.ok) {
    throw new Error(`El documento no supera el control editorial: ${editorialValidation.errors.slice(0, 4).join(" | ")}`);
  }
  const citationResolution = citations.resolveInstanceCitations(userDataPath, instance);
  if (!citationResolution.ok) {
    const details = citationResolution.missing.concat(citationResolution.incomplete).slice(0, 6).join(", ");
    throw new Error(`Completa las citas APA antes de aprobar la versión final: ${details}`);
  }
  // Las alertas son trazabilidad de revisión y nunca bloquean la final.
  // Los bloqueos reales se validan arriba: migración, estructura editorial y citas APA.
  const alertTrace = alertPolicy.trace(instance);
  const snapshot = {
    engineId: instance.engineId,
    engineVersion: instance.engineVersion,
    engineSchemaHash: instance.engineSchemaHash,
    migrationRevision: instance.migrationRevision,
    scopeType: instance.scopeType,
    scopeKey: instance.scopeKey,
    masterData: listMasterData(userDataPath, instance.dossierId),
    sections: instance.sections,
    citationSnapshot: {
      keys: citationResolution.keys,
      citations: citationResolution.citations,
      references: citationResolution.references
    },
    alertTrace: Object.assign({}, alertTrace, {
      policy: "trace_only",
      frozenWithUnresolvedAlerts: alertTrace.summary.total > 0
    }),
    frozenAt: now()
  };
  const ts = snapshot.frozenAt;
  db.prepare(`
    UPDATE document_instances_v3
    SET status = 'final', final_frozen_at = ?, frozen_snapshot_json = ?, migration_pending = 0, stale = 0, stale_reason = '', updated_at = ?
    WHERE id = ?
  `).run(ts, JSON.stringify(snapshot), ts, instanceId);
  audit(db, {
    dossierId: instance.dossierId,
    instanceId,
    entityType: "document_instance",
    entityId: instanceId,
    action: "freeze_final",
    detail: {
      engineVersion: instance.engineVersion,
      citationKeys: citationResolution.keys,
      referenceCount: citationResolution.references.length,
      alertSummary: alertTrace.summary,
      alertsDidNotBlockFinal: true
    }
  });
  markEngineDependentsStale(db, instance.dossierId, instance.engineId, `Se aprobó una nueva versión final de ${instance.label}`);
  return getDocumentInstance(userDataPath, instanceId);
}

function createWorkingCopy(userDataPath, instanceId) {
  const db = dbFor(userDataPath);
  const source = getDocumentInstance(userDataPath, instanceId);
  if (!source) throw new Error("Documento no válido.");
  const scopeKey = source.scopeKey ? `${source.scopeKey}::rev-${Date.now()}` : `rev-${Date.now()}`;
  const copy = ensureDocumentInstance(userDataPath, source.dossierId, source.engineId, { type: source.scopeType, key: scopeKey });
  const targetKeys = new Set(copy.sections.map((sectionItem) => sectionItem.key));
  const copiedKeys = [];
  const skippedHistoricalKeys = [];
  const sourceSections = source.finalFrozenAt && source.frozenSnapshot && Array.isArray(source.frozenSnapshot.sections)
    ? source.frozenSnapshot.sections
    : source.sections;
  sourceSections.forEach((sectionItem) => {
    if (!targetKeys.has(sectionItem.key)) {
      skippedHistoricalKeys.push(sectionItem.key);
      return;
    }
    updateSection(userDataPath, copy.id, sectionItem.key, {
      content: sectionItem.content,
      status: sectionItem.status === "approved" ? "edited" : sectionItem.status,
      data: sectionItem.data,
      provenance: Object.assign({}, sectionItem.provenance || {}, {
        copiedFromInstanceId: source.id,
        copiedFromEngineVersion: source.engineVersion
      }),
      alerts: sectionItem.alerts,
      blocks: sectionItem.blocks || [],
      locked: false,
      force: true
    });
    copiedKeys.push(sectionItem.key);
  });
  const copiedAlertTrace = alertPolicy.trace(getDocumentInstance(userDataPath, copy.id));
  audit(db, {
    dossierId: source.dossierId,
    instanceId: copy.id,
    entityType: "document_instance",
    entityId: copy.id,
    action: "working_copy",
    detail: {
      sourceInstanceId: instanceId,
      sourceEngineVersion: source.engineVersion,
      targetEngineVersion: copy.engineVersion,
      copiedKeys,
      skippedHistoricalKeys,
      copiedAlertCount: copiedAlertTrace.summary.total
    }
  });
  return getDocumentInstance(userDataPath, copy.id);
}


function cloneDossierToPeriod(userDataPath, sourceDossierId, targetPeriodId, label) {
  const db = dbFor(userDataPath);
  const source = getDossier(userDataPath, sourceDossierId);
  const targetPeriod = getPeriod(userDataPath, targetPeriodId);
  if (!source) throw new Error("Expediente de origen no válido.");
  if (!targetPeriod) throw new Error("Período de destino no válido.");
  const cloned = createDossier(userDataPath, {
    periodId: targetPeriodId,
    processKey: source.processKey,
    population: source.population,
    label: String(label || `${source.processKey} · ${targetPeriod.label}`),
    metadata: Object.assign({}, source.metadata || {}, {
      copiedFromDossierId: source.id,
      copiedFromPeriodId: source.periodId
    })
  });

  listSegments(userDataPath, source.id).forEach((segment) => {
    upsertSegment(userDataPath, cloned.id, {
      type: segment.type,
      key: segment.key,
      label: segment.label,
      metadata: Object.assign({}, segment.metadata || {}, { copiedFromSegmentId: segment.id })
    });
  });

  listMasterData(userDataPath, source.id).forEach((item) => {
    setMasterData(userDataPath, cloned.id, {
      key: item.key,
      scopeType: item.scopeType,
      scopeKey: item.scopeKey,
      value: item.value,
      reason: "Base copiada de un período anterior",
      provenance: Object.assign({}, item.provenance || {}, {
        source: "copied_from_period",
        sourceDossierId: source.id,
        sourcePeriodId: source.periodId,
        verified: false
      })
    });
  });

  audit(db, {
    dossierId: cloned.id,
    entityType: "dossier",
    entityId: cloned.id,
    action: "clone_from_period",
    detail: { sourceDossierId: source.id, sourcePeriodId: source.periodId, targetPeriodId }
  });
  return getDossier(userDataPath, cloned.id);
}

function dashboard(userDataPath) {
  const periods = listPeriods(userDataPath);
  const dossiers = listDossiers(userDataPath);
  return {
    periods,
    dossiers,
    engineCount: registry.allEngines().length,
    documentTypeCount: registry.SELECTED_DOCUMENT_IDS.length,
    finalCount: dossiers.reduce((sum, dossier) => sum + listDocumentInstances(userDataPath, dossier.id).filter((item) => item.status === "final").length, 0)
  };
}

module.exports = {
  ensureSchema,
  createPeriod,
  getPeriod,
  listPeriods,
  createDossier,
  getDossier,
  listDossiers,
  upsertSegment,
  listSegments,
  setMasterData,
  getMasterData,
  listMasterData,
  ensureDocumentInstance,
  getDocumentInstance,
  listDocumentInstances,
  listArchivedSections,
  ensureCurrentDocumentInstance,
  synchronizeEngineInstance,
  listEngineMigrations,
  updateSection,
  setSectionBlocks,
  freezeFinal,
  createWorkingCopy,
  cloneDossierToPeriod,
  dashboard,
  markDossierStale,
  audit,
  dbFor
};
