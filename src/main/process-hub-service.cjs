const crypto = require("crypto");
const { openDatabase, queueSync } = require("./database-service.cjs");
const registry = require("./document-engine-registry.cjs");
const editorial = require("./editorial-structure-service.cjs");
const citations = require("./citation-service.cjs");

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
      engine_schema_hash TEXT NOT NULL DEFAULT '',
      last_migrated_at TEXT,
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
      is_active INTEGER NOT NULL DEFAULT 1,
      archived_at TEXT,
      archived_reason TEXT NOT NULL DEFAULT '',
      introduced_engine_version TEXT NOT NULL DEFAULT '',
      last_engine_version TEXT NOT NULL DEFAULT '',
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
  ensureColumn(db, "document_sections_v3", "is_active", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "document_sections_v3", "archived_at", "TEXT");
  ensureColumn(db, "document_sections_v3", "archived_reason", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "document_sections_v3", "introduced_engine_version", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "document_sections_v3", "last_engine_version", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "document_instances_v3", "engine_schema_hash", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "document_instances_v3", "last_migrated_at", "TEXT");
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

function engineSchemaDescriptor(engine) {
  return editorial.flattenSections(engine && engine.sections || []).map((sectionItem) => ({
    key: sectionItem.key,
    title: sectionItem.title,
    type: sectionItem.type,
    parentKey: sectionItem.parentKey || "",
    level: Number(sectionItem.level || 1),
    sortPath: sectionItem.sortPath || "",
    numbering: sectionItem.numbering || "",
    pageBreakBefore: Boolean(sectionItem.pageBreakBefore),
    keepWithNext: sectionItem.keepWithNext !== false,
    required: sectionItem.required !== false,
    allowedVisuals: sectionItem.allowedVisuals || [],
    derivedFrom: sectionItem.derivedFrom || [],
    maxWords: sectionItem.maxWords || null,
    compact: Boolean(sectionItem.compact),
    layout: sectionItem.layout || {}
  }));
}

function engineSchemaHash(engine) {
  return crypto.createHash("sha256").update(JSON.stringify(engineSchemaDescriptor(engine))).digest("hex");
}

function syncEngineSchema(db, instanceRow, engine, options) {
  if (!instanceRow) throw new Error("Instancia documental no válida.");
  const opts = options || {};
  if (instanceRow.final_frozen_at && !opts.allowFrozen) {
    return {
      changed: false,
      skipped: "frozen",
      fromVersion: instanceRow.engine_version || "",
      toVersion: instanceRow.engine_version || "",
      added: [],
      updated: [],
      archived: [],
      reactivated: []
    };
  }

  const ts = now();
  const targetVersion = String(engine.version || registry.VERSION || "");
  const targetHash = engineSchemaHash(engine);
  const previousVersion = String(instanceRow.engine_version || "");
  const previousHash = String(instanceRow.engine_schema_hash || "");
  const sections = engineSchemaDescriptor(engine);
  const targetKeys = new Set(sections.map((item) => item.key));
  const existingRows = db.prepare("SELECT * FROM document_sections_v3 WHERE instance_id = ?").all(instanceRow.id);
  const existingByKey = new Map(existingRows.map((row) => [row.section_key, row]));

  const added = [];
  const updated = [];
  const archived = [];
  const reactivated = [];

  const insert = db.prepare(`
    INSERT INTO document_sections_v3
      (id, instance_id, section_key, section_order, title, section_type, status, content, data_json, provenance_json, alerts_json, locked,
       parent_key, section_level, sort_path, numbering, page_break_before, keep_with_next, layout_json,
       is_active, archived_at, archived_reason, introduced_engine_version, last_engine_version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', '', '{}', '{}', '[]', 0, ?, ?, ?, ?, ?, ?, ?, 1, NULL, '', ?, ?, ?, ?)
  `);

  const update = db.prepare(`
    UPDATE document_sections_v3
    SET section_order = ?, title = ?, section_type = ?, parent_key = ?, section_level = ?, sort_path = ?, numbering = ?,
        page_break_before = ?, keep_with_next = ?, layout_json = ?, is_active = 1, archived_at = NULL, archived_reason = '',
        last_engine_version = ?, updated_at = ?
    WHERE id = ?
  `);

  sections.forEach((sectionItem, index) => {
    const layout = {
      required: sectionItem.required !== false,
      allowedVisuals: sectionItem.allowedVisuals || [],
      derivedFrom: sectionItem.derivedFrom || [],
      maxWords: sectionItem.maxWords || null,
      compact: Boolean(sectionItem.compact),
      layout: sectionItem.layout || {}
    };
    const existing = existingByKey.get(sectionItem.key);
    if (!existing) {
      insert.run(
        id("section"), instanceRow.id, sectionItem.key, index + 1, sectionItem.title, sectionItem.type,
        sectionItem.parentKey || "", Number(sectionItem.level || 1), sectionItem.sortPath || "",
        sectionItem.numbering || "", sectionItem.pageBreakBefore ? 1 : 0, sectionItem.keepWithNext === false ? 0 : 1,
        JSON.stringify(layout), targetVersion, targetVersion, ts, ts
      );
      added.push(sectionItem.key);
      return;
    }

    if (!existing.is_active) reactivated.push(sectionItem.key);
    update.run(
      index + 1, sectionItem.title, sectionItem.type, sectionItem.parentKey || "", Number(sectionItem.level || 1),
      sectionItem.sortPath || "", sectionItem.numbering || "", sectionItem.pageBreakBefore ? 1 : 0,
      sectionItem.keepWithNext === false ? 0 : 1, JSON.stringify(layout), targetVersion, ts, existing.id
    );
    updated.push(sectionItem.key);
  });

  const archive = db.prepare(`
    UPDATE document_sections_v3
    SET is_active = 0, archived_at = ?, archived_reason = ?, last_engine_version = ?, updated_at = ?
    WHERE id = ?
  `);
  existingRows.forEach((row) => {
    if (row.is_active && !targetKeys.has(row.section_key)) {
      const reason = `Sección retirada del motor ${engine.engineId} al sincronizar ${previousVersion || "sin versión"} → ${targetVersion || "sin versión"}.`;
      archive.run(ts, reason, targetVersion, ts, row.id);
      archived.push(row.section_key);
    }
  });

  const schemaChanged = previousHash !== targetHash;
  const versionChanged = previousVersion !== targetVersion;
  const changed = schemaChanged || versionChanged || added.length > 0 || archived.length > 0 || reactivated.length > 0;
  const shouldMarkStale = changed && !opts.initializing;

  db.prepare(`
    UPDATE document_instances_v3
    SET document_id = ?, label = ?, engine_version = ?, engine_schema_hash = ?, last_migrated_at = ?,
        stale = CASE WHEN ? THEN 1 ELSE stale END,
        stale_reason = CASE WHEN ? THEN ? ELSE stale_reason END,
        updated_at = ?
    WHERE id = ?
  `).run(
    engine.documentId, engine.label, targetVersion, targetHash, changed ? ts : instanceRow.last_migrated_at,
    shouldMarkStale ? 1 : 0,
    shouldMarkStale ? 1 : 0,
    shouldMarkStale ? `Motor documental actualizado: ${previousVersion || "sin versión"} → ${targetVersion || "sin versión"}.` : "",
    ts,
    instanceRow.id
  );

  if (changed && !opts.skipAudit) {
    audit(db, {
      dossierId: instanceRow.dossier_id,
      instanceId: instanceRow.id,
      entityType: "engine_schema",
      entityId: engine.engineId,
      action: previousVersion ? "migrate" : "initialize",
      detail: {
        fromVersion: previousVersion,
        toVersion: targetVersion,
        previousSchemaHash: previousHash,
        schemaHash: targetHash,
        added,
        archived,
        reactivated,
        preserved: updated,
        frozen: false
      }
    });
  }

  return {
    changed,
    skipped: "",
    fromVersion: previousVersion,
    toVersion: targetVersion,
    previousSchemaHash: previousHash,
    schemaHash: targetHash,
    added,
    updated,
    archived,
    reactivated
  };
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
    db.prepare(`
      INSERT INTO document_instances_v3
        (id, dossier_id, document_id, engine_id, engine_version, scope_type, scope_key, label, status,
         engine_schema_hash, last_migrated_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', '', NULL, ?, ?)
    `).run(instanceId, dossierId, engine.documentId, engine.engineId, engine.version, scopeType, scopeKey, engine.label, ts, ts);
    row = db.prepare("SELECT * FROM document_instances_v3 WHERE id = ?").get(instanceId);
    const sync = syncEngineSchema(db, row, engine, { skipAudit: true, initializing: true });
    audit(db, {
      dossierId,
      instanceId,
      entityType: "document_instance",
      entityId: instanceId,
      action: "create",
      detail: {
        engineId,
        engineVersion: engine.version,
        engineSchemaHash: sync.schemaHash,
        scopeType,
        scopeKey,
        sectionCount: sync.added.length
      }
    });
  } else if (!row.final_frozen_at) {
    syncEngineSchema(db, row, engine);
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
    layout: layout.layout || {},
    status: row.status,
    content: row.content || "",
    data: json(row.data_json, {}),
    provenance: json(row.provenance_json, {}),
    alerts: json(row.alerts_json, []),
    blocks: db ? listBlocksForSection(db, row.id) : [],
    locked: Boolean(row.locked),
    generatedAt: row.generated_at,
    active: row.is_active !== 0,
    archivedAt: row.archived_at || null,
    archivedReason: row.archived_reason || "",
    introducedEngineVersion: row.introduced_engine_version || "",
    lastEngineVersion: row.last_engine_version || "",
    updatedAt: row.updated_at
  };
}

function getDocumentInstance(userDataPath, instanceId) {
  const db = dbFor(userDataPath);
  const row = db.prepare("SELECT * FROM document_instances_v3 WHERE id = ?").get(instanceId);
  if (!row) return null;
  const frozenSnapshot = json(row.frozen_snapshot_json, null);
  const liveSections = db.prepare("SELECT * FROM document_sections_v3 WHERE instance_id = ? AND is_active = 1 ORDER BY sort_path, section_order, id").all(instanceId).map((sectionRow) => rowToSection(sectionRow, db));
  const liveArchivedSections = db.prepare("SELECT * FROM document_sections_v3 WHERE instance_id = ? AND is_active = 0 ORDER BY archived_at, section_order, id").all(instanceId).map((sectionRow) => rowToSection(sectionRow, db));
  const sections = row.final_frozen_at && frozenSnapshot && Array.isArray(frozenSnapshot.sections)
    ? frozenSnapshot.sections
    : liveSections;
  const archivedSections = row.final_frozen_at ? [] : liveArchivedSections;
  const engine = registry.getEngine(row.engine_id);
  const migrationHistory = db.prepare(`
    SELECT action, detail_json, created_at
    FROM audit_events_v3
    WHERE instance_id = ? AND entity_type = 'engine_schema'
    ORDER BY created_at DESC
    LIMIT 25
  `).all(instanceId).map((event) => ({
    action: event.action,
    detail: json(event.detail_json, {}),
    createdAt: event.created_at
  }));
  return {
    id: row.id,
    dossierId: row.dossier_id,
    documentId: row.document_id,
    engineId: row.engine_id,
    engineVersion: row.engine_version,
    engine,
    scopeType: row.scope_type,
    scopeKey: row.scope_key,
    label: row.label,
    status: row.status,
    stale: Boolean(row.stale),
    staleReason: row.stale_reason || "",
    finalFrozenAt: row.final_frozen_at,
    frozenSnapshot,
    projectId: row.project_id || "",
    engineSchemaHash: row.engine_schema_hash || "",
    lastMigratedAt: row.last_migrated_at || null,
    sections,
    archivedSections,
    migrationHistory,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function listDocumentInstances(userDataPath, dossierId) {
  const db = dbFor(userDataPath);
  return db.prepare("SELECT id FROM document_instances_v3 WHERE dossier_id = ? ORDER BY created_at DESC").all(dossierId)
    .map((row) => getDocumentInstance(userDataPath, row.id));
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
  const sectionRow = db.prepare("SELECT * FROM document_sections_v3 WHERE instance_id = ? AND section_key = ? AND is_active = 1").get(instanceId, sectionKey);
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
  db.prepare("UPDATE document_instances_v3 SET status = 'draft', stale = 0, stale_reason = '', updated_at = ? WHERE id = ?").run(ts, instanceId);
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
  const current = db.prepare("SELECT * FROM document_sections_v3 WHERE instance_id = ? AND section_key = ? AND is_active = 1").get(instanceId, sectionKey);
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
  db.prepare("UPDATE document_instances_v3 SET status = 'draft', stale = 0, stale_reason = '', updated_at = ? WHERE id = ?").run(ts, instanceId);
  audit(db, { dossierId: instance.dossierId, instanceId, entityType: "section", entityId: sectionKey, action: "update", detail: { status, locked, alertCount: (alerts || []).length } });
  markEngineDependentsStale(db, instance.dossierId, instance.engineId, `Cambió ${instance.label}: ${sectionKey}`);
  return getDocumentInstance(userDataPath, instanceId);
}

function freezeFinal(userDataPath, instanceId) {
  const db = dbFor(userDataPath);
  const instance = getDocumentInstance(userDataPath, instanceId);
  if (!instance) throw new Error("Documento no válido.");
  const editorialValidation = editorial.validateDocumentInstance(instance);
  if (!editorialValidation.ok) {
    throw new Error(`El documento no supera el control editorial: ${editorialValidation.errors.slice(0, 4).join(" | ")}`);
  }
  const citationValidation = citations.validateInstanceCitations(userDataPath, instance);
  if (!citationValidation.ok) {
    const details = citationValidation.missing.concat(citationValidation.incomplete).slice(0, 6).join(", ");
    throw new Error(`Completa las citas APA antes de aprobar la versión final: ${details}`);
  }
  const pendingAlerts = instance.sections.flatMap((sectionItem) => sectionItem.alerts || []).filter((alert) => alert && alert.blocking !== false);
  if (pendingAlerts.length) throw new Error("El borrador todavía tiene alertas pendientes.");
  const snapshot = {
    engineId: instance.engineId,
    engineVersion: instance.engineVersion,
    engineSchemaHash: instance.engineSchemaHash,
    scopeType: instance.scopeType,
    scopeKey: instance.scopeKey,
    masterData: listMasterData(userDataPath, instance.dossierId),
    sections: instance.sections,
    frozenAt: now()
  };
  const ts = snapshot.frozenAt;
  db.prepare(`
    UPDATE document_instances_v3
    SET status = 'final', final_frozen_at = ?, frozen_snapshot_json = ?, stale = 0, stale_reason = '', updated_at = ?
    WHERE id = ?
  `).run(ts, JSON.stringify(snapshot), ts, instanceId);
  audit(db, { dossierId: instance.dossierId, instanceId, entityType: "document_instance", entityId: instanceId, action: "freeze_final", detail: { engineVersion: instance.engineVersion } });
  markEngineDependentsStale(db, instance.dossierId, instance.engineId, `Se aprobó una nueva versión final de ${instance.label}`);
  return getDocumentInstance(userDataPath, instanceId);
}

function createWorkingCopy(userDataPath, instanceId) {
  const db = dbFor(userDataPath);
  const source = getDocumentInstance(userDataPath, instanceId);
  if (!source) throw new Error("Documento no válido.");
  const scopeKey = source.scopeKey ? `${source.scopeKey}::rev-${Date.now()}` : `rev-${Date.now()}`;
  const copy = ensureDocumentInstance(userDataPath, source.dossierId, source.engineId, { type: source.scopeType, key: scopeKey });

  const sourceSections = source.finalFrozenAt && source.frozenSnapshot && Array.isArray(source.frozenSnapshot.sections)
    ? source.frozenSnapshot.sections
    : source.sections;
  const targetKeys = new Set(copy.sections.map((item) => item.key));
  const skippedLegacySections = [];

  sourceSections.forEach((sectionItem) => {
    if (!targetKeys.has(sectionItem.key)) {
      skippedLegacySections.push(sectionItem.key);
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
  });

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
      skippedLegacySections
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
  engineSchemaHash,
  syncEngineSchema,
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
