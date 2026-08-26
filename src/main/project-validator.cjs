function hasText(value) {
  return String(value == null ? "" : value).trim().length > 0;
}

function attachmentCount(project, kind, markerName) {
  return (project.attachments || []).filter((item) =>
    item.kind === kind && (!markerName || item.markerName === markerName)
  ).length;
}

function validateProject(project) {
  const errors = [];
  const warnings = [];
  const template = project && project.template;

  if (!project) return { ok: false, errors: ["No se encontró el documento."], warnings };
  if (project.mode === "upload") return { ok: true, errors, warnings };
  if (!template || !template.localPath) return { ok: false, errors: ["Primero carga la plantilla Word de este documento."], warnings };

  if (template.validation && Array.isArray(template.validation.errors) && template.validation.errors.length) {
    errors.push(...template.validation.errors);
  }

  (template.fields || []).forEach((field) => {
    if (!field.valid || !field.required) return;

    if (["CAMPO", "TEXTO", "FECHA", "NUMERO"].includes(field.type)) {
      if (!hasText(project.formData && project.formData[field.name])) errors.push(`Falta: ${field.label}.`);
      return;
    }

    if (field.type === "TABLA") {
      const rows = project.formData && project.formData[field.name];
      if (!Array.isArray(rows) || !rows.length) errors.push(`Falta: ${field.label}.`);
      return;
    }

    if (field.type === "DATOS" && attachmentCount(project, "data", field.name) === 0) {
      errors.push(`Falta: ${field.label}.`);
    }

    if (["IMAGEN", "IMAGENES"].includes(field.type) && attachmentCount(project, "evidence", field.name) === 0) {
      errors.push(`Falta: ${field.label}.`);
    }
  });

  if (template.validation && Array.isArray(template.validation.warnings)) warnings.push(...template.validation.warnings);
  return { ok: errors.length === 0, errors, warnings };
}

function validateAiFields(project, analysis) {
  const errors = [];
  const generated = analysis && analysis.generatedFields ? analysis.generatedFields : {};

  ((project.template && project.template.aiFields) || []).forEach((field) => {
    if (field.required && !hasText(generated[field.name])) errors.push(`La IA no pudo completar: ${field.label}.`);
  });

  return { ok: errors.length === 0, errors };
}

module.exports = { validateProject, validateAiFields };
