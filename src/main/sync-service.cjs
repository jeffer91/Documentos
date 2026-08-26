const { openDatabase } = require("./database-service.cjs");

function getSyncStatus(userDataPath) {
  const db = openDatabase(userDataPath);
  const config = db.prepare("SELECT * FROM external_sync_config WHERE id = 1").get();
  const pending = db.prepare("SELECT COUNT(*) AS total FROM sync_queue WHERE status = 'pending'").get();

  return {
    enabled: Boolean(config && config.enabled),
    provider: config && config.provider ? config.provider : "",
    endpoint: config && config.endpoint ? config.endpoint : "",
    remoteWorkspaceId: config && config.remote_workspace_id ? config.remote_workspace_id : "",
    lastSyncAt: config ? config.last_sync_at : null,
    pending: pending ? pending.total : 0,
    state: config && config.enabled ? "configured" : "pending_external_database"
  };
}

function configureSync(userDataPath, input) {
  const db = openDatabase(userDataPath);
  const now = new Date().toISOString();
  const current = db.prepare("SELECT * FROM external_sync_config WHERE id = 1").get();

  db.prepare(`
    UPDATE external_sync_config
    SET enabled = ?,
        provider = ?,
        endpoint = ?,
        remote_workspace_id = ?,
        updated_at = ?
    WHERE id = 1
  `).run(
    input && input.enabled ? 1 : 0,
    input && input.provider ? String(input.provider) : (current.provider || ""),
    input && input.endpoint ? String(input.endpoint) : (current.endpoint || ""),
    input && input.remoteWorkspaceId ? String(input.remoteWorkspaceId) : (current.remote_workspace_id || ""),
    now
  );

  return getSyncStatus(userDataPath);
}

module.exports = {
  getSyncStatus,
  configureSync
};
