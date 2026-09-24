const fs = require("fs");

const TOOL_VERSION = "1.0.0";
const TOOLS = Object.freeze({
  ishikawa: { label: "Ishikawa", category: "qualitative", version: TOOL_VERSION },
  foda: { label: "FODA", category: "strategic", version: TOOL_VERSION },
  came: { label: "CAME", category: "strategic", version: TOOL_VERSION },
  impact_matrix: { label: "Matriz impacto/esfuerzo", category: "prioritization", version: TOOL_VERSION },
  problem_tree: { label: "Árbol de problemas", category: "qualitative", version: TOOL_VERSION },
  objective_tree: { label: "Árbol de objetivos", category: "qualitative", version: TOOL_VERSION },
  stakeholders: { label: "Mapa de actores", category: "qualitative", version: TOOL_VERSION },
  gap_analysis: { label: "Análisis de brechas", category: "qualitative", version: TOOL_VERSION },
  process_flow: { label: "Flujo de proceso", category: "process", version: TOOL_VERSION },
  pestel: { label: "PESTEL", category: "strategic", version: TOOL_VERSION },
  cards: { label: "Tarjetas informativas", category: "explanatory", version: TOOL_VERSION },
  bar: { label: "Gráfico de barras", category: "quantitative", version: TOOL_VERSION },
  line: { label: "Gráfico de líneas", category: "quantitative", version: TOOL_VERSION }
});

const P = {
  ink: "#172033",
  muted: "#64748b",
  line: "#cbd5e1",
  soft: "#f8fafc",
  panel: "#ffffff",
  accent: "#0f766e",
  accentSoft: "#ccfbf1",
  warm: "#b45309",
  warmSoft: "#fef3c7",
  red: "#b91c1c",
  redSoft: "#fee2e2",
  blue: "#1d4ed8",
  blueSoft: "#dbeafe",
  violet: "#6d28d9",
  violetSoft: "#ede9fe"
};

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function textLines(value, width) {
  const words = String(value == null ? "" : value).trim().split(/\s+/).filter(Boolean);
  const limit = Math.max(8, Number(width || 30));
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > limit && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines.slice(0, 5);
}

function multiline(x, y, value, options) {
  const o = Object.assign({ size: 20, weight: 400, anchor: "start", fill: P.ink, width: 32, lineHeight: 1.2 }, options || {});
  return textLines(value, o.width).map((line, index) =>
    `<text x="${x}" y="${y + index * o.size * o.lineHeight}" font-family="Arial, sans-serif" font-size="${o.size}" font-weight="${o.weight}" text-anchor="${o.anchor}" fill="${o.fill}">${esc(line)}</text>`
  ).join("");
}

function svgShell(title, body, height) {
  const h = Math.max(500, Number(height || 760));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${h}" viewBox="0 0 1200 ${h}">
  <rect width="1200" height="${h}" fill="#ffffff"/>
  <rect x="0" y="0" width="1200" height="8" fill="${P.accent}"/>
  ${multiline(56, 62, title || "Visual", { size: 28, weight: 700, width: 70 })}
  <line x1="56" y1="92" x2="1144" y2="92" stroke="${P.line}" stroke-width="2"/>
  ${body}
  </svg>`;
}

function card(x, y, w, h, title, lines, fill, accent) {
  const items = arr(lines);
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${fill || P.soft}" stroke="${P.line}"/>
    <rect x="${x}" y="${y}" width="8" height="${h}" rx="4" fill="${accent || P.accent}"/>
    ${multiline(x + 28, y + 38, title, { size: 21, weight: 700, width: Math.max(18, Math.floor(w / 13)) })}
    ${items.slice(0, 6).map((item, index) => `
      <circle cx="${x + 31}" cy="${y + 86 + index * 34}" r="4" fill="${accent || P.accent}"/>
      ${multiline(x + 44, y + 93 + index * 34, item, { size: 16, width: Math.max(18, Math.floor(w / 11)) })}
    `).join("")}
  `;
}

function renderFoda(data) {
  const d = data || {};
  const body = [
    card(56, 130, 520, 245, "Fortalezas", d.strengths || d.fortalezas, P.accentSoft, P.accent),
    card(624, 130, 520, 245, "Oportunidades", d.opportunities || d.oportunidades, P.blueSoft, P.blue),
    card(56, 410, 520, 245, "Debilidades", d.weaknesses || d.debilidades, P.warmSoft, P.warm),
    card(624, 410, 520, 245, "Amenazas", d.threats || d.amenazas, P.redSoft, P.red)
  ].join("");
  return svgShell(d.title || "Análisis FODA", body, 710);
}

function renderCame(data) {
  const d = data || {};
  const body = [
    card(56, 130, 520, 245, "Corregir", d.correct || d.corregir, P.warmSoft, P.warm),
    card(624, 130, 520, 245, "Afrontar", d.adapt || d.afrontar, P.redSoft, P.red),
    card(56, 410, 520, 245, "Mantener", d.maintain || d.mantener, P.accentSoft, P.accent),
    card(624, 410, 520, 245, "Explotar", d.exploit || d.explotar, P.blueSoft, P.blue)
  ].join("");
  return svgShell(d.title || "Matriz CAME", body, 710);
}

function renderIshikawa(data) {
  const d = data || {};
  const categories = arr(d.categories || d.categorias).slice(0, 8);
  const centerY = 420;
  const spineX1 = 110;
  const spineX2 = 995;
  let body = `
    <line x1="${spineX1}" y1="${centerY}" x2="${spineX2}" y2="${centerY}" stroke="${P.ink}" stroke-width="7"/>
    <polygon points="${spineX2},398 1050,420 ${spineX2},442" fill="${P.accent}"/>
    <rect x="930" y="340" width="215" height="110" rx="18" fill="${P.accentSoft}" stroke="${P.accent}" stroke-width="2"/>
    ${multiline(1038, 382, d.effect || d.efecto || d.problem || "Efecto / problema", { size: 19, weight: 700, anchor: "middle", width: 22 })}
  `;
  categories.forEach((category, index) => {
    const top = index % 2 === 0;
    const pairIndex = Math.floor(index / 2);
    const xBase = 230 + pairIndex * 190;
    const yTip = top ? 185 : 655;
    const yJoin = centerY;
    body += `<line x1="${xBase}" y1="${yJoin}" x2="${xBase - 95}" y2="${yTip}" stroke="${P.muted}" stroke-width="4"/>`;
    body += multiline(xBase - 100, top ? yTip - 24 : yTip + 38, category.name || category.category || `Categoría ${index + 1}`, {
      size: 18, weight: 700, anchor: "middle", width: 20, fill: P.accent
    });
    arr(category.causes || category.causas).slice(0, 4).forEach((cause, ci) => {
      const ratio = (ci + 1) / 5;
      const cx = xBase + (xBase - 95 - xBase) * ratio;
      const cy = yJoin + (yTip - yJoin) * ratio;
      const offset = top ? -70 : 70;
      body += `<line x1="${cx}" y1="${cy}" x2="${cx + 70}" y2="${cy + offset}" stroke="${P.line}" stroke-width="2"/>`;
      body += multiline(cx + 75, cy + offset + (top ? -4 : 18), cause, { size: 14, width: 22, fill: P.ink });
    });
  });
  return svgShell(d.title || "Diagrama de Ishikawa", body, 760);
}

function renderImpactMatrix(data) {
  const d = data || {};
  const items = arr(d.items);
  const x = 170, y = 150, w = 860, h = 500;
  let body = `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${P.soft}" stroke="${P.line}"/>
    <rect x="${x}" y="${y}" width="${w/2}" height="${h/2}" fill="${P.blueSoft}" opacity=".65"/>
    <rect x="${x+w/2}" y="${y}" width="${w/2}" height="${h/2}" fill="${P.accentSoft}" opacity=".7"/>
    <rect x="${x}" y="${y+h/2}" width="${w/2}" height="${h/2}" fill="#f1f5f9"/>
    <rect x="${x+w/2}" y="${y+h/2}" width="${w/2}" height="${h/2}" fill="${P.warmSoft}" opacity=".65"/>
    <line x1="${x+w/2}" y1="${y}" x2="${x+w/2}" y2="${y+h}" stroke="${P.muted}" stroke-width="2"/>
    <line x1="${x}" y1="${y+h/2}" x2="${x+w}" y2="${y+h/2}" stroke="${P.muted}" stroke-width="2"/>
    ${multiline(x + 20, y + 32, "Alto impacto / bajo esfuerzo", { size: 17, weight: 700, fill: P.blue, width: 30 })}
    ${multiline(x + w/2 + 20, y + 32, "Alto impacto / alto esfuerzo", { size: 17, weight: 700, fill: P.accent, width: 30 })}
    ${multiline(x + 20, y + h/2 + 32, "Bajo impacto / bajo esfuerzo", { size: 17, weight: 700, fill: P.muted, width: 30 })}
    ${multiline(x + w/2 + 20, y + h/2 + 32, "Bajo impacto / alto esfuerzo", { size: 17, weight: 700, fill: P.warm, width: 30 })}
    <text x="${x + w/2}" y="${y+h+52}" text-anchor="middle" font-family="Arial" font-size="17" fill="${P.muted}">Esfuerzo →</text>
    <text x="${x-75}" y="${y+h/2}" text-anchor="middle" font-family="Arial" font-size="17" fill="${P.muted}" transform="rotate(-90 ${x-75} ${y+h/2})">Impacto →</text>
  `;
  items.slice(0, 20).forEach((item, index) => {
    const effort = Math.max(0, Math.min(100, Number(item.effort ?? item.esfuerzo ?? 50)));
    const impact = Math.max(0, Math.min(100, Number(item.impact ?? item.impacto ?? 50)));
    const px = x + (effort / 100) * w;
    const py = y + h - (impact / 100) * h;
    body += `<circle cx="${px}" cy="${py}" r="10" fill="${P.accent}" stroke="#fff" stroke-width="3"/>`;
    body += multiline(px + 14, py + 5, item.label || item.name || `A${index + 1}`, { size: 13, width: 20 });
  });
  return svgShell(d.title || "Matriz de impacto y esfuerzo", body, 760);
}

function treeBox(x, y, w, h, label, fill, stroke) {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
    ${multiline(x + w/2, y + 34, label, { size: 17, weight: 700, anchor: "middle", width: Math.max(16, Math.floor(w/12)) })}
  `;
}

function renderTree(data, objective) {
  const d = data || {};
  const centerLabel = objective ? (d.objective || d.objetivo || "Objetivo central") : (d.problem || d.problema || "Problema central");
  const lower = arr(objective ? (d.means || d.medios) : (d.causes || d.causas)).slice(0, 5);
  const upper = arr(objective ? (d.ends || d.fines) : (d.effects || d.efectos)).slice(0, 5);
  const centerX = 400, centerY = 345, centerW = 400, centerH = 100;
  let body = treeBox(centerX, centerY, centerW, centerH, centerLabel, objective ? P.accentSoft : P.redSoft, objective ? P.accent : P.red);
  upper.forEach((item, index) => {
    const w = 190, gap = 20, total = upper.length * w + (upper.length - 1) * gap;
    const x = (1200 - total) / 2 + index * (w + gap);
    body += `<line x1="${centerX+centerW/2}" y1="${centerY}" x2="${x+w/2}" y2="230" stroke="${P.line}" stroke-width="3"/>`;
    body += treeBox(x, 145, w, 85, item, P.blueSoft, P.blue);
  });
  lower.forEach((item, index) => {
    const w = 190, gap = 20, total = lower.length * w + (lower.length - 1) * gap;
    const x = (1200 - total) / 2 + index * (w + gap);
    body += `<line x1="${centerX+centerW/2}" y1="${centerY+centerH}" x2="${x+w/2}" y2="545" stroke="${P.line}" stroke-width="3"/>`;
    body += treeBox(x, 545, w, 85, item, P.warmSoft, P.warm);
  });
  return svgShell(d.title || (objective ? "Árbol de objetivos" : "Árbol de problemas"), body, 700);
}

function renderStakeholders(data) {
  const d = data || {};
  const items = arr(d.items || d.actores);
  const x = 170, y = 150, w = 860, h = 500;
  let body = `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${P.soft}" stroke="${P.line}"/>
    <line x1="${x+w/2}" y1="${y}" x2="${x+w/2}" y2="${y+h}" stroke="${P.muted}" stroke-width="2"/>
    <line x1="${x}" y1="${y+h/2}" x2="${x+w}" y2="${y+h/2}" stroke="${P.muted}" stroke-width="2"/>
    ${multiline(x+20,y+34,"Mantener satisfechos",{size:17,weight:700,fill:P.blue})}
    ${multiline(x+w/2+20,y+34,"Gestionar de cerca",{size:17,weight:700,fill:P.accent})}
    ${multiline(x+20,y+h/2+34,"Monitorear",{size:17,weight:700,fill:P.muted})}
    ${multiline(x+w/2+20,y+h/2+34,"Mantener informados",{size:17,weight:700,fill:P.warm})}
    <text x="${x+w/2}" y="${y+h+52}" text-anchor="middle" font-family="Arial" font-size="17" fill="${P.muted}">Interés →</text>
    <text x="${x-75}" y="${y+h/2}" text-anchor="middle" font-family="Arial" font-size="17" fill="${P.muted}" transform="rotate(-90 ${x-75} ${y+h/2})">Poder →</text>
  `;
  items.slice(0, 20).forEach((item) => {
    const interest = Math.max(0, Math.min(100, Number(item.interest ?? item.interes ?? 50)));
    const power = Math.max(0, Math.min(100, Number(item.power ?? item.poder ?? 50)));
    const px = x + (interest / 100) * w;
    const py = y + h - (power / 100) * h;
    body += `<circle cx="${px}" cy="${py}" r="10" fill="${P.violet}" stroke="#fff" stroke-width="3"/>`;
    body += multiline(px + 14, py + 5, item.label || item.name || "Actor", { size: 13, width: 20 });
  });
  return svgShell(d.title || "Mapa de actores", body, 760);
}

function renderGap(data) {
  const d = data || {};
  const items = arr(d.items).slice(0, 8);
  let body = "";
  items.forEach((item, index) => {
    const y = 150 + index * 70;
    const current = Math.max(0, Math.min(100, Number(item.current ?? item.actual ?? 0)));
    const target = Math.max(0, Math.min(100, Number(item.target ?? item.objetivo ?? 100)));
    body += multiline(60, y + 18, item.label || item.name || `Indicador ${index+1}`, { size: 16, weight: 700, width: 22 });
    body += `<rect x="330" y="${y}" width="720" height="24" rx="12" fill="#e2e8f0"/>`;
    body += `<rect x="330" y="${y}" width="${720*current/100}" height="24" rx="12" fill="${P.warm}"/>`;
    body += `<line x1="${330+720*target/100}" y1="${y-8}" x2="${330+720*target/100}" y2="${y+32}" stroke="${P.accent}" stroke-width="4"/>`;
    body += `<text x="1070" y="${y+18}" font-family="Arial" font-size="14" fill="${P.muted}">Actual ${current}% · Meta ${target}%</text>`;
  });
  return svgShell(d.title || "Análisis de brechas", body, Math.max(600, 210 + items.length*70));
}

function renderFlow(data) {
  const d = data || {};
  const steps = arr(d.steps || d.pasos || d.nodes).slice(0, 10);
  const y = 260;
  const boxW = Math.max(130, Math.min(210, Math.floor(1000 / Math.max(1, steps.length))));
  const gap = 24;
  const total = steps.length * boxW + Math.max(0, steps.length - 1) * gap;
  const startX = Math.max(50, (1200 - total) / 2);
  let body = "";
  steps.forEach((step, index) => {
    const label = typeof step === "string" ? step : step.label || step.name || step.title || `Paso ${index+1}`;
    const x = startX + index * (boxW + gap);
    body += `<rect x="${x}" y="${y}" width="${boxW}" height="110" rx="18" fill="${index%2 ? P.blueSoft : P.accentSoft}" stroke="${index%2 ? P.blue : P.accent}" stroke-width="2"/>`;
    body += multiline(x + boxW/2, y + 43, label, { size: 16, weight: 700, anchor: "middle", width: Math.max(14, Math.floor(boxW/10)) });
    if (index < steps.length - 1) {
      const x1 = x + boxW + 4;
      const x2 = x + boxW + gap - 4;
      body += `<line x1="${x1}" y1="${y+55}" x2="${x2}" y2="${y+55}" stroke="${P.muted}" stroke-width="3"/><polygon points="${x2},${y+49} ${x2+10},${y+55} ${x2},${y+61}" fill="${P.muted}"/>`;
    }
  });
  return svgShell(d.title || "Flujo de proceso", body, 560);
}

function renderPestel(data) {
  const d = data || {};
  const cells = [
    ["Político", d.political || d.politico, P.redSoft, P.red],
    ["Económico", d.economic || d.economico, P.warmSoft, P.warm],
    ["Social", d.social, P.blueSoft, P.blue],
    ["Tecnológico", d.technological || d.tecnologico, P.accentSoft, P.accent],
    ["Ambiental", d.environmental || d.ambiental, "#dcfce7", "#15803d"],
    ["Legal", d.legal, P.violetSoft, P.violet]
  ];
  let body = "";
  cells.forEach(([label, items, fill, accent], index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    body += card(55 + col*375, 130 + row*280, 345, 245, label, items, fill, accent);
  });
  return svgShell(d.title || "Análisis PESTEL", body, 720);
}

function renderCards(data) {
  const d = data || {};
  const items = arr(d.items || d.cards || d.nucleos).slice(0, 8);
  const cols = items.length <= 4 ? items.length : 4;
  const cardW = Math.floor((1088 - (cols-1)*18) / Math.max(1, cols));
  let body = "";
  items.forEach((item, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = 56 + col*(cardW+18);
    const y = 140 + row*245;
    body += `
      <rect x="${x}" y="${y}" width="${cardW}" height="210" rx="20" fill="${index%2 ? P.blueSoft : P.accentSoft}" stroke="${index%2 ? P.blue : P.accent}" stroke-width="2"/>
      <circle cx="${x+45}" cy="${y+45}" r="26" fill="${index%2 ? P.blue : P.accent}"/>
      <text x="${x+45}" y="${y+53}" text-anchor="middle" font-family="Arial" font-size="20" font-weight="700" fill="#fff">${esc(item.number || index+1)}</text>
      ${multiline(x+82,y+43,item.title || item.label || `Elemento ${index+1}`,{size:19,weight:700,width:Math.max(16,Math.floor(cardW/11))})}
      ${item.value != null ? multiline(x+28,y+112,String(item.value),{size:34,weight:700,fill:P.ink,width:18}) : ""}
      ${multiline(x+28,item.value != null ? y+155 : y+105,item.subtitle || item.description || "",{size:15,fill:P.muted,width:Math.max(18,Math.floor(cardW/10))})}
    `;
  });
  return svgShell(d.title || "Resumen visual", body, 200 + Math.ceil(items.length/Math.max(1,cols))*245);
}

function renderBar(data) {
  const d = data || {};
  const items = arr(d.items || d.data).map((item) => ({
    label: item.label || item.name || "",
    value: Number(item.value ?? item.valor)
  })).filter((item) => item.label && Number.isFinite(item.value)).slice(0, 12);
  const max = Math.max(1, ...items.map((item) => Math.abs(item.value)));
  let body = "";
  items.forEach((item,index) => {
    const y = 145 + index*48;
    const bw = 650*Math.abs(item.value)/max;
    body += multiline(60,y+18,item.label,{size:15,width:24});
    body += `<rect x="330" y="${y}" width="${bw}" height="26" rx="6" fill="${P.accent}"/>`;
    body += `<text x="${342+bw}" y="${y+19}" font-family="Arial" font-size="14" fill="${P.ink}">${esc(item.value)}</text>`;
  });
  return svgShell(d.title || "Gráfico de barras", body, Math.max(560,210+items.length*48));
}

function renderLine(data) {
  const d = data || {};
  const items = arr(d.items || d.data).map((item) => ({
    label: item.label || item.name || "",
    value: Number(item.value ?? item.valor)
  })).filter((item) => item.label && Number.isFinite(item.value)).slice(0, 16);
  if (!items.length) return svgShell(d.title || "Gráfico de líneas", "", 560);
  const x=100,y=150,w=980,h=360;
  const values=items.map(i=>i.value);
  const min=Math.min(...values), max=Math.max(...values);
  const span=max-min || 1;
  const points=items.map((item,index)=>{
    const px=x+(index/(Math.max(1,items.length-1)))*w;
    const py=y+h-((item.value-min)/span)*h;
    return {px,py,item};
  });
  let body=`<line x1="${x}" y1="${y+h}" x2="${x+w}" y2="${y+h}" stroke="${P.line}" stroke-width="2"/><line x1="${x}" y1="${y}" x2="${x}" y2="${y+h}" stroke="${P.line}" stroke-width="2"/>`;
  body += `<polyline points="${points.map(p=>`${p.px},${p.py}`).join(" ")}" fill="none" stroke="${P.accent}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`;
  points.forEach((p,index)=>{
    body += `<circle cx="${p.px}" cy="${p.py}" r="7" fill="${P.accent}" stroke="#fff" stroke-width="3"/>`;
    body += `<text x="${p.px}" y="${y+h+28}" text-anchor="middle" font-family="Arial" font-size="12" fill="${P.muted}">${esc(String(p.item.label).slice(0,10))}</text>`;
    body += `<text x="${p.px}" y="${p.py-12}" text-anchor="middle" font-family="Arial" font-size="12" fill="${P.ink}">${esc(p.item.value)}</text>`;
  });
  return svgShell(d.title || "Gráfico de líneas", body, 620);
}

function renderSvg(tool, data, options) {
  const type = String(tool || "").toLowerCase();
  const payload = Object.assign({}, data || {}, options || {});
  if (!TOOLS[type]) throw new Error(`Herramienta visual no reconocida: ${type}`);
  if (type === "foda") return renderFoda(payload);
  if (type === "came") return renderCame(payload);
  if (type === "ishikawa") return renderIshikawa(payload);
  if (type === "impact_matrix") return renderImpactMatrix(payload);
  if (type === "problem_tree") return renderTree(payload, false);
  if (type === "objective_tree") return renderTree(payload, true);
  if (type === "stakeholders") return renderStakeholders(payload);
  if (type === "gap_analysis") return renderGap(payload);
  if (type === "process_flow") return renderFlow(payload);
  if (type === "pestel") return renderPestel(payload);
  if (type === "cards") return renderCards(payload);
  if (type === "bar") return renderBar(payload);
  if (type === "line") return renderLine(payload);
  throw new Error(`Herramienta visual sin renderer: ${type}`);
}

function savePng(tool, data, outputPath, options) {
  const { nativeImage } = require("electron");
  const svg = renderSvg(tool, data, options);
  const image = nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  if (image.isEmpty()) throw new Error(`No se pudo renderizar ${tool}.`);
  fs.writeFileSync(outputPath, image.toPNG());
  return outputPath;
}

function listTools() {
  return Object.entries(TOOLS).map(([id, meta]) => Object.assign({ id }, meta));
}

module.exports = {
  TOOL_VERSION,
  TOOLS,
  listTools,
  renderSvg,
  savePng
};
