const { openDatabase, queueSync } = require("./database-service.cjs");
const workspace = require("./workspace-service.cjs");
const { normalizeName } = require("./template-markers.cjs");

const PROTOCOL = "ITSQMET-CAMPOS-V1";
const MANUAL_TYPES = new Set(["CAMPO", "TEXTO", "FECHA", "NUMERO", "LISTA", "BUSCAR"]);

function newId(prefix) {
  return String(prefix || "item") + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

function parseJson(value, fallback) {
  if (value == null || value === "") return fallback;
  try { return JSON.parse(value); } catch (_error) { return fallback; }
}

function projectOrThrow(userDataPath, projectId) {
  const project = workspace.getProject(userDataPath, projectId);
  if (!project) throw new Error("No se encontró el documento.");
  if (!project.template || !project.template.id) throw new Error("El documento no tiene una plantilla activa.");
  return project;
}

function guideForTemplate(db, templateId, templateVersion) {
  const row = db.prepare(
    "SELECT guide_text FROM external_ai_guides WHERE template_id = ? AND template_version = ?"
  ).get(templateId, Number(templateVersion || 1));
  return row ? String(row.guide_text || "") : "";
}

function canUndoImport(db, projectId) {
  const row = db.prepare(
    "SELECT id FROM external_ai_imports WHERE project_id = ? AND undone_at IS NULL ORDER BY created_at DESC LIMIT 1"
  ).get(projectId);
  return Boolean(row);
}

function getGuide(userDataPath, projectId) {
  const project = projectOrThrow(userDataPath, projectId);
  const db = openDatabase(userDataPath);
  return {
    guide: guideForTemplate(db, project.template.id, project.template.version),
    templateId: project.template.id,
    templateVersion: Number(project.template.version || 1),
    canUndo: canUndoImport(db, projectId)
  };
}

function saveGuide(userDataPath, projectId, guideText) {
  const project = projectOrThrow(userDataPath, projectId);
  const db = openDatabase(userDataPath);
  const now = new Date().toISOString();
  const text = String(guideText || "").trim();

  db.prepare(`
    INSERT INTO external_ai_guides(template_id, template_version, guide_text, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(template_id, template_version)
    DO UPDATE SET guide_text = excluded.guide_text, updated_at = excluded.updated_at
  `).run(project.template.id, Number(project.template.version || 1), text, now);

  queueSync(db, "external_ai_guide", project.template.id, "update", {
    templateVersion: Number(project.template.version || 1)
  });

  return {
    guide: text,
    templateId: project.template.id,
    templateVersion: Number(project.template.version || 1),
    canUndo: canUndoImport(db, projectId)
  };
}

function requestedFields(project, mode) {
  const manual = ((project.template && project.template.fields) || [])
    .filter((field) => field.valid !== false && MANUAL_TYPES.has(field.type));
  if (mode !== "manual_ai") return manual;
  const ai = ((project.template && project.template.aiFields) || [])
    .filter((field) => field.valid !== false);
  return manual.concat(ai);
}

function protocolMode(mode) {
  return mode === "manual_ai" ? "MANUALES+IA" : "MANUALES";
}

function templateFingerprint(project) {
  return String((project.template && project.template.sha256) || (project.template && project.template.id) || "");
}

function fieldDescription(field, index) {
  const lines = [
    String(index + 1) + ". " + field.name,
    "Etiqueta: " + (field.label || field.name),
    "Tipo: " + (field.type === "IA" ? "REDACCION" : field.type),
    "Obligatorio: " + (field.required ? "Sí" : "No")
  ];

  if (field.type === "LISTA" && Array.isArray(field.options) && field.options.length) {
    lines.push("Opciones permitidas: " + field.options.join(" | "));
  }
  if (field.type === "NUMERO") {
    lines.push("Formato: escribe únicamente el número, sin el símbolo % ni texto adicional.");
  }
  if (field.type === "FECHA") {
    lines.push("Formato recomendado: AAAA-MM-DD.");
  }
  if (field.type === "IA") {
    lines.push("Contenido: redacta este campo únicamente con las instrucciones y la información que te proporcione el usuario.");
  }
  return lines.join("\n");
}

function fieldSkeleton(field) {
  return [
    "//CAMPO:" + field.name + "//",
    "",
    "//FIN:" + field.name + "//"
  ].join("\n");
}

function buildPrompt(userDataPath, projectId, mode, guideText) {
  const project = projectOrThrow(userDataPath, projectId);
  const db = openDatabase(userDataPath);
  const normalizedMode = mode === "manual" ? "manual" : "manual_ai";
  const guide = guideText == null
    ? guideForTemplate(db, project.template.id, project.template.version)
    : String(guideText || "").trim();
  const fields = requestedFields(project, normalizedMode);
  const manualCount = ((project.template && project.template.fields) || [])
    .filter((field) => field.valid !== false && MANUAL_TYPES.has(field.type)).length;
  const aiCount = ((project.template && project.template.aiFields) || [])
    .filter((field) => field.valid !== false).length;
  const fingerprint = templateFingerprint(project);

  const responseHeader = [
    "//FORMATO:" + PROTOCOL + "//",
    "//DOCUMENTO:" + project.documentId + "//",
    "//PLANTILLA:" + fingerprint + "//",
    "//VERSION-PLANTILLA:" + Number(project.template.version || 1) + "//",
    "//MODO:" + protocolMode(normalizedMode) + "//"
  ];

  const fieldsText = responseHeader
    .concat([""])
    .concat(fields.flatMap((field) => [fieldSkeleton(field), ""]))
    .concat(["//FIN-DOCUMENTO//"])
    .join("\n")
    .trim();

  const prompt = [
    "Actúa como asistente para completar un documento institucional del ITSQMET.",
    "",
    "DOCUMENTO: " + project.documentName,
    "UNIDAD: " + project.unitName,
    "PROCESO: " + project.processName + (project.processCode ? " (" + project.processCode + ")" : ""),
    "PLANTILLA: versión " + Number(project.template.version || 1),
    "",
    "INSTRUCCIONES ADICIONALES (OPCIONAL):",
    guide || "No hay instrucciones adicionales. Completa los campos únicamente con la información que el usuario te proporcione.",
    "",
    "REGLAS OBLIGATORIAS:",
    "- No inventes información, cifras, nombres, fechas, normas ni resultados.",
    "- Si no existe información suficiente para un campo, deja su contenido vacío.",
    "- No cambies los identificadores de los campos.",
    "- No agregues campos que no estén en la lista.",
    "- Respeta exactamente las opciones permitidas en los campos LISTA.",
    "- En NUMERO escribe únicamente el valor numérico.",
    "- En FECHA usa preferentemente AAAA-MM-DD.",
    "- TEXTO e IA pueden contener varios párrafos.",
    "- Los campos IA de esta plantilla deben ser redactados por ti; la aplicación no llamará a otra IA para completarlos.",
    "- No escribas comentarios, explicaciones ni Markdown fuera del formato solicitado.",
    "- CALC, SISTEMA, imágenes, archivos, datos y gráficos son responsabilidad de la aplicación y no deben incluirse.",
    "",
    "CAMPOS QUE DEBES COMPLETAR:",
    fields.map(fieldDescription).join("\n\n"),
    "",
    "FORMATO DE RESPUESTA OBLIGATORIO:",
    "Copia exactamente la cabecera y devuelve cada campo entre su apertura y su cierre.",
    "El cierre debe repetir el mismo nombre del campo.",
    "",
    fieldsText
  ].join("\n");

  return {
    protocol: PROTOCOL,
    mode: normalizedMode,
    manualCount,
    aiCount,
    fieldCount: fields.length,
    guide,
    fieldsText,
    prompt,
    fingerprint
  };
}

function parseMetadataLine(line, prefix) {
  const start = "//" + prefix + ":";
  if (!line.startsWith(start) || !line.endsWith("//")) return null;
  return line.slice(start.length, -2).trim();
}

function parseResponse(rawText) {
  const lines = String(rawText || "").replace(/\r/g, "").split("\n");
  const metadata = {};
  const blocks = [];
  const outside = [];
  let current = null;
  let ended = false;

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (current) {
      const close = line.match(/^\/\/FIN:([A-Za-z0-9_.-]+)\/\/$/);
      if (close) {
        const closeName = normalizeName(close[1]);
        current.closed = closeName === current.name;
        if (!current.closed) current.parseError = "El cierre corresponde a " + closeName + " y no a " + current.name + ".";
        current.value = current.lines.join("\n").trim();
        blocks.push(current);
        current = null;
        return;
      }

      const nested = line.match(/^\/\/CAMPO:([A-Za-z0-9_.-]+)\/\/$/);
      if (nested) {
        current.closed = false;
        current.parseError = "Falta //FIN:" + current.name + "//.";
        current.value = current.lines.join("\n").trim();
        blocks.push(current);
        current = {
          name: normalizeName(nested[1]),
          originalName: nested[1],
          lines: [],
          closed: false,
          parseError: ""
        };
        return;
      }

      current.lines.push(rawLine);
      return;
    }

    const start = line.match(/^\/\/CAMPO:([A-Za-z0-9_.-]+)\/\/$/);
    if (start) {
      current = {
        name: normalizeName(start[1]),
        originalName: start[1],
        lines: [],
        closed: false,
        parseError: ""
      };
      return;
    }

    const format = parseMetadataLine(line, "FORMATO");
    if (format != null) { metadata.format = format; return; }
    const documentId = parseMetadataLine(line, "DOCUMENTO");
    if (documentId != null) { metadata.documentId = documentId; return; }
    const template = parseMetadataLine(line, "PLANTILLA");
    if (template != null) { metadata.template = template; return; }
    const templateVersion = parseMetadataLine(line, "VERSION-PLANTILLA");
    if (templateVersion != null) { metadata.templateVersion = templateVersion; return; }
    const mode = parseMetadataLine(line, "MODO");
    if (mode != null) { metadata.mode = mode; return; }

    if (line === "//FIN-DOCUMENTO//") {
      ended = true;
      return;
    }

    if (line) outside.push(rawLine);
  });

  if (current) {
    current.closed = false;
    current.parseError = "Falta //FIN:" + current.name + "//.";
    current.value = current.lines.join("\n").trim();
    blocks.push(current);
  }

  return { metadata, blocks, ended, outside };
}

function normalizedComparable(value) {
  return String(value == null ? "" : value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeDate(value) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) return null;
  const day = String(match[1]).padStart(2, "0");
  const month = String(match[2]).padStart(2, "0");
  const year = match[3];
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null;
  return year + "-" + month + "-" + day;
}

function validateValue(field, value) {
  const raw = String(value == null ? "" : value).trim();
  if (!raw) return { status: "empty", value: "", message: "Sin información." };

  if (field.type === "NUMERO") {
    const normalized = raw.replace(",", ".");
    if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) {
      return { status: "error", value: raw, message: "Debe contener únicamente un número." };
    }
    const number = Number(normalized);
    if (!Number.isFinite(number)) return { status: "error", value: raw, message: "Número no válido." };
    return { status: "valid", value: number, message: "" };
  }

  if (field.type === "FECHA") {
    const date = normalizeDate(raw);
    if (!date) return { status: "error", value: raw, message: "Fecha no válida. Usa AAAA-MM-DD o DD/MM/AAAA." };
    return { status: "valid", value: date, message: "" };
  }

  if (field.type === "LISTA" && Array.isArray(field.options) && field.options.length) {
    const comparable = normalizedComparable(raw);
    const option = field.options.find((item) => normalizedComparable(item) === comparable);
    if (!option) {
      return {
        status: "error",
        value: raw,
        message: "Valor no permitido. Opciones: " + field.options.join(" | ")
      };
    }
    return { status: "valid", value: option, message: option === raw ? "" : "Se normalizará a: " + option };
  }

  return { status: "valid", value: raw, message: "" };
}

function existingValue(project, field) {
  if (field.type === "IA") {
    const external = project.analysis && project.analysis.externalGeneratedFields;
    return external && external[field.name] != null ? external[field.name] : "";
  }
  return project.formData && project.formData[field.name] != null ? project.formData[field.name] : "";
}

function previewResponse(userDataPath, projectId, rawText, mode) {
  const project = projectOrThrow(userDataPath, projectId);
  const normalizedMode = mode === "manual" ? "manual" : "manual_ai";
  const allowed = requestedFields(project, normalizedMode);
  const allowedByName = new Map(allowed.map((field) => [field.name, field]));
  const parsed = parseResponse(rawText);
  const errors = [];
  const warnings = [];

  if (parsed.metadata.format !== PROTOCOL) {
    errors.push("Formato no válido. Se esperaba " + PROTOCOL + ".");
  }
  if (parsed.metadata.documentId !== project.documentId) {
    errors.push("La respuesta corresponde a otro documento.");
  }
  if (parsed.metadata.template !== templateFingerprint(project)) {
    errors.push("La respuesta corresponde a otra plantilla o versión.");
  }
  if (
    parsed.metadata.templateVersion != null &&
    Number(parsed.metadata.templateVersion) !== Number(project.template.version || 1)
  ) {
    errors.push("La respuesta corresponde a otra versión de la plantilla.");
  }
  if (parsed.metadata.templateVersion == null) {
    warnings.push("La respuesta no incluye VERSION-PLANTILLA; se validó mediante la huella de la plantilla.");
  }
  if (parsed.metadata.mode !== protocolMode(normalizedMode)) {
    errors.push("El modo de la respuesta no coincide con el modo seleccionado.");
  }
  if (!parsed.ended) warnings.push("No se encontró //FIN-DOCUMENTO//.");
  if (parsed.outside.length) warnings.push("Se encontró texto fuera del formato; será ignorado.");

  const counts = new Map();
  parsed.blocks.forEach((block) => counts.set(block.name, (counts.get(block.name) || 0) + 1));

  const items = parsed.blocks.map((block) => {
    const field = allowedByName.get(block.name);
    if (!field) {
      return {
        name: block.name,
        label: block.name,
        type: "DESCONOCIDO",
        status: "error",
        message: "Este campo no existe o no está permitido en el modo seleccionado.",
        value: block.value,
        normalizedValue: block.value,
        conflict: false
      };
    }

    if (counts.get(block.name) > 1) {
      return {
        name: field.name,
        label: field.label,
        type: field.type,
        status: "error",
        message: "El campo aparece más de una vez en la respuesta.",
        value: block.value,
        normalizedValue: block.value,
        conflict: false
      };
    }

    if (block.parseError || !block.closed) {
      return {
        name: field.name,
        label: field.label,
        type: field.type,
        status: "error",
        message: block.parseError || ("Falta //FIN:" + field.name + "//."),
        value: block.value,
        normalizedValue: block.value,
        conflict: false
      };
    }

    const checked = validateValue(field, block.value);
    const current = existingValue(project, field);
    const conflict = checked.status === "valid" &&
      String(current == null ? "" : current).trim() !== "" &&
      String(current) !== String(checked.value);

    return {
      name: field.name,
      label: field.label,
      type: field.type,
      status: checked.status,
      message: conflict ? "Ya existe un valor diferente en la app." : checked.message,
      value: block.value,
      normalizedValue: checked.value,
      existingValue: current,
      conflict
    };
  });

  const presentNames = new Set(items.map((item) => item.name));
  const missingRequired = allowed
    .filter((field) => field.required && !presentNames.has(field.name))
    .map((field) => field.label || field.name);

  if (missingRequired.length) {
    warnings.push("Faltan campos obligatorios en la respuesta: " + missingRequired.slice(0, 8).join(", ") + (missingRequired.length > 8 ? "…" : ""));
  }

  const summary = {
    totalBlocks: items.length,
    valid: items.filter((item) => item.status === "valid").length,
    empty: items.filter((item) => item.status === "empty").length,
    errors: items.filter((item) => item.status === "error").length,
    conflicts: items.filter((item) => item.conflict).length,
    requested: allowed.length
  };

  return {
    protocol: PROTOCOL,
    mode: normalizedMode,
    metadata: parsed.metadata,
    items,
    errors,
    warnings,
    summary,
    canImport: errors.length === 0 && summary.valid > 0
  };
}

function externalFieldsFromProject(project) {
  const analysis = project && project.analysis;
  if (!analysis || !analysis.externalGeneratedFields || typeof analysis.externalGeneratedFields !== "object") return {};
  return Object.assign({}, analysis.externalGeneratedFields);
}

function externalAnalysis(externalFields) {
  const fields = Object.assign({}, externalFields || {});
  const sources = {};
  Object.keys(fields).forEach((name) => { sources[name] = ["IA externa"]; });
  return {
    provider: "IA externa",
    generatedAt: new Date().toISOString(),
    generatedFields: fields,
    externalGeneratedFields: fields,
    fieldSources: sources,
    keyFindings: [],
    missingData: [],
    tables: [],
    charts: [],
    sourceTrace: [],
    notes: "Campos importados mediante ITSQMET-CAMPOS-V1."
  };
}

function applyResponse(userDataPath, projectId, rawText, mode, overwrite) {
  const project = projectOrThrow(userDataPath, projectId);
  const db = openDatabase(userDataPath);
  const preview = previewResponse(userDataPath, projectId, rawText, mode);
  if (preview.errors.length) throw new Error(preview.errors[0]);
  if (!preview.summary.valid) throw new Error("No hay campos válidos para importar.");

  const accepted = preview.items.filter((item) =>
    item.status === "valid" && (!item.conflict || Boolean(overwrite))
  );
  if (!accepted.length) throw new Error("No hay campos nuevos para importar.");

  const previousForm = Object.assign({}, project.formData || {});
  const previousAnalysis = project.analysis || null;
  const previousStatus = project.status || "draft";
  const external = externalFieldsFromProject(project);
  const now = new Date().toISOString();
  const importId = newId("extai");

  const manualItems = accepted.filter((item) => item.type !== "IA");
  const aiItems = accepted.filter((item) => item.type === "IA");
  aiItems.forEach((item) => { external[item.name] = item.normalizedValue; });

  const tx = db.transaction(() => {
    const upsert = db.prepare(`
      INSERT INTO project_fields(project_id, field_name, value_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(project_id, field_name)
      DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
    `);

    manualItems.forEach((item) => {
      upsert.run(projectId, item.name, JSON.stringify(item.normalizedValue), now);
    });

    const calculated = db.prepare(
      "SELECT name FROM template_fields WHERE template_id = ? AND type = 'CALC'"
    ).all(project.template.id);
    calculated.forEach((field) => {
      db.prepare("DELETE FROM project_fields WHERE project_id = ? AND field_name = ?").run(projectId, field.name);
    });

    const nextAnalysis = Object.keys(external).length ? externalAnalysis(external) : null;
    db.prepare(
      "UPDATE projects SET analysis_json = ?, status = 'draft', updated_at = ? WHERE id = ?"
    ).run(nextAnalysis ? JSON.stringify(nextAnalysis) : null, now, projectId);

    db.prepare(`
      INSERT INTO external_ai_imports
        (id, project_id, template_id, template_version, mode, raw_response,
         previous_form_json, previous_analysis_json, previous_status, imported_json, created_at, undone_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(
      importId,
      projectId,
      project.template.id,
      Number(project.template.version || 1),
      mode === "manual" ? "manual" : "manual_ai",
      String(rawText || ""),
      JSON.stringify(previousForm),
      previousAnalysis ? JSON.stringify(previousAnalysis) : null,
      previousStatus,
      JSON.stringify(accepted.map((item) => ({
        name: item.name,
        type: item.type,
        value: item.normalizedValue
      }))),
      now
    );
  });

  tx();
  queueSync(db, "external_ai_import", importId, "create", {
    projectId,
    templateId: project.template.id,
    count: accepted.length
  });

  return {
    project: workspace.getProject(userDataPath, projectId),
    imported: accepted.length,
    skipped: preview.summary.valid - accepted.length,
    canUndo: true,
    preview
  };
}

function undoLastImport(userDataPath, projectId) {
  const db = openDatabase(userDataPath);
  const row = db.prepare(
    "SELECT * FROM external_ai_imports WHERE project_id = ? AND undone_at IS NULL ORDER BY created_at DESC LIMIT 1"
  ).get(projectId);
  if (!row) throw new Error("No hay una importación de IA externa para deshacer.");

  const project = workspace.getProject(userDataPath, projectId);
  if (!project) throw new Error("No se encontró el documento.");

  const previousForm = parseJson(row.previous_form_json, {});
  const previousAnalysis = parseJson(row.previous_analysis_json, null);
  const imported = parseJson(row.imported_json, []);
  const now = new Date().toISOString();

  const manualNames = imported
    .filter((item) => item && item.type !== "IA" && item.name)
    .map((item) => String(item.name));
  const aiNames = imported
    .filter((item) => item && item.type === "IA" && item.name)
    .map((item) => String(item.name));

  const currentForm = Object.assign({}, project.formData || {});
  manualNames.forEach((name) => {
    if (Object.prototype.hasOwnProperty.call(previousForm, name)) currentForm[name] = previousForm[name];
    else delete currentForm[name];
  });

  let nextAnalysis = project.analysis ? Object.assign({}, project.analysis) : null;
  const currentExternal = nextAnalysis && nextAnalysis.externalGeneratedFields
    ? Object.assign({}, nextAnalysis.externalGeneratedFields)
    : {};
  const previousExternal = previousAnalysis && previousAnalysis.externalGeneratedFields
    ? previousAnalysis.externalGeneratedFields
    : {};

  aiNames.forEach((name) => {
    if (Object.prototype.hasOwnProperty.call(previousExternal, name)) currentExternal[name] = previousExternal[name];
    else delete currentExternal[name];
  });

  const currentGenerated = nextAnalysis && nextAnalysis.generatedFields
    ? Object.assign({}, nextAnalysis.generatedFields)
    : {};
  aiNames.forEach((name) => {
    if (Object.prototype.hasOwnProperty.call(previousExternal, name)) currentGenerated[name] = previousExternal[name];
    else delete currentGenerated[name];
  });

  const onlyExternalAnalysis = nextAnalysis &&
    String(nextAnalysis.provider || "") === "IA externa" &&
    Object.keys(nextAnalysis.generatedFields || {}).every((name) =>
      Object.prototype.hasOwnProperty.call(nextAnalysis.externalGeneratedFields || {}, name)
    );

  if (onlyExternalAnalysis) {
    nextAnalysis = previousAnalysis;
  } else if (nextAnalysis) {
    nextAnalysis.generatedFields = currentGenerated;
    nextAnalysis.externalGeneratedFields = currentExternal;
    nextAnalysis.fieldSources = Object.assign({}, nextAnalysis.fieldSources || {});
    aiNames.forEach((name) => {
      if (Object.prototype.hasOwnProperty.call(previousExternal, name)) {
        nextAnalysis.fieldSources[name] = ["IA externa"];
      } else {
        delete nextAnalysis.fieldSources[name];
      }
    });
  }

  const tx = db.transaction(() => {
    const upsert = db.prepare(`
      INSERT INTO project_fields(project_id, field_name, value_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(project_id, field_name)
      DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
    `);

    manualNames.forEach((name) => {
      if (Object.prototype.hasOwnProperty.call(previousForm, name)) {
        upsert.run(projectId, name, JSON.stringify(previousForm[name]), now);
      } else {
        db.prepare("DELETE FROM project_fields WHERE project_id = ? AND field_name = ?").run(projectId, name);
      }
    });

    db.prepare(
      "UPDATE projects SET analysis_json = ?, status = 'draft', updated_at = ? WHERE id = ?"
    ).run(nextAnalysis ? JSON.stringify(nextAnalysis) : null, now, projectId);

    db.prepare("UPDATE external_ai_imports SET undone_at = ? WHERE id = ?").run(now, row.id);
  });

  tx();
  queueSync(db, "external_ai_import", row.id, "undo", { projectId });

  return {
    project: workspace.getProject(userDataPath, projectId),
    canUndo: canUndoImport(db, projectId)
  };
}

function analysisFromExternalOnly(project) {
  const external = externalFieldsFromProject(project);
  return externalAnalysis(external);
}

function projectForInternalAi(project) {
  const external = externalFieldsFromProject(project);
  if (!Object.keys(external).length || !project || !project.template) return project;

  const clone = Object.assign({}, project);
  clone.template = Object.assign({}, project.template);
  clone.template.aiFields = ((project.template && project.template.aiFields) || []).filter((field) => {
    const value = external[field.name];
    return value == null || String(value).trim() === "";
  });
  return clone;
}

function mergeExternalGeneratedFields(project, analysis) {
  const external = externalFieldsFromProject(project);
  if (!Object.keys(external).length) return analysis;

  const base = analysis && typeof analysis === "object" ? Object.assign({}, analysis) : {};
  base.generatedFields = Object.assign({}, base.generatedFields || {}, external);
  base.externalGeneratedFields = external;
  base.fieldSources = Object.assign({}, base.fieldSources || {});
  Object.keys(external).forEach((name) => {
    base.fieldSources[name] = ["IA externa"];
  });
  base.provider = base.provider && base.provider !== "IA externa"
    ? base.provider + " + IA externa"
    : "IA externa";
  base.generatedAt = base.generatedAt || new Date().toISOString();
  base.keyFindings = Array.isArray(base.keyFindings) ? base.keyFindings : [];
  base.missingData = Array.isArray(base.missingData) ? base.missingData : [];
  base.tables = Array.isArray(base.tables) ? base.tables : [];
  base.charts = Array.isArray(base.charts) ? base.charts : [];
  base.sourceTrace = Array.isArray(base.sourceTrace) ? base.sourceTrace : [];
  base.notes = String(base.notes || "");
  return base;
}

module.exports = {
  PROTOCOL,
  getGuide,
  saveGuide,
  buildPrompt,
  parseResponse,
  previewResponse,
  applyResponse,
  undoLastImport,
  analysisFromExternalOnly,
  projectForInternalAi,
  mergeExternalGeneratedFields
};
