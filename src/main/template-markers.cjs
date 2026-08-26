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
  "IMAGENES"
]);

const BLOCK_TYPES = new Set(["DATOS", "TABLA", "IMAGEN", "IMAGENES"]);
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
  const config = parts.length > 1 ? parts.slice(1).join("|") : "";
  const explicitLabel = parts[0] || "";
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

  if (!ALLOWED_TYPES.has(type)) {
    return {
      raw,
      valid: false,
      error: `Tipo desconocido: ${type}`,
      type,
      name: normalizeName(name),
      label: explicitLabel || humanize(name),
      required,
      config
    };
  }

  const normalized = normalizeName(name);
  if (!normalized) {
    return {
      raw,
      valid: false,
      error: "El marcador no tiene nombre.",
      type,
      name: "",
      label: explicitLabel || "Campo",
      required,
      config
    };
  }

  const columns = type === "TABLA" && config
    ? config.split(",").map((item) => item.trim()).filter(Boolean)
    : [];

  return {
    raw,
    token: raw,
    valid: true,
    type,
    name: normalized,
    label: explicitLabel || humanize(normalized),
    required,
    config,
    columns,
    isBlock: BLOCK_TYPES.has(type),
    isUserInput: USER_TYPES.has(type),
    isAi: type === "IA",
    isSystem: type === "SISTEMA"
  };
}

function parseMarkersFromText(text) {
  const source = String(text || "");
  const regex = /\{\{\s*([^{}]+?)\s*\}\}/g;
  const markers = [];
  const seen = new Set();
  let match;

  while ((match = regex.exec(source))) {
    const marker = parseMarkerInner(match[1]);
    if (!marker) continue;
    const key = `${marker.type}:${marker.name}:${marker.raw}`;
    if (seen.has(key)) continue;
    seen.add(key);
    markers.push(marker);
  }
  return markers;
}

function markerKey(marker) {
  return marker && marker.raw ? marker.raw : "";
}

function validateMarkers(markers) {
  const errors = [];
  const warnings = [];
  const list = Array.isArray(markers) ? markers : [];

  list.forEach((marker) => {
    if (!marker.valid) errors.push(marker.error || `Marcador inválido: ${marker.raw}`);
    if (marker.type === "TABLA" && !marker.columns.length) {
      warnings.push(`${marker.raw}: la tabla no define columnas. Usa |Actividad,Responsable,Fecha al final.`);
    }
  });

  const repeated = new Map();
  list.filter((marker) => marker.valid).forEach((marker) => {
    const key = `${marker.type}:${marker.name}`;
    repeated.set(key, (repeated.get(key) || 0) + 1);
  });
  repeated.forEach((count, key) => {
    if (count > 1) warnings.push(`${key} aparece ${count} veces; se rellenará con el mismo valor.`);
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
  markerKey,
  validateMarkers
};
