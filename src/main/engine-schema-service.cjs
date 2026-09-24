const crypto = require("crypto");
const editorial = require("./editorial-structure-service.cjs");

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = stableObject(value[key]);
    return acc;
  }, {});
}

function hash(value) {
  return crypto.createHash("sha256")
    .update(JSON.stringify(stableObject(value)))
    .digest("hex");
}

function sectionDefinition(section) {
  return {
    key: section.key,
    title: section.title,
    type: section.type,
    parentKey: section.parentKey || "",
    level: Number(section.level || 1),
    sortPath: section.sortPath || "",
    numbering: section.numbering || "",
    pageBreakBefore: Boolean(section.pageBreakBefore),
    keepWithNext: section.keepWithNext !== false,
    required: section.required !== false,
    allowedVisuals: Array.isArray(section.allowedVisuals) ? section.allowedVisuals.slice() : [],
    derivedFrom: Array.isArray(section.derivedFrom) ? section.derivedFrom.slice() : [],
    maxWords: section.maxWords || null,
    compact: Boolean(section.compact),
    layout: section.layout || {}
  };
}

function sectionDefinitionHash(section) {
  return hash(sectionDefinition(section));
}

function normalizedEngineSections(engine) {
  return editorial.flattenSections(engine && engine.sections || []).map((section, index) => {
    const definition = sectionDefinition(section);
    return Object.assign({}, definition, {
      order: index + 1,
      definitionHash: sectionDefinitionHash(definition)
    });
  });
}

function engineDefinition(engine) {
  return {
    engineId: engine && engine.engineId || "",
    documentId: engine && engine.documentId || "",
    family: engine && engine.family || "",
    profile: engine && engine.profile || "",
    cardinality: engine && engine.cardinality || "",
    population: engine && engine.population || "all",
    scopeKeys: Array.isArray(engine && engine.scopeKeys) ? engine.scopeKeys.slice() : [],
    dependencies: Array.isArray(engine && engine.dependencies) ? engine.dependencies.slice() : [],
    rules: Array.isArray(engine && engine.rules) ? engine.rules.slice() : [],
    sections: normalizedEngineSections(engine).map((section) => sectionDefinition(section))
  };
}

function engineDefinitionHash(engine) {
  return hash(engineDefinition(engine));
}

function rowDefinition(row) {
  let layout = {};
  try { layout = JSON.parse(row && row.layout_json || "{}"); } catch (_error) { layout = {}; }
  return {
    key: row.section_key,
    title: row.title,
    type: row.section_type,
    parentKey: row.parent_key || "",
    level: Number(row.section_level || 1),
    sortPath: row.sort_path || "",
    numbering: row.numbering || "",
    pageBreakBefore: Boolean(row.page_break_before),
    keepWithNext: row.keep_with_next !== 0,
    required: layout.required !== false,
    allowedVisuals: Array.isArray(layout.allowedVisuals) ? layout.allowedVisuals : [],
    derivedFrom: Array.isArray(layout.derivedFrom) ? layout.derivedFrom : [],
    maxWords: layout.maxWords || null,
    compact: Boolean(layout.compact),
    layout: layout.layout || {}
  };
}

function planMigration(currentRows, engine) {
  const target = normalizedEngineSections(engine);
  const currentByKey = new Map((currentRows || []).map((row) => [row.section_key, row]));
  const targetByKey = new Map(target.map((section) => [section.key, section]));
  const added = [];
  const reactivated = [];
  const updated = [];
  const unchanged = [];
  const archived = [];

  target.forEach((section) => {
    const current = currentByKey.get(section.key);
    if (!current) {
      added.push(section.key);
      return;
    }
    if (Number(current.active == null ? 1 : current.active) === 0) {
      reactivated.push(section.key);
    }
    const currentHash = String(current.definition_hash || "") || sectionDefinitionHash(rowDefinition(current));
    if (currentHash !== section.definitionHash) updated.push(section.key);
    else unchanged.push(section.key);
  });

  (currentRows || []).forEach((row) => {
    const active = Number(row.active == null ? 1 : row.active) !== 0;
    if (active && !targetByKey.has(row.section_key)) archived.push(row.section_key);
  });

  return {
    target,
    added,
    reactivated,
    updated,
    unchanged,
    archived,
    structuralChange: Boolean(added.length || reactivated.length || updated.length || archived.length)
  };
}

module.exports = {
  stableObject,
  sectionDefinition,
  sectionDefinitionHash,
  normalizedEngineSections,
  engineDefinition,
  engineDefinitionHash,
  rowDefinition,
  planMigration
};
