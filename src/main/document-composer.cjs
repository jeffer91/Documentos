const fs = require("fs");
const path = require("path");
const { nativeImage } = require("electron");
const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} = require("docx");
const { generatedDir, safeName } = require("./workspace-service.cjs");
const { fillTemplate } = require("./template-service.cjs");

const RED = "D71920";
const GREEN = "0F766E";
const LIGHT = "F4F6F8";
const BORDER = { style: BorderStyle.SINGLE, size: 5, color: "AAB2BD" };
const borders = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER, insideHorizontal: BORDER, insideVertical: BORDER };

function text(value) { return String(value || "").trim(); }
function para(value, options) {
  const opts = options || {};
  return new Paragraph({
    alignment: opts.alignment || AlignmentType.JUSTIFIED,
    heading: opts.heading,
    spacing: opts.spacing || { after: 160, line: 300 },
    children: [new TextRun({ text: text(value), bold: Boolean(opts.bold), size: opts.size || 22, color: opts.color || "111827" })]
  });
}

function heading(value, level) {
  return new Paragraph({
    heading: level || HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text: text(value), bold: true, size: level === HeadingLevel.HEADING_2 ? 24 : 28, color: "111827" })]
  });
}

function splitParagraphs(value) {
  const raw = text(value);
  if (!raw) return [para("Información no registrada.", { color: "6B7280" })];
  return raw.split(/\n{2,}/).map((block) => para(block.replace(/\n/g, " ")));
}

function dateParts(project) {
  const raw = project.formData && project.formData.fecha ? String(project.formData.fecha) : "";
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const now = new Date();
  return match ? { year: match[1], month: match[2], day: match[3] } : {
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1).padStart(2, "0"),
    day: String(now.getDate()).padStart(2, "0")
  };
}

function resolvedCode(project) {
  const parts = dateParts(project);
  return text(project.codePattern || "DOCUMENTO")
    .replace(/AÑO/g, parts.year)
    .replace(/20XX/g, parts.year)
    .replace(/MES/g, parts.month)
    .replace(/0X/g, "01")
    .replace(/XX/g, "01");
}

function headerTable(project) {
  const code = resolvedCode(project);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders,
    rows: [
      new TableRow({ children: [
        new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ITSQMET", bold: true, size: 22 })] })] }),
        new TableCell({ width: { size: 47, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: project.unitName || "Unidad", color: RED, size: 18, bold: true })] })] }),
        new TableCell({ width: { size: 28, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "Código: ", size: 16 }), new TextRun({ text: code, size: 16, bold: true, color: RED })] })] })
      ] }),
      new TableRow({ children: [
        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Versión: 1.0", size: 15 })] })] }),
        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: project.documentName || "Documento", size: 16, bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Página ", size: 15 }), new TextRun({ children: [PageNumber.CURRENT], size: 15 }), new TextRun({ text: " de ", size: 15 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 15 })] })] })
      ] })
    ]
  });
}

function footer(project) {
  return new Footer({ children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: `${project.processCode || ""} · Documento generado localmente`, size: 14, color: "6B7280" })]
  })] });
}

function titlePage(project, signers) {
  const data = signers || {};
  const people = [
    ["ELABORADO POR", data.elaboradoPor],
    ["REVISADO POR", data.revisadoPor],
    ["APROBADO POR", data.aprobadoPor]
  ];
  const signerRows = people.map(([label, person]) => new TableCell({
    width: { size: 33.33, type: WidthType.PERCENTAGE },
    borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, shading: { type: ShadingType.CLEAR, fill: LIGHT }, children: [new TextRun({ text: label, size: 16, bold: true })] }),
      new Paragraph({ spacing: { before: 600, after: 160 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "________________________", size: 16 })] }),
      new Paragraph({ children: [new TextRun({ text: `NOMBRE: ${person && person.nombre ? person.nombre : ""}`, size: 14 })] }),
      new Paragraph({ children: [new TextRun({ text: `CARGO: ${person && person.cargo ? person.cargo : ""}`, size: 14 })] })
    ]
  }));

  return [
    new Paragraph({ spacing: { before: 2300, after: 180 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: project.documentType || "DOCUMENTO", bold: true, color: RED, size: 28 })] }),
    new Paragraph({ spacing: { before: 100, after: 2300 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: (project.documentName || "DOCUMENTO").toUpperCase(), bold: true, size: 42 })] }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: signerRows })], borders }),
    new Paragraph({ children: [new PageBreak()] })
  ];
}

function wordTable(tableData) {
  const headers = Array.isArray(tableData.headers) ? tableData.headers.slice(0, 8) : [];
  const rows = Array.isArray(tableData.rows) ? tableData.rows.slice(0, 40) : [];
  if (!headers.length) return null;
  const width = 100 / headers.length;
  const headerRow = new TableRow({ children: headers.map((value) => new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: "E8F5F2" },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: text(value), bold: true, size: 16, color: GREEN })] })]
  })) });
  const bodyRows = rows.map((row) => new TableRow({ children: headers.map((_header, index) => new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    children: [new Paragraph({ children: [new TextRun({ text: text(Array.isArray(row) ? row[index] : ""), size: 15 })] })]
  })) }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow].concat(bodyRows), borders });
}

function escapeXml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function chartPng(chart) {
  const data = Array.isArray(chart.data) ? chart.data.filter((item) => item && item.label && Number.isFinite(Number(item.value))).slice(0, 12) : [];
  if (data.length < 2) return null;
  const width = 900;
  const rowH = 52;
  const height = 90 + data.length * rowH;
  const max = Math.max(...data.map((item) => Math.abs(Number(item.value)))) || 1;
  const bars = data.map((item, index) => {
    const y = 70 + index * rowH;
    const w = Math.max(2, Math.round((Math.abs(Number(item.value)) / max) * 520));
    return `<text x="8" y="${y + 20}" font-family="Arial" font-size="16" fill="#334155">${escapeXml(String(item.label).slice(0, 28))}</text><rect x="260" y="${y}" width="${w}" height="28" rx="5" fill="#0f766e"/><text x="${275 + w}" y="${y + 20}" font-family="Arial" font-size="15" fill="#334155">${escapeXml(item.value)}</text>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/><text x="8" y="30" font-family="Arial" font-size="22" font-weight="700" fill="#0f172a">${escapeXml(chart.title || "Gráfico")}</text>${bars}</svg>`;
  try {
    const image = nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    return image.isEmpty() ? null : image.toPNG();
  } catch (_error) {
    return null;
  }
}

function evidenceRuns(attachments) {
  const result = [];
  const images = (attachments || []).filter((item) => item.kind === "evidence" && [".png", ".jpg", ".jpeg", ".webp"].includes(String(item.extension).toLowerCase()));
  images.slice(0, 20).forEach((item, index) => {
    try {
      const image = nativeImage.createFromPath(item.localPath);
      if (image.isEmpty()) return;
      const size = image.getSize();
      const maxW = 520;
      const ratio = size.width ? Math.min(1, maxW / size.width) : 1;
      const png = image.toPNG();
      result.push(new Paragraph({ spacing: { before: 180, after: 80 }, alignment: AlignmentType.CENTER, children: [new ImageRun({ data: png, type: "png", transformation: { width: Math.max(120, Math.round(size.width * ratio)), height: Math.max(80, Math.round(size.height * ratio)) } })] }));
      result.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: `Figura ${index + 1}. ${item.name}`, italics: true, size: 16, color: "475569" })] }));
    } catch (_error) { /* evidencia no compatible */ }
  });
  return result;
}

function templateValues(project, analysis) {
  const values = {
    UNIDAD: project.unitName,
    PROCESO: project.processName,
    CODIGO_PROCESO: project.processCode,
    CODIGO: resolvedCode(project),
    TITULO: project.documentName,
    DOCUMENTO: project.documentName,
    PERIODO: project.formData && project.formData.periodo,
    FECHA: project.formData && project.formData.fecha,
    RESUMEN_EJECUTIVO: analysis.executiveSummary,
    HALLAZGOS: (analysis.keyFindings || []).join("\n"),
    DATOS_FALTANTES: (analysis.missingData || []).join("\n")
  };
  Object.entries(project.formData || {}).forEach(([key, value]) => { values[String(key).toUpperCase()] = value; });
  (analysis.sections || []).forEach((section) => {
    const key = String(section.title || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
    values[key] = section.content;
  });
  values.TABLAS = (analysis.tables || []).map((table) => `${table.title}\n${(table.headers || []).join("\t")}\n${(table.rows || []).map((row) => row.join("\t")).join("\n")}`).join("\n\n");
  values.GRAFICOS = (analysis.charts || []).map((chart) => chart.title).join("\n");
  return values;
}

async function composeRichDocument(project, analysis, signers, outputPath) {
  const children = [];
  children.push(...titlePage(project, signers));
  children.push(heading("Contenido", HeadingLevel.HEADING_1));
  (project.structure || []).forEach((title, index) => children.push(para(`${index + 1}. ${title}`, { alignment: AlignmentType.LEFT })));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  (analysis.sections || []).forEach((section, index) => {
    children.push(heading(`${index + 1}. ${section.title}`, HeadingLevel.HEADING_1));
    children.push(...splitParagraphs(section.content));
  });

  if ((analysis.tables || []).length) {
    children.push(heading("Tablas de resultados", HeadingLevel.HEADING_1));
    (analysis.tables || []).slice(0, 8).forEach((tableData, index) => {
      children.push(para(`Tabla ${index + 1}. ${tableData.title || "Resultados"}`, { bold: true, alignment: AlignmentType.LEFT, size: 18 }));
      const table = wordTable(tableData);
      if (table) children.push(table);
      children.push(para("", { size: 8 }));
    });
  }

  const validCharts = (analysis.charts || []).map((chart) => ({ chart, png: chartPng(chart) })).filter((item) => item.png);
  if (validCharts.length) {
    children.push(heading("Gráficos", HeadingLevel.HEADING_1));
    validCharts.forEach((item, index) => {
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 70 }, children: [new ImageRun({ data: item.png, type: "png", transformation: { width: 560, height: 360 } })] }));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 150 }, children: [new TextRun({ text: `Figura ${index + 1}. ${item.chart.title || "Resultados"}`, italics: true, size: 16 })] }));
    });
  }

  const evidence = evidenceRuns(project.attachments);
  if (evidence.length) {
    children.push(heading("Anexos y evidencias", HeadingLevel.HEADING_1));
    children.push(...evidence);
  }

  if ((analysis.sourceTrace || []).length) {
    children.push(heading("Trazabilidad de fuentes", HeadingLevel.HEADING_1));
    (analysis.sourceTrace || []).slice(0, 30).forEach((item) => children.push(para(`• ${item.source || "Fuente"}: ${item.use || "Información utilizada"}`, { alignment: AlignmentType.LEFT, size: 17 })));
  }

  const doc = new Document({
    creator: "Documentos ITSQMET",
    title: project.documentName,
    description: `${project.unitName} · ${project.processName}`,
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", bold: true, size: 28, color: "111827" }, paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", bold: true, size: 24, color: "111827" }, paragraph: { spacing: { before: 220, after: 120 }, outlineLevel: 1 } }
      ]
    },
    sections: [{
      properties: { page: { margin: { top: 1250, right: 900, bottom: 900, left: 900 } } },
      headers: { default: new Header({ children: [headerTable(project)] }) },
      footers: { default: footer(project) },
      children
    }]
  });
  fs.writeFileSync(outputPath, await Packer.toBuffer(doc));
  return outputPath;
}

async function generateDocument(userDataPath, project, analysis, signers) {
  const dir = generatedDir(userDataPath, project.id);
  const code = safeName(resolvedCode(project));
  const richPath = path.join(dir, `${code}-${safeName(project.documentName)}.docx`);
  await composeRichDocument(project, analysis, signers, richPath);
  const outputs = [{ type: "rich", label: "Documento completo", path: richPath }];

  if (project.template && project.template.localPath && Array.isArray(project.template.tokens) && project.template.tokens.length) {
    try {
      const exactPath = path.join(dir, `${code}-plantilla.docx`);
      fillTemplate(project.template.localPath, templateValues(project, analysis), exactPath);
      outputs.push({ type: "template", label: "Plantilla llenada", path: exactPath });
    } catch (error) {
      outputs.push({ type: "warning", label: "La plantilla no pudo completarse", error: error.message || String(error) });
    }
  }
  return { code: resolvedCode(project), outputs };
}

module.exports = {
  generateDocument,
  resolvedCode
};
