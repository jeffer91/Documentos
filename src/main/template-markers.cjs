const ALLOWED_TYPES = new Set([
  "SISTEMA",
  "CAMPO",
  "TEXTO",
  "FECHA",
  "NUMERO",
  "IA",
  "DATOS",
  "TABLA",
  "IMAGEN",
  "IMAGENES",
  "GRAFICO",
  "GRAFICOS"
]);

const BLOCK_TYPES = new Set(["DATOS", "TABLA", "IMAGEN", "IMAGENES", "GRAFICO", "GRAFICOS"]);
const USER_TYPES = new Set(["CAMPO", "TEXTO", "FECHA", "NUMERO", "DATOS", "TABLA", "IMAGEN", "IMAGENES"]);

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

function parseMarkerInner(inner) {
  const raw = String(inner || "").trim();
  if (!raw) return null;

  const parts = raw.split("|").map((part) => part.trim());
  const head = parts.shift() || "";
  const explicitLabel = parts.shift() || "";
  const config = parts.join("|");
  const colon = head.indexOf(":");

  let type = "CAMPO";
  let required = false;
  let name = head;

  if (colon >= 0) {
    let typePart = head.slice(0, colon).trim().toUpperCase();
    name = head.slice(colon + 1).trim();
    if (typePart.endsWith("!")) {
      required = true;
      typePart = typePart.slice(0, -1);
    }
    type = typePart;
  } else if (head.endsWith("!")) {
    required = true;
    name = head.slice(0, -1);
  }

  const normalized = normalizeName(name);
  const base = {
    raw,
    token: raw,
    type,
    name: normalized,
    label: explicitLabel || humanize(normalized || name),
    required,
    config
  };

  if (!ALLOWED_TYPES.has(type)) {
    return Object.assign(base, { valid: false, error: `Tipo desconocido: ${type}` });
  }
  if (!normalized) {
    return Object.assign(base, { valid: false, error: "El marcador no tiene nombre." });
  }

  const columns = type === "TABLA" && config
    ? config.split(",").map((item) => item.trim()).filter(Boolean)
    : [];

  return Object.assign(base, {
    valid: true,
    columns,
    isBlock: BLOCK_TYPES.has(type),
    isUserInput: USER_TYPES.has(type),
    isAi: type === "IA",
    isSystem: type === "SISTEMA"
  });
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
    if (marker.valid && marker.type === "TABLA" && !marker.columns.length) {
      warnings.push(`{{${marker.raw}}}: agrega las columnas después de la etiqueta. Ejemplo: {{TABLA:CRONOGRAMA|Cronograma|Actividad,Responsable,Fecha}}`);
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
  ALLOWED_TYPES,
  BLOCK_TYPES,
  USER_TYPES,
  normalizeName,
  humanize,
  parseMarkerInner,
  parseMarkersFromText,
  validateMarkers
};
