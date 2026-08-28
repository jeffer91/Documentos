const { inspect } = require("./file-integrity-service.cjs");

function hasText(value) {
  return String(value == null ? "" : value).trim().length > 0;
}

function attachmentCount(project, kind, markerName) {
  return (project.attachments || []).filter((item) =>
    item.kind === kind && (!markerName || item.markerName === markerName)
  ).length;
}

function validateFileIntegrity(project, errors, warnings) {
  const template = project && project.template;
  if (template && template.localPath) {
    const check = inspect(template.localPath, template.sha256 || "");
    if (!check.exists) errors.push("La plantilla Word ya no existe en el almacenamiento local.");
    else if (!check.ok) errors.push("La plantilla Word fue modificada fuera de la app. Vuelve a importarla.");
    else if (!template.sha256) warnings.push("La plantilla proviene de una versión antigua y aún no tiene huella de integridad.");
  }

  (project.attachments || []).forEach((item) => {
    const check = inspect(item.localPath, item.sha256 || "");
    if (!check.exists) {
      errors.push(`No se encontró el archivo: ${item.name}.`);
      return;
    }
    if (!check.ok) {
      errors.push(`El archivo cambió fuera de la app: ${item.name}.`);
      return;
    }
    if (!item.sha256) warnings.push(`${item.name}: archivo antiguo sin huella de integridad.`);
  });
}

function validateProject(project) {
  const errors = [];
  const warnings = [];
  const template = project && project.template;

  if (!project) return { ok: false, errors: ["No se encontró el documento."], warnings };
  if (project.mode === "upload") {
    validateFileIntegrity(project, errors, warnings);
    return { ok: errors.length === 0, errors, warnings };
  }
  if (!template || !template.localPath) {
    return { ok: false, errors: ["Primero carga la plantilla Word de este documento."], warnings };
  }

  if (template.validation && Array.isArray(template.validation.errors) && template.validation.errors.length) {
    errors.push(...template.validation.errors);
  }

  const needsDocumentNumber = (template.systemFields || []).some((field) =>
    field.valid !== false && ["CODIGO", "CODIGO_DOCUMENTO"].includes(field.name)
  ) && /(0X|XX)/.test(String(project.codePattern || ""));
  const documentNumber = project.formData && (project.formData.NUMERO_DOCUMENTO || project.formData.NUMERO);
  if (needsDocumentNumber && !hasText(documentNumber)) {
    errors.push("Falta el número de documento necesario para construir {{SYS:CODIGO}}.");
  }

  (template.fields || []).forEach((field) => {
    if (!field.valid || !field.required) return;

    if (["CAMPO", "TEXTO", "FECHA", "NUMERO", "LISTA", "BUSCAR"].includes(field.type)) {
      const value = project.formData && project.formData[field.name];
      if (!hasText(value)) errors.push(`Falta: ${field.label}.`);
      if (field.type === "LISTA" && hasText(value) && field.options && field.options.length && !field.options.includes(String(value))) {
        errors.push(`${field.label}: selecciona una opción válida.`);
      }
      return;
    }

    if (field.type === "CALC") return;

    if (field.type === "TABLA") {
      const rows = project.formData && project.formData[field.name];
      if (!Array.isArray(rows) || !rows.length) {
        errors.push(`Falta: ${field.label}.`);
        return;
      }

      const defs = field.columnDefs || [];
      rows.forEach((row, rowIndex) => {
        defs.forEach((column) => {
          const value = row && Object.keys(row).find((key) => String(key).toUpperCase() === String(column.label).toUpperCase());
          const raw = value ? row[value] : row && row[column.label];
          if (column.type === "NUMERO" && hasText(raw) && !Number.isFinite(Number(String(raw).replace(",", ".")))) {
            errors.push(`${field.label}, fila ${rowIndex + 1}, ${column.label}: debe ser numérico.`);
          }
        });
      });
      return;
    }

    if (field.type === "DATOS" && attachmentCount(project, "data", field.name) === 0) {
      errors.push(`Falta: ${field.label}.`);
    }

    if (["IMAGEN", "IMAGENES"].includes(field.type) && attachmentCount(project, "evidence", field.name) === 0) {
      errors.push(`Falta: ${field.label}.`);
    }
  });

  validateFileIntegrity(project, errors, warnings);

  if (template.validation && Array.isArray(template.validation.warnings)) {
    warnings.push(...template.validation.warnings);
  }

  return { ok: errors.length === 0, errors, warnings };
}

function validateAiFields(project, analysis) {
  const errors = [];
  const generated = analysis && analysis.generatedFields ? analysis.generatedFields : {};

  ((project.template && project.template.aiFields) || []).forEach((field) => {
    if (field.required && !hasText(generated[field.name])) {
      errors.push(`La IA no pudo completar: ${field.label}.`);
    }
  });

  return { ok: errors.length === 0, errors };
}

module.exports = { validateProject, validateAiFields };
