function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix || "airun"}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function json(value, fallback) {
  try { return JSON.parse(value || ""); } catch (_error) { return fallback; }
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_generation_runs_v6 (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'document',
      status TEXT NOT NULL DEFAULT 'running',
      current_section_key TEXT NOT NULL DEFAULT '',
      total_sections INTEGER NOT NULL DEFAULT 0,
      completed_sections INTEGER NOT NULL DEFAULT 0,
      skipped_sections INTEGER NOT NULL DEFAULT 0,
      failed_sections INTEGER NOT NULL DEFAULT 0,
      blocked_sections INTEGER NOT NULL DEFAULT 0,
      options_json TEXT NOT NULL DEFAULT '{}',
      result_json TEXT NOT NULL DEFAULT '{}',
      started_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      finished_at TEXT,
      FOREIGN KEY(instance_id) REFERENCES document_instances_v3(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_ai_generation_runs_v6_instance
      ON ai_generation_runs_v6(instance_id, started_at);
  `);
}

function normalizeResult(result) {
  const input = result && typeof result === "object" ? result : {};
  return {
    completed: Array.isArray(input.completed) ? input.completed : [],
    skipped: Array.isArray(input.skipped) ? input.skipped : [],
    preserved: Array.isArray(input.preserved) ? input.preserved : [],
    failed: Array.isArray(input.failed) ? input.failed : [],
    blocked: Array.isArray(input.blocked) ? input.blocked : [],
    providers: Array.isArray(input.providers) ? input.providers : [],
    lastCompletedSectionKey: String(input.lastCompletedSectionKey || ""),
    nextSectionKey: String(input.nextSectionKey || ""),
    resumable: Boolean(input.resumable)
  };
}

function rowToRun(row) {
  if (!row) return null;
  const result = normalizeResult(json(row.result_json, {}));
  return {
    id: row.id,
    instanceId: row.instance_id,
    mode: row.mode,
    status: row.status,
    currentSectionKey: row.current_section_key || "",
    totalSections: Number(row.total_sections || 0),
    completedSections: Number(row.completed_sections || 0),
    skippedSections: Number(row.skipped_sections || 0),
    failedSections: Number(row.failed_sections || 0),
    blockedSections: Number(row.blocked_sections || 0),
    options: json(row.options_json, {}),
    result,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at || null
  };
}

function start(db, instanceId, mode, totalSections, options) {
  ensureSchema(db);
  const runId = id("airun");
  const ts = now();
  const result = normalizeResult({});
  db.prepare(`
    INSERT INTO ai_generation_runs_v6
      (id, instance_id, mode, status, current_section_key, total_sections,
       completed_sections, skipped_sections, failed_sections, blocked_sections,
       options_json, result_json, started_at, updated_at, finished_at)
    VALUES (?, ?, ?, 'running', '', ?, 0, 0, 0, 0, ?, ?, ?, ?, NULL)
  `).run(
    runId,
    instanceId,
    String(mode || "document"),
    Math.max(0, Number(totalSections || 0)),
    JSON.stringify(options || {}),
    JSON.stringify(result),
    ts,
    ts
  );
  return get(db, runId);
}

function update(db, runId, patch) {
  ensureSchema(db);
  const current = get(db, runId);
  if (!current) throw new Error("Sesión de generación no válida.");
  const input = patch || {};
  const result = normalizeResult(input.result || current.result);
  const status = String(input.status || current.status);
  const ts = now();
  const finishedAt = Object.prototype.hasOwnProperty.call(input, "finishedAt")
    ? input.finishedAt
    : current.finishedAt;
  db.prepare(`
    UPDATE ai_generation_runs_v6
    SET status = ?,
        current_section_key = ?,
        completed_sections = ?,
        skipped_sections = ?,
        failed_sections = ?,
        blocked_sections = ?,
        result_json = ?,
        updated_at = ?,
        finished_at = ?
    WHERE id = ?
  `).run(
    status,
    String(input.currentSectionKey != null ? input.currentSectionKey : current.currentSectionKey || ""),
    result.completed.length,
    result.skipped.length + result.preserved.length,
    result.failed.length,
    result.blocked.length,
    JSON.stringify(result),
    ts,
    finishedAt || null,
    runId
  );
  return get(db, runId);
}

function finish(db, runId, status, result) {
  const normalized = normalizeResult(result);
  normalized.resumable = normalized.failed.length > 0 || normalized.blocked.length > 0;
  return update(db, runId, {
    status: String(status || (normalized.resumable ? "partial" : "completed")),
    currentSectionKey: "",
    result: normalized,
    finishedAt: now()
  });
}

function get(db, runId) {
  ensureSchema(db);
  return rowToRun(db.prepare("SELECT * FROM ai_generation_runs_v6 WHERE id = ?").get(runId));
}

function latest(db, instanceId) {
  ensureSchema(db);
  return rowToRun(db.prepare(`
    SELECT * FROM ai_generation_runs_v6
    WHERE instance_id = ?
    ORDER BY started_at DESC
    LIMIT 1
  `).get(instanceId));
}

function list(db, instanceId, limit) {
  ensureSchema(db);
  return db.prepare(`
    SELECT * FROM ai_generation_runs_v6
    WHERE instance_id = ?
    ORDER BY started_at DESC
    LIMIT ?
  `).all(instanceId, Math.max(1, Math.min(Number(limit || 20), 100))).map(rowToRun);
}

module.exports = {
  ensureSchema,
  start,
  update,
  finish,
  get,
  latest,
  list
};
