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

function deactivateCitationBySource(userDataPath, dossierId, sourceId) {
  const db = dbFor(userDataPath);
  const result = db.prepare(
    "UPDATE citations_v4 SET active = 0, updated_at = ? WHERE dossier_id = ? AND source_id = ? AND active = 1"
  ).run(now(), dossierId, sourceId);
  return { sourceId, deactivated: Number(result.changes || 0) };
}


function referenceAuthors(citation) {
  const authors = splitAuthors(citation.author, citation.metadata);
  if (citation.corporateAuthor) return citation.corporateAuthor;
  if (!authors.length) return "";
  if (authors.length === 1) return authors[0];
  if (authors.length <= 20) return authors.slice(0, -1).join(", ") + ", & " + authors[authors.length - 1];
  return authors.slice(0, 19).join(", ") + ", … " + authors[authors.length - 1];
}

function shortTitle(citation) {
  return clean(citation && citation.metadata && citation.metadata.shortTitle) ||
    clean(citation && citation.title).split(/[:.]/)[0].slice(0, 80) ||
    "Fuente";
}

function inTextAuthor(citation) {
  if (citation.corporateAuthor) return citation.corporateAuthor;
  const authors = splitAuthors(citation.author, citation.metadata);
  if (authors.length === 1) return surname(authors[0]);
  if (authors.length === 2) return surname(authors[0]) + " & " + surname(authors[1]);
  if (authors.length >= 3) return surname(authors[0]) + " et al.";
  return shortTitle(citation);
}

function citationYear(citation) {
  return clean(citation && (citation.displayYear || citation.year)) || "s. f.";
}

function sameParty(a, b) {
  return Boolean(normalizedText(a) && normalizedText(a) === normalizedText(b));
}

function authorSortKey(citation) {
  return normalizedText(citation.corporateAuthor || referenceAuthors(citation) || shortTitle(citation));
}

function referenceIdentity(citation) {
  const doi = normalizeDoi(citation.doi).toLowerCase();
  if (doi) return "doi:" + doi;
  const url = normalizeUrl(citation.url).replace(/\/$/, "").toLowerCase();
  if (url) return "url:" + url;
  if (citation.sourceId) return "source:" + citation.sourceId;
  return [
    normalizeSourceType(citation.sourceType),
    authorSortKey(citation),
    normalizedText(citation.year),
    normalizedText(citation.title)
  ].join("|");
}

function prepareCitationSet(citations) {
  const raw = (citations || []).filter(Boolean).map((item) => Object.assign({}, item, {
    sourceType: normalizeSourceType(item.sourceType),
    metadata: Object.assign({}, item.metadata || {})
  }));
  const uniqueMap = new Map();
  raw.forEach((citation) => {
    const identity = referenceIdentity(citation);
    if (!uniqueMap.has(identity)) uniqueMap.set(identity, citation);
  });
  const unique = Array.from(uniqueMap.values());
  const groups = new Map();
  unique.forEach((citation) => {
    const key = authorSortKey(citation) + "|" + normalizedText(citation.year || "s. f.");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(citation);
  });
  const suffixByIdentity = new Map();
  groups.forEach((items) => {
    if (items.length < 2) return;
    items.sort((a, b) => normalizedText(a.title).localeCompare(normalizedText(b.title), "es"));
    items.forEach((item, index) => suffixByIdentity.set(referenceIdentity(item), String.fromCharCode(97 + index)));
  });
  const applySuffix = (citation) => {
    const suffix = suffixByIdentity.get(referenceIdentity(citation)) || "";
    const base = clean(citation.year) || "s. f.";
    return Object.assign({}, citation, { displayYear: suffix ? base + suffix : base });
  };
  const tokenCitations = raw.map(applySuffix);
  const references = unique.map(applySuffix).sort((a, b) =>
    authorSortKey(a).localeCompare(authorSortKey(b), "es") ||
    normalizedText(a.displayYear).localeCompare(normalizedText(b.displayYear), "es") ||
    normalizedText(a.title).localeCompare(normalizedText(b.title), "es")
  );
  return { citations: tokenCitations, references };
}

function formatInText(citation) {
  if (!citation) return "(cita pendiente)";
  return "(" + inTextAuthor(citation) + ", " + citationYear(citation) + ")";
}

function normalizeDoi(value) {
  const doi = clean(value);
  if (!doi) return "";
  if (/^https?:\/\/doi\.org\//i.test(doi)) return doi.replace(/^http:\/\//i, "https://");
  return "https://doi.org/" + doi.replace(/^doi:\s*/i, "");
}

function dateForReference(citation, detailed) {
  const metadata = citation.metadata || {};
  const raw = clean(metadata.date || metadata.publicationDate);
  if (!detailed || !raw) return citationYear(citation);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw;
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return citationYear(citation) + ", " + Number(match[3]) + " de " + months[Number(match[2]) - 1];
}

function locator(citation) {
  return normalizeDoi(citation.doi) || normalizeUrl(citation.url) || "";
}

function addPart(parts, text, italic) {
  const value = String(text == null ? "" : text);
  if (value) parts.push({ text: value, italic: Boolean(italic) });
}

function formatReferenceSegments(citation) {
  if (!citation) return [];
  const c = Object.assign({}, citation, {
    sourceType: normalizeSourceType(citation.sourceType),
    metadata: citation.metadata || {}
  });
  const m = c.metadata;
  const type = c.sourceType;
  const parts = [];
  const authors = referenceAuthors(c);
  const detailedDate = ["webpage", "resolution", "regulation", "conference_paper"].includes(type);
  const date = dateForReference(c, detailedDate);
  const publisher = clean(c.publisher || m.publisher);
  const loc = locator(c);

  if (type === "law") {
    addPart(parts, c.title, true);
    const identifiers = [m.legalNumber || m.identifier, m.officialPublication, m.jurisdiction].map(clean).filter(Boolean);
    if (identifiers.length) addPart(parts, ", " + identifiers.join(", "));
    addPart(parts, " (" + date + ").");
    if (loc) addPart(parts, " " + loc);
    return parts;
  }

  if (authors) addPart(parts, authors + ". ");
  else addPart(parts, "Autor no identificado. ");
  addPart(parts, "(" + date + "). ");

  if (type === "journal_article") {
    addPart(parts, c.title + ". ");
    addPart(parts, m.journalTitle, true);
    if (m.volume) addPart(parts, ", " + m.volume, true);
    if (m.issue) addPart(parts, "(" + m.issue + ")");
    if (m.pages) addPart(parts, ", " + m.pages);
    addPart(parts, ".");
  } else if (type === "book") {
    addPart(parts, c.title, true);
    if (m.edition) addPart(parts, " (" + m.edition + ")");
    addPart(parts, ".");
    if (publisher && !sameParty(publisher, authors)) addPart(parts, " " + publisher + ".");
  } else if (type === "book_chapter") {
    addPart(parts, c.title + ". ");
    if (m.editors) addPart(parts, "En " + m.editors + " (Eds.), ");
    addPart(parts, m.bookTitle || "Libro", true);
    if (m.pages) addPart(parts, " (pp. " + m.pages + ")");
    addPart(parts, ".");
    if (publisher) addPart(parts, " " + publisher + ".");
  } else if (type === "thesis") {
    addPart(parts, c.title, true);
    const thesisType = clean(m.thesisType || "Tesis");
    const institution = clean(m.institution);
    addPart(parts, " [" + thesisType + (institution ? ", " + institution : "") + "].");
    if (m.repository) addPart(parts, " " + m.repository + ".");
  } else if (type === "webpage") {
    addPart(parts, c.title, true);
    addPart(parts, ".");
    const site = clean(m.siteName);
    if (site && !sameParty(site, authors)) addPart(parts, " " + site + ".");
  } else if (type === "report") {
    addPart(parts, c.title, true);
    if (m.reportNumber) addPart(parts, " (Informe No. " + m.reportNumber + ")");
    addPart(parts, ".");
    if (publisher && !sameParty(publisher, authors)) addPart(parts, " " + publisher + ".");
  } else if (["institutional", "policy", "manual"].includes(type)) {
    addPart(parts, c.title, true);
    const descriptor = clean(m.documentCode || m.identifier || m.version);
    if (descriptor) addPart(parts, " (" + descriptor + ")");
    addPart(parts, ".");
    if (publisher && !sameParty(publisher, authors)) addPart(parts, " " + publisher + ".");
  } else if (["regulation", "resolution"].includes(type)) {
    addPart(parts, c.title, true);
    const identifier = clean(m.identifier || m.resolutionNumber || m.regulationNumber);
    if (identifier) addPart(parts, " (" + identifier + ")");
    addPart(parts, ".");
    if (m.officialPublication) addPart(parts, " " + m.officialPublication + ".");
  } else if (type === "standard") {
    addPart(parts, c.title, true);
    const number = clean(m.standardNumber || m.identifier);
    if (number) addPart(parts, " (" + number + ")");
    addPart(parts, ".");
    if (publisher && !sameParty(publisher, authors)) addPart(parts, " " + publisher + ".");
  } else if (type === "conference_paper") {
    addPart(parts, c.title + ". [Ponencia]. " + clean(m.conferenceName));
    if (m.location) addPart(parts, ", " + m.location);
    addPart(parts, ".");
  } else if (type === "dataset") {
    addPart(parts, c.title, true);
    addPart(parts, " [Conjunto de datos].");
    const repository = clean(m.repository || publisher);
    if (repository && !sameParty(repository, authors)) addPart(parts, " " + repository + ".");
  } else {
    addPart(parts, c.title, true);
    addPart(parts, ".");
    if (publisher && !sameParty(publisher, authors)) addPart(parts, " " + publisher + ".");
  }

  if (loc) addPart(parts, " " + loc);
  return parts;
}

function formatReference(citation) {
  return formatReferenceSegments(citation)
    .map((item) => item.text)
    .join("")
    .replace(/\s+([,.;:)])/g, "$1")
    .trim();
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatReferenceHtml(citation) {
  return formatReferenceSegments(citation)
    .map((item) => item.italic ? "<em>" + escapeHtml(item.text) + "</em>" : escapeHtml(item.text))
    .join("")
    .replace(/\s+([,.;:)])/g, "$1")
    .trim();
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



function scanCitationTokens(value, keys) {
  if (value == null) return;
  if (typeof value === "string") {
    const regex = /\[\[CITE:([^\]]+)\]\]/g;
    let match;
    while ((match = regex.exec(value))) {
      const key = clean(match[1]);
      if (key) keys.push(key);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => scanCitationTokens(item, keys));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => scanCitationTokens(item, keys));
  }
}

function citationTokensFromInstance(instance, sectionKeys) {
  const keys = [];
  const wanted = Array.isArray(sectionKeys) && sectionKeys.length
    ? new Set(sectionKeys.map(String))
    : null;
  (instance && instance.sections || []).forEach((section) => {
    if (wanted && !wanted.has(String(section.key))) return;
    scanCitationTokens(section.content, keys);
    scanCitationTokens(section.blocks || [], keys);
  });
  return Array.from(new Set(keys));
}

function resolveInstanceCitations(userDataPath, instance, options) {
  const keys = citationTokensFromInstance(instance, options && options.sectionKeys);
  const missing = [];
  const incomplete = [];
  const warnings = [];
  const rows = [];
  keys.forEach((key) => {
    const citation = getCitation(userDataPath, instance.dossierId, key);
    if (!citation) {
      missing.push(key);
      return;
    }
    if (!citation.complete) {
      incomplete.push(key);
      (citation.validation && citation.validation.errors || []).forEach((message) => {
        warnings.push(key + ": " + message);
      });
    }
    rows.push(citation);
  });
  const prepared = prepareCitationSet(rows);
  return {
    ok: missing.length === 0 && incomplete.length === 0,
    keys,
    missing,
    incomplete,
    warnings,
    citations: prepared.citations,
    references: prepared.references
  };
}

function validateInstanceCitations(userDataPath, instance, options) {
  const resolved = resolveInstanceCitations(userDataPath, instance, options);
  return {
    ok: resolved.ok,
    keys: resolved.keys,
    missing: resolved.missing,
    incomplete: resolved.incomplete,
    warnings: resolved.warnings,
    referenceCount: resolved.references.length
  };
}

module.exports = {
  SOURCE_TYPES,
  sourceTypeOptions,
  normalizeSourceType,
  normalizeDoi,
  validateCitation,
  ensureSchema,
  upsertCitation,
  ensureCitationForSource,
  getCitation,
  getCitationBySource,
  listCitations,
  deactivateCitationBySource,
  formatInText,
  formatReference,
  formatReferenceHtml,
  prepareCitationSet,
  referenceIdentity,
  replaceCitationTokens,
  citationTokensFromInstance,
  resolveInstanceCitations,
  validateInstanceCitations
};
