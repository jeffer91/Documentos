const fs = require("fs");
const path = require("path");
const { safeStorage } = require("electron");
const { root } = require("./workspace-service.cjs");

const FILE = "ai-providers.json";

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

function filePath(userDataPath) {
  return path.join(root(userDataPath), FILE);
}

function encrypt(value) {
  const text = String(value || "");
  if (!text) return "";
  if (!safeStorage.isEncryptionAvailable()) return "";
  return safeStorage.encryptString(text).toString("base64");
}

function decrypt(value) {
  if (!value || !safeStorage.isEncryptionAvailable()) return "";
  try {
    return safeStorage.decryptString(Buffer.from(value, "base64"));
  } catch (_error) {
    return "";
  }
}

function mergeProvider(base, saved) {
  const data = saved && typeof saved === "object" ? saved : {};
  return {
    id: base.id,
    name: data.name || base.name,
    kind: data.kind || base.kind,
    enabled: Boolean(data.enabled),
    priority: Number.isFinite(Number(data.priority)) ? Number(data.priority) : base.priority,
    model: data.model || "",
    endpoint: data.endpoint || base.endpoint,
    encryptedKey: data.encryptedKey || ""
  };
}

function readRaw(userDataPath) {
  const target = filePath(userDataPath);
  if (!fs.existsSync(target)) return DEFAULT_PROVIDERS.map((item) => mergeProvider(item, {}));
  try {
    const saved = JSON.parse(fs.readFileSync(target, "utf8"));
    return DEFAULT_PROVIDERS.map((base) => mergeProvider(base, Array.isArray(saved) ? saved.find((item) => item.id === base.id) : null));
  } catch (_error) {
    return DEFAULT_PROVIDERS.map((item) => mergeProvider(item, {}));
  }
}

function publicProviders(userDataPath) {
  return readRaw(userDataPath).map((item) => ({
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
  const current = readRaw(userDataPath);
  const list = current.map((existing) => {
    const update = Array.isArray(incoming) ? incoming.find((item) => item.id === existing.id) : null;
    if (!update) return existing;
    const next = Object.assign({}, existing, {
      name: update.name || existing.name,
      kind: update.kind || existing.kind,
      enabled: Boolean(update.enabled),
      priority: Number.isFinite(Number(update.priority)) ? Number(update.priority) : existing.priority,
      model: String(update.model || "").trim(),
      endpoint: String(update.endpoint || "").trim()
    });
    if (Object.prototype.hasOwnProperty.call(update, "apiKey") && String(update.apiKey || "").trim()) {
      const encryptedKey = encrypt(String(update.apiKey).trim());
      if (encryptedKey) next.encryptedKey = encryptedKey;
    }
    if (update.clearKey === true) next.encryptedKey = "";
    return next;
  });
  fs.writeFileSync(filePath(userDataPath), JSON.stringify(list, null, 2), "utf8");
  return publicProviders(userDataPath);
}

function runtimeProviders(userDataPath) {
  return readRaw(userDataPath)
    .map((item) => Object.assign({}, item, { apiKey: decrypt(item.encryptedKey) }))
    .filter((item) => item.enabled && item.apiKey && item.model && item.endpoint)
    .sort((a, b) => a.priority - b.priority);
}

module.exports = {
  DEFAULT_PROVIDERS,
  publicProviders,
  saveProviders,
  runtimeProviders
};
