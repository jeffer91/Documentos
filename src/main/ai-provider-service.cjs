const { safeStorage } = require("electron");
const { openDatabase } = require("./database-service.cjs");

function id(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function now() {
  return new Date().toISOString();
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_providers_v3 (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'openai-compatible',
      base_url TEXT NOT NULL,
      model TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'both',
      priority INTEGER NOT NULL DEFAULT 100,
      enabled INTEGER NOT NULL DEFAULT 1,
      api_key_encrypted TEXT NOT NULL DEFAULT '',
      api_key_env TEXT NOT NULL DEFAULT '',
      config_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ai_providers_v3_enabled
      ON ai_providers_v3(enabled, priority);
  `);
}

function dbFor(userDataPath) {
  const db = openDatabase(userDataPath);
  ensureSchema(db);
  return db;
}

function encryptSecret(secret) {
  const value = String(secret || "");
  if (!value) return "";
  if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
    throw new Error("El sistema no permite cifrar la clave. Usa una variable de entorno en su lugar.");
  }
  return safeStorage.encryptString(value).toString("base64");
}

function decryptSecret(encoded) {
  if (!encoded) return "";
  if (!safeStorage || !safeStorage.isEncryptionAvailable()) return "";
  return safeStorage.decryptString(Buffer.from(encoded, "base64"));
}

function sanitize(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    baseUrl: row.base_url,
    model: row.model,
    role: row.role,
    priority: row.priority,
    enabled: Boolean(row.enabled),
    apiKeyEnv: row.api_key_env || "",
    hasSecret: Boolean(row.api_key_encrypted || row.api_key_env),
    config: (() => { try { return JSON.parse(row.config_json || "{}"); } catch (_error) { return {}; } })(),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function listProviders(userDataPath, includeDisabled) {
  const db = dbFor(userDataPath);
  const rows = includeDisabled
    ? db.prepare("SELECT * FROM ai_providers_v3 ORDER BY priority, created_at").all()
    : db.prepare("SELECT * FROM ai_providers_v3 WHERE enabled = 1 ORDER BY priority, created_at").all();
  return rows.map(sanitize);
}

function getProviderRow(userDataPath, providerId) {
  return dbFor(userDataPath).prepare("SELECT * FROM ai_providers_v3 WHERE id = ?").get(providerId) || null;
}

function getProvider(userDataPath, providerId) {
  return sanitize(getProviderRow(userDataPath, providerId));
}

function saveProvider(userDataPath, input) {
  const db = dbFor(userDataPath);
  const providerId = String(input && input.id || id("provider"));
  const current = getProviderRow(userDataPath, providerId);
  const ts = now();
  const name = String(input && input.name || current && current.name || "IA").trim();
  const kind = String(input && input.kind || current && current.kind || "openai-compatible").trim();
  const baseUrl = String(input && input.baseUrl || current && current.base_url || "").trim().replace(/\/$/, "");
  const model = String(input && input.model || current && current.model || "").trim();
  const role = String(input && input.role || current && current.role || "both").trim();
  const priority = Number(input && input.priority != null ? input.priority : current && current.priority != null ? current.priority : 100);
  const enabled = input && input.enabled === false ? 0 : 1;
  const apiKeyEnv = String(input && input.apiKeyEnv || current && current.api_key_env || "").trim();
  const secret = input && Object.prototype.hasOwnProperty.call(input, "apiKey") ? String(input.apiKey || "") : null;
  const encrypted = secret === null
    ? String(current && current.api_key_encrypted || "")
    : secret
      ? encryptSecret(secret)
      : "";
  if (!name || !baseUrl || !model) throw new Error("Nombre, URL y modelo son obligatorios.");
  if (!["openai-compatible", "anthropic"].includes(kind)) throw new Error("Proveedor no compatible.");
  if (!["writer", "reviewer", "both"].includes(role)) throw new Error("Rol de IA no válido.");

  db.prepare(`
    INSERT INTO ai_providers_v3
      (id, name, kind, base_url, model, role, priority, enabled, api_key_encrypted, api_key_env, config_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      kind = excluded.kind,
      base_url = excluded.base_url,
      model = excluded.model,
      role = excluded.role,
      priority = excluded.priority,
      enabled = excluded.enabled,
      api_key_encrypted = excluded.api_key_encrypted,
      api_key_env = excluded.api_key_env,
      config_json = excluded.config_json,
      updated_at = excluded.updated_at
  `).run(
    providerId, name, kind, baseUrl, model, role, priority, enabled,
    encrypted, apiKeyEnv, JSON.stringify(input && input.config || current && JSON.parse(current.config_json || "{}") || {}),
    current && current.created_at || ts, ts
  );
  return getProvider(userDataPath, providerId);
}

function deleteProvider(userDataPath, providerId) {
  const db = dbFor(userDataPath);
  db.prepare("DELETE FROM ai_providers_v3 WHERE id = ?").run(providerId);
  return { id: providerId, deleted: true };
}

function apiKey(userDataPath, providerId) {
  const row = getProviderRow(userDataPath, providerId);
  if (!row) return "";
  if (row.api_key_env && process.env[row.api_key_env]) return process.env[row.api_key_env];
  return decryptSecret(row.api_key_encrypted);
}

function responseTextFromOpenAi(payload) {
  const choice = payload && payload.choices && payload.choices[0];
  if (!choice) return "";
  const content = choice.message && choice.message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => part && (part.text || part.content || "")).join("\n");
  return "";
}

function responseTextFromAnthropic(payload) {
  return (payload && Array.isArray(payload.content) ? payload.content : [])
    .map((part) => part && part.type === "text" ? part.text : "")
    .filter(Boolean)
    .join("\n");
}

async function callProvider(userDataPath, providerId, request) {
  const provider = getProvider(userDataPath, providerId);
  if (!provider || !provider.enabled) throw new Error("Proveedor de IA no disponible.");
  const key = apiKey(userDataPath, providerId);
  if (!key) throw new Error(`Falta la clave para ${provider.name}.`);
  const system = String(request && request.system || "");
  const prompt = String(request && request.prompt || "");
  const maxTokens = Math.max(512, Math.min(Number(request && request.maxTokens || 6000), 20000));
  let url;
  let headers;
  let body;

  if (provider.kind === "anthropic") {
    url = provider.baseUrl.endsWith("/v1/messages") ? provider.baseUrl : `${provider.baseUrl}/v1/messages`;
    headers = {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01"
    };
    body = {
      model: provider.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }]
    };
  } else {
    url = provider.baseUrl.endsWith("/chat/completions") ? provider.baseUrl : `${provider.baseUrl}/chat/completions`;
    headers = {
      "content-type": "application/json",
      authorization: `Bearer ${key}`
    };
    body = {
      model: provider.model,
      temperature: request && request.temperature != null ? Number(request.temperature) : 0.2,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ]
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(15000, Math.min(Number(request && request.timeoutMs || 120000), 300000)));
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const raw = await response.text();
    let payload = {};
    try { payload = JSON.parse(raw); } catch (_error) { payload = { raw }; }
    if (!response.ok) {
      const message = payload && payload.error && (payload.error.message || payload.error.type)
        ? payload.error.message || payload.error.type
        : raw.slice(0, 500);
      throw new Error(`${provider.name}: ${message || "Error de IA"}`);
    }
    const text = provider.kind === "anthropic" ? responseTextFromAnthropic(payload) : responseTextFromOpenAi(payload);
    if (!text) throw new Error(`${provider.name}: respuesta vacía.`);
    return { provider, text, raw: payload };
  } finally {
    clearTimeout(timeout);
  }
}

async function testProvider(userDataPath, providerId) {
  const result = await callProvider(userDataPath, providerId, {
    system: "Responde únicamente con la palabra OK.",
    prompt: "Prueba de conexión.",
    maxTokens: 32,
    timeoutMs: 30000,
    temperature: 0
  });
  return { ok: /ok/i.test(result.text), provider: result.provider, response: result.text.slice(0, 100) };
}

module.exports = {
  listProviders,
  getProvider,
  saveProvider,
  deleteProvider,
  callProvider,
  testProvider
};
