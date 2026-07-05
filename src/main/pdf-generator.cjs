/* =========================================================
Archivo: pdf-generator.cjs
Ruta: /src/main/pdf-generator.cjs
Funciones principales:
- Generar una portada institucional en PDF desde Electron.
- Usar una ventana oculta para imprimir HTML a PDF.
- Aplicar fecha editable y total de páginas.
========================================================= */

const fs = require("fs");
const { BrowserWindow } = require("electron");
const { getDocumentRule } = require("./document-rules.cjs");

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

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function signerBlock(title, signer) {
  return `
    <div class="signer">
      <div class="signer-title">${escapeHtml(title)}</div>
      <div class="signature-space"></div>
      <div class="signer-row"><b>NOMBRE:</b> ${escapeHtml(signer.nombre)}</div>
      <div class="signer-row"><b>CARGO:</b> ${escapeHtml(signer.cargo)}</div>
    </div>
  `;
}

function buildCoverHtml(data) {
  const rule = getDocumentRule(data.typeKey);
  const signers = data.signers || {};
  const elaborado = signers.elaboradoPor || {};
  const revisado = signers.revisadoPor || {};
  const aprobado = signers.aprobadoPor || {};

  const title = text(data.title) || "Documento de XXX";
  const typeLabel = text(data.typeLabel) || rule.label;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
  .page { min-height: 260mm; display: flex; flex-direction: column; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  td { border: 1px solid #000; text-align: center; vertical-align: middle; padding: 6px; }
  .logo { width: 28%; font-weight: bold; font-size: 15px; line-height: 1.15; }
  .logo small { display: block; font-size: 8px; font-weight: normal; margin-top: 3px; }
  .unit { width: 46%; color: #d71920; font-size: 11px; }
  .code { width: 26%; font-size: 10px; line-height: 1.35; }
  .red { color: #d71920; font-weight: bold; }
  .date { color: #d71920; font-size: 10px; }
  .doc-name { font-size: 10px; font-weight: bold; }
  .main-title { flex: 1; display: flex; align-items: center; justify-content: center; text-align: center; padding: 35mm 15mm; }
  .main-title h1 { margin: 0; font-size: 24px; line-height: 1.25; text-transform: uppercase; }
  .main-title .kind { color: #d71920; font-size: 15px; margin-bottom: 10px; font-weight: bold; }
  .signatures { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid #000; }
  .signer { border-right: 1px solid #000; min-height: 42mm; }
  .signer:last-child { border-right: none; }
  .signer-title { border-bottom: 1px solid #000; padding: 6px; text-align: center; font-size: 10px; background: #f2f2f2; }
  .signature-space { height: 23mm; border-bottom: 1px solid #000; }
  .signer-row { padding: 5px 6px; border-bottom: 1px solid #000; font-size: 8px; text-align: left; min-height: 8mm; }
  .signer-row:last-child { border-bottom: none; }
</style>
</head>
<body>
  <div class="page">
    <table>
      <tr style="height: 24mm;">
        <td class="logo">
          ITSQMET
          <small>INSTITUTO SUPERIOR TECNOLÓGICO<br />QUITO METROPOLITANO</small>
        </td>
        <td class="unit">${escapeHtml(data.unitName || "Nombre de la coordinación/unidad o área")}</td>
        <td class="code">
          Código:<br />
          <span class="red">${escapeHtml(data.code || "XXXX")}</span>
        </td>
      </tr>
      <tr style="height: 15mm;">
        <td class="date">${escapeHtml(rule.dateLabel)}<br />${escapeHtml(data.date || "día/mes/año")}</td>
        <td class="doc-name">${escapeHtml(title)}</td>
        <td class="code">Versión: ${escapeHtml(data.version || "1.0")}<br />${escapeHtml(pageText(data))}</td>
      </tr>
    </table>

    <div class="main-title">
      <div>
        <div class="kind">${escapeHtml(typeLabel.toUpperCase())}</div>
        <h1>${escapeHtml(title)}</h1>
      </div>
    </div>

    <div class="signatures">
      ${signerBlock("ELABORADO POR:", elaborado)}
      ${signerBlock("REVISADO POR:", revisado)}
      ${signerBlock("APROBADO POR:", aprobado)}
    </div>
  </div>
</body>
</html>`;
}

async function generateCoverPdf(data, outputPath) {
  const html = buildCoverHtml(data || {});
  const win = new BrowserWindow({
    show: false,
    width: 1240,
    height: 1754,
    webPreferences: {
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  try {
    await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
      margins: { marginType: "none" }
    });
    fs.writeFileSync(outputPath, pdfBuffer);
    return outputPath;
  } finally {
    if (!win.isDestroyed()) {
      win.close();
    }
  }
}

module.exports = {
  generateCoverPdf
};
