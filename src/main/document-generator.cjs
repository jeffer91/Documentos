/* =========================================================
Archivo: document-generator.cjs
Ruta: /src/main/document-generator.cjs
Funciones principales:
- Generar una portada institucional en Word.
- Crear tabla superior, título central y tabla inferior de firmas.
- Aplicar fecha editable y número total de páginas.
========================================================= */

const {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType
} = require("docx");

const fs = require("fs");
const { getDocumentRule, hasFormalCover } = require("./document-rules.cjs");

const RED = "D71920";
const BLACK = "000000";
const GRAY = "F2F2F2";

function text(value) {
  return String(value || "").trim();
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1) return fallback;
  return Math.floor(number);
}

function pageText(data) {
  return "Página 1 de " + positiveNumber(data.totalPages, 1);
}

function run(value, options) {
  const opts = options || {};
  return new TextRun({
    text: value,
    bold: Boolean(opts.bold),
    size: opts.size || 20,
    color: opts.color || BLACK
  });
}

function paragraph(children, options) {
  const opts = options || {};
  return new Paragraph({
    alignment: opts.align || AlignmentType.CENTER,
    spacing: opts.spacing || {},
    children: Array.isArray(children) ? children : [run(String(children || ""), opts)]
  });
}

function border(size) {
  return {
    top: { style: BorderStyle.SINGLE, size: size || 4, color: BLACK },
    bottom: { style: BorderStyle.SINGLE, size: size || 4, color: BLACK },
    left: { style: BorderStyle.SINGLE, size: size || 4, color: BLACK },
    right: { style: BorderStyle.SINGLE, size: size || 4, color: BLACK }
  };
}

function cell(children, width, options) {
  const opts = options || {};
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    borders: border(opts.borderSize),
    shading: opts.shading ? { fill: opts.shading } : undefined,
    margins: {
      top: opts.margin || 80,
      bottom: opts.margin || 80,
      left: opts.margin || 80,
      right: opts.margin || 80
    },
    children: Array.isArray(children) ? children : [paragraph(String(children || ""), opts)]
  });
}

function buildLogoCell() {
  return cell([
    paragraph([run("ITSQMET", { bold: true, size: 24 })]),
    paragraph([run("INSTITUTO SUPERIOR", { size: 13 })]),
    paragraph([run("TECNOLÓGICO", { size: 13 })]),
    paragraph([run("QUITO METROPOLITANO", { size: 11 })])
  ], 28, { margin: 50 });
}

function buildHeaderTable(data) {
  const rule = getDocumentRule(data.typeKey);
  const fecha = text(data.date) || "día/mes/año";
  const unitName = text(data.unitName) || "Nombre de la coordinación/unidad o área";
  const code = text(data.code) || "XXXX";
  const version = text(data.version) || "1.0";
  const title = text(data.title) || "Documento de XXX";

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        height: { value: 950 },
        children: [
          buildLogoCell(),
          cell([paragraph([run(unitName, { color: RED, size: 19 })])], 46),
          cell([
            paragraph([run("Código:", { size: 18 })]),
            paragraph([run(code, { color: RED, size: 18, bold: true })])
          ], 26)
        ]
      }),
      new TableRow({
        height: { value: 650 },
        children: [
          cell([
            paragraph([run(rule.dateLabel, { color: RED, size: 17 })]),
            paragraph([run(fecha, { color: RED, size: 17 })])
          ], 28),
          cell([paragraph([run(title, { bold: true, size: 18 })])], 46),
          cell([
            paragraph([run("Versión: " + version, { size: 18 })]),
            paragraph([run(pageText(data), { size: 18 })])
          ], 26)
        ]
      })
    ]
  });
}

function buildMainTitle(data) {
  const title = text(data.title) || "Documento de XXX";
  const typeLabel = text(data.typeLabel) || getDocumentRule(data.typeKey).label;

  return paragraph([
    run(typeLabel.toUpperCase(), { bold: true, size: 26, color: RED }),
    run("\n"),
    run(title.toUpperCase(), { bold: true, size: 40 })
  ], {
    align: AlignmentType.CENTER,
    spacing: { before: 4300, after: 4200 }
  });
}

function signerHeader(label) {
  return cell([paragraph([run(label, { size: 21 })])], 33.33, { shading: GRAY });
}

function signerBlank() {
  return cell([paragraph("")], 33.33, { margin: 60 });
}

function signerName(value) {
  return cell([paragraph([run("NOMBRE: ", { bold: true, size: 15 }), run(text(value), { bold: true, size: 15 })], { align: AlignmentType.LEFT })], 33.33, { margin: 45 });
}

function signerCargo(value) {
  return cell([paragraph([run("CARGO: ", { bold: true, size: 15 }), run(text(value), { bold: true, size: 15 })], { align: AlignmentType.LEFT })], 33.33, { margin: 45 });
}

function buildSignaturesTable(data) {
  const signers = data.signers || {};
  const elaborado = signers.elaboradoPor || {};
  const revisado = signers.revisadoPor || {};
  const aprobado = signers.aprobadoPor || {};

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [signerHeader("ELABORADO POR:"), signerHeader("REVISADO POR:"), signerHeader("APROBADO POR:")] }),
      new TableRow({ height: { value: 1450 }, children: [signerBlank(), signerBlank(), signerBlank()] }),
      new TableRow({ children: [signerName(elaborado.nombre), signerName(revisado.nombre), signerName(aprobado.nombre)] }),
      new TableRow({ children: [signerCargo(elaborado.cargo), signerCargo(revisado.cargo), signerCargo(aprobado.cargo)] })
    ]
  });
}

function buildNoticeParagraph(data) {
  if (hasFormalCover(data.typeKey)) {
    return paragraph("", { spacing: { before: 60, after: 60 } });
  }

  return paragraph([run("Formato administrativo generado desde el selector institucional.", { size: 18 })], {
    align: AlignmentType.CENTER,
    spacing: { before: 60, after: 60 }
  });
}

function buildCoverDocument(data) {
  return new Document({
    creator: "Documentos ITSQMET",
    title: text(data.title) || "Portada institucional",
    sections: [
      {
        properties: {
          page: {
            margin: { top: 700, right: 700, bottom: 700, left: 700 }
          }
        },
        children: [
          buildHeaderTable(data),
          buildMainTitle(data),
          buildSignaturesTable(data),
          buildNoticeParagraph(data)
        ]
      }
    ]
  });
}

async function generateCoverDocx(data, outputPath) {
  const doc = buildCoverDocument(data || {});
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

module.exports = {
  generateCoverDocx
};
