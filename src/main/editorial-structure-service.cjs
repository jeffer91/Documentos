const crypto = require("crypto");

const BLOCK_TYPES = new Set([
  "prose",
  "list",
  "table",
  "figure",
  "image",
  "visual",
  "quote",
  "callout",
  "reference_list"
]);

const ANALYTICAL_BLOCK_TYPES = new Set(["table", "figure", "image", "visual"]);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function stableKey(prefix) {
  return `${prefix || "block"}-${crypto.randomBytes(5).toString("hex")}`;
}

function normalizeSectionNode(node, parentKey, level, path, siblingNumber) {
  const section = Object.assign({}, node || {});
  const normalizedLevel = Math.max(1, Number(level || section.level || 1));
  const key = String(section.key || "").trim();
  if (!key) {
    throw new Error("Cada sección del motor necesita una key estable. No se permiten claves aleatorias.");
  }
  const currentPath = path.concat([siblingNumber]);
  const pageBreakBefore = normalizedLevel === 1;
  const keepWithNext = true;
  const base = Object.assign({}, section, {
    key,
    title: String(section.title || key).trim(),
    type: String(section.type || "ai"),
    parentKey: parentKey || "",
    level: normalizedLevel,
    sortPath: currentPath.map((part) => String(part).padStart(4, "0")).join("."),
    numbering: currentPath.join("."),
    // Regla institucional fija: solo las secciones principales empiezan página.
    pageBreakBefore,
    // Todo título debe permanecer unido al contenido que le sigue.
    keepWithNext,
    required: section.required !== false,
    allowManualEdit: section.allowManualEdit !== false,
    lockAfterApproval: section.lockAfterApproval !== false,
    regenerateOnDependencyChange: section.regenerateOnDependencyChange !== false,
    allowedVisuals: Array.isArray(section.allowedVisuals) ? section.allowedVisuals.slice() : [],
    derivedFrom: Array.isArray(section.derivedFrom) ? section.derivedFrom.slice() : [],
    layout: Object.assign({}, section.layout || {}, {
      apa7: true,
      pageBreakBefore,
      keepWithNext
    }),
    children: undefined
  });
  return base;
}

function flattenSections(sections) {
  const result = [];
  const keys = new Set();
  const walk = (items, parentKey, level, path) => {
    (items || []).forEach((item, index) => {
      const node = normalizeSectionNode(item, parentKey, level, path, index + 1);
      if (keys.has(node.key)) {
        throw new Error(`La key de sección "${node.key}" está duplicada. Cada punto y subpunto necesita una key única y estable.`);
      }
      keys.add(node.key);
      result.push(node);
      if (Array.isArray(item && item.children) && item.children.length) {
        walk(item.children, node.key, level + 1, path.concat([index + 1]));
      }
    });
  };
  walk(Array.isArray(sections) ? sections : [], "", 1, []);
  return result;
}

function normalizeBlocks(blocks) {
  return (Array.isArray(blocks) ? blocks : []).map((raw, index) => {
    const block = Object.assign({}, raw || {});
    const type = BLOCK_TYPES.has(String(block.type || "").toLowerCase())
      ? String(block.type).toLowerCase()
      : "prose";
    const role = String(block.role || (type === "prose" ? "body" : "evidence")).toLowerCase();
    return {
      key: String(block.key || stableKey(type)),
      order: Number.isFinite(Number(block.order)) ? Number(block.order) : index + 1,
      type,
      role,
      title: String(block.title || "").trim(),
      text: String(block.text || block.content || "").trim(),
      caption: String(block.caption || "").trim(),
      note: String(block.note || "").trim(),
      visualType: String(block.visualType || block.tool || "").trim().toLowerCase(),
      data: clone(block.data || {}),
      provenance: clone(block.provenance || {}),
      alerts: Array.isArray(block.alerts) ? clone(block.alerts) : [],
      status: String(block.status || "generated"),
      locked: Boolean(block.locked)
    };
  }).sort((a, b) => a.order - b.order);
}

function plainTextFromBlocks(blocks) {
  return normalizeBlocks(blocks).map((block) => {
    if (block.type === "prose" || block.type === "quote" || block.type === "callout") return block.text;
    if (block.type === "list") {
      const items = Array.isArray(block.data && block.data.items) ? block.data.items : [];
      return items.map((item) => `• ${String(item)}`).join("\n");
    }
    if (block.type === "table") return [block.title, block.note].filter(Boolean).join("\n");
    if (block.type === "figure" || block.type === "image" || block.type === "visual") {
      return [block.title || block.caption, block.note].filter(Boolean).join("\n");
    }
    if (block.type === "reference_list") {
      const items = Array.isArray(block.data && block.data.items) ? block.data.items : [];
      return items.map(String).join("\n");
    }
    return block.text;
  }).filter(Boolean).join("\n\n");
}

function meaningfulText(block) {
  return Boolean(
    block &&
    ["prose", "quote", "callout"].includes(block.type) &&
    String(block.text || "").trim().length >= 20
  );
}

function contextBefore(blocks, index) {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (ANALYTICAL_BLOCK_TYPES.has(blocks[i].type)) break;
    if (meaningfulText(blocks[i]) && ["context", "body", "introduction", "summary"].includes(blocks[i].role)) return true;
  }
  return false;
}

function analysisAfter(blocks, index) {
  for (let i = index + 1; i < blocks.length; i += 1) {
    if (ANALYTICAL_BLOCK_TYPES.has(blocks[i].type)) break;
    if (meaningfulText(blocks[i]) && ["analysis", "interpretation", "summary"].includes(blocks[i].role)) return true;
  }
  return false;
}

function validateTable(block) {
  const errors = [];
  const headers = Array.isArray(block.data && block.data.headers) ? block.data.headers : [];
  const rows = Array.isArray(block.data && block.data.rows) ? block.data.rows : [];
  if (!block.title) errors.push("La tabla necesita un título.");
  if (!headers.length) errors.push("La tabla no tiene encabezados.");
  if (!rows.length) errors.push("La tabla no tiene filas.");
  return errors;
}

function validateVisual(block, allowedVisuals) {
  const errors = [];
  if (!block.title && !block.caption) errors.push("La figura o herramienta visual necesita título.");
  if (block.type === "visual") {
    if (!block.visualType) errors.push("La herramienta visual no indica su tipo.");
    if (
      block.visualType &&
      Array.isArray(allowedVisuals) &&
      allowedVisuals.length &&
      !allowedVisuals.includes(block.visualType)
    ) {
      errors.push(`La herramienta visual "${block.visualType}" no está habilitada para esta sección.`);
    }
  }
  return errors;
}

function validateSectionBlocks(section, inputBlocks) {
  const blocks = normalizeBlocks(inputBlocks);
  const errors = [];
  const warnings = [];

  blocks.forEach((block, index) => {
    if (!BLOCK_TYPES.has(block.type)) errors.push(`Tipo de bloque no válido: ${block.type}.`);

    if (block.type === "table") errors.push(...validateTable(block).map((message) => `${section.title}: ${message}`));
    if (["figure", "image", "visual"].includes(block.type)) {
      errors.push(...validateVisual(block, section.allowedVisuals).map((message) => `${section.title}: ${message}`));
    }

    const requiresNarrative = ANALYTICAL_BLOCK_TYPES.has(block.type) && String(section.type || "") !== "annexes";
    if (requiresNarrative && !contextBefore(blocks, index)) {
      errors.push(`${section.title}: ${block.type === "table" ? "la tabla" : "la figura"} "${block.title || block.caption || block.key}" necesita contexto previo.`);
    }
    if (requiresNarrative && !analysisAfter(blocks, index)) {
      errors.push(`${section.title}: ${block.type === "table" ? "la tabla" : "la figura"} "${block.title || block.caption || block.key}" necesita análisis posterior.`);
    }
  });

  if (String(section.type || "") === "executive_summary") {
    const words = plainTextFromBlocks(blocks).split(/\s+/).filter(Boolean).length;
    const maxWords = Number(section.maxWords || 600);
    if (words > maxWords) warnings.push(`El resumen ejecutivo tiene ${words} palabras; el objetivo es máximo ${maxWords}.`);
    const analyticalCount = blocks.filter((block) => ANALYTICAL_BLOCK_TYPES.has(block.type)).length;
    if (analyticalCount > 4) warnings.push("El resumen ejecutivo debería conservar solo las tablas o figuras más relevantes.");
  }

  return { ok: errors.length === 0, errors, warnings, blocks };
}

function validateHierarchy(sections) {
  const errors = [];
  const warnings = [];
  const rows = Array.isArray(sections) ? sections : [];
  const byKey = new Map();
  const numbers = new Set();
  const sortPaths = new Set();

  rows.forEach((section, index) => {
    const key = String(section && section.key || "").trim();
    if (!key) {
      errors.push(`La sección en posición ${index + 1} no tiene key estable.`);
      return;
    }
    if (byKey.has(key)) errors.push(`Key de sección duplicada: ${key}.`);
    else byKey.set(key, section);
  });

  rows.forEach((section, index) => {
    const level = Math.max(1, Number(section.level || 1));
    const numbering = String(section.numbering || "").trim();
    const sortPath = String(section.sortPath || "").trim();
    const parentKey = String(section.parentKey || "").trim();

    if (!String(section.title || "").trim()) errors.push(`La sección ${section.key} no tiene título.`);

    if (numbering) {
      if (!/^\d+(?:\.\d+)*$/.test(numbering)) errors.push(`Numeración inválida en ${section.key}: ${numbering}.`);
      if (numbers.has(numbering)) errors.push(`Numeración duplicada: ${numbering}.`);
      numbers.add(numbering);
      if (numbering.split(".").length !== level) {
        errors.push(`La numeración ${numbering} no coincide con el nivel ${level} de ${section.key}.`);
      }
    } else {
      errors.push(`La sección ${section.key} no tiene numeración jerárquica.`);
    }

    if (sortPath) {
      if (sortPaths.has(sortPath)) errors.push(`Ruta de orden duplicada: ${sortPath}.`);
      sortPaths.add(sortPath);
    } else {
      errors.push(`La sección ${section.key} no tiene ruta de orden.`);
    }

    if (!section.keepWithNext) {
      errors.push(`El título ${section.title || section.key} puede quedar huérfano: keepWithNext debe estar activo.`);
    }

    if (level === 1) {
      if (parentKey) errors.push(`La sección principal ${section.key} no puede tener padre.`);
      if (!section.pageBreakBefore) errors.push(`La sección principal ${section.title} debe iniciar en página nueva.`);
    } else {
      if (!parentKey) {
        errors.push(`La sección ${section.key} de nivel ${level} necesita una sección padre.`);
      } else {
        const parent = byKey.get(parentKey);
        if (!parent) {
          errors.push(`La sección ${section.key} apunta a un padre inexistente: ${parentKey}.`);
        } else {
          const parentLevel = Math.max(1, Number(parent.level || 1));
          if (parentLevel !== level - 1) {
            errors.push(`La sección ${section.key} debe depender de un nivel ${level - 1}, no de nivel ${parentLevel}.`);
          }
          const parentIndex = rows.indexOf(parent);
          if (parentIndex >= index) errors.push(`La sección padre ${parentKey} debe aparecer antes que ${section.key}.`);
          if (numbering && parent.numbering && !numbering.startsWith(`${parent.numbering}.`)) {
            errors.push(`La numeración ${numbering} de ${section.key} no deriva de su padre ${parent.numbering}.`);
          }
        }
      }
      if (section.pageBreakBefore) {
        errors.push(`El subnivel ${numbering || section.key} no debe iniciar una página nueva automáticamente.`);
      }
    }

    if (level > 6) {
      warnings.push(`La sección ${numbering || section.key} usa nivel ${level}; se conservará la numeración y se aplicará el estilo visual del nivel profundo.`);
    }
  });

  return { ok: errors.length === 0, errors, warnings };
}

function validateDocumentInstance(instance) {
  const errors = [];
  const warnings = [];
  const sections = Array.isArray(instance && instance.sections) ? instance.sections : [];
  const hierarchy = validateHierarchy(sections);
  errors.push(...hierarchy.errors);
  warnings.push(...hierarchy.warnings);

  sections.forEach((section) => {
    const blocks = normalizeBlocks(section.blocks || []);
    const hasContent = String(section.content || "").trim() || blocks.length;
    if (section.required !== false && !hasContent) {
      errors.push(`La sección obligatoria "${section.title}" está vacía.`);
    }
    const result = validateSectionBlocks(section, blocks);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  });

  const byKey = new Map(sections.map((section) => [section.key, section]));
  const executive = sections.find((section) => section.type === "executive_summary" || section.key === "RESUMEN_EJECUTIVO");
  if (executive && (executive.blocks || []).length) {
    const requiredKeys = Array.isArray(executive.derivedFrom) && executive.derivedFrom.length
      ? executive.derivedFrom
      : ["RESULTADOS", "ANALISIS_RESULTADOS"];
    requiredKeys.forEach((key) => {
      const source = byKey.get(key);
      if (!source || (!String(source.content || "").trim() && !(source.blocks || []).length)) {
        errors.push(`El Resumen Ejecutivo depende de "${key}", pero esa sección todavía no contiene resultados aprobables.`);
      }
    });
  }

  return { ok: errors.length === 0, errors, warnings };
}

module.exports = {
  BLOCK_TYPES,
  ANALYTICAL_BLOCK_TYPES,
  flattenSections,
  normalizeBlocks,
  plainTextFromBlocks,
  validateSectionBlocks,
  validateHierarchy,
  validateDocumentInstance
};
