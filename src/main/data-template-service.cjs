const path = require("path");
const XLSX = require("xlsx");
const registry = require("./data-template-registry.cjs");

function safeFilePart(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "datos";
}

function templateFileName(slot, periodLabel) {
  const parts = ["Plantilla", safeFilePart(slot && slot.label || slot && slot.key || "datos")];
  if (periodLabel) parts.push(safeFilePart(periodLabel));
  return parts.join("_") + ".xlsx";
}

function instructionsRows(slot, context) {
  const rows = [
    ["PLANTILLA DE DATOS", slot.label],
    ["Dataset", slot.key],
    ["Proceso", context && context.processLabel || slot.processKey || ""],
    ["Período", context && context.periodLabel || ""],
    ["Documento que introduce estos datos", slot.introducedBy || ""],
    [],
    ["INSTRUCCIONES"],
    ["1", "No cambies los encabezados de la hoja DATOS."],
    ["2", "Completa una fila por registro."],
    ["3", "No combines celdas ni agregues títulos sobre los encabezados."],
    ["4", "Los campos obligatorios deben tener información."],
    ["5", "Guarda el archivo como .xlsx y vuelve a cargarlo en la aplicación."],
    [],
    ["CAMPO", "OBLIGATORIO", "TIPO"]
  ];
  (slot.fields || []).forEach((field) => {
    rows.push([field.label, field.required ? "Sí" : "No", field.type || "texto"]);
  });
  return rows;
}

function buildWorkbook(slot, context) {
  if (!slot) throw new Error("Dataset no válido.");
  const workbook = XLSX.utils.book_new();
  const headers = registry.templateHeaders(slot);
  const dataSheet = XLSX.utils.aoa_to_sheet([headers]);
  dataSheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  dataSheet["!cols"] = headers.map((header) => ({ wch: Math.max(14, Math.min(34, String(header).length + 4)) }));
  XLSX.utils.book_append_sheet(workbook, dataSheet, "DATOS");

  const instructions = XLSX.utils.aoa_to_sheet(instructionsRows(slot, context || {}));
  instructions["!cols"] = [{ wch: 28 }, { wch: 72 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, instructions, "INSTRUCCIONES");

  if (Array.isArray(slot.catalogs) && slot.catalogs.length) {
    const rows = [["CATÁLOGO", "VALOR"]];
    slot.catalogs.forEach((catalog) => {
      (catalog.values || []).forEach((value) => rows.push([catalog.label || catalog.key, value]));
    });
    const catalogs = XLSX.utils.aoa_to_sheet(rows);
    catalogs["!cols"] = [{ wch: 28 }, { wch: 48 }];
    XLSX.utils.book_append_sheet(workbook, catalogs, "CATALOGOS");
  }

  workbook.Props = {
    Title: slot.label,
    Subject: slot.description || "Plantilla de datos",
    Author: "Documentos ITSQMET",
    Comments: `Dataset: ${slot.key}`
  };
  return workbook;
}

function writeTemplate(filePath, slot, context) {
  const workbook = buildWorkbook(slot, context);
  XLSX.writeFile(workbook, filePath, { compression: true });
  return {
    path: filePath,
    fileName: path.basename(filePath),
    datasetKey: slot.key,
    headers: registry.templateHeaders(slot)
  };
}

module.exports = {
  safeFilePart,
  templateFileName,
  buildWorkbook,
  writeTemplate
};
