const VALID_VISUAL_POLICIES = new Set(["none", "optional", "recommended", "required"]);
const VALID_CONTENT_MODES = new Set([
  "fixed",
  "manual",
  "ai",
  "stable_ai",
  "semi_stable_ai",
  "data",
  "data_table",
  "data_ai",
  "analysis_ai",
  "derived_ai",
  "executive_summary",
  "references",
  "annexes"
]);

function deepClone(value) {
  if (Array.isArray(value)) return value.map(deepClone);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).reduce((acc, key) => {
    acc[key] = deepClone(value[key]);
    return acc;
  }, {});
}

function cleanString(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeContract(contract, fallbackType) {
  const input = contract && typeof contract === "object" && !Array.isArray(contract)
    ? deepClone(contract)
    : {};
  if (!Object.keys(input).length) return {};

  const normalized = Object.assign({}, input);
  if (normalized.contentMode != null) normalized.contentMode = cleanString(normalized.contentMode);
  else if (fallbackType) normalized.contentMode = cleanString(fallbackType);

  if (normalized.purpose != null) normalized.purpose = cleanString(normalized.purpose);
  if (normalized.sourcePolicy != null) normalized.sourcePolicy = cleanString(normalized.sourcePolicy);
  if (normalized.visualPolicy != null) normalized.visualPolicy = cleanString(normalized.visualPolicy);
  if (normalized.evidenceRequired != null) normalized.evidenceRequired = Boolean(normalized.evidenceRequired);
  if (normalized.reviewRequired != null) normalized.reviewRequired = Boolean(normalized.reviewRequired);
  normalized.dataNeeds = Array.isArray(normalized.dataNeeds)
    ? normalized.dataNeeds.map(cleanString).filter(Boolean)
    : [];
  normalized.promptInstructions = Array.isArray(normalized.promptInstructions)
    ? normalized.promptInstructions.map(cleanString).filter(Boolean)
    : [];
  return normalized;
}

function mergeBlueprintEntry(entry, sectionLibrary) {
  if (typeof entry === "string") {
    const base = sectionLibrary[entry];
    if (!base) throw new Error(`Sección base no registrada: ${entry}.`);
    return { node: deepClone(base), children: deepClone(base.children || []) };
  }

  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error("Cada entrada del blueprint debe ser una clave de biblioteca o un objeto.");
  }

  const use = cleanString(entry.use);
  const base = use ? sectionLibrary[use] : {};
  if (use && !base) throw new Error(`Sección base no registrada: ${use}.`);

  const direct = deepClone(entry);
  delete direct.use;
  delete direct.overrides;
  delete direct.children;

  const overrides = entry.overrides && typeof entry.overrides === "object" && !Array.isArray(entry.overrides)
    ? deepClone(entry.overrides)
    : {};
  const children = Object.prototype.hasOwnProperty.call(entry, "children")
    ? deepClone(entry.children || [])
    : Object.prototype.hasOwnProperty.call(overrides, "children")
      ? deepClone(overrides.children || [])
      : deepClone(base.children || []);
  delete overrides.children;

  return {
    node: Object.assign({}, deepClone(base), direct, overrides),
    children
  };
}

function compileEntry(entry, index, context) {
  const merged = mergeBlueprintEntry(entry, context.sectionLibrary);
  const node = merged.node;
  const key = cleanString(node.key);
  if (!key) throw new Error(`El motor ${context.engineId} contiene una sección sin key estable.`);

  node.key = key;
  node.title = cleanString(node.title || key);
  node.type = cleanString(node.type || "ai");
  node.order = index + 1;
  node.definitionOwner = context.engineId;
  node.allowedVisuals = Array.isArray(node.allowedVisuals) ? node.allowedVisuals.slice() : [];
  node.derivedFrom = Array.isArray(node.derivedFrom) ? node.derivedFrom.map(cleanString).filter(Boolean) : [];
  node.data = node.data && typeof node.data === "object" && !Array.isArray(node.data) ? deepClone(node.data) : {};
  node.contract = normalizeContract(node.contract, node.type);
  node.children = (Array.isArray(merged.children) ? merged.children : [])
    .map((child, childIndex) => compileEntry(child, childIndex, context));
  return node;
}

function flattenTree(sections) {
  const rows = [];
  const walk = (items, depth) => {
    (items || []).forEach((item) => {
      rows.push({ node: item, depth });
      walk(item.children || [], depth + 1);
    });
  };
  walk(sections || [], 1);
  return rows;
}

function dependencyCycles(rows) {
  const byKey = new Map(rows.map((row) => [row.node.key, row.node]));
  const visiting = new Set();
  const visited = new Set();
  const cycles = [];

  function visit(key, stack) {
    if (visiting.has(key)) {
      const start = stack.indexOf(key);
      cycles.push(stack.slice(start).concat(key));
      return;
    }
    if (visited.has(key)) return;
    visiting.add(key);
    const node = byKey.get(key);
    (node && node.derivedFrom || []).forEach((dependency) => {
      if (byKey.has(dependency)) visit(dependency, stack.concat(key));
    });
    visiting.delete(key);
    visited.add(key);
  }

  rows.forEach((row) => visit(row.node.key, []));
  return cycles;
}

function validateCompiledOutline(engineId, sections, options) {
  const opts = options || {};
  const allowedVisuals = new Set(Array.isArray(opts.allowedVisuals) ? opts.allowedVisuals : []);
  const rows = flattenTree(sections);
  const errors = [];
  const warnings = [];
  const keys = new Set();

  if (!rows.length) errors.push(`El motor ${engineId} no tiene secciones.`);

  rows.forEach(({ node, depth }) => {
    if (keys.has(node.key)) errors.push(`El motor ${engineId} repite la key "${node.key}".`);
    keys.add(node.key);

    if (!node.title) errors.push(`La sección ${node.key} no tiene título.`);
    if (!node.type) errors.push(`La sección ${node.key} no tiene tipo de contenido.`);

    if (node.maxWords != null && (!Number.isFinite(Number(node.maxWords)) || Number(node.maxWords) <= 0)) {
      errors.push(`La sección ${node.key} tiene maxWords inválido.`);
    }

    (node.allowedVisuals || []).forEach((visual) => {
      if (allowedVisuals.size && !allowedVisuals.has(visual)) {
        errors.push(`La sección ${node.key} habilita una herramienta visual desconocida: ${visual}.`);
      }
    });

    const contract = node.contract || {};
    if (Object.keys(contract).length) {
      if (contract.contentMode && !VALID_CONTENT_MODES.has(contract.contentMode)) {
        errors.push(`La sección ${node.key} usa contentMode inválido: ${contract.contentMode}.`);
      }
      if (contract.visualPolicy && !VALID_VISUAL_POLICIES.has(contract.visualPolicy)) {
        errors.push(`La sección ${node.key} usa visualPolicy inválido: ${contract.visualPolicy}.`);
      }
      if (!Array.isArray(contract.dataNeeds)) errors.push(`La sección ${node.key} debe declarar dataNeeds como arreglo.`);
      if (!Array.isArray(contract.promptInstructions)) errors.push(`La sección ${node.key} debe declarar promptInstructions como arreglo.`);
    }

    if (depth > 6) {
      warnings.push(`La sección ${node.key} alcanza nivel ${depth}; el motor lo soporta, pero conviene confirmar que tanta profundidad sea necesaria.`);
    }
  });

  rows.forEach(({ node }) => {
    (node.derivedFrom || []).forEach((dependency) => {
      if (dependency === node.key) {
        errors.push(`La sección ${node.key} no puede derivar de sí misma.`);
      } else if (!keys.has(dependency)) {
        errors.push(`La sección ${node.key} depende de "${dependency}", que no existe en su propio motor.`);
      }
    });
  });

  dependencyCycles(rows).forEach((cycle) => {
    errors.push(`Dependencia circular entre secciones: ${cycle.join(" → ")}.`);
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: structureSummary(sections)
  };
}

function structureSummary(sections) {
  const rows = flattenTree(sections);
  return {
    nodeCount: rows.length,
    rootCount: (sections || []).length,
    leafCount: rows.filter((row) => !(row.node.children || []).length).length,
    maxDepth: rows.reduce((max, row) => Math.max(max, row.depth), 0),
    contractedNodes: rows.filter((row) => {
      const contract = row.node.contract || {};
      return Boolean(
        contract.purpose ||
        contract.sourcePolicy ||
        contract.visualPolicy ||
        contract.evidenceRequired ||
        (contract.dataNeeds || []).length ||
        (contract.promptInstructions || []).length
      );
    }).length
  };
}

function compileOutline(engineId, blueprint, sectionLibrary, options) {
  if (!Array.isArray(blueprint)) throw new Error(`El blueprint de ${engineId} debe ser un arreglo.`);
  const sections = blueprint.map((entry, index) => compileEntry(entry, index, {
    engineId,
    sectionLibrary: sectionLibrary || {}
  }));
  const validation = validateCompiledOutline(engineId, sections, options);
  if (!validation.ok) throw new Error(validation.errors.join(" | "));
  return { sections, validation };
}

module.exports = {
  VALID_VISUAL_POLICIES,
  VALID_CONTENT_MODES,
  deepClone,
  normalizeContract,
  compileOutline,
  validateCompiledOutline,
  structureSummary,
  flattenTree
};
