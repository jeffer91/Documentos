const { openDatabase } = require("./database-service.cjs");

const SOURCE_TYPES = Object.freeze([
  { id: "institutional", label: "Documento institucional" },
  { id: "journal_article", label: "Artículo científico" },
  { id: "book", label: "Libro" },
  { id: "book_chapter", label: "Capítulo de libro" },
  { id: "thesis", label: "Tesis / trabajo académico" },
  { id: "webpage", label: "Página web" },
  { id: "report", label: "Informe" },
  { id: "law", label: "Ley / norma legal" },
  { id: "regulation", label: "Reglamento" },
  { id: "resolution", label: "Resolución" },
  { id: "policy", label: "Política institucional" },
  { id: "manual", label: "Manual / guía" },
  { id: "standard", label: "Norma técnica" },
  { id: "conference_paper", label: "Ponencia / congreso" },
  { id: "dataset", label: "Conjunto de datos" }
]);

const SOURCE_TYPE_ALIASES = Object.freeze({
  article: "journal_article",
  journal: "journal_article",
  articulo: "journal_article",
  book: "book",
  libro: "book",
  chapter: "book_chapter",
  capitulo: "book_chapter",
  thesis: "thesis",
  dissertation: "thesis",
  tesis: "thesis",
  webpage: "webpage",
  website: "webpage",
  web: "webpage",
  report: "report",
  informe: "report",
  institutional_document: "institutional",
  document: "institutional",
  legal: "law",
  legislation: "law",
  ley: "law",
  reglamento: "regulation",
  resolucion: "resolution",
  politica: "policy",
  guide: "manual",
  guia: "manual",
  norma: "standard",
  conference: "conference_paper",
  ponencia: "conference_paper",
  datos: "dataset"
});

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function normalizedText(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeSourceType(value) {
  const raw = normalizedText(value).replace(/[\s-]+/g, "_");
  if (SOURCE_TYPE_ALIASES[raw]) return SOURCE_TYPE_ALIASES[raw];
  return SOURCE_TYPES.some((item) => item.id === raw) ? raw : "institutional";
}

function sourceTypeOptions() {
  return SOURCE_TYPES.map((item) => Object.assign({}, item));
}

function normalizeUrl(value) {
  return clean(value);
}


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


function splitAuthors(author, metadata) {
  if (metadata && Array.isArray(metadata.authors) && metadata.authors.length) {
    return metadata.authors.map((item) => {
      if (typeof item === "string") return clean(item);
      if (!item || typeof item !== "object") return "";
      const family = clean(item.family || item.surname || item.lastName);
      const given = clean(item.given || item.initials || item.firstName);
      return [family, given].filter(Boolean).join(", ");
    }).filter(Boolean);
  }
  const raw = clean(author);
  if (!raw) return [];
  return raw.split(/\s*[;|]\s*/).map(clean).filter(Boolean);
}

function surname(author) {
  const raw = clean(author);
  if (!raw) return "";
  if (raw.includes(",")) return clean(raw.split(",")[0]);
  const parts = raw.split(/\s+/);
  return parts[parts.length - 1];
}

function canonicalYear(year, metadata) {
  const direct = clean(year);
  if (direct) return direct;
  const date = clean(metadata && (metadata.date || metadata.publicationDate));
  const match = date.match(/^(\d{4})/);
  return match ? match[1] : "";
}

function validateCitation(citation) {
  const c = citation || {};
  const type = normalizeSourceType(c.sourceType);
  const metadata = c.metadata || {};
  const errors = [];
  const warnings = [];
  const authors = splitAuthors(c.author, metadata);
  const hasAuthor = Boolean(clean(c.corporateAuthor) || authors.length);
  const hasDate = Boolean(clean(c.year) || clean(metadata.date) || clean(metadata.publicationDate));

  if (!clean(c.title)) errors.push("Falta el título.");
  if (!hasDate) errors.push("Falta el año o fecha de publicación.");

  if (["journal_article", "book", "book_chapter", "thesis", "webpage", "report", "institutional", "policy", "manual", "standard", "conference_paper", "dataset"].includes(type) && !hasAuthor) {
    errors.push("Falta autor personal o institucional.");
  }

  if (type === "journal_article") {
    if (!authors.length) errors.push("Un artículo científico necesita autor personal.");
    if (!clean(metadata.journalTitle)) errors.push("Falta el nombre de la revista.");
    if (!clean(metadata.volume)) warnings.push("No se registró volumen de revista.");
  }
  if (type === "book" && !clean(c.publisher || metadata.publisher)) errors.push("Falta la editorial.");
  if (type === "book_chapter") {
    if (!clean(metadata.bookTitle)) errors.push("Falta el título del libro.");
    if (!clean(c.publisher || metadata.publisher)) errors.push("Falta la editorial del libro.");
  }
  if (type === "thesis") {
    if (!clean(metadata.institution)) errors.push("Falta la institución de la tesis.");
    if (!clean(metadata.thesisType)) errors.push("Falta el tipo de tesis/trabajo académico.");
  }
  if (type === "webpage" && !normalizeUrl(c.url || metadata.url)) errors.push("Una página web necesita URL.");
  if (type === "law" && !clean(metadata.legalNumber || metadata.identifier || metadata.officialPublication)) {
    errors.push("La norma legal necesita número/identificador o publicación oficial.");
  }
  if (["regulation", "resolution"].includes(type) && !clean(c.corporateAuthor || metadata.issuingBody)) {
    errors.push("Falta el organismo emisor.");
  }
  if (type === "resolution" && !clean(metadata.identifier || metadata.resolutionNumber)) {
    errors.push("Falta el número/identificador de la resolución.");
  }
  if (type === "standard" && !clean(metadata.standardNumber || metadata.identifier)) {
    errors.push("Falta el número de la norma técnica.");
  }
  if (type === "conference_paper" && !clean(metadata.conferenceName)) {
    errors.push("Falta el nombre del congreso/evento.");
  }
  if (type === "dataset" && !clean(c.publisher || metadata.repository || metadata.publisher)) {
    warnings.push("No se registró repositorio/editor del conjunto de datos.");
  }
  return { ok: errors.length === 0, errors, warnings, sourceType: type };
}

function rowToCitation(row) {
  if (!row) return null;
  const metadata = parseJson(row.metadata_json, {});
  const citation = {
    id: row.id,
    dossierId: row.dossier_id,
    sourceId: row.source_id || "",
    citationKey: row.citation_key,
    sourceType: normalizeSourceType(row.source_type),
    author: row.author || "",
    corporateAuthor: row.corporate_author || "",
    year: canonicalYear(row.year, metadata),
    title: row.title || "",
    publisher: row.publisher || "",
    url: row.url || "",
    doi: row.doi || "",
    metadata,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
  citation.validation = validateCitation(citation);
  citation.complete = citation.validation.ok;
  return citation;
}

function upsertCitation(userDataPath, dossierId, input) {
  const db = dbFor(userDataPath);
  const ts = now();
  const supplied = input || {};
  const citationKey = clean(supplied.citationKey);
  if (!citationKey) throw new Error("La cita necesita una clave.");
  const existing = db.prepare("SELECT * FROM citations_v4 WHERE dossier_id = ? AND citation_key = ?").get(dossierId, citationKey);
  const previous = rowToCitation(existing) || {};
  const citationId = existing ? existing.id : id("citation");
  const sourceId = Object.prototype.hasOwnProperty.call(supplied, "sourceId") ? clean(supplied.sourceId) : clean(previous.sourceId);
  const sourceType = normalizeSourceType(Object.prototype.hasOwnProperty.call(supplied, "sourceType") ? supplied.sourceType : previous.sourceType);
  const author = Object.prototype.hasOwnProperty.call(supplied, "author") ? clean(supplied.author) : clean(previous.author);
  const corporateAuthor = Object.prototype.hasOwnProperty.call(supplied, "corporateAuthor") ? clean(supplied.corporateAuthor) : clean(previous.corporateAuthor);
  const title = Object.prototype.hasOwnProperty.call(supplied, "title") ? clean(supplied.title) : clean(previous.title);
  const publisher = Object.prototype.hasOwnProperty.call(supplied, "publisher") ? clean(supplied.publisher) : clean(previous.publisher);
  const url = Object.prototype.hasOwnProperty.call(supplied, "url") ? normalizeUrl(supplied.url) : normalizeUrl(previous.url);
  const doi = Object.prototype.hasOwnProperty.call(supplied, "doi") ? normalizeDoi(supplied.doi) : normalizeDoi(previous.doi);
  const metadata = Object.assign({}, previous.metadata || {}, supplied.metadata || {});
  const year = canonicalYear(
    Object.prototype.hasOwnProperty.call(supplied, "year") ? supplied.year : previous.year,
    metadata
  );
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
    sourceType: metadata.citationType || source && source.sourceType || "institutional",
    author: metadata.author || "",
    corporateAuthor: metadata.corporateAuthor || "",
    year: metadata.year || "",
    title: metadata.title || source && source.name || "",
    publisher: metadata.publisher || "",
    url: metadata.url || "",
    doi: metadata.doi || "",
    metadata: Object.assign({}, metadata, { provisional: true })
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
