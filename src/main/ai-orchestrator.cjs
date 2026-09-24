const hub = require("./process-hub-service.cjs");
const ingestion = require("./data-ingestion-service.cjs");
const dataBindings = require("./document-data-binding-service.cjs");
const providers = require("./ai-provider-service.cjs");
const registry = require("./document-engine-registry.cjs");
const knowledge = require("./knowledge-source-service.cjs");
const editorial = require("./editorial-structure-service.cjs");
const generationRuns = require("./ai-generation-run-service.cjs");

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms || 0))));
}

function retryableProviderError(error) {
  const status = Number(error && error.statusCode || 0);
  if ([408, 409, 425, 429].includes(status) || status >= 500) return true;
  const text = String(error && error.message || error || "").toLowerCase();
  return [
    "timeout",
    "timed out",
    "aborted",
    "rate limit",
    "overloaded",
    "temporarily",
    "unavailable",
    "connection",
    "econnreset",
    "fetch failed"
  ].some((part) => text.includes(part));
}

function humanEdited(section) {
  const provenance = section && section.provenance || {};
  return Boolean(
    section &&
    (
      provenance.source === "human" ||
      provenance.blockEditedBy === "human" ||
      provenance.approvedBy === "human"
    )
  );
}

function hasSectionContent(section) {
  return Boolean(
    section &&
    (
      String(section.content || "").trim() ||
      (Array.isArray(section.blocks) && section.blocks.length)
    )
  );
}

function sectionPreservationReason(section, options) {
  const input = options || {};
  if (!section) return "missing";
  if (section.locked || section.status === "approved") return "approved_or_locked";
  if (humanEdited(section) && input.overrideHuman !== true) return "human_edited";
  if (!input.force && section.status === "reviewed") return "already_reviewed";
  if (!input.force && section.status === "needs_review") return "needs_human_review";
  return "";
}

function documentMemory(instance, section) {
  const before = (instance.sections || [])
    .filter((item) => Number(item.order || 0) < Number(section.order || 0) && hasSectionContent(item))
    .slice(-20)
    .map((item) => ({
      key: item.key,
      title: item.title,
      status: item.status,
      summary: String(item.content || "").slice(0, 1600),
      claims: Array.isArray(item.provenance && item.provenance.claims)
        ? item.provenance.claims.slice(0, 6)
        : [],
      alertCount: Array.isArray(item.alerts) ? item.alerts.length : 0
    }));

  return {
    priorSections: before,
    outline: (instance.sections || []).map((item) => ({
      key: item.key,
      title: item.title,
      order: item.order,
      level: item.level,
      status: item.status,
      locked: Boolean(item.locked),
      hasContent: hasSectionContent(item)
    }))
  };
}

function writerPayloadUsable(payload) {
  if (!payload || typeof payload !== "object") return false;
  const content = String(payload.content || "").trim();
  const blocks = Array.isArray(payload.blocks) ? payload.blocks : [];
  return Boolean(content || blocks.length);
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
    writers,
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
    "Los cálculos y agregados de Excel/CSV ya vienen hechos por la aplicación. Interprétalos; no recalcules promedios, porcentajes, conteos ni filtros.",
    "Nunca introduzcas conclusiones que no estén respaldadas por resultados.",
    "La estructura final y APA 7 los aplica la aplicación; tú debes devolver contenido semántico estructurado.",
    "Devuelve SOLO JSON válido con las claves: content, blocks, alerts, claims.",
    "blocks es una lista ordenada de objetos.",
    "Tipos admitidos de bloque: prose, list, table, figure, image, visual, quote, callout, reference_list.",
    "Para prose usa {type:'prose',role:'context|body|analysis|summary',text:'...'}",
    "Para table usa {type:'table',title:'...',data:{headers:[...],rows:[[...]]},note:'...'}",
    "Para visual usa {type:'visual',visualType:'...',title:'...',data:{...},note:'...'}",
    "Antes de toda tabla, figura, imagen o visual debe existir un bloque prose con role context/body/summary; después debe existir prose con role analysis/interpretation/summary.",
    "No fuerces una herramienta visual. Úsala únicamente cuando aporte comprensión.",
    "Cuando sustentes texto en una fuente institucional, usa el token [[CITE:CLAVE]] únicamente si esa fuente tiene citationComplete=true; nunca inventes claves ni cites una fuente APA incompleta.",
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

function dataReadinessForSection(userDataPath, instance, section) {
  const scopeOptions = {
    scopeType: instance.scopeType,
    scopeKey: instance.scopeKey,
    scopePolicy: "inclusive"
  };
  const availability = ingestion.inspectDataAvailability(userDataPath, instance.dossierId, scopeOptions);
  const configuredQuery = section && section.data && section.data.query;
  if (configuredQuery) {
    return {
      bindingId: "custom-query:" + section.key,
      requirement: "configured",
      mode: instance.scopeType === "student" ? "individual" : "aggregate",
      status: availability.hasImports ? "ready" : "no_imports",
      ready: availability.hasImports,
      query: Object.assign({
        scopeType: instance.scopeType,
        scopeKey: instance.scopeKey,
        scopePolicy: "inclusive",
        privacyMode: instance.scopeType === "student" ? "student_specific" : "aggregate"
      }, configuredQuery),
      availableFields: availability.availableFields,
      warnings: availability.hasImports ? [] : ["No hay Excel/CSV disponible para la consulta configurada."],
      availability
    };
  }

  const bindingConfig = section && section.data && section.data.binding
    ? section.data.binding
    : dataBindings.bindingFor(instance.engineId, section.key);
  if (!bindingConfig) {
    return {
      bindingId: "",
      requirement: "none",
      mode: "none",
      status: "not_configured",
      ready: false,
      query: null,
      availableFields: availability.availableFields,
      warnings: [],
      availability
    };
  }

  const resolved = dataBindings.resolveBinding(bindingConfig, instance, availability);
  resolved.availability = availability;
  if (resolved.query) {
    resolved.query = Object.assign({
      scopeType: instance.scopeType,
      scopeKey: instance.scopeKey,
      scopePolicy: "inclusive"
    }, resolved.query);
  }
  return resolved;
}

function sectionDataContext(userDataPath, instance, section) {
  const masterData = hub.listMasterData(userDataPath, instance.dossierId);
  const imports = ingestion.listImports(userDataPath, instance.dossierId).map((item) => ({
    id: item.id,
    sourceName: item.sourceName,
    scopeType: item.scopeType,
    scopeKey: item.scopeKey,
    sha256: item.sha256,
    mapping: item.mapping || {},
    totalRows: Number(item.profile && item.profile.totalRows || 0),
    sheets: ((item.profile && item.profile.sheets) || []).map((sheet) => ({
      name: sheet.name,
      rowCount: Number(sheet.rowCount || 0),
      headers: (sheet.columns || []).map((column) => column.name)
    }))
  }));

  const dataReadiness = dataReadinessForSection(userDataPath, instance, section);
  let filteredData = null;
  if (dataReadiness.ready && dataReadiness.query) {
    filteredData = ingestion.aiSlice(userDataPath, instance.dossierId, dataReadiness.query);
  }

  const sourceQuery = `${section && section.title || ""} ${section && section.key || ""} ${instance.label || ""}`;
  const institutionalSources = knowledge.searchKnowledge(userDataPath, instance.dossierId, sourceQuery, 5);
  return {
    masterData: compactMasterData(masterData),
    imports,
    filteredData,
    dataReadiness: {
      bindingId: dataReadiness.bindingId || "",
      requirement: dataReadiness.requirement || "none",
      mode: dataReadiness.mode || "none",
      status: dataReadiness.status || "not_configured",
      ready: Boolean(dataReadiness.ready),
      availableFields: dataReadiness.availableFields || [],
      missingAll: dataReadiness.missingAll || [],
      missingAny: dataReadiness.missingAny || [],
      warnings: dataReadiness.warnings || []
    },
    institutionalSources
  };
}

function instanceDataReadiness(userDataPath, instanceId) {
  const instance = hub.getDocumentInstance(userDataPath, instanceId);
  if (!instance) throw new Error("Documento no válido.");
  return {
    instanceId,
    engineId: instance.engineId,
    sections: (instance.sections || []).map((section) => {
      const readiness = dataReadinessForSection(userDataPath, instance, section);
      return {
        sectionKey: section.key,
        title: section.title,
        bindingId: readiness.bindingId || "",
        requirement: readiness.requirement || "none",
        status: readiness.status || "not_configured",
        ready: Boolean(readiness.ready),
        availableFields: readiness.availableFields || [],
        missingAll: readiness.missingAll || [],
        missingAny: readiness.missingAny || [],
        warnings: readiness.warnings || []
      };
    })
  };
}

function writerPrompt(instance, engine, section, context) {
  const memory = documentMemory(instance, section);
  const prior = memory.priorSections;
  const derived = (section.derivedFrom || []).map((key) => {
    const source = instance.sections.find((item) => item.key === key);
    return source ? {
      key: source.key,
      title: source.title,
      content: String(source.content || "").slice(0, 12000),
      blocks: (source.blocks || []).slice(0, 30)
    } : { key, missing: true };
  });
  return [
    "Redacta la sección solicitada.",
    "Respeta exactamente la jerarquía definida por la aplicación; no inventes títulos ni subniveles fuera de la sección solicitada.",
    "Mantén coherencia con las secciones previas y con las secciones de las que deriva.",
    "Si un dato es simulado o inferido, NO lo presentes como verificado: inclúyelo en alerts.",
    section.type === "executive_summary"
      ? `El resumen ejecutivo debe ser muy concreto, priorizar los hallazgos críticos y no superar aproximadamente ${section.maxWords || 600} palabras.`
      : "",
    section.contract && section.contract.purpose
      ? `Propósito específico de la sección: ${section.contract.purpose}`
      : "",
    section.contract && section.contract.sourcePolicy
      ? `Política de fuentes: ${section.contract.sourcePolicy}.`
      : "",
    section.contract && section.contract.evidenceRequired
      ? "Toda afirmación sustantiva de esta sección debe quedar respaldada por datos o fuentes disponibles."
      : "",
    section.contract && Array.isArray(section.contract.dataNeeds) && section.contract.dataNeeds.length
      ? `Datos requeridos por esta sección: ${section.contract.dataNeeds.join(", ")}.`
      : "",
    section.contract && Array.isArray(section.contract.promptInstructions) && section.contract.promptInstructions.length
      ? `Instrucciones específicas: ${section.contract.promptInstructions.join(" | ")}`
      : "",
    (section.allowedVisuals || []).length
      ? `Herramientas visuales permitidas en esta sección: ${section.allowedVisuals.join(", ")}. Selecciona solo las que sean útiles.`
      : "No generes herramientas visuales en esta sección salvo que la aplicación las habilite.",
    context.dataReadiness && context.dataReadiness.requirement !== "none"
      ? `Estado de datos de esta sección: ${context.dataReadiness.status}. ${(context.dataReadiness.warnings || []).join(" ")}`
      : "",
    context.dataReadiness && !context.dataReadiness.ready && context.dataReadiness.requirement === "recommended"
      ? "Los datos recomendados no están listos. No inventes cifras ni resultados; utiliza únicamente fuentes o datos maestros disponibles y registra la limitación en alerts."
      : "",
    "Contexto estructurado:",
    JSON.stringify({
      engine: { id: engine.engineId, version: engine.version, family: engine.family, population: engine.population },
      instance: { scopeType: instance.scopeType, scopeKey: instance.scopeKey },
      section: {
        key: section.key,
        title: section.title,
        type: section.type,
        level: section.level,
        numbering: section.numbering,
        allowedVisuals: section.allowedVisuals || [],
        derivedFrom: section.derivedFrom || [],
        contract: section.contract || {}
      },
      masterData: context.masterData,
      imports: context.imports,
      filteredData: context.filteredData,
      dataReadiness: context.dataReadiness,
      dataContract: context.filteredData ? {
        calculationComplete: true,
        querySignature: context.filteredData.querySignature,
        rawRowsDefault: "disabled",
        instruction: "Interpretar los agregados suministrados sin recalcularlos."
      } : null,
      institutionalSources: context.institutionalSources,
      derivedSections: derived,
      previousSections: prior,
      documentMemory: memory
    })
  ].filter(Boolean).join("\n\n");
}

function reviewerPrompt(engine, section, draft, context) {
  return [
    "Revisa el borrador de esta sección.",
    "Comprueba coherencia, trazabilidad, privacidad institucional, datos no sustentados, contradicciones y redacción.",
    "Verifica que cada tabla, figura, imagen o visual tenga contexto previo y análisis/interpretación posterior.",
    "Verifica que las herramientas visuales estén dentro de las permitidas para la sección.",
    "Si detectas problemas, corrige content y blocks.",
    "Devuelve SOLO JSON válido con: approved, issues, correctedContent, correctedBlocks, alerts.",
    JSON.stringify({
      engine: engine.engineId,
      section: {
        key: section.key,
        type: section.type,
        allowedVisuals: section.allowedVisuals || [],
        derivedFrom: section.derivedFrom || [],
        contract: section.contract || {}
      },
      draft,
      masterData: context.masterData,
      filteredData: context.filteredData,
      institutionalSources: context.institutionalSources
    })
  ].join("\n\n");
}

function createJob(db, instanceId, sectionKey, role, providerId, request, attempt) {
  const jobId = id("aijob");
  const ts = now();
  db.prepare(`
    INSERT INTO ai_jobs_v3
      (id, instance_id, section_key, role, provider_id, status, attempt, request_json, response_json, error_text, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'running', ?, ?, '{}', '', ?, ?)
  `).run(
    jobId,
    instanceId,
    sectionKey || null,
    role,
    providerId || null,
    Math.max(1, Number(attempt || 1)),
    JSON.stringify(request || {}),
    ts,
    ts
  );
  return jobId;
}

function finishJob(db, jobId, response, error) {
  db.prepare(`
    UPDATE ai_jobs_v3
    SET status = ?, response_json = ?, error_text = ?, updated_at = ?
    WHERE id = ?
  `).run(error ? "failed" : "completed", JSON.stringify(response || {}), error ? String(error.message || error) : "", now(), jobId);
}

async function callProviderWithRetries(userDataPath, db, candidate, role, instanceId, sectionKey, request, options) {
  const input = options || {};
  const configuredRetries = candidate && candidate.config && candidate.config.retries != null
    ? Number(candidate.config.retries)
    : 1;
  const retries = Math.max(0, Math.min(Number(input.providerRetries != null ? input.providerRetries : configuredRetries), 2));
  let lastError = null;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const jobId = createJob(db, instanceId, sectionKey, role, candidate.id, {
      prompt: request.prompt,
      engineId: request.engineId
    }, attempt);
    try {
      const result = await providers.callProvider(userDataPath, candidate.id, request);
      finishJob(db, jobId, { provider: result.provider.name, textLength: String(result.text || "").length }, null);
      return result;
    } catch (error) {
      lastError = error;
      finishJob(db, jobId, null, error);
      if (attempt > retries || !retryableProviderError(error)) break;
      await sleep(Math.min(1500, 250 * attempt));
    }
  }

  throw lastError || new Error(`${candidate.name}: no se pudo completar la solicitud.`);
}

async function generateSection(userDataPath, instanceId, sectionKey, options) {
  let instance = hub.ensureCurrentDocumentInstance(userDataPath, instanceId);
  if (!instance) throw new Error("Documento no válido.");
  if (instance.finalFrozenAt) throw new Error("La versión final está congelada.");
  const engine = registry.getEngine(instance.engineId);
  if (!engine) throw new Error("Motor no disponible.");
  const section = instance.sections.find((item) => item.key === sectionKey);
  if (!section) throw new Error("Sección no válida.");
  if (section.locked || section.status === "approved") {
    throw new Error("La sección está aprobada y bloqueada. Crea una nueva versión de trabajo para modificarla.");
  }
  if (humanEdited(section) && !(options && options.overrideHuman === true)) {
    throw new Error("La sección contiene edición humana. Confirma explícitamente si deseas reemplazarla con IA.");
  }

  if (section.type === "references") {
    return hub.updateSection(userDataPath, instanceId, sectionKey, {
      content: "",
      status: "reviewed",
      blocks: [{ type: "reference_list", role: "body", data: {} }],
      provenance: { source: "system", engineId: engine.engineId, generatedAt: now() },
      alerts: []
    });
  }

  const set = providerSets(userDataPath);
  if (!set.writer) throw new Error("Configura al menos una IA en Ajustes.");
  const context = sectionDataContext(userDataPath, instance, section);
  if (context.dataReadiness && context.dataReadiness.requirement === "required" && !context.dataReadiness.ready) {
    const detail = (context.dataReadiness.warnings || []).join(" ");
    throw new Error(`La sección "${section.title}" requiere datos antes de generar. ${detail}`.trim());
  }
  const db = hub.dbFor(userDataPath);
  const system = baseSystem(engine, section);
  const prompt = writerPrompt(instance, engine, section, context);

  let writerResult = null;
  let usedWriter = null;
  let lastWriterError = null;
  for (const candidate of set.writers || [set.writer]) {
    try {
      const result = await callProviderWithRetries(
        userDataPath,
        db,
        candidate,
        "writer",
        instanceId,
        sectionKey,
        {
          system,
          prompt,
          maxTokens: options && options.maxTokens || candidate.config && candidate.config.maxTokens || 7000,
          timeoutMs: options && options.timeoutMs || candidate.config && candidate.config.timeoutMs || 120000,
          temperature: 0.2,
          engineId: engine.engineId
        },
        options
      );
      const parsed = parseJsonObject(result.text);
      if (!writerPayloadUsable(parsed)) {
        throw new Error(`${candidate.name}: la respuesta no contiene contenido ni bloques utilizables.`);
      }
      writerResult = parsed;
      usedWriter = candidate;
      break;
    } catch (error) {
      lastWriterError = error;
    }
  }
  if (!writerResult || !usedWriter) throw lastWriterError || new Error("Ninguna IA pudo redactar la sección.");

  let blocks = editorial.normalizeBlocks(writerResult.blocks || []);
  let content = String(writerResult.content || "");
  if (!blocks.length && content) {
    blocks = editorial.normalizeBlocks([{ type: "prose", role: "body", text: content }]);
  }
  if (blocks.length) content = editorial.plainTextFromBlocks(blocks);
  let alerts = Array.isArray(writerResult.alerts) ? writerResult.alerts : [];
  const provenance = {
    source: "ai",
    writerProviderId: usedWriter.id,
    writerProvider: usedWriter.name,
    engineId: engine.engineId,
    engineVersion: engine.version,
    generatedAt: now(),
    claims: Array.isArray(writerResult.claims) ? writerResult.claims : []
  };

  const reviewers = (set.reviewers || []).filter((provider) => provider.id !== usedWriter.id)
    .concat((set.reviewers || []).some((provider) => provider.id === usedWriter.id) ? [usedWriter] : [])
    .slice(0, Math.max(1, Number(options && options.reviewers || 1)));

  for (const reviewer of reviewers) {
    const reviewRequest = reviewerPrompt(engine, section, { content, blocks, alerts }, context);
    try {
      const result = await callProviderWithRetries(
        userDataPath,
        db,
        reviewer,
        "reviewer",
        instanceId,
        sectionKey,
        {
          system: "Eres revisor documental. Devuelve únicamente JSON válido.",
          prompt: reviewRequest,
          maxTokens: reviewer.config && reviewer.config.reviewMaxTokens || 6000,
          timeoutMs: reviewer.config && reviewer.config.timeoutMs || 120000,
          temperature: 0.1,
          engineId: engine.engineId
        },
        options
      );
      const review = parseJsonObject(result.text);
      if (Array.isArray(review.correctedBlocks) && review.correctedBlocks.length) {
        blocks = editorial.normalizeBlocks(review.correctedBlocks);
        content = editorial.plainTextFromBlocks(blocks);
      } else if (review.correctedContent) {
        if (!blocks.length) {
          content = String(review.correctedContent);
          blocks = editorial.normalizeBlocks([{ type: "prose", role: "body", text: content }]);
        } else {
          alerts.push({
            type: "review_format",
            severity: "warning",
            message: `${reviewer.name} devolvió texto corregido sin bloques; se conservó la estructura del writer para evitar inconsistencias.`,
            blocking: false
          });
        }
      }
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
      alerts.push({ type: "reviewer_failure", severity: "warning", message: `No se pudo completar la revisión con ${reviewer.name}: ${error.message}`, blocking: false });
    }
  }

  const editorialValidation = editorial.validateSectionBlocks(section, blocks);
  const reviewerRejected = Boolean(
    provenance.reviewers &&
    provenance.reviewers.some((item) => item.approved === false)
  );
  editorialValidation.errors.forEach((message) => {
    alerts.push({ type: "editorial", severity: "error", message, blocking: true });
  });
  editorialValidation.warnings.forEach((message) => {
    alerts.push({ type: "editorial", severity: "warning", message, blocking: false });
  });

  const dedup = [];
  const seen = new Set();
  alerts.forEach((alert) => {
    const key = `${alert && alert.type || ""}|${alert && alert.message || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      dedup.push(alert);
    }
  });

  const sectionStatus = editorialValidation.ok && !reviewerRejected ? "reviewed" : "needs_review";
  instance = hub.updateSection(userDataPath, instanceId, sectionKey, {
    content,
    blocks,
    status: sectionStatus,
    provenance,
    alerts: dedup
  });
  return instance;
}

function dependencyProblems(instance, section, failedKeys, blockedKeys) {
  const issues = [];
  (section.derivedFrom || []).forEach((key) => {
    const source = (instance.sections || []).find((item) => item.key === key);
    if (!source) {
      issues.push({ key, reason: "missing_dependency" });
      return;
    }
    if (failedKeys.has(key) || blockedKeys.has(key)) {
      issues.push({ key, reason: "dependency_failed" });
      return;
    }
    if (!hasSectionContent(source) && source.type !== "references") {
      issues.push({ key, reason: "dependency_empty" });
    }
  });
  return issues;
}

async function runDocumentGeneration(userDataPath, instanceId, options, mode) {
  const input = Object.assign({ continueOnError: true }, options || {});
  let instance = hub.ensureCurrentDocumentInstance(userDataPath, instanceId);
  if (!instance) throw new Error("Documento no válido.");
  if (instance.finalFrozenAt) throw new Error("La versión final está congelada.");

  const db = hub.dbFor(userDataPath);
  const startAt = input.startAt ? String(input.startAt) : "";
  let enabled = !startAt;
  const candidates = [];
  for (const section of instance.sections) {
    if (section.key === startAt) enabled = true;
    if (enabled) candidates.push(section);
  }
  if (startAt && !enabled) throw new Error(`No existe la sección inicial ${startAt}.`);

  const run = generationRuns.start(db, instanceId, mode || "document", candidates.length, {
    startAt,
    force: Boolean(input.force),
    overrideHuman: Boolean(input.overrideHuman),
    reviewers: Number(input.reviewers || 1),
    continueOnError: input.continueOnError !== false
  });

  const result = {
    completed: [],
    skipped: [],
    preserved: [],
    failed: [],
    blocked: [],
    providers: [],
    lastCompletedSectionKey: "",
    nextSectionKey: "",
    resumable: false
  };
  const failedKeys = new Set();
  const blockedKeys = new Set();

  try {
    for (const original of candidates) {
      instance = hub.getDocumentInstance(userDataPath, instanceId);
      const section = instance.sections.find((item) => item.key === original.key);
      if (!section) continue;

      generationRuns.update(db, run.id, {
        currentSectionKey: section.key,
        result
      });

      const preservationReason = sectionPreservationReason(section, input);
      if (preservationReason) {
        const record = { key: section.key, title: section.title, reason: preservationReason };
        if (preservationReason === "human_edited" || preservationReason === "approved_or_locked") {
          result.preserved.push(record);
        } else {
          result.skipped.push(record);
        }
        generationRuns.update(db, run.id, { result });
        continue;
      }

      const dependencyIssues = dependencyProblems(instance, section, failedKeys, blockedKeys);
      if (dependencyIssues.length) {
        const record = {
          key: section.key,
          title: section.title,
          reason: "dependencies_not_ready",
          dependencies: dependencyIssues
        };
        result.blocked.push(record);
        blockedKeys.add(section.key);
        generationRuns.update(db, run.id, { result });
        continue;
      }

      try {
        const generated = await generateSection(userDataPath, instanceId, section.key, input);
        const generatedSection = generated.sections.find((item) => item.key === section.key);
        result.completed.push({
          key: section.key,
          title: section.title,
          status: generatedSection && generatedSection.status || "reviewed"
        });
        result.lastCompletedSectionKey = section.key;
        const provenance = generatedSection && generatedSection.provenance || {};
        if (provenance.writerProviderId) {
          result.providers.push({
            sectionKey: section.key,
            writerProviderId: provenance.writerProviderId,
            reviewerCount: Array.isArray(provenance.reviewers) ? provenance.reviewers.length : 0
          });
        }
      } catch (error) {
        failedKeys.add(section.key);
        result.failed.push({
          key: section.key,
          title: section.title,
          error: String(error && error.message || error)
        });
        if (input.continueOnError === false) {
          result.nextSectionKey = section.key;
          result.resumable = true;
          generationRuns.finish(db, run.id, "failed", result);
          error.generationRunId = run.id;
          throw error;
        }
      }

      generationRuns.update(db, run.id, { result });
    }

    const unresolved = result.failed.length > 0 || result.blocked.length > 0;
    if (unresolved) {
      const unresolvedKeys = new Set([
        ...result.failed.map((item) => item.key),
        ...result.blocked.map((item) => item.key)
      ]);
      result.nextSectionKey = candidates.find((item) => unresolvedKeys.has(item.key))?.key || "";
    }
    result.resumable = unresolved;
    const finished = generationRuns.finish(db, run.id, unresolved ? "partial" : "completed", result);
    const finalInstance = hub.getDocumentInstance(userDataPath, instanceId);
    finalInstance.generationRun = finished;
    return finalInstance;
  } catch (error) {
    const latest = generationRuns.get(db, run.id);
    if (latest && latest.status === "running") {
      generationRuns.finish(db, run.id, "failed", Object.assign(result, {
        resumable: true,
        nextSectionKey: result.nextSectionKey || latest.currentSectionKey || ""
      }));
    }
    throw error;
  }
}

async function generateDocument(userDataPath, instanceId, options) {
  return runDocumentGeneration(userDataPath, instanceId, options || {}, "document");
}

async function resumeDocument(userDataPath, instanceId, options) {
  return runDocumentGeneration(userDataPath, instanceId, Object.assign({}, options || {}, {
    force: false
  }), "resume");
}

async function regenerateStale(userDataPath, instanceId, options) {
  return runDocumentGeneration(userDataPath, instanceId, Object.assign({}, options || {}, {
    force: true,
    overrideHuman: false
  }), "stale");
}

function latestGenerationRun(userDataPath, instanceId) {
  return generationRuns.latest(hub.dbFor(userDataPath), instanceId);
}

function listGenerationRuns(userDataPath, instanceId, limit) {
  return generationRuns.list(hub.dbFor(userDataPath), instanceId, limit);
}

module.exports = {
  dataReadinessForSection,
  instanceDataReadiness,
  generateSection,
  generateDocument,
  resumeDocument,
  regenerateStale,
  latestGenerationRun,
  listGenerationRuns,
  parseJsonObject,
  retryableProviderError,
  sectionPreservationReason
};
