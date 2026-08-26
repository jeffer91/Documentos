const { openDatabase } = require("./database-service.cjs");

function newId() {
  return `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeDetail(error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error.stack) return String(error.stack);
  try { return JSON.stringify(error); } catch (_error) { return String(error); }
}

function record(userDataPath, input) {
  const db = openDatabase(userDataPath);
  const data = input && typeof input === "object" ? input : {};
  const row = {
    id: newId(),
    severity: ["warning", "info"].includes(data.severity) ? data.severity : "error",
    module: String(data.module || "app"),
    action: String(data.action || ""),
    message: String(data.message || "Error no especificado"),
    detail: String(data.detail || ""),
    createdAt: new Date().toISOString()
  };

  db.prepare(`
    INSERT INTO app_errors(id, severity, module, action, message, detail, resolved, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(row.id, row.severity, row.module, row.action, row.message, row.detail, row.createdAt);

  return row;
}

function recordError(userDataPath, moduleName, action, error, message) {
  return record(userDataPath, {
    severity: "error",
    module: moduleName,
    action,
    message: message || (error && error.message ? error.message : String(error || "Error")),
    detail: safeDetail(error)
  });
}

function list(userDataPath, options) {
  const db = openDatabase(userDataPath);
  const includeResolved = Boolean(options && options.includeResolved);
  const limit = Math.max(1, Math.min(200, Number(options && options.limit || 100)));
  const sql = includeResolved
    ? "SELECT * FROM app_errors ORDER BY created_at DESC LIMIT ?"
    : "SELECT * FROM app_errors WHERE resolved = 0 ORDER BY created_at DESC LIMIT ?";

  return db.prepare(sql).all(limit).map((row) => ({
    id: row.id,
    severity: row.severity,
    module: row.module,
    action: row.action || "",
    message: row.message,
    detail: row.detail || "",
    resolved: Boolean(row.resolved),
    createdAt: row.created_at
  }));
}

function countOpen(userDataPath) {
  const db = openDatabase(userDataPath);
  const row = db.prepare("SELECT COUNT(*) AS total FROM app_errors WHERE resolved = 0 AND severity = 'error'").get();
  return Number(row && row.total || 0);
}

function resolveAll(userDataPath) {
  const db = openDatabase(userDataPath);
  const result = db.prepare("UPDATE app_errors SET resolved = 1 WHERE resolved = 0").run();
  return { changed: result.changes };
}

function clearResolved(userDataPath) {
  const db = openDatabase(userDataPath);
  const result = db.prepare("DELETE FROM app_errors WHERE resolved = 1").run();
  return { changed: result.changes };
}

module.exports = {
  record,
  recordError,
  list,
  countOpen,
  resolveAll,
  clearResolved
};
