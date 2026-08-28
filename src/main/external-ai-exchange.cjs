const { openDatabase, queueSync } = require("./database-service.cjs");
const workspace = require("./workspace-service.cjs");
const { normalizeName } = require("./template-markers.cjs");

const PROTOCOL = "ITSQMET-DOCUMENTO-V2";
const LEGACY_PROTOCOL = "ITSQMET-CAMPOS-V1";
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
  const tables = ((project.template && project.template.fields) || [])
    .filter((field) => field.valid !== false && field.type === "TABLA");
  if (mode !== "manual_ai") return manual.concat(tables);
  const ai = ((project.template && project.template.aiFields) || [])
    .filter((field) => field.valid !== false);
  return manual.concat(ai, tables);
}

function protocolMode(mode) {
  return mode === "manual_ai" ? "DOCUMENTO-COMPLETO" : "DATOS+TABLAS";
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
  if (field.type === "BUSCAR" && field.lookupSource) {
    lines.push("Fuente de referencia: " + field.lookupSource + ".");
  }
  if (field.type === "IA") {
    lines.push("Contenido: redacta este campo únicamente con las instrucciones y la información que te proporcione el usuario.");
  }
  if (field.type === "TABLA") {
    const defs = Array.isArray(field.columnDefs) ? field.columnDefs : [];
    lines.push("Columnas obligatorias de la tabla:");
    defs.forEach((column) => lines.push("- " + column.name + " (" + column.type + "): " + column.label));
    lines.push("Puedes devolver cero, una o varias filas según la información disponible.");
  }
  return lines.join("\n");
}

function fieldSkeleton(field) {
  if (field.type === "TABLA") {
    const defs = Array.isArray(field.columnDefs) ? field.columnDefs : [];
    return [
      "//TABLA:" + field.name + "//",
      "//FILA//",
      ...defs.flatMap((column) => [
        "//DATO:" + column.name + "//",
        "",
        "//FIN-DATO:" + column.name + "//"
      ]),
      "//FIN-FILA//",
      "//FIN-TABLA:" + field.name + "//"
    ].join("\n");
  }

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
  const tableCount = ((project.template && project.template.fields) || [])
    .filter((field) => field.valid !== false && field.type === "TABLA").length;
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
    "- TEXTO y REDACCION pueden contener varios párrafos.",
    "- Los campos de REDACCION deben ser redactados por ti; la aplicación no llamará a otra IA para completarlos.",
    "- Las TABLAS deben respetar exactamente sus nombres de columna y el formato //FILA// + //DATO:COLUMNA//.",
    "- No escribas comentarios, explicaciones ni Markdown fuera del formato solicitado.",
    "- SISTEMA, CALC, DATOS, IMAGEN, IMAGENES, GRAFICO y GRAFICOS son responsabilidad de la aplicación y no deben incluirse en la respuesta.",
    "",
    "DATOS, REDACCIONES Y TABLAS QUE DEBES COMPLETAR:",
    fields.map(fieldDescription).join("\n\n"),
    "",
    "FORMATO DE RESPUESTA OBLIGATORIO:",
    "Copia exactamente la cabecera.",
    "Para campos y redacciones usa //CAMPO:NOMBRE// ... //FIN:NOMBRE//.",
    "Para tablas usa //TABLA:NOMBRE//, una o varias //FILA// y dentro //DATO:COLUMNA// ... //FIN-DATO:COLUMNA//.",
    "",
    fieldsText
  ].join("\n");

  return {
    protocol: PROTOCOL,
    mode: normalizedMode,
    manualCount,
    aiCount,
    tableCount,
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

function parseLegacyResponse(rawText) {
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


function parseV2Response(rawText) {
  const lines = String(rawText || "").replace(/\r/g, "").split("\n");
  const metadata = {};
  const blocks = [];
  const outside = [];
  let ended = false;
  let i = 0;

  function meta(line, key) {
    const value = parseMetadataLine(line, key);
    if (value != null) metadata[key === "FORMATO" ? "format" : key === "DOCUMENTO" ? "documentId" : key === "PLANTILLA" ? "template" : key === "VERSION-PLANTILLA" ? "templateVersion" : key === "MODO" ? "mode" : key] = value;
    return value != null;
  }

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) { i += 1; continue; }
    if (meta(line, "FORMATO") || meta(line, "DOCUMENTO") || meta(line, "PLANTILLA") || meta(line, "VERSION-PLANTILLA") || meta(line, "MODO")) {
      i += 1;
      continue;
    }
    if (line === "//FIN-DOCUMENTO//") { ended = true; i += 1; continue; }

    const fieldStart = line.match(/^\/\/CAMPO:([A-Za-z0-9_.-]+)\/\/$/);
    if (fieldStart) {
      const name = normalizeName(fieldStart[1]);
      const content = [];
      let closed = false;
      i += 1;
      while (i < lines.length) {
        const close = lines[i].trim().match(/^\/\/FIN:([A-Za-z0-9_.-]+)\/\/$/);
        if (close) {
          const closeName = normalizeName(close[1]);
          blocks.push({
            kind: "field",
            name,
            value: content.join("\n").trim(),
            closed: closeName === name,
            parseError: closeName === name ? "" : "El cierre corresponde a " + closeName + " y no a " + name + "."
          });
          closed = true;
          i += 1;
          break;
        }
        content.push(lines[i]);
        i += 1;
      }
      if (!closed) {
        blocks.push({ kind: "field", name, value: content.join("\n").trim(), closed: false, parseError: "Falta //FIN:" + name + "//." });
      }
      continue;
    }

    const tableStart = line.match(/^\/\/TABLA:([A-Za-z0-9_.-]+)\/\/$/);
    if (tableStart) {
      const name = normalizeName(tableStart[1]);
      const rows = [];
      const tableErrors = [];
      let tableClosed = false;
      i += 1;

      while (i < lines.length) {
        const current = lines[i].trim();
        const tableClose = current.match(/^\/\/FIN-TABLA:([A-Za-z0-9_.-]+)\/\/$/);
        if (tableClose) {
          const closeName = normalizeName(tableClose[1]);
          tableClosed = closeName === name;
          if (!tableClosed) tableErrors.push("El cierre corresponde a " + closeName + " y no a " + name + ".");
          i += 1;
          break;
        }

        if (current === "//FILA//") {
          const row = {};
          let rowClosed = false;
          i += 1;
          while (i < lines.length) {
            const rowLine = lines[i].trim();
            if (rowLine === "//FIN-FILA//") { rowClosed = true; i += 1; break; }
            const dataStart = rowLine.match(/^\/\/DATO:([A-Za-z0-9_.-]+)\/\/$/);
            if (dataStart) {
              const column = normalizeName(dataStart[1]);
              const content = [];
              let dataClosed = false;
              i += 1;
              while (i < lines.length) {
                const dataClose = lines[i].trim().match(/^\/\/FIN-DATO:([A-Za-z0-9_.-]+)\/\/$/);
                if (dataClose) {
                  const closeColumn = normalizeName(dataClose[1]);
                  if (closeColumn !== column) tableErrors.push("Cierre de dato incorrecto: " + closeColumn + " para " + column + ".");
                  dataClosed = true;
                  i += 1;
                  break;
                }
                content.push(lines[i]);
                i += 1;
              }
              if (!dataClosed) tableErrors.push("Falta //FIN-DATO:" + column + "//.");
              row[column] = content.join("\n").trim();
              continue;
            }
            if (rowLine) tableErrors.push("Texto no reconocido dentro de FILA: " + rowLine);
            i += 1;
          }
          if (!rowClosed) tableErrors.push("Falta //FIN-FILA//.");
          rows.push(row);
          continue;
        }

        if (current) tableErrors.push("Texto no reconocido dentro de TABLA: " + current);
        i += 1;
      }

      blocks.push({
        kind: "table",
        name,
        rows,
        closed: tableClosed,
        parseError: tableClosed ? tableErrors.join(" ") : (tableErrors.concat(["Falta //FIN-TABLA:" + name + "//."]).join(" "))
      });
      continue;
    }

    outside.push(raw);
    i += 1;
  }

  return { metadata, blocks, ended, outside };
}

function parseResponse(rawText) {
  const source = String(rawText || "");
  if (source.includes("//FORMATO:" + PROTOCOL + "//")) return parseV2Response(source);
  return parseLegacyResponse(source);
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

function validateTable(field, rows) {
  const defs = Array.isArray(field.columnDefs) ? field.columnDefs : [];
  if (!defs.length) {
    return { status: "error", value: [], message: "La tabla no define columnas en la plantilla Word." };
  }
  if (!Array.isArray(rows) || !rows.length) {
    return { status: field.required ? "error" : "empty", value: [], message: field.required ? "La tabla obligatoria no contiene filas." : "Sin filas." };
  }

  const expected = new Set(defs.map((column) => column.name));
  const hasRowContent = (row) => defs.some((column) =>
    String(row && row[column.name] != null ? row[column.name] : "").trim() !== ""
  );
  if (!rows.some(hasRowContent)) {
    return {
      status: field.required ? "error" : "empty",
      value: [],
      message: field.required ? "La tabla obligatoria no contiene información." : "Sin filas con información."
    };
  }

  const normalizedRows = [];
  const errors = [];

  rows.forEach((row, rowIndex) => {
    const normalizedRow = {};
    const keys = Object.keys(row || {});
    const hasContent = hasRowContent(row);
    if (!hasContent) {
      errors.push("Fila " + (rowIndex + 1) + ": la fila está completamente vacía.");
    }
    keys.filter((key) => !expected.has(key)).forEach((key) => {
      errors.push("Fila " + (rowIndex + 1) + ": columna no reconocida " + key + ".");
    });

    defs.forEach((column) => {
      if (!Object.prototype.hasOwnProperty.call(row || {}, column.name)) {
        errors.push("Fila " + (rowIndex + 1) + ": falta la columna " + column.name + ".");
      }
      const raw = row && row[column.name] != null ? row[column.name] : "";
      const checked = validateValue({ type: column.type, options: [] }, raw);
      if (checked.status === "error") {
        errors.push("Fila " + (rowIndex + 1) + ", " + column.label + ": " + checked.message);
      }
      normalizedRow[column.label] = checked.status === "valid" ? checked.value : raw;
    });
    normalizedRows.push(normalizedRow);
  });

  return errors.length
    ? { status: "error", value: normalizedRows, message: errors.slice(0, 5).join(" · ") }
    : { status: "valid", value: normalizedRows, message: normalizedRows.length + " fila(s)." };
}

function previewResponse(userDataPath, projectId, rawText, mode) {
  const project = projectOrThrow(userDataPath, projectId);
  const normalizedMode = mode === "manual" ? "manual" : "manual_ai";
  const allowed = requestedFields(project, normalizedMode);
  const allowedByName = new Map(allowed.map((field) => [field.name, field]));
  const parsed = parseResponse(rawText);
  const errors = [];
  const warnings = [];
  const isLegacy = parsed.metadata.format === LEGACY_PROTOCOL;

  if (parsed.metadata.format !== PROTOCOL && !isLegacy) {
    errors.push("Formato no válido. Se esperaba " + PROTOCOL + ".");
  }
  if (parsed.metadata.documentId !== project.documentId) errors.push("La respuesta corresponde a otro documento.");
  if (parsed.metadata.template !== templateFingerprint(project)) errors.push("La respuesta corresponde a otra plantilla.");
  if (
    parsed.metadata.templateVersion != null &&
    Number(parsed.metadata.templateVersion) !== Number(project.template.version || 1)
  ) errors.push("La respuesta corresponde a otra versión de la plantilla.");
  if (parsed.metadata.templateVersion == null) warnings.push("La respuesta no incluye VERSION-PLANTILLA; se validó mediante la huella.");
  if (!isLegacy && parsed.metadata.mode !== protocolMode(normalizedMode)) errors.push("El modo de la respuesta no coincide con el documento completo.");
  if (!parsed.ended) warnings.push("No se encontró //FIN-DOCUMENTO//.");
  if (parsed.outside.length) warnings.push("Se encontró texto fuera del formato; será ignorado.");
  if (isLegacy) warnings.push("Respuesta V1 detectada. Se importarán campos, pero las tablas requieren el formato V2.");

  const counts = new Map();
  parsed.blocks.forEach((block) => counts.set(block.name, (counts.get(block.name) || 0) + 1));

  const items = parsed.blocks.map((block) => {
    const field = allowedByName.get(block.name);
    if (!field) {
      return { name: block.name, label: block.name, type: "DESCONOCIDO", status: "error", message: "Este elemento no existe en la plantilla.", value: block.value || block.rows || "", normalizedValue: block.value || block.rows || "", conflict: false };
    }
    if (counts.get(block.name) > 1) {
      return { name: field.name, label: field.label, type: field.type, status: "error", message: "El elemento aparece más de una vez.", value: block.value || block.rows || "", normalizedValue: block.value || block.rows || "", conflict: false };
    }
    if (block.parseError || !block.closed) {
      return { name: field.name, label: field.label, type: field.type, status: "error", message: block.parseError || "Bloque sin cierre correcto.", value: block.value || block.rows || "", normalizedValue: block.value || block.rows || "", conflict: false };
    }

    const checked = field.type === "TABLA" ? validateTable(field, block.rows) : validateValue(field, block.value);
    const current = existingValue(project, field);
    const hasCurrent = field.type === "TABLA"
      ? Array.isArray(current) && current.length > 0
      : String(current == null ? "" : current).trim() !== "";
    const conflict = checked.status === "valid" && hasCurrent && JSON.stringify(current) !== JSON.stringify(checked.value);

    return {
      name: field.name,
      label: field.label,
      type: field.type,
      status: checked.status,
      message: conflict ? "Ya existe un valor diferente en la app." : checked.message,
      value: field.type === "TABLA" ? block.rows : block.value,
      normalizedValue: checked.value,
      existingValue: current,
      conflict,
      rowCount: field.type === "TABLA" && Array.isArray(checked.value) ? checked.value.length : 0
    };
  });

  const presentNames = new Set(items.filter((item) => item.status !== "empty").map((item) => item.name));
  const missingRequired = allowed.filter((field) => field.required && !presentNames.has(field.name)).map((field) => field.label || field.name);
  if (missingRequired.length) warnings.push("Faltan elementos obligatorios en la respuesta: " + missingRequired.slice(0, 8).join(", ") + (missingRequired.length > 8 ? "…" : ""));

  const summary = {
    totalBlocks: items.length,
    valid: items.filter((item) => item.status === "valid").length,
    empty: items.filter((item) => item.status === "empty").length,
    errors: items.filter((item) => item.status === "error").length,
    conflicts: items.filter((item) => item.conflict).length,
    requested: allowed.length,
    tableRows: items.reduce((sum, item) => sum + Number(item.rowCount || 0), 0)
  };

  return {
    protocol: parsed.metadata.format || PROTOCOL,
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

function externalAnalysis(externalFields, deterministicSources) {
  const fields = Object.assign({}, externalFields || {});
  const sourceData = deterministicSources && typeof deterministicSources === "object" ? deterministicSources : {};
  const fieldSources = {};
  Object.keys(fields).forEach((name) => { fieldSources[name] = ["IA externa"]; });

  return {
    provider: deterministicSources ? "IA externa + procesamiento local" : "IA externa",
    generatedAt: new Date().toISOString(),
    generatedFields: fields,
    externalGeneratedFields: fields,
    fieldSources,
    keyFindings: [],
    missingData: Array.isArray(sourceData.extractionWarnings) ? sourceData.extractionWarnings : [],
    tables: Array.isArray(sourceData.tables) ? sourceData.tables : [],
    charts: Array.isArray(sourceData.charts) ? sourceData.charts : [],
    sourceTrace: []
      .concat(Array.isArray(sourceData.dataSummary) ? sourceData.dataSummary.map((item) => ({ name: item.name, markerName: item.markerName || "", type: "datos" })) : [])
      .concat(Array.isArray(sourceData.textSources) ? sourceData.textSources.map((item) => ({ name: item.name, markerName: item.markerName || "", type: "texto" })) : []),
    notes: "Contenido de redacción importado mediante ITSQMET-DOCUMENTO-V2; tablas y gráficos de archivos se procesan localmente."
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

function analysisFromExternalOnly(project, deterministicSources) {
  const external = externalFieldsFromProject(project);
  return externalAnalysis(external, deterministicSources);
}


module.exports = {
  PROTOCOL,
  LEGACY_PROTOCOL,
  getGuide,
  saveGuide,
  buildPrompt,
  parseResponse,
  previewResponse,
  applyResponse,
  undoLastImport,
  analysisFromExternalOnly
};
