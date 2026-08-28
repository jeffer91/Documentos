const workspace = require("./workspace-service.cjs");
const settingsService = require("./settings-service.cjs");
const { systemValues } = require("./document-composer.cjs");

const SCALAR_TYPES = new Set(["CAMPO", "TEXTO", "FECHA", "NUMERO", "LISTA", "BUSCAR"]);

function text(value) {
  return String(value == null ? "" : value).trim();
}

function attachmentCount(project, kind, markerName) {
  return (project.attachments || []).filter((item) =>
    item.kind === kind && String(item.markerName || "") === String(markerName || "")
  ).length;
}

function categoryFor(type) {
  if (type === "SISTEMA") return "system";
  if (SCALAR_TYPES.has(type)) return "data";
  if (type === "IA") return "writing";
  if (type === "TABLA") return "tables";
  if (type === "DATOS") return "files";
  if (type === "IMAGEN" || type === "IMAGENES") return "evidence";
  if (type === "CALC") return "calculations";
  if (type === "GRAFICO" || type === "GRAFICOS") return "charts";
  return "other";
}

function sourceFor(type) {
  if (type === "SISTEMA") return "Sistema";
  if (SCALAR_TYPES.has(type)) return "Usuario o IA externa";
  if (type === "IA") return "IA externa";
  if (type === "TABLA") return "IA externa o captura manual";
  if (type === "DATOS") return "Archivo Excel / CSV";
  if (type === "IMAGEN" || type === "IMAGENES") return "Archivos de evidencia";
  if (type === "CALC") return "Cálculo automático";
  if (type === "GRAFICO" || type === "GRAFICOS") return "Generación automática";
  return "Aplicación";
}

function actionFor(type) {
  if (type === "SISTEMA") return "automatic";
  if (SCALAR_TYPES.has(type)) return "input";
  if (type === "IA") return "external_ai";
  if (type === "TABLA") return "table";
  if (type === "DATOS") return "upload_data";
  if (type === "IMAGEN" || type === "IMAGENES") return "upload_evidence";
  if (type === "CALC") return "calculate";
  if (type === "GRAFICO" || type === "GRAFICOS") return "automatic";
  return "none";
}

function valueFor(marker, project, sys) {
  if (marker.type === "SISTEMA") return sys[marker.name] == null ? "" : sys[marker.name];
  if (marker.type === "IA") {
    const fields = project.analysis && project.analysis.externalGeneratedFields || {};
    return fields[marker.name] == null ? "" : fields[marker.name];
  }
  if (marker.type === "TABLA") {
    const rows = project.formData && project.formData[marker.name];
    return Array.isArray(rows) ? rows : [];
  }
  if (marker.type === "DATOS") return attachmentCount(project, "data", marker.name);
  if (marker.type === "IMAGEN" || marker.type === "IMAGENES") return attachmentCount(project, "evidence", marker.name);
  if (SCALAR_TYPES.has(marker.type) || marker.type === "CALC") {
    return project.formData && project.formData[marker.name] != null ? project.formData[marker.name] : "";
  }
  return "";
}

function systemNote(marker, project, value) {
  if (!["CODIGO", "CODIGO_DOCUMENTO"].includes(marker.name)) return "";
  const pattern = String(project.codePattern || "");
  if (!/(0X|XX)/.test(pattern)) return "Se calcula automáticamente con el patrón institucional del documento.";
  const explicit = text(project.formData && (project.formData.NUMERO_DOCUMENTO || project.formData.NUMERO));
  if (explicit) return "Número de documento utilizado: " + explicit + ".";
  return "El patrón necesita un número de documento. Actualmente se usaría 01 por defecto; puedes cambiarlo antes de generar.";
}

function statusFor(marker, project, value) {
  if (marker.type === "SISTEMA") {
    if (["CODIGO", "CODIGO_DOCUMENTO"].includes(marker.name) && /(0X|XX)/.test(String(project.codePattern || ""))) {
      const explicit = text(project.formData && (project.formData.NUMERO_DOCUMENTO || project.formData.NUMERO));
      if (!explicit) return "warning";
    }
    return text(value) ? "ready" : (marker.required ? "missing" : "pending");
  }
  if (marker.type === "TABLA") return Array.isArray(value) && value.length ? "ready" : "pending";
  if (marker.type === "DATOS" || marker.type === "IMAGEN" || marker.type === "IMAGENES") {
    return Number(value || 0) > 0 ? "ready" : (marker.required ? "missing" : "pending");
  }
  if (marker.type === "GRAFICO" || marker.type === "GRAFICOS") return "automatic";
  if (marker.type === "CALC") return text(value) ? "ready" : "automatic";
  return text(value) ? "ready" : (marker.required ? "missing" : "pending");
}

function requirementFor(marker, project, sys) {
  const value = valueFor(marker, project, sys);
  const note = marker.type === "SISTEMA" ? systemNote(marker, project, value) : "";
  return {
    key: marker.type + ":" + marker.name,
    name: marker.name,
    label: marker.label || marker.name,
    type: marker.type,
    raw: marker.raw,
    literal: "{{" + marker.raw + "}}",
    required: Boolean(marker.required),
    category: categoryFor(marker.type),
    source: sourceFor(marker.type),
    action: actionFor(marker.type),
    status: statusFor(marker, project, value),
    value,
    note,
    options: Array.isArray(marker.options) ? marker.options : [],
    columns: Array.isArray(marker.columnDefs)
      ? marker.columnDefs.map((column) => ({ name: column.name, label: column.label, type: column.type }))
      : [],
    formula: marker.formula || "",
    multiple: marker.type === "IMAGENES"
  };
}

function summarize(requirements) {
  const categories = {};
  requirements.forEach((item) => {
    categories[item.category] = (categories[item.category] || 0) + 1;
  });
  const blocking = requirements.filter((item) => item.required && item.status === "missing");
  const warnings = requirements.filter((item) => item.status === "warning");
  const ready = requirements.filter((item) => item.status === "ready" || item.status === "automatic").length;
  return {
    total: requirements.length,
    ready,
    pending: requirements.length - ready,
    blocking: blocking.length,
    warnings: warnings.length,
    categories
  };
}

function getRequirements(userDataPath, projectId) {
  const project = workspace.getProject(userDataPath, projectId);
  if (!project) throw new Error("No se encontró el documento.");
  if (!project.template) throw new Error("El documento no tiene una plantilla activa.");

  const settings = settingsService.readSettings(userDataPath);
  const sys = systemValues(project, settings.signers || {});
  const requirements = (project.template.markers || [])
    .filter((marker) => marker.valid !== false)
    .map((marker) => requirementFor(marker, project, sys));

  return {
    templateId: project.template.id,
    templateVersion: Number(project.template.version || 1),
    requirements,
    summary: summarize(requirements),
    systemValues: sys,
    codePattern: project.codePattern || ""
  };
}

module.exports = { getRequirements, categoryFor, sourceFor };
