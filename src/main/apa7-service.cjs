const fs = require("fs");
const path = require("path");
const editorial = require("./editorial-structure-service.cjs");
const visuals = require("./visual-renderer-service.cjs");
const citationService = require("./citation-service.cjs");

const PROFILE = Object.freeze({
  name: "APA 7",
  fontFamily: "Arial",
  fontSizePt: 11,
  marginCm: 2.54,
  lineHeight: 2,
  firstLineIndentCm: 1.27,
  referenceHangingIndentCm: 1.27,
  tableFontSizePt: 10
});

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileUrl(filePath) {
  const normalized = path.resolve(filePath).replace(/\\/g, "/");
  return encodeURI(`file:///${normalized.replace(/^\//, "")}`);
}

function paragraphs(text, citations) {
  const replaced = citationService.replaceCitationTokens(text, citations || []);
  const html = String(replaced.text || "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length > 1 && lines.every((line) => /^[-•*]\s+/.test(line))) {
        return `<ul class="apa-list">${lines.map((line) => `<li>${esc(line.replace(/^[-•*]\s+/, ""))}</li>`).join("")}</ul>`;
      }
      return `<p class="apa-paragraph">${esc(block).replace(/\n/g, "<br>")}</p>`;
    }).join("\n");
  return { html, missing: replaced.missing };
}

function blockNumberMaps(instance) {
  let table = 0;
  let figure = 0;
  const tables = new Map();
  const figures = new Map();
  (instance.sections || []).forEach((section) => {
    (section.blocks || []).forEach((block) => {
      if (block.type === "table") {
        table += 1;
        tables.set(block.key, table);
      }
      if (["figure", "image", "visual"].includes(block.type)) {
        figure += 1;
        figures.set(block.key, figure);
      }
    });
  });
  return { tables, figures };
}

function headingHtml(section) {
  const actualLevel = Math.max(1, Number(section.level || 1));
  const semanticLevel = Math.max(1, Math.min(6, actualLevel));
  const styleLevel = Math.max(1, Math.min(5, actualLevel));
  const number = section.numbering ? `${section.numbering}. ` : "";
  const title = `${number}${section.title || ""}`;
  return `<h${semanticLevel} class="apa-heading level-${styleLevel}" data-actual-level="${actualLevel}">${esc(title)}</h${semanticLevel}>`;
}

function tableHtml(block, number, citations) {
  const headers = Array.isArray(block.data && block.data.headers) ? block.data.headers : [];
  const rows = Array.isArray(block.data && block.data.rows) ? block.data.rows : [];
  const note = paragraphs(block.note || "", citations);
  return {
    html: `
      <div class="apa-table-block" data-keep-together="true">
        <p class="apa-object-number">Tabla ${number}</p>
        <p class="apa-object-title">${esc(block.title || "Tabla")}</p>
        <table class="apa-table">
          <thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr></thead>
          <tbody>
            ${rows.map((row) => {
              const values = Array.isArray(row) ? row : headers.map((header) => row && row[header]);
              return `<tr>${headers.map((_header, index) => `<td>${esc(values[index])}</td>`).join("")}</tr>`;
            }).join("")}
          </tbody>
        </table>
        ${block.note ? `<div class="apa-note"><span>Nota.</span> ${note.html}</div>` : ""}
      </div>
    `,
    missing: note.missing
  };
}

function imageHtml(block, number, assetDir, citations) {
  let sourcePath = "";
  if (block.type === "visual") {
    const file = path.join(assetDir, `figura-${number}-${String(block.visualType || "visual").replace(/[^a-z0-9_-]+/gi, "-")}.png`);
    visuals.savePng(block.visualType, Object.assign({}, block.data || {}, { title: block.title || block.caption || "" }), file);
    sourcePath = file;
  } else {
    sourcePath = String(
      block.data && (block.data.path || block.data.localPath) ||
      block.path ||
      ""
    );
  }

  const note = paragraphs(block.note || "", citations);
  const img = sourcePath && fs.existsSync(sourcePath)
    ? `<img src="${fileUrl(sourcePath)}" alt="${esc(block.caption || block.title || "Figura")}" class="apa-figure-image">`
    : `<div class="apa-missing-figure">Figura pendiente de archivo</div>`;

  return {
    html: `
      <div class="apa-figure-block" data-keep-together="true">
        <p class="apa-object-number">Figura ${number}</p>
        <p class="apa-object-title">${esc(block.title || block.caption || "Figura")}</p>
        ${img}
        ${block.note ? `<div class="apa-note"><span>Nota.</span> ${note.html}</div>` : ""}
      </div>
    `,
    missing: note.missing
  };
}

function listHtml(block) {
  const items = Array.isArray(block.data && block.data.items) ? block.data.items : [];
  return `<ul class="apa-list">${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
}

function referencesHtml(citations) {
  const rows = (citations || []).filter((item) => item.active !== false)
    .sort((a, b) => {
      const aa = String(a.corporateAuthor || a.author || "").toLowerCase();
      const bb = String(b.corporateAuthor || b.author || "").toLowerCase();
      return aa.localeCompare(bb) || String(a.year || "").localeCompare(String(b.year || ""));
    });
  if (!rows.length) return '<p class="apa-paragraph">No se registraron referencias para este documento.</p>';
  return rows.map((citation) =>
    `<p class="apa-reference">${esc(citationService.formatReference(citation))}</p>`
  ).join("\n");
}

function renderBlock(block, maps, assetDir, citations) {
  if (block.type === "prose" || block.type === "quote" || block.type === "callout") {
    return paragraphs(block.text, citations);
  }
  if (block.type === "list") return { html: listHtml(block), missing: [] };
  if (block.type === "table") return tableHtml(block, maps.tables.get(block.key) || 1, citations);
  if (["figure", "image", "visual"].includes(block.type)) {
    return imageHtml(block, maps.figures.get(block.key) || 1, assetDir, citations);
  }
  if (block.type === "reference_list") return { html: referencesHtml(citations), missing: [] };
  return paragraphs(block.text || "", citations);
}

function sectionHtml(section, maps, assetDir, citations, includeAlerts) {
  const blocks = editorial.normalizeBlocks(section.blocks || []);
  const missing = [];
  let body = "";
  if (blocks.length) {
    blocks.forEach((block) => {
      const rendered = renderBlock(block, maps, assetDir, citations);
      body += rendered.html;
      missing.push(...(rendered.missing || []));
    });
  } else if (section.key === "REFERENCIAS" || section.type === "references") {
    body = referencesHtml(citations);
  } else {
    const rendered = paragraphs(section.content || "", citations);
    body = rendered.html;
    missing.push(...rendered.missing);
  }

  const alerts = includeAlerts && Array.isArray(section.alerts) && section.alerts.length
    ? `<div class="draft-alerts"><b>Alertas del borrador</b>${section.alerts.map((alert) => `<p>${esc(alert.severity || "aviso")} · ${esc(alert.message || "")}</p>`).join("")}</div>`
    : "";

  return {
    html: `<section class="apa-section level-${Number(section.level || 1)}" data-level="${Number(section.level || 1)}">${headingHtml(section)}${alerts}${body}</section>`,
    missing: Array.from(new Set(missing))
  };
}

function css() {
  return `
    @page { margin: ${PROFILE.marginCm}cm; }
    html,body{background:#fff;color:#111;}
    body{font-family:${PROFILE.fontFamily},sans-serif;font-size:${PROFILE.fontSizePt}pt;line-height:${PROFILE.lineHeight};margin:${PROFILE.marginCm}cm;}
    .document-title{font-size:16pt;font-weight:700;text-align:center;margin:0 0 24pt;}
    .document-meta{font-size:9pt;line-height:1.25;color:#475569;margin:0 0 18pt;text-align:center;}
    .apa-section.level-1{page-break-before:always;break-before:page;}
    .apa-heading{font-family:${PROFILE.fontFamily},sans-serif;font-size:${PROFILE.fontSizePt}pt;line-height:2;margin:0;font-weight:700;page-break-after:avoid;break-after:avoid;orphans:2;widows:2;}
    .apa-heading.level-1{text-align:center;}
    .apa-heading.level-2{text-align:left;}
    .apa-heading.level-3{text-align:left;font-style:italic;}
    .apa-heading.level-4,.apa-heading.level-5{text-align:left;text-indent:${PROFILE.firstLineIndentCm}cm;}
    .apa-heading.level-5{font-style:italic;}
    .apa-paragraph{font-family:${PROFILE.fontFamily},sans-serif;font-size:${PROFILE.fontSizePt}pt;line-height:2;text-align:left;text-indent:${PROFILE.firstLineIndentCm}cm;margin:0;}
    .apa-list{font-size:${PROFILE.fontSizePt}pt;line-height:2;margin:0 0 0 ${PROFILE.firstLineIndentCm}cm;padding-left:${PROFILE.firstLineIndentCm}cm;}
    .apa-object-number{font-size:${PROFILE.fontSizePt}pt;font-weight:700;line-height:1.25;margin:12pt 0 0;page-break-after:avoid;break-after:avoid;}
    .apa-object-title{font-size:${PROFILE.fontSizePt}pt;font-style:italic;line-height:1.25;margin:0 0 6pt;page-break-after:avoid;break-after:avoid;}
    .apa-table-block{margin:12pt 0;}
    .apa-figure-block{margin:12pt 0;page-break-inside:avoid;break-inside:avoid;}
    .apa-table{border-collapse:collapse;width:100%;font-size:${PROFILE.tableFontSizePt}pt;line-height:1.25;margin:0;}
    .apa-table th{font-weight:700;text-align:left;border-top:1.5pt solid #111;border-bottom:1pt solid #111;padding:5pt 6pt;}
    .apa-table td{border:0;padding:5pt 6pt;vertical-align:top;orphans:2;widows:2;}
    .apa-table tbody tr:last-child td{border-bottom:1.5pt solid #111;}
    .apa-figure-image{display:block;max-width:100%;height:auto;margin:6pt auto;}
    .apa-missing-figure{border:1pt dashed #94a3b8;padding:30pt;text-align:center;color:#64748b;}
    .apa-note{font-size:10pt;line-height:1.5;margin:4pt 0 0;}
    .apa-note span{font-style:italic;}
    .apa-note .apa-paragraph{display:inline;font-size:10pt;line-height:1.5;text-indent:0;}
    .apa-reference{font-size:${PROFILE.fontSizePt}pt;line-height:2;margin:0;padding-left:${PROFILE.referenceHangingIndentCm}cm;text-indent:-${PROFILE.referenceHangingIndentCm}cm;}
    .draft-alerts{border:1px solid #d97706;background:#fffbeb;padding:8pt 10pt;margin:0 0 10pt;line-height:1.25;color:#78350f;}
    .draft-alerts p{margin:3pt 0;font-size:9pt;}
  `;
}

function buildDocumentHtml(instance, options) {
  const opts = options || {};
  const includeAlerts = opts.includeAlerts !== false && !opts.final;
  const citations = Array.isArray(opts.citations) ? opts.citations : [];
  const assetDir = opts.assetDir;
  if (!assetDir) throw new Error("Falta el directorio de recursos APA.");
  fs.mkdirSync(assetDir, { recursive: true });

  const wanted = Array.isArray(opts.sectionKeys) && opts.sectionKeys.length ? new Set(opts.sectionKeys) : null;
  const sections = (instance.sections || []).filter((section) => !wanted || wanted.has(section.key));
  const maps = blockNumberMaps(instance);
  const missingCitations = [];
  const content = sections.map((section) => {
    const rendered = sectionHtml(section, maps, assetDir, citations, includeAlerts);
    missingCitations.push(...rendered.missing);
    return rendered.html;
  }).join("\n");

  return {
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(instance.label)}</title><style>${css()}</style></head><body>
      <div class="document-title">${esc(instance.label)}</div>
      <div class="document-meta">Motor ${esc(instance.engineId)} · versión ${esc(instance.engineVersion)} · ${opts.final ? "VERSIÓN FINAL" : "BORRADOR"}</div>
      ${content}
    </body></html>`,
    missingCitations: Array.from(new Set(missingCitations))
  };
}

module.exports = {
  PROFILE,
  css,
  buildDocumentHtml,
  blockNumberMaps
};
