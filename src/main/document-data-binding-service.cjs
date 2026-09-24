const REQUIREMENTS = new Set(["none", "recommended", "required"]);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function binding(sectionKey, options) {
  const input = options || {};
  return Object.assign({
    id: "",
    sectionKey,
    requirement: "recommended",
    mode: "aggregate",
    requiredAll: [],
    requiredAny: [],
    optionalFields: [],
    dimensions: [],
    measures: [],
    groupBy: [],
    distinctBy: [],
    select: [],
    where: [],
    anyOf: [],
    scopeFields: [],
    privacyMode: "aggregate",
    includeCountsForAi: false,
    includeSampleRows: false,
    sampleLimit: 20
  }, clone(input));
}

const PROFILES = Object.freeze({
  schedule: binding("CRONOGRAMA", {
    requiredAny: [["activity_name", "event_name", "core", "component"]],
    optionalFields: ["start_date", "end_date", "event_date", "responsible", "career", "campus", "modality", "segment", "status"],
    dimensions: ["career", "campus", "modality", "segment", "status"],
    distinctBy: ["activity_id", "activity_name", "event_date"]
  }),
  studentResults: binding("RESULTADOS", {
    requiredAny: [["student_id", "career", "status", "grade"]],
    optionalFields: ["student_id", "career", "campus", "core", "component", "grade", "status", "modality", "level"],
    dimensions: ["career", "campus", "core", "component", "status", "modality", "level"],
    measures: ["grade"],
    groupBy: ["career"],
    distinctBy: ["student_id"]
  }),
  requirements: binding("RESULTADOS", {
    requirement: "required",
    requiredAll: ["student_id"],
    requiredAny: [["requirement_status", "status"]],
    optionalFields: ["student_name", "career", "requirement_name", "requirement_status", "status", "requirement_date"],
    dimensions: ["career", "requirement_name", "requirement_status", "status"],
    groupBy: ["career"],
    distinctBy: ["student_id", "requirement_name"]
  }),
  studentPlagiarism: binding("RESULTADO_ANTIPLAGIO", {
    requirement: "required",
    mode: "individual",
    requiredAll: ["student_id", "plagiarism_percent"],
    optionalFields: ["student_name", "career", "status", "document_title"],
    measures: ["plagiarism_percent"],
    select: ["student_id", "student_name", "career", "plagiarism_percent", "status", "document_title"],
    where: [{ field: "plagiarism_percent", op: "exists" }],
    scopeFields: ["student_id"],
    privacyMode: "student_specific",
    includeCountsForAi: true,
    includeSampleRows: true,
    sampleLimit: 5
  }),
  topics: binding("RESULTADOS", {
    requiredAny: [["topic", "document_title"]],
    optionalFields: ["student_id", "student_name", "career", "topic", "document_title", "status", "tutor_name"],
    dimensions: ["career", "status"],
    groupBy: ["career"],
    distinctBy: ["student_id", "topic"]
  }),
  designations: binding("DESIGNACIONES", {
    requiredAny: [["tutor_name", "methodologist_name", "responsible"]],
    optionalFields: ["student_id", "student_name", "career", "tutor_name", "methodologist_name", "responsible", "status"],
    dimensions: ["career", "status"],
    distinctBy: ["student_id"]
  }),
  induction: binding("RESULTADOS", {
    requiredAny: [["attendance", "status"]],
    optionalFields: ["student_id", "student_name", "career", "attendance", "attendance_date", "status"],
    dimensions: ["career", "attendance", "status"],
    groupBy: ["career"],
    distinctBy: ["student_id", "attendance_date"]
  }),
  needs: binding("RESULTADOS", {
    requiredAny: [["need", "priority", "competency", "area"]],
    optionalFields: ["person_id", "teacher_id", "teacher_name", "career", "campus", "need", "priority", "competency", "area", "status"],
    dimensions: ["career", "campus", "need", "priority", "competency", "area", "status"],
    groupBy: ["career"],
    distinctBy: ["person_id", "teacher_id", "need"]
  }),
  training: binding("RESULTADOS", {
    requiredAny: [["activity_name", "training_name"]],
    optionalFields: ["activity_id", "activity_name", "training_name", "teacher_id", "teacher_name", "career", "attendance", "completion", "hours", "status", "satisfaction_score", "impact_score"],
    dimensions: ["career", "attendance", "completion", "status"],
    measures: ["hours", "satisfaction_score", "impact_score"],
    groupBy: ["career"],
    distinctBy: ["activity_id", "teacher_id", "teacher_name"]
  }),
  formation: binding("RESULTADOS", {
    requiredAny: [["formation_program", "formation_level", "degree_level"]],
    optionalFields: ["person_id", "teacher_id", "teacher_name", "career", "formation_program", "formation_level", "degree_level", "institution", "status", "start_date", "end_date"],
    dimensions: ["career", "formation_level", "degree_level", "institution", "status"],
    groupBy: ["career"],
    distinctBy: ["person_id", "teacher_id", "formation_program"]
  }),
  curriculum: binding("ANALISIS_CURRICULAR", {
    requiredAny: [["subject", "finding", "agreement"]],
    optionalFields: ["career", "level", "session", "subject", "finding", "agreement", "responsible", "due_date", "status"],
    dimensions: ["career", "level", "session", "status"],
    groupBy: ["career", "level"],
    distinctBy: ["career", "level", "subject", "finding"]
  }),
  activity: binding("RESULTADOS", {
    requiredAny: [["activity_name", "training_name"]],
    optionalFields: ["activity_id", "activity_name", "training_name", "career", "teacher_id", "teacher_name", "attendance", "completion", "hours", "status", "satisfaction_score", "impact_score"],
    dimensions: ["career", "attendance", "completion", "status"],
    measures: ["hours", "satisfaction_score", "impact_score"],
    groupBy: ["career"],
    distinctBy: ["activity_id", "teacher_id"],
    scopeFields: ["activity_id", "activity_name"]
  }),
  impact: binding("RESULTADOS", {
    requiredAny: [["impact_score", "satisfaction_score", "status"]],
    optionalFields: ["activity_id", "activity_name", "teacher_id", "teacher_name", "career", "impact_score", "satisfaction_score", "status"],
    dimensions: ["career", "status"],
    measures: ["impact_score", "satisfaction_score"],
    groupBy: ["career"],
    distinctBy: ["activity_id", "teacher_id"],
    scopeFields: ["activity_id", "activity_name"]
  }),
  person: binding("DIAGNOSTICO_INDIVIDUAL", {
    requirement: "recommended",
    mode: "individual",
    requiredAny: [["person_id", "teacher_id", "teacher_name"]],
    optionalFields: ["person_id", "teacher_id", "teacher_name", "career", "need", "priority", "competency", "area", "formation_level", "status"],
    dimensions: ["need", "priority", "competency", "area", "formation_level", "status"],
    select: ["person_id", "teacher_id", "teacher_name", "career", "need", "priority", "competency", "area", "formation_level", "status"],
    scopeFields: ["person_id", "teacher_id", "teacher_name"],
    privacyMode: "individual",
    includeCountsForAi: true,
    includeSampleRows: true,
    sampleLimit: 20
  })
});

function fromProfile(name, sectionKey, overrides) {
  const base = clone(PROFILES[name]);
  if (!base) throw new Error(`Perfil de datos no registrado: ${name}.`);
  return Object.assign(base, clone(overrides || {}), {
    sectionKey: sectionKey || base.sectionKey
  });
}

const ENGINE_DATA_PLANS = Object.freeze({
  "tit.regular.plan-complexivo": [fromProfile("schedule", "CRONOGRAMA")],
  "tit.regular.plan-trabajo": [fromProfile("schedule", "CRONOGRAMA")],
  "tit.pvc.plan-articulo": [fromProfile("schedule", "CRONOGRAMA")],
  "tit.regular.informe-final": [fromProfile("studentResults", "RESULTADOS")],
  "tit.pvc.informe-final": [fromProfile("studentResults", "RESULTADOS")],
  "tit.requisitos.reporte-final": [fromProfile("requirements", "RESULTADOS")],
  "tit.regular.cronograma-complexivo": [fromProfile("schedule", "CRONOGRAMA", { requirement: "required" })],
  "tit.regular.comunicado-complexivo": [],
  "tit.regular.designacion-tutores": [fromProfile("designations", "DESIGNACIONES")],
  "tit.regular.ficha-temas": [fromProfile("topics", "RESULTADOS")],
  "tit.regular.plagio-trabajo": [fromProfile("studentPlagiarism", "RESULTADO_ANTIPLAGIO")],
  "tit.pvc.cronograma-articulo": [fromProfile("schedule", "CRONOGRAMA", { requirement: "required" })],
  "tit.pvc.designacion-metodologicos": [fromProfile("designations", "DESIGNACIONES")],
  "tit.pvc.plagio-articulo": [fromProfile("studentPlagiarism", "RESULTADO_ANTIPLAGIO")],
  "tit.induccion.informe": [fromProfile("induction", "RESULTADOS")],

  "cap.deteccion": [fromProfile("needs", "RESULTADOS")],
  "cap.plan": [fromProfile("schedule", "CRONOGRAMA")],
  "cap.informe-cumplimiento": [fromProfile("training", "RESULTADOS")],
  "form.deteccion": [fromProfile("needs", "RESULTADOS")],
  "form.plan": [fromProfile("schedule", "CRONOGRAMA")],
  "form.informe": [fromProfile("formation", "RESULTADOS")],

  "ccc.acta-colectivos": [fromProfile("curriculum", "ANALISIS_CURRICULAR")],
  "ccc.ficha-nivel": [fromProfile("curriculum", "ANALISIS_CURRICULAR")],
  "ccc.guia-carrera": [fromProfile("curriculum", "ANALISIS_CURRICULAR")],

  "cap.planificacion-actividad": [fromProfile("schedule", "CRONOGRAMA", {
    scopeFields: ["activity_id", "activity_name"]
  })],
  "cap.patrocinio": [],
  "cap.informe-final": [fromProfile("activity", "RESULTADOS")],
  "cap.instrumento-impacto": [fromProfile("impact", "RESULTADOS")],
  "cap.impacto": [fromProfile("impact", "RESULTADOS")],

  "plan-individual.plan": [fromProfile("person", "DIAGNOSTICO_INDIVIDUAL")],
  "plan-individual.reporte": [fromProfile("training", "RESULTADOS")],
  "form.seguimiento": [fromProfile("formation", "RESULTADOS")],
  "ccc.comunicado-matriz": []
});

function validatePlan(engineId, sections) {
  const errors = [];
  const keys = new Set();
  const walk = (items) => (items || []).forEach((item) => {
    keys.add(item.key);
    walk(item.children || []);
  });
  walk(sections || []);

  const plan = ENGINE_DATA_PLANS[engineId];
  if (!Array.isArray(plan)) {
    errors.push(`El motor ${engineId} no tiene plan explícito de datos.`);
    return { ok: false, errors };
  }

  plan.forEach((item) => {
    if (!keys.has(item.sectionKey)) {
      errors.push(`El binding ${engineId}:${item.sectionKey} apunta a una sección inexistente.`);
    }
    if (!REQUIREMENTS.has(item.requirement)) {
      errors.push(`El binding ${engineId}:${item.sectionKey} tiene requirement inválido.`);
    }
  });
  return { ok: errors.length === 0, errors };
}

function bindingsForEngine(engineId) {
  const plan = ENGINE_DATA_PLANS[engineId];
  return Array.isArray(plan)
    ? plan.map((item) => Object.assign(clone(item), { id: `${engineId}:${item.sectionKey}` }))
    : null;
}

function bindingFor(engineId, sectionKey) {
  return (bindingsForEngine(engineId) || []).find((item) => item.sectionKey === sectionKey) || null;
}

function decorateSections(engineId, sections) {
  const bindings = new Map((bindingsForEngine(engineId) || []).map((item) => [item.sectionKey, item]));
  const walk = (items) => (items || []).map((item) => {
    const next = clone(item);
    const data = next.data && typeof next.data === "object" && !Array.isArray(next.data)
      ? clone(next.data)
      : {};
    const configured = bindings.get(next.key);
    if (configured) data.binding = configured;
    next.data = data;
    next.children = walk(next.children || []);
    return next;
  });
  return walk(sections || []);
}

function mappedSet(availability) {
  return new Set((availability && availability.availableFields || []).map(String));
}

function pickAvailable(fields, available) {
  return (fields || []).filter((field) => available.has(field));
}

function compatibleSources(bindingConfig, availability) {
  const requiredAll = bindingConfig.requiredAll || [];
  const requiredAny = bindingConfig.requiredAny || [];
  const output = [];
  (availability && availability.imports || []).forEach((item) => {
    (item.sheets || []).forEach((sheet) => {
      const set = new Set((sheet.canonicalFields || []).map(String));
      const compatible =
        requiredAll.every((field) => set.has(field)) &&
        requiredAny.every((group) => !Array.isArray(group) || !group.length || group.some((field) => set.has(field)));
      if (compatible) {
        output.push({
          importId: item.importId,
          sheet: sheet.name,
          fields: Array.from(set)
        });
      }
    });
  });
  return output;
}

function fieldsFromSources(sources) {
  const set = new Set();
  (sources || []).forEach((source) => (source.fields || []).forEach((field) => set.add(String(field))));
  return set;
}

function requiredState(bindingConfig, available) {
  const missingAll = (bindingConfig.requiredAll || []).filter((field) => !available.has(field));
  const missingAny = (bindingConfig.requiredAny || [])
    .filter((group) => Array.isArray(group) && group.length && !group.some((field) => available.has(field)))
    .map((group) => group.slice());
  return { missingAll, missingAny, ok: !missingAll.length && !missingAny.length };
}

function resolveScopeFilter(bindingConfig, instance, available) {
  const value = String(instance && instance.scopeKey || "").trim();
  if (!value || !(bindingConfig.scopeFields || []).length) return null;
  const field = (bindingConfig.scopeFields || []).find((candidate) => available.has(candidate));
  return field ? { field, op: "eq", value } : null;
}

function resolveBinding(bindingConfig, instance, availability) {
  if (!bindingConfig) return {
    status: "not_configured",
    ready: false,
    query: null,
    warnings: ["Esta sección no tiene binding de datos."]
  };

  const allAvailable = mappedSet(availability);
  const required = requiredState(bindingConfig, allAvailable);
  const compatible = compatibleSources(bindingConfig, availability);
  const compatibleAvailable = fieldsFromSources(compatible);
  const available = compatible.length ? compatibleAvailable : allAvailable;
  const hasImports = Boolean(availability && availability.hasImports);
  const mappedCount = Number(availability && availability.availableFields && availability.availableFields.length || 0);
  const scopeFilter = resolveScopeFilter(bindingConfig, instance, available);
  const compatibleSheet = compatible.length > 0;
  const scopeRequired = Boolean(
    String(instance && instance.scopeKey || "").trim() &&
    (bindingConfig.scopeFields || []).length &&
    ["required", "individual"].includes(bindingConfig.requirement === "required" ? "required" : bindingConfig.mode)
  );
  const missingScope = scopeRequired && !scopeFilter;

  let status = "ready";
  if (!hasImports) status = "no_imports";
  else if (!mappedCount) status = "mapping_pending";
  else if (!required.ok || missingScope || !compatibleSheet) status = "missing_fields";

  const ready = status === "ready";
  const baseWhere = (bindingConfig.where || []).filter((condition) => condition && available.has(condition.field));
  const baseAnyOf = (bindingConfig.anyOf || []).filter((condition) => condition && available.has(condition.field));
  const query = ready ? {
    importIds: Array.from(new Set(compatible.map((item) => item.importId))),
    sheet: Array.from(new Set(compatible.map((item) => item.sheet))),
    where: baseWhere.concat(scopeFilter ? [scopeFilter] : []),
    anyOf: baseAnyOf,
    dimensions: pickAvailable(bindingConfig.dimensions, available),
    measures: pickAvailable(bindingConfig.measures, available),
    groupBy: pickAvailable(bindingConfig.groupBy, available),
    distinctBy: pickAvailable(bindingConfig.distinctBy, available),
    select: pickAvailable(bindingConfig.select, available),
    privacyMode: bindingConfig.privacyMode || (bindingConfig.mode === "individual" ? "individual" : "aggregate"),
    includeCountsForAi: bindingConfig.includeCountsForAi === true,
    includeSampleRows: bindingConfig.includeSampleRows === true,
    allowRawRowsForAi: bindingConfig.includeSampleRows === true,
    sampleLimit: bindingConfig.sampleLimit || 20
  } : null;

  const warnings = [];
  if (status === "no_imports") warnings.push("No hay Excel/CSV disponible para esta sección.");
  if (status === "mapping_pending") warnings.push("Hay archivos importados, pero todavía no tienen campos canónicos mapeados.");
  if (required.missingAll.length) warnings.push(`Faltan campos requeridos: ${required.missingAll.join(", ")}.`);
  required.missingAny.forEach((group) => warnings.push(`Falta al menos uno de estos campos: ${group.join(" / ")}.`));
  if (!compatibleSheet && hasImports && mappedCount && required.ok) {
    warnings.push("Los campos requeridos existen, pero no coinciden en una misma hoja de datos.");
  }
  if (missingScope) warnings.push(`No se pudo vincular el alcance ${instance.scopeType || ""} al Excel; falta uno de: ${(bindingConfig.scopeFields || []).join(", ")}.`);

  return {
    bindingId: bindingConfig.id,
    requirement: bindingConfig.requirement,
    mode: bindingConfig.mode,
    status,
    ready,
    query,
    availableFields: Array.from(available).sort(),
    compatibleSources: compatible.map((item) => ({ importId: item.importId, sheet: item.sheet })),
    missingAll: required.missingAll,
    missingAny: required.missingAny,
    warnings
  };
}

function plansReport(engineIds) {
  const ids = Array.isArray(engineIds) ? engineIds : Object.keys(ENGINE_DATA_PLANS);
  return {
    engineCount: ids.length,
    plannedEngineCount: ids.filter((id) => Array.isArray(ENGINE_DATA_PLANS[id])).length,
    enginesWithoutPlan: ids.filter((id) => !Array.isArray(ENGINE_DATA_PLANS[id])),
    bindingCount: ids.reduce((sum, id) => sum + (Array.isArray(ENGINE_DATA_PLANS[id]) ? ENGINE_DATA_PLANS[id].length : 0), 0)
  };
}

module.exports = {
  ENGINE_DATA_PLANS,
  bindingsForEngine,
  bindingFor,
  decorateSections,
  validatePlan,
  resolveBinding,
  plansReport
};
