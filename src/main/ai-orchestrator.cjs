const hub = require("./process-hub-service.cjs");
const ingestion = require("./data-ingestion-service.cjs");
const providers = require("./ai-provider-service.cjs");
const registry = require("./document-engine-registry.cjs");

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseJsonObject(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/i);
  const source = fenced ? fenced[1].trim() : raw;
  try { return JSON.parse(source); } catch (_error) { /* continue */ }
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(source.slice(start, end + 1)); } catch (_error) { /* continue */ }
  }
  return { content: raw, alerts: [{ type: "format", severity: "warning", message: "La IA no devolvió JSON estructurado.", blocking: false }] };
}

function providerSets(userDataPath) {
  const all = providers.listProviders(userDataPath, false);
  const writers = all.filter((item) => item.role === "writer" || item.role === "both");
  const reviewers = all.filter((item) => item.role === "reviewer" || item.role === "both");
  return {
    writer: writers[0] || null,
    reviewers: reviewers.length ? reviewers : writers.slice(0, 1)
  };
}

function baseSystem(engine, section) {
  return [
    "Eres un motor de redacción documental institucional.",
    "Trabaja únicamente con los datos proporcionados.",
    "No inventes hechos. Si falta información, crea una alerta y redacta sin afirmar el dato ausente.",
    "Respeta privacidad institucional: en resultados agregados prefiere porcentajes y evita cantidades absolutas innecesarias.",
    "Nunca introduzcas conclusiones que no estén respaldadas por resultados.",
    "Devuelve SOLO JSON válido con las claves: content, alerts, claims.",
    "alerts es una lista de objetos {type,severity,message,blocking}.",
    "claims es una lista de objetos {text,sourceType,sourceKey,confidence}.",
    `Documento: ${engine.label}.`,
    `Sección: ${section.title}.`,
    "Reglas:",
    ...(engine.rules || []).map((rule) => `- ${rule}`)
  ].join("\n");
}

function compactMasterData(masterData) {
  return (masterData || []).map((item) => ({
    key: item.key,
    scopeType: item.scopeType,
    scopeKey: item.scopeKey,
    value: item.value,
    provenance: item.provenance,
    revision: item.revision
  }));
}

function sectionDataContext(userDataPath, instance, section) {
  const masterData = hub.listMasterData(userDataPath, instance.dossierId);
  const imports = ingestion.listImports(userDataPath, instance.dossierId).map((item) => ({
    id: item.id,
    sourceName: item.sourceName,
    scopeType: item.scopeType,
    scopeKey: item.scopeKey,
    profile: item.profile,
    sha256: item.sha256
  }));
  let filteredData = null;
  const query = section && section.data && section.data.query;
  if (query) filteredData = ingestion.aiSlice(userDataPath, instance.dossierId, query);
  return { masterData: compactMasterData(masterData), imports, filteredData };
}

function writerPrompt(instance, engine, section, context) {
  const prior = instance.sections
    .filter((item) => item.order < section.order && item.content)
    .slice(-4)
    .map((item) => ({ key: item.key, title: item.title, content: item.content.slice(0, 5000) }));
  return [
    "Redacta la sección solicitada.",
    "Usa puntos y subpuntos cuando mejore la claridad.",
    "Mantén coherencia con las secciones previas.",
    "Si un dato es simulado o inferido, NO lo presentes como verificado: inclúyelo en alerts.",
    "Contexto estructurado:",
    JSON.stringify({
      engine: { id: engine.engineId, version: engine.version, family: engine.family, population: engine.population },
      instance: { scopeType: instance.scopeType, scopeKey: instance.scopeKey },
      section: { key: section.key, title: section.title, type: section.type },
      masterData: context.masterData,
      imports: context.imports,
      filteredData: context.filteredData,
      previousSections: prior
    })
  ].join("\n\n");
}

function reviewerPrompt(engine, section, draft, context) {
  return [
    "Revisa el borrador de esta sección.",
    "Comprueba coherencia, trazabilidad, privacidad institucional, datos no sustentados, contradicciones y redacción.",
    "Si detectas problemas, corrige el texto en correctedContent.",
    "Devuelve SOLO JSON válido con: approved, issues, correctedContent, alerts.",
    JSON.stringify({
      engine: engine.engineId,
      section: section.key,
      draft,
      masterData: context.masterData,
      filteredData: context.filteredData
    })
  ].join("\n\n");
}

function createJob(db, instanceId, sectionKey, role, providerId, request) {
  const jobId = id("aijob");
  const ts = now();
  db.prepare(`
    INSERT INTO ai_jobs_v3
      (id, instance_id, section_key, role, provider_id, status, attempt, request_json, response_json, error_text, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'running', 1, ?, '{}', '', ?, ?)
  `).run(jobId, instanceId, sectionKey || null, role, providerId || null, JSON.stringify(request || {}), ts, ts);
  return jobId;
}

function finishJob(db, jobId, response, error) {
  db.prepare(`
    UPDATE ai_jobs_v3
    SET status = ?, response_json = ?, error_text = ?, updated_at = ?
    WHERE id = ?
  `).run(error ? "failed" : "completed", JSON.stringify(response || {}), error ? String(error.message || error) : "", now(), jobId);
}

async function generateSection(userDataPath, instanceId, sectionKey, options) {
  let instance = hub.getDocumentInstance(userDataPath, instanceId);
  if (!instance) throw new Error("Documento no válido.");
  if (instance.finalFrozenAt) throw new Error("La versión final está congelada.");
  const engine = registry.getEngine(instance.engineId);
  if (!engine) throw new Error("Motor no disponible.");
  const section = instance.sections.find((item) => item.key === sectionKey);
  if (!section) throw new Error("Sección no válida.");
  if (section.locked && !(options && options.force)) return instance;

  const set = providerSets(userDataPath);
  if (!set.writer) throw new Error("Configura al menos una IA en Ajustes.");
  const context = sectionDataContext(userDataPath, instance, section);
  const db = hub.dbFor(userDataPath);
  const system = baseSystem(engine, section);
  const prompt = writerPrompt(instance, engine, section, context);
  const jobId = createJob(db, instanceId, sectionKey, "writer", set.writer.id, { prompt, engineId: engine.engineId });

  let writerResult;
  try {
    const result = await providers.callProvider(userDataPath, set.writer.id, { system, prompt, maxTokens: options && options.maxTokens || 7000 });
    writerResult = parseJsonObject(result.text);
    finishJob(db, jobId, { parsed: writerResult, provider: result.provider.name }, null);
  } catch (error) {
    finishJob(db, jobId, null, error);
    throw error;
  }

  let content = String(writerResult.content || "");
  let alerts = Array.isArray(writerResult.alerts) ? writerResult.alerts : [];
  const provenance = {
    source: "ai",
    writerProviderId: set.writer.id,
    writerProvider: set.writer.name,
    engineId: engine.engineId,
    engineVersion: engine.version,
    generatedAt: now(),
    claims: Array.isArray(writerResult.claims) ? writerResult.claims : []
  };

  const reviewers = (set.reviewers || []).filter((provider) => provider.id !== set.writer.id)
    .concat((set.reviewers || []).some((provider) => provider.id === set.writer.id) ? [set.writer] : [])
    .slice(0, Math.max(1, Number(options && options.reviewers || 1)));

  for (const reviewer of reviewers) {
    const reviewRequest = reviewerPrompt(engine, section, { content, alerts }, context);
    const reviewJobId = createJob(db, instanceId, sectionKey, "reviewer", reviewer.id, { prompt: reviewRequest, engineId: engine.engineId });
    try {
      const result = await providers.callProvider(userDataPath, reviewer.id, {
        system: "Eres revisor documental. Devuelve únicamente JSON válido.",
        prompt: reviewRequest,
        maxTokens: 6000,
        temperature: 0.1
      });
      const review = parseJsonObject(result.text);
      finishJob(db, reviewJobId, { parsed: review, provider: result.provider.name }, null);
      if (review.correctedContent) content = String(review.correctedContent);
      if (Array.isArray(review.alerts)) alerts = alerts.concat(review.alerts);
      if (Array.isArray(review.issues) && review.issues.length) {
        alerts = alerts.concat(review.issues.map((issue) => ({
          type: "review",
          severity: "warning",
          message: typeof issue === "string" ? issue : JSON.stringify(issue),
          blocking: false
        })));
      }
      provenance.reviewers = (provenance.reviewers || []).concat([{ id: reviewer.id, name: reviewer.name, approved: review.approved !== false }]);
    } catch (error) {
      finishJob(db, reviewJobId, null, error);
      alerts.push({ type: "reviewer_failure", severity: "warning", message: `No se pudo completar la revisión con ${reviewer.name}: ${error.message}`, blocking: false });
    }
  }

  const dedup = [];
  const seen = new Set();
  alerts.forEach((alert) => {
    const key = `${alert && alert.type || ""}|${alert && alert.message || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      dedup.push(alert);
    }
  });

  instance = hub.updateSection(userDataPath, instanceId, sectionKey, {
    content,
    status: "reviewed",
    provenance,
    alerts: dedup
  });
  return instance;
}

async function generateDocument(userDataPath, instanceId, options) {
  let instance = hub.getDocumentInstance(userDataPath, instanceId);
  if (!instance) throw new Error("Documento no válido.");
  const startAt = options && options.startAt ? String(options.startAt) : "";
  let enabled = !startAt;
  for (const section of instance.sections) {
    if (section.key === startAt) enabled = true;
    if (!enabled) continue;
    if (section.locked || section.status === "approved") continue;
    instance = await generateSection(userDataPath, instanceId, section.key, options || {});
  }
  return hub.getDocumentInstance(userDataPath, instanceId);
}

async function regenerateStale(userDataPath, instanceId, options) {
  const instance = hub.getDocumentInstance(userDataPath, instanceId);
  if (!instance) throw new Error("Documento no válido.");
  for (const section of instance.sections) {
    if (section.locked || section.status === "approved") continue;
    await generateSection(userDataPath, instanceId, section.key, Object.assign({}, options || {}, { force: true }));
  }
  return hub.getDocumentInstance(userDataPath, instanceId);
}

module.exports = {
  generateSection,
  generateDocument,
  regenerateStale,
  parseJsonObject
};
