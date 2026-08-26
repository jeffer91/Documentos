const { safeStorage } = require("electron");
const { openDatabase, queueSync } = require("./database-service.cjs");

const DEFAULT_PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    kind: "openai-compatible",
    enabled: false,
    priority: 1,
    model: "",
    endpoint: "https://api.openai.com/v1/chat/completions"
  },
  {
    id: "anthropic",
    name: "Anthropic",
    kind: "anthropic",
    enabled: false,
    priority: 2,
    model: "",
    endpoint: "https://api.anthropic.com/v1/messages"
  },
  {
    id: "gemini",
    name: "Google Gemini",
    kind: "gemini",
    enabled: false,
    priority: 3,
    model: "",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
  },
  {
    id: "compatible",
    name: "Compatible",
    kind: "openai-compatible",
    enabled: false,
    priority: 4,
    model: "",
    endpoint: ""
  }
];

function encrypt(value) {
  const text = String(value || "");
  if (!text || !safeStorage.isEncryptionAvailable()) return "";
  return safeStorage.encryptString(text).toString("base64");
}

function decrypt(value) {
  if (!value || !safeStorage.isEncryptionAvailable()) return "";
  try { return safeStorage.decryptString(Buffer.from(value, "base64")); } catch (_error) { return ""; }
}

function ensureDefaults(db) {
  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO ai_providers
      (id, name, kind, enabled, priority, model, endpoint, encrypted_key, updated_at)
    VALUES (?, ?, ?, 0, ?, ?, ?, '', ?)
  `);

  DEFAULT_PROVIDERS.forEach((provider) => {
    insert.run(provider.id, provider.name, provider.kind, provider.priority, provider.model, provider.endpoint, now);
  });
}

function rawProviders(userDataPath) {
  const db = openDatabase(userDataPath);
  ensureDefaults(db);
  return db.prepare("SELECT * FROM ai_providers ORDER BY priority, name").all().map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    enabled: Boolean(row.enabled),
    priority: row.priority,
    model: row.model || "",
    endpoint: row.endpoint || "",
    encryptedKey: row.encrypted_key || ""
  }));
}

function publicProviders(userDataPath) {
  return rawProviders(userDataPath).map((item) => ({
    id: item.id,
    name: item.name,
    kind: item.kind,
    enabled: item.enabled,
    priority: item.priority,
    model: item.model,
    endpoint: item.endpoint,
    hasKey: Boolean(item.encryptedKey && decrypt(item.encryptedKey))
  }));
}

function saveProviders(userDataPath, incoming) {
  const db = openDatabase(userDataPath);
  ensureDefaults(db);
  const current = rawProviders(userDataPath);
  const now = new Date().toISOString();

  const update = db.prepare(`
    UPDATE ai_providers
    SET enabled = ?, priority = ?, model = ?, endpoint = ?, encrypted_key = ?, updated_at = ?
    WHERE id = ?
  `);

  const tx = db.transaction(() => {
    current.forEach((existing) => {
      const change = Array.isArray(incoming) ? incoming.find((item) => item.id === existing.id) : null;
      if (!change) return;

      let encryptedKey = existing.encryptedKey;
      if (Object.prototype.hasOwnProperty.call(change, "apiKey") && String(change.apiKey || "").trim()) {
        const encrypted = encrypt(String(change.apiKey).trim());
        if (encrypted) encryptedKey = encrypted;
      }
      if (change.clearKey === true) encryptedKey = "";

      update.run(
        change.enabled ? 1 : 0,
        Number.isFinite(Number(change.priority)) ? Number(change.priority) : existing.priority,
        String(change.model || "").trim(),
        String(change.endpoint || "").trim(),
        encryptedKey,
        now,
        existing.id
      );

      queueSync(db, "ai_provider", existing.id, "update", {
        enabled: Boolean(change.enabled),
        priority: Number(change.priority || existing.priority),
        model: String(change.model || "").trim(),
        endpoint: String(change.endpoint || "").trim()
      });
    });
  });

  tx();
  return publicProviders(userDataPath);
}

function runtimeProviders(userDataPath) {
  return rawProviders(userDataPath)
    .map((item) => Object.assign({}, item, { apiKey: decrypt(item.encryptedKey) }))
    .filter((item) => item.enabled && item.apiKey && item.model && item.endpoint)
    .sort((a, b) => a.priority - b.priority);
}

module.exports = { DEFAULT_PROVIDERS, publicProviders, saveProviders, runtimeProviders };
