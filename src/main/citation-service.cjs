const { openDatabase } = require("./database-service.cjs");

function now() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`; }

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS citations_v4 (
      id TEXT PRIMARY KEY,
      dossier_id TEXT NOT NULL,
      source_id TEXT,
      citation_key TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'institutional',
      author TEXT NOT NULL DEFAULT '',
      corporate_author TEXT NOT NULL DEFAULT '',
      year TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      publisher TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      doi TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_citations_v4_key ON citations_v4(dossier_id, citation_key);
    CREATE INDEX IF NOT EXISTS idx_citations_v4_source ON citations_v4(dossier_id, source_id);
  `);
}

function dbFor(userDataPath) {
  const db = openDatabase(userDataPath);
  ensureSchema(db);
  return db;
}

function parseJson(value, fallback) {
  try { return JSON.parse(value || ""); } catch (_error) { return fallback; }
}

function rowToCitation(row) {
  if (!row) return null;
  const complete = Boolean((row.author || row.corporate_author) && row.title && row.year);
  return {
    id: row.id,
    dossierId: row.dossier_id,
    sourceId: row.source_id || "",
    citationKey: row.citation_key,
    sourceType: row.source_type,
    author: row.author || "",
    corporateAuthor: row.corporate_author || "",
    year: row.year || "",
    title: row.title || "",
    publisher: row.publisher || "",
    url: row.url || "",
    doi: row.doi || "",
    metadata: parseJson(row.metadata_json, {}),
    active: Boolean(row.active),
    complete,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function upsertCitation(userDataPath, dossierId, input) {
  const db = dbFor(userDataPath);
  const ts = now();
  const citationKey = String(input && input.citationKey || "").trim();
  if (!citationKey) throw new Error("La cita necesita una clave.");
  const existing = db.prepare("SELECT * FROM citations_v4 WHERE dossier_id = ? AND citation_key = ?").get(dossierId, citationKey);
  const citationId = existing ? existing.id : id("citation");
  const sourceId = String(input && input.sourceId || existing && existing.source_id || "");
  const sourceType = String(input && input.sourceType || existing && existing.source_type || "institutional");
  const author = String(input && input.author || "");
  const corporateAuthor = String(input && input.corporateAuthor || "");
  const year = String(input && input.year || "");
  const title = String(input && input.title || "");
  const publisher = String(input && input.publisher || "");
  const url = String(input && input.url || "");
  const doi = String(input && input.doi || "");
  const metadata = input && input.metadata || parseJson(existing && existing.metadata_json, {});
  db.prepare(`
    INSERT INTO citations_v4
      (id, dossier_id, source_id, citation_key, source_type, author, corporate_author, year, title, publisher, url, doi, metadata_json, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(dossier_id, citation_key) DO UPDATE SET
      source_id = excluded.source_id,
      source_type = excluded.source_type,
      author = excluded.author,
      corporate_author = excluded.corporate_author,
      year = excluded.year,
      title = excluded.title,
      publisher = excluded.publisher,
      url = excluded.url,
      doi = excluded.doi,
      metadata_json = excluded.metadata_json,
      active = 1,
      updated_at = excluded.updated_at
  `).run(
    citationId, dossierId, sourceId || null, citationKey, sourceType,
    author, corporateAuthor, year, title, publisher, url, doi,
    JSON.stringify(metadata || {}), existing && existing.created_at || ts, ts
  );
  return getCitation(userDataPath, dossierId, citationKey);
}

function ensureCitationForSource(userDataPath, dossierId, source) {
  const sourceId = String(source && source.id || "");
  if (!sourceId) throw new Error("Fuente no válida.");
  const key = `SRC:${sourceId}`;
  const existing = getCitation(userDataPath, dossierId, key);
  if (existing) return existing;
  const metadata = source && source.metadata || {};
  return upsertCitation(userDataPath, dossierId, {
    citationKey: key,
    sourceId,
    sourceType: source && source.sourceType || "institutional",
    author: metadata.author || "",
    corporateAuthor: metadata.corporateAuthor || "",
    year: metadata.year || "",
    title: metadata.title || source && source.name || "",
    publisher: metadata.publisher || "",
    url: metadata.url || "",
    doi: metadata.doi || "",
    metadata: { provisional: true }
  });
}

function getCitation(userDataPath, dossierId, citationKey) {
  const row = dbFor(userDataPath)
    .prepare("SELECT * FROM citations_v4 WHERE dossier_id = ? AND citation_key = ? AND active = 1")
    .get(dossierId, citationKey);
  return rowToCitation(row);
}

function getCitationBySource(userDataPath, dossierId, sourceId) {
  const row = dbFor(userDataPath)
    .prepare("SELECT * FROM citations_v4 WHERE dossier_id = ? AND source_id = ? AND active = 1 ORDER BY updated_at DESC LIMIT 1")
    .get(dossierId, sourceId);
  return rowToCitation(row);
}

function listCitations(userDataPath, dossierId) {
  return dbFor(userDataPath)
    .prepare("SELECT * FROM citations_v4 WHERE dossier_id = ? AND active = 1 ORDER BY corporate_author, author, year, title")
    .all(dossierId)
    .map(rowToCitation);
}

function surname(author) {
  const raw = String(author || "").trim();
  if (!raw) return "";
  if (raw.includes(",")) return raw.split(",")[0].trim();
  const parts = raw.split(/\s+/);
  return parts[parts.length - 1];
}

function displayAuthor(citation) {
  return citation.corporateAuthor || surname(citation.author) || "Autor no identificado";
}

function formatInText(citation) {
  if (!citation) return "(fuente pendiente)";
  return `(${displayAuthor(citation)}, ${citation.year || "s. f."})`;
}

function normalizeDoi(value) {
  const doi = String(value || "").trim();
  if (!doi) return "";
  if (/^https?:\/\/doi\.org\//i.test(doi)) return doi;
  return `https://doi.org/${doi.replace(/^doi:\s*/i, "")}`;
}

function formatReference(citation) {
  if (!citation) return "";
  const author = citation.corporateAuthor || citation.author || "Autor no identificado";
  const year = citation.year || "s. f.";
  const title = citation.title || "Título pendiente";
  const publisher = citation.publisher ? ` ${citation.publisher}.` : "";
  const locator = normalizeDoi(citation.doi) || citation.url || "";
  return `${author}. (${year}). ${title}.${publisher}${locator ? ` ${locator}` : ""}`.replace(/\s+/g, " ").trim();
}

function replaceCitationTokens(text, citations) {
  const map = new Map((citations || []).map((item) => [item.citationKey, item]));
  const missing = [];
  const output = String(text || "").replace(/\[\[CITE:([^\]]+)\]\]/g, (_match, rawKey) => {
    const key = String(rawKey || "").trim();
    const citation = map.get(key);
    if (!citation) {
      missing.push(key);
      return "(cita pendiente)";
    }
    if (!citation.complete) missing.push(key);
    return formatInText(citation);
  });
  return { text: output, missing: Array.from(new Set(missing)) };
}


function citationTokensFromInstance(instance) {
  const keys = [];
  const scan = (value) => {
    const text = String(value || "");
    const regex = /\[\[CITE:([^\]]+)\]\]/g;
    let match;
    while ((match = regex.exec(text))) keys.push(String(match[1] || "").trim());
  };
  (instance && instance.sections || []).forEach((section) => {
    scan(section.content);
    (section.blocks || []).forEach((block) => {
      scan(block.text);
      scan(block.note);
      scan(block.caption);
      scan(block.title);
    });
  });
  return Array.from(new Set(keys.filter(Boolean)));
}

function validateInstanceCitations(userDataPath, instance) {
  const keys = citationTokensFromInstance(instance);
  const missing = [];
  const incomplete = [];
  keys.forEach((key) => {
    const citation = getCitation(userDataPath, instance.dossierId, key);
    if (!citation) missing.push(key);
    else if (!citation.complete) incomplete.push(key);
  });
  return { ok: missing.length === 0 && incomplete.length === 0, keys, missing, incomplete };
}

module.exports = {
  ensureSchema,
  upsertCitation,
  ensureCitationForSource,
  getCitation,
  getCitationBySource,
  listCitations,
  formatInText,
  formatReference,
  replaceCitationTokens,
  citationTokensFromInstance,
  validateInstanceCitations
};
