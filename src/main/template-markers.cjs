const TYPE_ALIASES = Object.freeze({
  CAM: "CAMPO",
  TXT: "TEXTO",
  FEC: "FECHA",
  NUM: "NUMERO",
  LST: "LISTA",
  CAL: "CALC",
  BUS: "BUSCAR",
  SYS: "SISTEMA",
  AI: "IA",
  DAT: "DATOS",
  TAB: "TABLA",
  IMG: "IMAGEN",
  IMGS: "IMAGENES",
  GRA: "GRAFICO",
  GRAS: "GRAFICOS"
});

const ALLOWED_TYPES = new Set([
  "SISTEMA",
  "CAMPO",
  "TEXTO",
  "FECHA",
  "NUMERO",
  "LISTA",
  "BUSCAR",
  "CALC",
  "IA",
  "DATOS",
  "TABLA",
  "IMAGEN",
  "IMAGENES",
  "GRAFICO",
  "GRAFICOS"
]);

const BLOCK_TYPES = new Set(["DATOS", "TABLA", "IMAGEN", "IMAGENES", "GRAFICO", "GRAFICOS"]);
const USER_TYPES = new Set(["CAMPO", "TEXTO", "FECHA", "NUMERO", "LISTA", "BUSCAR", "DATOS", "TABLA", "IMAGEN", "IMAGENES"]);
const DERIVED_TYPES = new Set(["CALC", "GRAFICO", "GRAFICOS"]);

function canonicalType(value) {
  const raw = String(value || "").trim().toUpperCase();
  return TYPE_ALIASES[raw] || raw;
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_.-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function humanize(value) {
  const text = String(value || "").replace(/[_.-]+/g, " ").trim().toLowerCase();
  return text ? text.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()) : "Campo";
}

function parseListOptions(config) {
  return String(config || "")
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTableColumns(config) {
  return String(config || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const colon = item.lastIndexOf(":");
      let label = item;
      let type = "CAMPO";

      if (colon > 0) {
        const possible = canonicalType(item.slice(colon + 1));
        if (["CAMPO", "TEXTO", "FECHA", "NUMERO", "LISTA", "BUSCAR"].includes(possible)) {
          label = item.slice(0, colon).trim();
          type = possible;
        }
      }

      return {
        label: label || "Dato",
        name: normalizeName(label || "Dato"),
        type
      };
    });
}

function enrichMarker(input) {
  const marker = Object.assign({}, input || {});
  marker.type = canonicalType(marker.type);
  marker.columns = marker.type === "TABLA"
    ? parseTableColumns(marker.config).map((column) => column.label)
    : Array.isArray(marker.columns) ? marker.columns : [];
  marker.columnDefs = marker.type === "TABLA" ? parseTableColumns(marker.config) : [];
  marker.options = marker.type === "LISTA" ? parseListOptions(marker.config) : [];
  marker.formula = marker.type === "CALC" ? String(marker.config || "").trim() : "";
  marker.lookupSource = marker.type === "BUSCAR" ? String(marker.config || "").trim() : "";
  marker.isBlock = BLOCK_TYPES.has(marker.type);
  marker.isUserInput = USER_TYPES.has(marker.type);
  marker.isDerived = DERIVED_TYPES.has(marker.type);
  marker.isAi = marker.type === "IA";
  marker.isSystem = marker.type === "SISTEMA";
  return marker;
}

function parseMarkerInner(inner) {
  const raw = String(inner || "").trim();
  if (!raw) return null;

  const parts = raw.split("|").map((part) => part.trim());
  const head = parts.shift() || "";
  const explicitLabel = parts.shift() || "";
  const config = parts.join("|");
  const colon = head.indexOf(":");

  let rawType = "CAMPO";
  let required = false;
  let name = head;

  if (colon >= 0) {
    let typePart = head.slice(0, colon).trim().toUpperCase();
    name = head.slice(colon + 1).trim();
    if (typePart.endsWith("!")) {
      required = true;
      typePart = typePart.slice(0, -1);
    }
    rawType = typePart;
  } else if (head.endsWith("!")) {
    required = true;
    name = head.slice(0, -1);
  }

  const type = canonicalType(rawType);
  const normalized = normalizeName(name);
  const base = {
    raw,
    token: raw,
    rawType,
    type,
    aliasUsed: rawType !== type ? rawType : "",
    name: normalized,
    label: explicitLabel || humanize(normalized || name),
    required,
    config
  };

  if (!ALLOWED_TYPES.has(type)) {
    return enrichMarker(Object.assign(base, { valid: false, error: `Tipo desconocido: ${rawType}` }));
  }
  if (!normalized) {
    return enrichMarker(Object.assign(base, { valid: false, error: "El marcador no tiene nombre." }));
  }

  return enrichMarker(Object.assign(base, { valid: true }));
}

function parseMarkersFromText(text) {
  const source = String(text || "");
  const regex = /\{\{\s*([^{}]+?)\s*\}\}/g;
  const markers = [];
  const seenRaw = new Set();
  let match;

  while ((match = regex.exec(source))) {
    const marker = parseMarkerInner(match[1]);
    if (!marker || seenRaw.has(marker.raw)) continue;
    seenRaw.add(marker.raw);
    markers.push(marker);
  }
  return markers;
}

function validateMarkers(markers) {
  const errors = [];
  const warnings = [];
  const list = Array.isArray(markers) ? markers : [];

  list.forEach((marker) => {
    if (!marker.valid) errors.push(marker.error || `Marcador inválido: ${marker.raw}`);

    if (marker.valid && marker.type === "TABLA" && !marker.columnDefs.length) {
      warnings.push(`{{${marker.raw}}}: agrega columnas. Ejemplo: {{TABLA:CRONOGRAMA|Cronograma|Actividad:TEXTO,Responsable:CAMPO,Fecha:FECHA}}`);
    }

    if (marker.valid && marker.type === "LISTA" && !marker.options.length) {
      warnings.push(`{{${marker.raw}}}: LISTA no tiene opciones. Ejemplo: {{LISTA:MODALIDAD|Modalidad|Presencial,En línea,Híbrida}}`);
    }

    if (marker.valid && marker.type === "CALC" && !marker.formula) {
      errors.push(`{{${marker.raw}}}: CALC necesita una fórmula.`);
    }

    if (marker.valid && marker.type === "BUSCAR" && !marker.lookupSource) {
      warnings.push(`{{${marker.raw}}}: BUSCAR no indica una fuente. Ejemplo: {{BUSCAR:DOCENTE|Docente|DOCENTES}}`);
    }
  });

  const byMeaning = new Map();
  list.filter((marker) => marker.valid).forEach((marker) => {
    const key = `${marker.type}:${marker.name}`;
    const raws = byMeaning.get(key) || [];
    raws.push(marker.raw);
    byMeaning.set(key, raws);
  });

  byMeaning.forEach((raws, key) => {
    if (new Set(raws).size > 1) warnings.push(`${key} tiene variantes de marcador. Conviene usar una sola forma.`);
  });

  if (!list.length) warnings.push("No se detectaron marcadores {{...}}.");
  return { errors, warnings, ok: errors.length === 0 };
}

module.exports = {
  TYPE_ALIASES,
  ALLOWED_TYPES,
  BLOCK_TYPES,
  USER_TYPES,
  DERIVED_TYPES,
  canonicalType,
  normalizeName,
  humanize,
  parseListOptions,
  parseTableColumns,
  enrichMarker,
  parseMarkerInner,
  parseMarkersFromText,
  validateMarkers
};
