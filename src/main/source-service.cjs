const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const XLSX = require("xlsx");

function cleanText(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function stripXml(xml) {
  return String(xml || "")
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractDocx(filePath) {
  const zip = new PizZip(fs.readFileSync(filePath));
  const parts = Object.keys(zip.files)
    .filter((name) => /^word\/(document|header\d+|footer\d+)\.xml$/.test(name))
    .map((name) => stripXml(zip.file(name).asText()));
  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function summarizeRows(rows) {
  if (!rows.length) return { headers: [], rows: [], numeric: [] };
  const headers = Object.keys(rows[0]).slice(0, 30);
  const numeric = [];
  headers.forEach((header) => {
    const nums = rows.map((row) => Number(row[header])).filter(Number.isFinite);
    if (nums.length >= Math.max(2, Math.floor(rows.length * 0.5))) {
      numeric.push({
        column: header,
        count: nums.length,
        min: Math.min(...nums),
        max: Math.max(...nums),
        average: nums.reduce((a, b) => a + b, 0) / nums.length
      });
    }
  });
  return { headers, rows: rows.slice(0, 100), numeric };
}

function extractSpreadsheet(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  return workbook.SheetNames.slice(0, 10).map((name) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: "" });
    const summary = summarizeRows(rows);
    return {
      name,
      rowCount: rows.length,
      headers: summary.headers,
      sampleRows: summary.rows,
      calculationRows: rows,
      numeric: summary.numeric
    };
  });
}

async function extractPdf(filePath) {
  try {
    const pdfParse = require("pdf-parse");
    const result = await pdfParse(fs.readFileSync(filePath));
    return String(result.text || "").trim();
  } catch (_error) {
    return "";
  }
}

async function extractAttachment(attachment) {
  const ext = String(attachment.extension || path.extname(attachment.localPath || "")).toLowerCase();
  const base = {
    id: attachment.id,
    name: attachment.name,
    kind: attachment.kind,
    markerName: attachment.markerName || "",
    extension: ext
  };

  try {
    if (ext === ".docx") {
      return Object.assign(base, { type: "text", text: extractDocx(attachment.localPath).slice(0, 70000) });
    }
    if ([".xlsx", ".xls", ".csv"].includes(ext)) {
      return Object.assign(base, { type: "spreadsheet", sheets: extractSpreadsheet(attachment.localPath) });
    }
    if (ext === ".pdf") {
      const text = await extractPdf(attachment.localPath);
      return Object.assign(base, { type: "text", text: text.slice(0, 70000), extractionWarning: text ? "" : "No se pudo extraer texto del PDF." });
    }
    if ([".txt", ".md", ".json"].includes(ext)) {
      return Object.assign(base, { type: "text", text: fs.readFileSync(attachment.localPath, "utf8").slice(0, 70000) });
    }
    if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
      return Object.assign(base, { type: "image", localPath: attachment.localPath });
    }
    return Object.assign(base, { type: "file" });
  } catch (error) {
    return Object.assign(base, { type: "error", error: error.message || String(error) });
  }
}

function tableCandidates(extracted) {
  const tables = [];
  const charts = [];
  const warnings = [];
  const MAX_WORD_ROWS = 1000;

  extracted.filter((item) => item.type === "spreadsheet").forEach((item) => {
    (item.sheets || []).forEach((sheet) => {
      const sourceRows = Array.isArray(sheet.calculationRows) && sheet.calculationRows.length
        ? sheet.calculationRows
        : sheet.sampleRows || [];
      if (!sheet.headers.length || !sourceRows.length) return;
      const headers = sheet.headers.slice(0, 10);
      const rowsForWord = sourceRows.slice(0, MAX_WORD_ROWS);
      tables.push({
        markerName: item.markerName || "",
        source: item.name,
        title: `${item.name} · ${sheet.name}`,
        headers,
        rows: rowsForWord.map((row) => headers.map((header) => cleanText(row[header])))
      });

      if (sourceRows.length > MAX_WORD_ROWS) {
        warnings.push(
          `${item.name} · ${sheet.name}: el archivo tiene ${sourceRows.length} filas; se insertarán las primeras ${MAX_WORD_ROWS} en el Word para evitar un documento excesivamente pesado.`
        );
      }

      const labelHeader = sheet.headers.find((header) => !sheet.numeric.some((n) => n.column === header));
      const numeric = sheet.numeric[0];
      if (labelHeader && numeric) {
        const data = sourceRows
          .map((row) => ({ label: cleanText(row[labelHeader]), value: Number(row[numeric.column]) }))
          .filter((row) => row.label && Number.isFinite(row.value))
          .slice(0, 15);
        if (data.length >= 2) {
          charts.push({
            markerName: item.markerName || "",
            source: item.name,
            title: `${numeric.column} por ${labelHeader}`,
            type: "bar",
            data
          });
        }
      }
    });
  });

  return { tables: tables.slice(0, 12), charts: charts.slice(0, 10), warnings };
}

async function analyzeAttachments(attachments) {
  const extracted = [];
  for (const attachment of attachments || []) extracted.push(await extractAttachment(attachment));

  const candidates = tableCandidates(extracted);
  const textSources = extracted.filter((item) => item.type === "text").map((item) => ({
    name: item.name,
    markerName: item.markerName,
    text: item.text,
    extractionWarning: item.extractionWarning || ""
  }));
  const dataSummary = extracted.filter((item) => item.type === "spreadsheet").map((item) => ({
    name: item.name,
    markerName: item.markerName,
    sheets: (item.sheets || []).map((sheet) => ({
      name: sheet.name,
      rowCount: sheet.rowCount,
      headers: sheet.headers,
      sampleRows: sheet.sampleRows,
      numeric: sheet.numeric
    }))
  }));

  const calculationData = extracted.filter((item) => item.type === "spreadsheet").map((item) => ({
    name: item.name,
    markerName: item.markerName,
    sheets: (item.sheets || []).map((sheet) => ({
      name: sheet.name,
      rows: sheet.calculationRows || []
    }))
  }));

  const extractionWarnings = extracted
    .filter((item) => item.extractionWarning || item.type === "error")
    .map((item) => item.extractionWarning
      ? `${item.name}: ${item.extractionWarning}`
      : `${item.name}: ${item.error || "No se pudo analizar el archivo."}`)
    .concat(candidates.warnings || []);

  return {
    extracted,
    textSources,
    dataSummary,
    calculationData,
    tables: candidates.tables,
    charts: candidates.charts,
    extractionWarnings
  };
}

module.exports = {
  analyzeAttachments,
  extractAttachment,
  extractDocx,
  extractSpreadsheet
};
