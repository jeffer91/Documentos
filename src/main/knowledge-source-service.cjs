const fs = require("fs");
const path = require("path");
const { workspaceRoot } = require("./database-service.cjs");
const { sha256 } = require("./file-integrity-service.cjs");
const { extractAttachment } = require("./source-service.cjs");
const hub = require("./process-hub-service.cjs");
const citations = require("./citation-service.cjs");

function id(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function now() {
  return new Date().toISOString();
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_sources_v3 (
      id TEXT PRIMARY KEY,
      dossier_id TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'institutional',
      name TEXT NOT NULL,
      local_path TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      extracted_text TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(dossier_id) REFERENCES dossiers_v3(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_sources_v3_dossier
      ON knowledge_sources_v3(dossier_id, active, created_at);
  `);
}

function dbFor(userDataPath) {
  const db = hub.dbFor(userDataPath);
  ensureSchema(db);
  return db;
}

function rowToSource(row) {
  if (!row) return null;
  return {
    id: row.id,
    dossierId: row.dossier_id,
    sourceType: row.source_type,
    name: row.name,
    localPath: row.local_path,
    sha256: row.sha256,
    textLength: String(row.extracted_text || "").length,
    tags: (() => { try { return JSON.parse(row.tags_json || "[]"); } catch (_error) { return []; } })(),
    metadata: (() => { try { return JSON.parse(row.metadata_json || "{}"); } catch (_error) { return {}; } })(),
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function importKnowledgeSource(userDataPath, dossierId, sourcePath, options) {
  const db = dbFor(userDataPath);
  const dossier = hub.getDossier(userDataPath, dossierId);
  if (!dossier) throw new Error("Expediente no válido.");
  if (!sourcePath || !fs.existsSync(sourcePath)) throw new Error("Fuente institucional no encontrada.");

  const sourceId = id("knowledge");
  const dir = path.join(workspaceRoot(userDataPath), "dossiers", dossierId, "knowledge", sourceId);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, path.basename(sourcePath));
  fs.copyFileSync(sourcePath, target);
  const hash = sha256(target);
  const extension = path.extname(target).toLowerCase();
  const extracted = await extractAttachment({
    id: sourceId,
    name: path.basename(target),
    kind: "source",
    markerName: "",
    extension,
    localPath: target
  });
  const text = extracted && extracted.type === "text" ? String(extracted.text || "") : "";
  const ts = now();
  const tags = options && Array.isArray(options.tags) ? options.tags : [];
  const metadata = Object.assign({}, options && options.metadata || {}, {
    extractionType: extracted && extracted.type || "file",
    extractionWarning: extracted && extracted.extractionWarning || "",
    importedFor: options && options.purpose || "institutional"
  });

  db.prepare(`
    INSERT INTO knowledge_sources_v3
      (id, dossier_id, source_type, name, local_path, sha256, extracted_text, tags_json, metadata_json, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    sourceId,
    dossierId,
    String(options && options.sourceType || "institutional"),
    path.basename(target),
    target,
    hash,
    text.slice(0, 250000),
    JSON.stringify(tags),
    JSON.stringify(metadata),
    ts,
    ts
  );

  hub.audit(db, {
    dossierId,
    entityType: "knowledge_source",
    entityId: sourceId,
    action: "import",
    detail: { name: path.basename(target), sha256: hash, sourceType: options && options.sourceType || "institutional", tags }
  });
  hub.markDossierStale(userDataPath, dossierId, `Se agregó una fuente institucional: ${path.basename(target)}`);
  const source = getKnowledgeSource(userDataPath, sourceId);
  citations.ensureCitationForSource(userDataPath, dossierId, source);
  return source;
}

function getKnowledgeSource(userDataPath, sourceId) {
  const row = dbFor(userDataPath).prepare("SELECT * FROM knowledge_sources_v3 WHERE id = ?").get(sourceId);
  return rowToSource(row);
}

function listKnowledgeSources(userDataPath, dossierId) {
  return dbFor(userDataPath)
    .prepare("SELECT * FROM knowledge_sources_v3 WHERE dossier_id = ? AND active = 1 ORDER BY created_at DESC")
    .all(dossierId)
    .map(rowToSource);
}

function snippet(text, terms) {
  const raw = String(text || "");
  if (!raw) return "";
  const lower = raw.toLowerCase();
  let best = 0;
  for (const term of terms) {
    const index = lower.indexOf(term);
    if (index >= 0) { best = index; break; }
  }
  const start = Math.max(0, best - 700);
  return raw.slice(start, start + 4500).trim();
}

function searchKnowledge(userDataPath, dossierId, query, limit) {
  const db = dbFor(userDataPath);
  const terms = String(query || "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);
  const rows = db.prepare("SELECT * FROM knowledge_sources_v3 WHERE dossier_id = ? AND active = 1").all(dossierId);
  const ranked = rows.map((row) => {
    const haystack = `${row.name} ${row.tags_json} ${row.extracted_text}`.toLowerCase();
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
    return { row, score };
  }).sort((a, b) => b.score - a.score || String(b.row.created_at).localeCompare(String(a.row.created_at)));

  return ranked.slice(0, Math.max(1, Math.min(Number(limit || 5), 10))).map(({ row, score }) => {
    const citation = citations.getCitationBySource(userDataPath, dossierId, row.id);
    return {
      id: row.id,
      name: row.name,
      sourceType: row.source_type,
      sha256: row.sha256,
      tags: (() => { try { return JSON.parse(row.tags_json || "[]"); } catch (_error) { return []; } })(),
      citationKey: citation ? citation.citationKey : `SRC:${row.id}`,
      citationComplete: Boolean(citation && citation.complete),
      score,
      excerpt: snippet(row.extracted_text, terms)
    };
  });
}

function deactivateSource(userDataPath, sourceId) {
  const db = dbFor(userDataPath);
  const row = db.prepare("SELECT * FROM knowledge_sources_v3 WHERE id = ?").get(sourceId);
  if (!row) throw new Error("Fuente no válida.");
  db.prepare("UPDATE knowledge_sources_v3 SET active = 0, updated_at = ? WHERE id = ?").run(now(), sourceId);
  hub.audit(db, {
    dossierId: row.dossier_id,
    entityType: "knowledge_source",
    entityId: sourceId,
    action: "deactivate",
    detail: { name: row.name }
  });
  hub.markDossierStale(userDataPath, row.dossier_id, `Se retiró una fuente institucional: ${row.name}`);
  return { id: sourceId, active: false };
}

module.exports = {
  importKnowledgeSource,
  getKnowledgeSource,
  listKnowledgeSources,
  searchKnowledge,
  deactivateSource
};
