const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const { nativeImage } = require("electron");
const { generatedDir, safeName } = require("./workspace-service.cjs");
const { exportPdf } = require("./pdf-service.cjs");

function text(value) {
  return String(value == null ? "" : value).trim();
}

function dateParts(project) {
  const values = project.formData || {};
  const dateValue = values.FECHA || values.FECHA_ELABORACION || values.FECHA_DOCUMENTO || "";
  const match = String(dateValue).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const now = new Date();
  return match ? { year: match[1], month: match[2], day: match[3] } : {
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1).padStart(2, "0"),
    day: String(now.getDate()).padStart(2, "0")
  };
}

function resolvedCode(project) {
  const parts = dateParts(project);
  const number = text((project.formData || {}).NUMERO_DOCUMENTO || (project.formData || {}).NUMERO || "01").padStart(2, "0");
  return text(project.codePattern || "DOCUMENTO")
    .replace(/AÑO/g, parts.year)
    .replace(/20XX/g, parts.year)
    .replace(/MES/g, parts.month)
    .replace(/0X/g, number)
    .replace(/XX/g, number);
}

function systemValues(project, signers) {
  const signerData = signers || {};
  const elaborado = signerData.elaboradoPor || {};
  const revisado = signerData.revisadoPor || {};
  const aprobado = signerData.aprobadoPor || {};
  const parts = dateParts(project);
  const today = `${parts.day}/${parts.month}/${parts.year}`;

  return {
    UNIDAD: project.unitName || "",
    SIGLA_UNIDAD: project.unitId || "",
    PROCESO: project.processName || "",
    CODIGO_PROCESO: project.processCode || "",
    DOCUMENTO: project.documentName || "",
    TITULO: project.documentName || "",
    CODIGO: resolvedCode(project),
    CODIGO_DOCUMENTO: resolvedCode(project),
    FECHA_ACTUAL: today,
    VERSION: (project.formData || {}).VERSION_DOCUMENTO || project.documentVersion || "1.0",
    VERSION_DOCUMENTO: (project.formData || {}).VERSION_DOCUMENTO || project.documentVersion || "1.0",
    VERSION_PLANTILLA: project.template && project.template.version ? String(project.template.version) : "1",
    PERIODO: (project.formData || {}).PERIODO || "",
    ELABORADO_POR: elaborado.nombre || "",
    CARGO_ELABORADO: elaborado.cargo || "",
    REVISADO_POR: revisado.nombre || "",
    CARGO_REVISADO: revisado.cargo || "",
    APROBADO_POR: aprobado.nombre || "",
    CARGO_APROBADO: aprobado.cargo || ""
  };
}

function scalarValue(marker, project, analysis, signers) {
  if (marker.type === "SISTEMA") return systemValues(project, signers)[marker.name] || "";
  if (marker.type === "IA") return text(analysis && analysis.generatedFields && analysis.generatedFields[marker.name]);
  if (["CAMPO", "TEXTO", "FECHA", "NUMERO"].includes(marker.type)) {
    const value = project.formData && project.formData[marker.name];
    return value == null ? "" : String(value);
  }
  return `{{${marker.raw}}}`;
}

function fillScalars(templatePath, outputPath, project, analysis, signers) {
  const zip = new PizZip(fs.readFileSync(templatePath));
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => ""
  });

  const values = {};
  ((project.template && project.template.markers) || []).forEach((marker) => {
    values[marker.raw] = marker.isBlock
      ? `{{${marker.raw}}}`
      : scalarValue(marker, project, analysis, signers);
  });

  doc.render(values);
  fs.writeFileSync(outputPath, doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }));
  return outputPath;
}

function manualTable(project, marker) {
  const rows = Array.isArray(project.formData && project.formData[marker.name]) ? project.formData[marker.name] : [];
  const headers = marker.columns && marker.columns.length ? marker.columns : [];
  return {
    title: marker.label || "",
    headers,
    rows: rows.map((row) => headers.map((header) => text(row && row[header])))
  };
}

function matchingTables(project, analysis, marker) {
  if (marker.type === "TABLA") return [manualTable(project, marker)];
  const tables = (analysis && analysis.tables) || [];
  const exact = tables.filter((table) => table.markerName === marker.name);
  if (exact.length) return exact;
  const dataFields = ((project.template && project.template.fields) || []).filter((field) => field.type === "DATOS");
  return dataFields.length === 1 ? tables : [];
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function chartPng(chart, outputPath) {
  const data = Array.isArray(chart && chart.data)
    ? chart.data.filter((item) => item && item.label && Number.isFinite(Number(item.value))).slice(0, 15)
    : [];
  if (data.length < 2) return "";

  const width = 960;
  const rowHeight = 48;
  const height = Math.max(260, 90 + data.length * rowHeight);
  const max = Math.max(...data.map((item) => Math.abs(Number(item.value)))) || 1;
  const bars = data.map((item, index) => {
    const y = 70 + index * rowHeight;
    const barWidth = Math.max(2, Math.round((Math.abs(Number(item.value)) / max) * 560));
    return `<text x="10" y="${y + 19}" font-family="Arial" font-size="15" fill="#334155">${escapeXml(String(item.label).slice(0, 32))}</text><rect x="300" y="${y}" width="${barWidth}" height="26" rx="4" fill="#0f766e"/><text x="${312 + barWidth}" y="${y + 19}" font-family="Arial" font-size="14" fill="#334155">${escapeXml(item.value)}</text>`;
  }).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/><text x="10" y="30" font-family="Arial" font-size="21" font-weight="700" fill="#0f172a">${escapeXml(chart.title || "Gráfico")}</text>${bars}</svg>`;

  const image = nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  if (image.isEmpty()) return "";
  fs.writeFileSync(outputPath, image.toPNG());
  return outputPath;
}

function matchingCharts(project, analysis, marker, dir) {
  const charts = (analysis && analysis.charts) || [];
  let selected = charts.filter((chart) => chart.markerName === marker.name);
  if (!selected.length) {
    const dataFields = ((project.template && project.template.fields) || []).filter((field) => field.type === "DATOS");
    if (dataFields.length === 1) selected = charts;
  }
  if (marker.type === "GRAFICO") selected = selected.slice(0, 1);

  return selected.map((chart, index) => {
    const file = path.join(dir, `grafico-${marker.name.toLowerCase()}-${index + 1}.png`);
    const rendered = chartPng(chart, file);
    return rendered ? { path: rendered, caption: chart.title || marker.label || "" } : null;
  }).filter(Boolean);
}

function matchingImages(project, marker) {
  const images = (project.attachments || []).filter((item) =>
    item.kind === "evidence" &&
    item.markerName === marker.name &&
    [".png", ".jpg", ".jpeg", ".webp"].includes(String(item.extension || "").toLowerCase())
  );
  const selected = marker.type === "IMAGEN" ? images.slice(0, 1) : images;
  return selected.map((item) => ({ path: item.localPath, caption: item.name }));
}

function buildBlocks(project, analysis, dir) {
  const blocks = [];

  ((project.template && project.template.markers) || [])
    .filter((marker) => marker.valid && marker.isBlock)
    .forEach((marker) => {
      const literal = `{{${marker.raw}}}`;

      if (["TABLA", "DATOS"].includes(marker.type)) {
        blocks.push({
          marker: literal,
          kind: "tables",
          tables: matchingTables(project, analysis, marker)
        });
        return;
      }

      if (["IMAGEN", "IMAGENES"].includes(marker.type)) {
        blocks.push({
          marker: literal,
          kind: "images",
          images: matchingImages(project, marker)
        });
        return;
      }

      if (["GRAFICO", "GRAFICOS"].includes(marker.type)) {
        blocks.push({
          marker: literal,
          kind: "images",
          images: matchingCharts(project, analysis, marker, dir)
        });
      }
    });

  return blocks;
}

function saveJob(dir, job) {
  const file = path.join(dir, "render-job.json");
  fs.writeFileSync(file, JSON.stringify(job, null, 2), "utf8");
  return file;
}

async function generateDocument(userDataPath, project, analysis, signers, appRoot, generationVersion) {
  if (!project.template || !project.template.localPath) {
    throw new Error("Este documento no tiene una plantilla Word asociada.");
  }

  const rootDir = generatedDir(userDataPath, project.id);
  const version = Number(generationVersion || 1);
  const dir = path.join(rootDir, `v${version}`);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const code = safeName(resolvedCode(project));
  const base = safeName(`${code}-${project.documentName}`);
  const filledDocx = path.join(dir, `${base}-contenido.docx`);
  const finalDocx = path.join(dir, `${base}.docx`);
  const pdfPath = path.join(dir, `${base}.pdf`);

  fillScalars(project.template.localPath, filledDocx, project, analysis || {}, signers || {});
  const blocks = buildBlocks(project, analysis || {}, dir);

  const job = {
    inputDocx: filledDocx,
    outputDocx: finalDocx,
    outputPdf: pdfPath,
    blocks
  };
  const jobPath = saveJob(dir, job);
  const scriptPath = path.join(appRoot, "scripts", "render-word.ps1");
  const result = await exportPdf({
    inputDocx: filledDocx,
    outputDocx: finalDocx,
    pdfPath,
    blocks,
    jobPath,
    scriptPath
  });

  return {
    code: resolvedCode(project),
    version,
    engine: result.engine,
    outputs: [
      { type: "pdf", label: "PDF final", path: result.pdfPath, primary: true },
      { type: "docx", label: "Word de respaldo", path: result.docxPath, primary: false }
    ]
  };
}

module.exports = {
  generateDocument,
  resolvedCode,
  systemValues
};
