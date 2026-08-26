const { runtimeProviders } = require("./ai-provider-service.cjs");

function safeJsonParse(value) {
  if (!value) return null;
  const text = String(value).trim()
    .replace(/^\`\`\`json\s*/i, "")
    .replace(/^\`\`\`\s*/i, "")
    .replace(/\`\`\`$/i, "")
    .trim();
  try { return JSON.parse(text); } catch (_error) { return null; }
}

function normalizeAnalysis(input, project, sourceBundle, providerName) {
  const data = input && typeof input === "object" ? input : {};
  const sectionTitles = Array.isArray(project.structure) ? project.structure : [];
  const rawSections = Array.isArray(data.sections) ? data.sections : [];
  const sections = sectionTitles.map((title) => {
    const found = rawSections.find((section) => String(section.title || "").toLowerCase() === String(title).toLowerCase());
    return { title, content: found && found.content ? String(found.content) : "" };
  });
  return {
    provider: providerName || data.provider || "Local",
    generatedAt: new Date().toISOString(),
    executiveSummary: String(data.executiveSummary || ""),
    keyFindings: Array.isArray(data.keyFindings) ? data.keyFindings.map(String).filter(Boolean).slice(0, 12) : [],
    missingData: Array.isArray(data.missingData) ? data.missingData.map(String).filter(Boolean).slice(0, 12) : [],
    sections,
    tables: Array.isArray(data.tables) && data.tables.length ? data.tables.slice(0, 8) : (sourceBundle.tables || []).slice(0, 8),
    charts: Array.isArray(data.charts) && data.charts.length ? data.charts.slice(0, 6) : (sourceBundle.charts || []).slice(0, 6),
    sourceTrace: Array.isArray(data.sourceTrace) ? data.sourceTrace.slice(0, 30) : [],
    notes: String(data.notes || "")
  };
}

function fieldText(project) {
  return Object.entries(project.formData || {})
    .filter(([, value]) => String(value || "").trim())
    .map(([key, value]) => `${key}: ${String(value).trim()}`)
    .join("\n");
}

function localAnalysis(project, sourceBundle) {
  const form = project.formData || {};
  const notes = fieldText(project);
  const sourceNames = (sourceBundle.extracted || []).map((item) => item.name).filter(Boolean);
  const spreadsheetRows = (sourceBundle.dataSummary || []).reduce((total, item) => total + (item.sheets || []).reduce((sum, sheet) => sum + Number(sheet.rowCount || 0), 0), 0);
  const findings = [];
  if (form.resultados) findings.push(String(form.resultados).trim());
  if (form.necesidades) findings.push(String(form.necesidades).trim());
  if (form.priorizacion) findings.push(String(form.priorizacion).trim());
  if (spreadsheetRows) findings.push(`Se analizaron ${spreadsheetRows} registros provenientes de archivos de datos.`);
  if (sourceNames.length) findings.push(`Se consideraron ${sourceNames.length} archivos de soporte.`);

  const missing = [];
  if (!Object.values(form).some((value) => String(value || "").trim())) missing.push("Falta información básica del documento.");
  if (!sourceNames.length && project.mode !== "upload") missing.push("No se adjuntaron fuentes de respaldo; el contenido se limitará a lo escrito en la app.");

  const sections = (project.structure || []).map((title) => {
    const lower = title.toLowerCase();
    let content = "";
    if (lower.includes("objetivo")) content = form.objetivo || form.tema || "";
    else if (lower.includes("metodolog")) content = form.metodologia || form.contexto || "";
    else if (lower.includes("resultado")) content = form.resultados || form.necesidades || form.contexto || "";
    else if (lower.includes("cronograma")) content = form.cronograma || "";
    else if (lower.includes("responsable")) content = form.responsables || form.capacitador || "";
    else if (lower.includes("particip")) content = form.participantes || form.poblacion || "";
    else if (lower.includes("conclus")) content = findings.length ? `Los principales hallazgos registrados fueron: ${findings.join(" ")}` : "";
    else if (lower.includes("recomend")) content = form.observaciones || "";
    else if (lower.includes("resumen ejecutivo")) content = findings.join(" ");
    else content = form.contexto || notes;
    return { title, content: String(content || "").trim() };
  });

  return normalizeAnalysis({
    provider: "Local",
    executiveSummary: findings.join(" "),
    keyFindings: findings,
    missingData: missing,
    sections,
    tables: sourceBundle.tables,
    charts: sourceBundle.charts,
    sourceTrace: sourceNames.map((name) => ({ source: name, use: "Fuente adjunta" }))
  }, project, sourceBundle, "Local");
}

function promptFor(project, sourceBundle) {
  const sourceText = (sourceBundle.textSources || []).map((source) => `FUENTE: ${source.name}\n${String(source.text || "").slice(0, 12000)}`).join("\n\n");
  const dataText = JSON.stringify((sourceBundle.dataSummary || []).slice(0, 5)).slice(0, 25000);
  const expected = JSON.stringify({
    executiveSummary: "texto",
    keyFindings: ["hallazgo"],
    missingData: ["dato faltante"],
    sections: (project.structure || []).map((title) => ({ title, content: "texto amplio y verificable" })),
    tables: [{ title: "Tabla", headers: ["Columna"], rows: [["Dato"]] }],
    charts: [{ title: "Gráfico", type: "bar", data: [{ label: "A", value: 1 }] }],
    sourceTrace: [{ source: "archivo", use: "dato utilizado" }]
  });

  return `Eres un analista documental institucional. Redacta en español formal y claro.

DOCUMENTO: ${project.documentName}
UNIDAD: ${project.unitName}
PROCESO: ${project.processName} (${project.processCode})
CÓDIGO PATRÓN: ${project.codePattern}
ESTRUCTURA OBLIGATORIA: ${(project.structure || []).join(" | ")}

DATOS DEL USUARIO:
${fieldText(project) || "Sin datos adicionales."}

FUENTES:
${sourceText || "Sin texto extraído."}

DATOS TABULARES:
${dataText || "Sin datos tabulares."}

REGLAS:
- No inventes normas, artículos, cifras, nombres, fechas ni resultados.
- La base legal solo puede usar normativa visible en las fuentes o escrita por el usuario.
- Si falta algo, colócalo en missingData, no lo inventes.
- Usa tablas y gráficos solo cuando existan datos que los sustenten.
- Conclusiones y recomendaciones deben derivarse de los resultados.
- Respeta exactamente los títulos de la estructura obligatoria.
- Redacta secciones amplias, útiles y sin relleno repetitivo.
- Devuelve exclusivamente JSON válido con esta forma:
${expected}`;
}

async function callOpenAiCompatible(provider, prompt) {
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: "Responde únicamente con JSON válido." },
        { role: "user", content: prompt }
      ],
      temperature: 0.15
    })
  });
  if (!response.ok) throw new Error(`${provider.name}: HTTP ${response.status}`);
  const data = await response.json();
  return data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : "";
}

async function callAnthropic(provider, prompt) {
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": provider.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({ model: provider.model, max_tokens: 7000, temperature: 0.15, messages: [{ role: "user", content: prompt }] })
  });
  if (!response.ok) throw new Error(`${provider.name}: HTTP ${response.status}`);
  const data = await response.json();
  return Array.isArray(data.content) ? data.content.map((item) => item.text || "").join("\n") : "";
}

async function callGemini(provider, prompt) {
  const endpoint = provider.endpoint.replace("{model}", encodeURIComponent(provider.model));
  const joiner = endpoint.includes("?") ? "&" : "?";
  const response = await fetch(`${endpoint}${joiner}key=${encodeURIComponent(provider.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.15, responseMimeType: "application/json" } })
  });
  if (!response.ok) throw new Error(`${provider.name}: HTTP ${response.status}`);
  const data = await response.json();
  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content ? data.candidates[0].content.parts : [];
  return Array.isArray(parts) ? parts.map((item) => item.text || "").join("\n") : "";
}

async function callProvider(provider, prompt) {
  if (provider.kind === "anthropic") return callAnthropic(provider, prompt);
  if (provider.kind === "gemini") return callGemini(provider, prompt);
  return callOpenAiCompatible(provider, prompt);
}

function scoreAnalysis(analysis, project) {
  if (!analysis) return 0;
  let score = 0;
  const required = project.structure || [];
  score += analysis.sections.filter((section) => String(section.content || "").trim().length >= 80).length * 6;
  score += Math.min(analysis.keyFindings.length, 8) * 3;
  score += Math.min(analysis.tables.length, 5) * 2;
  score += Math.min(analysis.charts.length, 4) * 2;
  score += Math.min(String(analysis.executiveSummary || "").length / 150, 6);
  score -= Math.max(0, required.length - analysis.sections.length) * 5;
  return score;
}

function mergeAnalyses(analyses, project, sourceBundle) {
  const ranked = analyses.slice().sort((a, b) => scoreAnalysis(b, project) - scoreAnalysis(a, project));
  const best = ranked[0];
  const merged = JSON.parse(JSON.stringify(best));
  merged.provider = ranked.map((item) => item.provider).join(" + ");
  merged.keyFindings = Array.from(new Set(ranked.flatMap((item) => item.keyFindings || []))).slice(0, 12);
  merged.missingData = Array.from(new Set(ranked.flatMap((item) => item.missingData || []))).slice(0, 12);
  merged.sections = (project.structure || []).map((title) => {
    const options = ranked
      .map((item) => (item.sections || []).find((section) => section.title === title))
      .filter(Boolean)
      .sort((a, b) => String(b.content || "").length - String(a.content || "").length);
    return options[0] || { title, content: "" };
  });
  merged.tables = (sourceBundle.tables || []).length ? sourceBundle.tables.slice(0, 8) : best.tables;
  merged.charts = (sourceBundle.charts || []).length ? sourceBundle.charts.slice(0, 6) : best.charts;
  return normalizeAnalysis(merged, project, sourceBundle, merged.provider);
}

async function analyzeWithAi(userDataPath, project, sourceBundle, mode) {
  const providers = runtimeProviders(userDataPath);
  if (!providers.length) return localAnalysis(project, sourceBundle);
  const prompt = promptFor(project, sourceBundle);

  if (mode !== "deep") {
    for (const provider of providers) {
      try {
        const parsed = safeJsonParse(await callProvider(provider, prompt));
        if (parsed) return normalizeAnalysis(parsed, project, sourceBundle, provider.name);
      } catch (_error) {
        // Fallback automático al siguiente proveedor.
      }
    }
    return localAnalysis(project, sourceBundle);
  }

  const selected = providers.slice(0, 4);
  const settled = await Promise.allSettled(selected.map(async (provider) => {
    const parsed = safeJsonParse(await callProvider(provider, prompt));
    if (!parsed) throw new Error("Respuesta no estructurada");
    return normalizeAnalysis(parsed, project, sourceBundle, provider.name);
  }));
  const valid = settled.filter((item) => item.status === "fulfilled").map((item) => item.value);
  if (!valid.length) return localAnalysis(project, sourceBundle);
  if (valid.length === 1) return valid[0];
  return mergeAnalyses(valid, project, sourceBundle);
}

module.exports = {
  analyzeWithAi,
  localAnalysis,
  scoreAnalysis
};
