/* =========================================================
Archivo: document-generator.cjs
Ruta: /src/main/document-generator.cjs
Funciones principales:
- Generar una portada institucional en Word.
- Crear tabla superior, título central y tabla inferior de firmas.
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

const RED = "D71920";
const BLACK = "000000";

function text(value) {
  return String(value || "").trim();
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

function border() {
  return {
    top: { style: BorderStyle.SINGLE, size: 4, color: BLACK },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: BLACK },
    left: { style: BorderStyle.SINGLE, size: 4, color: BLACK },
    right: { style: BorderStyle.SINGLE, size: 4, color: BLACK }
  };
}

function cell(children, width, options) {
  const opts = options || {};
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    borders: border(),
    margins: { top: 90, bottom: 90, left: 90, right: 90 },
    children: Array.isArray(children) ? children : [paragraph(String(children || ""), opts)]
  });
}

function getFechaLabel(typeKey) {
  if (typeKey === "ACT") return "Fecha de Reunión:";
  if (typeKey === "INSO") return "Fecha de socialización:";
  return "Fecha de Elaboración:";
}

function buildHeaderTable(data) {
  const fecha = text(data.date) || "día/mes/año";
  const unitName = text(data.unitName) || "Nombre de la coordinación/unidad o área";
  const code = text(data.code) || "XXXX";
  const version = text(data.version) || "1.0";
  const title = text(data.title) || "Documento de XXX";

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        height: { value: 850 },
        children: [
          cell([paragraph([run("ITSQMET", { bold: true, size: 28 })])], 28),
          cell([paragraph([run(unitName, { color: RED, size: 20 })])], 46),
          cell([
            paragraph([run("Código:", { size: 18 })]),
            paragraph([run(code, { color: RED, size: 18 })]),
            paragraph([run("Versión: " + version, { size: 18 })])
          ], 26)
        ]
      }),
      new TableRow({
        height: { value: 520 },
        children: [
          cell([
            paragraph([run(getFechaLabel(data.typeKey), { color: RED, size: 18 })]),
            paragraph([run(fecha, { color: RED, size: 18 })])
          ], 28),
          cell([paragraph([run(title, { bold: true, size: 19 })])], 46),
          cell([paragraph([run("Página 1 de 1", { size: 18 })])], 26)
        ]
      })
    ]
  });
}

function buildMainTitle(data) {
  const title = text(data.title) || "Documento de XXX";
  return paragraph([run(title, { bold: true, size: 46 })], {
    align: AlignmentType.CENTER,
    spacing: { before: 5200, after: 5000 }
  });
}

function signerHeader(label) {
  return cell([paragraph([run(label, { size: 22 })])], 33.33);
}

function signerBlank() {
  return cell([paragraph("")], 33.33);
}

function signerName(value) {
  return cell([paragraph([run("NOMBRE: ", { bold: true, size: 16 }), run(text(value), { bold: true, size: 16 })], { align: AlignmentType.LEFT })], 33.33);
}

function signerCargo(value) {
  return cell([paragraph([run("CARGO: ", { bold: true, size: 16 }), run(text(value), { bold: true, size: 16 })], { align: AlignmentType.LEFT })], 33.33);
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
      new TableRow({ height: { value: 1300 }, children: [signerBlank(), signerBlank(), signerBlank()] }),
      new TableRow({ children: [signerName(elaborado.nombre), signerName(revisado.nombre), signerName(aprobado.nombre)] }),
      new TableRow({ children: [signerCargo(elaborado.cargo), signerCargo(revisado.cargo), signerCargo(aprobado.cargo)] })
    ]
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
            margin: { top: 720, right: 720, bottom: 720, left: 720 }
          }
        },
        children: [
          buildHeaderTable(data),
          buildMainTitle(data),
          buildSignaturesTable(data)
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
