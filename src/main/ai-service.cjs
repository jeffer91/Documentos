const { runtimeProviders } = require("./ai-provider-service.cjs");

function safeJsonParse(value) {
  if (!value) return null;
  const text = String(value).trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try { return JSON.parse(text); } catch (_error) { return null; }
}

function scalarFields(project) {
  const fields = ((project.template && project.template.fields) || [])
    .filter((field) => ["CAMPO", "TEXTO", "FECHA", "NUMERO"].includes(field.type));
  return fields.map((field) => ({
    name: field.name,
    label: field.label,
    value: project.formData && project.formData[field.name] != null ? project.formData[field.name] : ""
  }));
}

function tableFields(project) {
  return ((project.template && project.template.fields) || [])
    .filter((field) => field.type === "TABLA")
    .map((field) => ({
      name: field.name,
      label: field.label,
      columns: field.columns || [],
      rows: Array.isArray(project.formData && project.formData[field.name]) ? project.formData[field.name] : []
    }));
}

function aiFields(project) {
  return ((project.template && project.template.aiFields) || []).filter((field) => field.valid);
}

function formText(project) {
  return scalarFields(project)
    .filter((item) => String(item.value || "").trim())
    .map((item) => `${item.label}: ${String(item.value).trim()}`)
    .join("\n");
}

function rowCount(sourceBundle) {
  return (sourceBundle.dataSummary || []).reduce(
    (total, source) => total + (source.sheets || []).reduce((sum, sheet) => sum + Number(sheet.rowCount || 0), 0),
    0
  );
}

function normalizeAnalysis(input, project, sourceBundle, providerName) {
  const data = input && typeof input === "object" ? input : {};
  const requested = aiFields(project);
  const incoming = data.generatedFields && typeof data.generatedFields === "object" ? data.generatedFields : {};
  const generatedFields = {};

  requested.forEach((field) => {
    generatedFields[field.name] = String(incoming[field.name] || incoming[field.name.toLowerCase()] || "").trim();
  });

  return {
    provider: providerName || data.provider || "Local",
    generatedAt: new Date().toISOString(),
    generatedFields,
    keyFindings: Array.isArray(data.keyFindings) ? data.keyFindings.map(String).filter(Boolean).slice(0, 12) : [],
    missingData: Array.isArray(data.missingData) ? data.missingData.map(String).filter(Boolean).slice(0, 12) : [],
    tables: (sourceBundle.tables || []).slice(0, 12),
    charts: (sourceBundle.charts || []).slice(0, 10),
    sourceTrace: Array.isArray(data.sourceTrace) ? data.sourceTrace.slice(0, 40) : [],
    notes: String(data.notes || "")
  };
}

function localField(field, project, sourceBundle) {
  const fields = scalarFields(project).filter((item) => String(item.value || "").trim());
  const userText = fields.map((item) => `${item.label}: ${item.value}`).join(". ");
  const rows = rowCount(sourceBundle);
  const sourceNames = (sourceBundle.extracted || []).map((item) => item.name).filter(Boolean);
  const name = field.name.toUpperCase();

  if (name.includes("BASE_LEGAL") || name.includes("NORMAT")) {
    return "";
  }
  if (name.includes("RESUMEN")) {
    return [userText, rows ? `Se analizaron ${rows} registros.` : "", sourceNames.length ? `Se consideraron ${sourceNames.length} fuentes de respaldo.` : ""]
      .filter(Boolean).join(" ");
  }
  if (name.includes("RESULT") || name.includes("ANALISIS") || name.includes("HALLAZ")) {
    return [userText, rows ? `Los archivos de datos contienen ${rows} registros para el análisis.` : ""].filter(Boolean).join(" ");
  }
  if (name.includes("CONCLUS")) {
    return userText ? `Con base en la información registrada, se concluye que ${userText.charAt(0).toLowerCase() + userText.slice(1)}.` : "";
  }
  if (name.includes("RECOMEND")) {
    return userText ? "Se recomienda dar seguimiento a los resultados registrados y documentar las acciones de mejora que correspondan." : "";
  }
  if (name.includes("INTRO") || name.includes("ANTECED")) {
    return userText
      ? `El presente documento corresponde a ${project.documentName}, dentro del proceso ${project.processName}. La información registrada para su elaboración comprende: ${userText}.`
      : "";
  }
  if (name.includes("METODO")) {
    return userText ? `La elaboración se realizó a partir de la información registrada por el usuario y de las fuentes adjuntas. ${userText}.` : "";
  }
  return userText;
}

function localAnalysis(project, sourceBundle) {
  const generatedFields = {};
  const missingData = [];
  aiFields(project).forEach((field) => {
    generatedFields[field.name] = localField(field, project, sourceBundle);
    if (field.required && !generatedFields[field.name]) {
      missingData.push(`Configura una IA o agrega información suficiente para completar ${field.label}.`);
    }
  });

  const findings = [];
  const rows = rowCount(sourceBundle);
  if (rows) findings.push(`Se identificaron ${rows} registros en los archivos de datos.`);
  if ((sourceBundle.textSources || []).length) findings.push(`Se analizaron ${sourceBundle.textSources.length} fuentes documentales.`);

  return normalizeAnalysis({
    generatedFields,
    keyFindings: findings,
    missingData,
    sourceTrace: (sourceBundle.extracted || []).map((item) => ({ source: item.name, use: item.kind || "Fuente" }))
  }, project, sourceBundle, "Local");
}

function promptFor(project, sourceBundle) {
  const requested = aiFields(project).map((field) => ({
    name: field.name,
    label: field.label,
    required: field.required
  }));

  const sources = (sourceBundle.textSources || [])
    .map((source) => `FUENTE: ${source.name}\n${String(source.text || "").slice(0, 14000)}`)
    .join("\n\n");

  const data = JSON.stringify((sourceBundle.dataSummary || []).slice(0, 6)).slice(0, 30000);
  const manualTables = JSON.stringify(tableFields(project)).slice(0, 16000);

  const expected = {
    generatedFields: Object.fromEntries(requested.map((field) => [field.name, "texto"])),
    keyFindings: ["hallazgo verificable"],
    missingData: ["dato que hace falta"],
    sourceTrace: [{ source: "archivo", use: "información utilizada" }]
  };

  return `Eres un analista documental institucional. Tu tarea es completar SOLO los campos de IA solicitados por una plantilla Word.

DOCUMENTO: ${project.documentName}
UNIDAD: ${project.unitName}
PROCESO: ${project.processName} (${project.processCode})
CÓDIGO PATRÓN: ${project.codePattern}

CAMPOS DE IA SOLICITADOS:
${JSON.stringify(requested)}

DATOS INGRESADOS:
${formText(project) || "Sin texto ingresado."}

TABLAS INGRESADAS:
${manualTables || "Sin tablas manuales."}

FUENTES DOCUMENTALES:
${sources || "Sin fuentes documentales."}

DATOS DE EXCEL/CSV:
${data || "Sin archivos de datos."}

REGLAS OBLIGATORIAS:
- No inventes leyes, artículos, normas, cifras, nombres, fechas ni resultados.
- Un campo relacionado con base legal o normativa solo puede usar normas visibles en las fuentes o escritas por el usuario.
- Si la información no alcanza para un campo, déjalo vacío y explica la carencia en missingData.
- Conclusiones deben derivarse de resultados o hallazgos disponibles.
- Recomendaciones deben derivarse de hallazgos o conclusiones disponibles.
- Resúmenes deben condensar la información existente, no agregar hechos.
- Redacta de forma amplia cuando haya suficiente información, pero sin relleno repetitivo.
- No alteres números provenientes de archivos de datos.
- Devuelve exclusivamente JSON válido con esta forma:
${JSON.stringify(expected)}`;
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
      temperature: 0.1
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
    body: JSON.stringify({
      model: provider.model,
      max_tokens: 8000,
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }]
    })
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
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
    })
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
  const fields = aiFields(project);
  let score = 0;
  fields.forEach((field) => {
    const value = String(analysis.generatedFields && analysis.generatedFields[field.name] || "");
    if (value.trim()) score += field.required ? 12 : 7;
    score += Math.min(value.length / 300, 4);
  });
  score += Math.min((analysis.keyFindings || []).length, 8) * 2;
  score -= Math.min((analysis.missingData || []).length, 8);
  return score;
}

function mergeAnalyses(analyses, project, sourceBundle) {
  const ranked = analyses.slice().sort((a, b) => scoreAnalysis(b, project) - scoreAnalysis(a, project));
  const merged = normalizeAnalysis(ranked[0], project, sourceBundle, ranked.map((item) => item.provider).join(" + "));

  aiFields(project).forEach((field) => {
    const options = ranked
      .map((analysis) => String(analysis.generatedFields && analysis.generatedFields[field.name] || "").trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    merged.generatedFields[field.name] = options[0] || "";
  });

  merged.keyFindings = Array.from(new Set(ranked.flatMap((item) => item.keyFindings || []))).slice(0, 12);
  merged.missingData = Array.from(new Set(ranked.flatMap((item) => item.missingData || []))).slice(0, 12);
  merged.sourceTrace = ranked[0].sourceTrace || [];
  return merged;
}

async function analyzeWithAi(userDataPath, project, sourceBundle, mode) {
  if (!aiFields(project).length) {
    return normalizeAnalysis({ generatedFields: {}, keyFindings: [], missingData: [], sourceTrace: [] }, project, sourceBundle, "Sin IA requerida");
  }

  const providers = runtimeProviders(userDataPath);
  if (!providers.length) return localAnalysis(project, sourceBundle);
  const prompt = promptFor(project, sourceBundle);

  if (mode !== "deep") {
    for (const provider of providers) {
      try {
        const parsed = safeJsonParse(await callProvider(provider, prompt));
        if (parsed) return normalizeAnalysis(parsed, project, sourceBundle, provider.name);
      } catch (_error) {
        // Fallback al siguiente proveedor.
      }
    }
    return localAnalysis(project, sourceBundle);
  }

  const settled = await Promise.allSettled(providers.slice(0, 4).map(async (provider) => {
    const parsed = safeJsonParse(await callProvider(provider, prompt));
    if (!parsed) throw new Error("Respuesta no estructurada.");
    return normalizeAnalysis(parsed, project, sourceBundle, provider.name);
  }));

  const valid = settled.filter((item) => item.status === "fulfilled").map((item) => item.value);
  if (!valid.length) return localAnalysis(project, sourceBundle);
  return valid.length === 1 ? valid[0] : mergeAnalyses(valid, project, sourceBundle);
}

module.exports = {
  analyzeWithAi,
  localAnalysis,
  scoreAnalysis
};
