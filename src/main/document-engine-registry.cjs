(function () {
  "use strict";

  const VERSION = "4.0.0";

  const SELECTED_DOCUMENT_IDS = [
    "utet-plan-complexivo",
    "utet-plan-trabajo",
    "utet-plan-articulo",
    "utet-informe-final",
    "utet-reporte-final-requisitos",
    "utet-cronograma-complexivo",
    "utet-comunicado-complexivo",
    "utet-designacion-tutores",
    "utet-ficha-temas",
    "utet-plagio-trabajo",
    "utet-cronograma-articulo",
    "utet-designacion-metodologicos",
    "utet-plagio-articulo",
    "utet-informe-induccion",
    "ugpa-necesidades-capacitacion",
    "ugpa-plan-capacitacion",
    "ugpa-informe-capacitacion",
    "ugpa-necesidades-formacion",
    "ugpa-plan-formacion",
    "ugpa-informe-formacion",
    "ugpa-acta-ccc",
    "ugpa-ficha-nivel",
    "ugpa-guia-carrera",
    "ugpa-planificacion-capacitacion",
    "ugpa-acuerdo-patrocinio",
    "ugpa-informe-final-capacitacion",
    "ugpa-instrumento-impacto",
    "ugpa-informe-impacto",
    "ugpa-plan-individual",
    "ugpa-reporte-plan-individual",
    "ugpa-reporte-seguimiento",
    "ugpa-comunicado-matriz"
  ];

  const BASE_RULES = [
    "Mantener coherencia estricta con los datos maestros del período y proceso.",
    "No inventar cifras, normas, fechas, carreras, sedes, personas ni resultados sin marcarlos como simulados en borrador.",
    "En resultados institucionales preferir porcentajes y agregados antes que cantidades absolutas, salvo que el motor indique lo contrario.",
    "No redactar afirmaciones que comprometan al instituto cuando los datos no tengan respaldo.",
    "Toda conclusión debe derivarse de resultados ya sustentados; toda recomendación debe vincularse a un hallazgo.",
    "Distinguir dato verificado, cálculo determinístico, inferencia de IA, simulación y edición humana.",
    "La versión final no muestra alertas, pero conserva internamente la trazabilidad.",
    "Aplicar APA 7 mediante el motor editorial; no confiar el formato final al texto libre de la IA.",
    "Toda tabla, figura o herramienta visual debe tener contexto previo y análisis posterior.",
    "Los títulos no pueden quedar huérfanos y las secciones de primer nivel deben iniciar en página nueva sin páginas vacías.",
    "Las herramientas visuales se seleccionan solo cuando aportan al análisis; no se fuerzan por plantilla."
  ];

  const VISUAL_TOOLSETS = Object.freeze({
    methodology: ["process_flow", "problem_tree", "objective_tree", "stakeholders"],
    results: ["bar", "line", "cards", "gap_analysis"],
    analysis: ["ishikawa", "foda", "came", "impact_matrix", "problem_tree", "objective_tree", "stakeholders", "gap_analysis", "process_flow", "pestel", "bar", "line", "cards"],
    summary: ["bar", "line", "cards", "impact_matrix", "gap_analysis"],
    none: []
  });

  const section = (key, title, type, options) => Object.assign({
    key,
    title,
    type: type || "ai",
    required: true,
    allowManualEdit: true,
    lockAfterApproval: true,
    regenerateOnDependencyChange: true,
    pageBreakBefore: true,
    keepWithNext: true,
    allowedVisuals: [],
    children: []
  }, options || {});

  const COMMON = {
    intro: section("INTRODUCCION", "Introducción", "stable_ai"),
    legal: section("BASE_LEGAL", "Base legal", "stable_ai"),
    alignment: section("ALINEACION_INSTITUCIONAL", "Alineación institucional", "stable_ai"),
    methodology: section("METODOLOGIA", "Metodología", "semi_stable_ai", { allowedVisuals: VISUAL_TOOLSETS.methodology }),
    results: section("RESULTADOS", "Resultados", "data_ai", { privacy: "percentage_first", allowedVisuals: VISUAL_TOOLSETS.results }),
    analysis: section("ANALISIS_RESULTADOS", "Análisis de resultados", "analysis_ai", {
      allowedVisuals: VISUAL_TOOLSETS.analysis,
      derivedFrom: ["RESULTADOS"]
    }),
    executive: section("RESUMEN_EJECUTIVO", "Resumen ejecutivo", "executive_summary", {
      allowedVisuals: VISUAL_TOOLSETS.summary,
      derivedFrom: ["RESULTADOS", "ANALISIS_RESULTADOS"],
      maxWords: 600,
      compact: true
    }),
    conclusions: section("CONCLUSIONES", "Conclusiones", "derived_ai", { derivedFrom: ["RESULTADOS", "ANALISIS_RESULTADOS"] }),
    recommendations: section("RECOMENDACIONES", "Recomendaciones", "derived_ai", { derivedFrom: ["RESULTADOS", "ANALISIS_RESULTADOS", "CONCLUSIONES"] }),
    references: section("REFERENCIAS", "Referencias", "references", { required: false, allowedVisuals: VISUAL_TOOLSETS.none }),
    annexes: section("ANEXOS", "Anexos", "annexes", { required: false, allowedVisuals: VISUAL_TOOLSETS.none })
  };

  const profiles = {
    detection: [
      COMMON.intro, COMMON.legal, COMMON.alignment, COMMON.methodology,
      section("CARACTERIZACION", "Caracterización del contexto", "data_ai"),
      COMMON.results,
      section("NECESIDADES_PRIORIZADAS", "Necesidades priorizadas", "derived_ai"),
      COMMON.conclusions, COMMON.recommendations, COMMON.annexes
    ],
    planning: [
      COMMON.intro, COMMON.legal, COMMON.alignment,
      section("OBJETIVOS", "Objetivos", "semi_stable_ai"),
      section("ALCANCE", "Alcance", "semi_stable_ai"),
      COMMON.methodology,
      section("PLANIFICACION", "Planificación", "data_ai"),
      section("CRONOGRAMA", "Cronograma", "data_table"),
      section("SEGUIMIENTO", "Seguimiento y control", "semi_stable_ai"),
      COMMON.conclusions, COMMON.annexes
    ],
    report: [
      COMMON.intro, COMMON.legal, COMMON.alignment, COMMON.methodology,
      COMMON.results, COMMON.analysis, COMMON.executive,
      COMMON.conclusions, COMMON.recommendations, COMMON.references, COMMON.annexes
    ],
    schedule: [
      section("OBJETIVO", "Objetivo", "stable_ai"),
      section("ALCANCE", "Alcance", "stable_ai"),
      section("CRONOGRAMA", "Cronograma", "data_table"),
      section("CONSIDERACIONES", "Consideraciones", "semi_stable_ai"),
      COMMON.annexes
    ],
    designation: [
      section("ANTECEDENTES", "Antecedentes", "stable_ai"),
      section("CRITERIOS", "Criterios de designación", "semi_stable_ai"),
      section("DESIGNACIONES", "Designaciones", "data_table"),
      section("RESPONSABILIDADES", "Responsabilidades", "stable_ai"),
      COMMON.annexes
    ],
    plagiarism: [
      section("IDENTIFICACION", "Identificación", "data"),
      section("FUENTE_ANTIPLAGIO", "Fuente del análisis", "data"),
      section("RESULTADO_ANTIPLAGIO", "Resultado de antiplagio", "data_ai", { privacy: "student_specific" }),
      section("OBSERVACIONES", "Observaciones", "ai"),
      COMMON.annexes
    ],
    compactReport: [
      COMMON.intro, COMMON.methodology, COMMON.results,
      COMMON.analysis, COMMON.executive,
      COMMON.conclusions, COMMON.recommendations, COMMON.references, COMMON.annexes
    ],
    curricular: [
      COMMON.intro, COMMON.legal, COMMON.alignment, COMMON.methodology,
      section("ANALISIS_CURRICULAR", "Análisis curricular", "data_ai"),
      section("ACUERDOS", "Acuerdos y acciones", "data_ai"),
      COMMON.conclusions, COMMON.recommendations, COMMON.annexes
    ],
    communication: [
      section("ANTECEDENTE", "Antecedente", "stable_ai"),
      section("INFORMACION", "Información comunicada", "data_ai"),
      section("DISPOSICIONES", "Disposiciones", "semi_stable_ai")
    ],
    individualPlan: [
      COMMON.intro,
      section("DIAGNOSTICO_INDIVIDUAL", "Diagnóstico individual", "data_ai"),
      section("PLAN_INDIVIDUAL", "Plan individual", "data_table"),
      section("SEGUIMIENTO", "Seguimiento", "data_ai"),
      COMMON.annexes
    ]
  };

  function cloneNode(item, order) {
    const copy = Object.assign({}, item, {
      order,
      allowedVisuals: Array.isArray(item.allowedVisuals) ? item.allowedVisuals.slice() : [],
      derivedFrom: Array.isArray(item.derivedFrom) ? item.derivedFrom.slice() : [],
      children: []
    });
    copy.children = (item.children || []).map((child, index) => cloneNode(child, index + 1));
    return copy;
  }

  function cloneSections(name) {
    return (profiles[name] || profiles.report).map((item, index) => cloneNode(item, index + 1));
  }

  const engines = [];
  function E(documentId, engineId, label, family, profile, cardinality, options) {
    engines.push(Object.assign({
      documentId,
      engineId,
      label,
      family,
      profile,
      cardinality,
      version: VERSION,
      sections: cloneSections(profile),
      rules: BASE_RULES.slice(),
      dependencies: [],
      scopeKeys: [],
      population: "all",
      active: true
    }, options || {}));
  }

  E("utet-plan-complexivo", "tit.regular.plan-complexivo", "Planificación de Examen Complexivo", "titulacion_regular", "planning", "period", {
    population: "regular", scopeKeys: ["period"]
  });
  E("utet-plan-trabajo", "tit.regular.plan-trabajo", "Planificación de Trabajo de Titulación", "titulacion_regular", "planning", "period", {
    population: "regular", scopeKeys: ["period"]
  });
  E("utet-plan-articulo", "tit.pvc.plan-articulo", "Planificación de Artículo Académico", "titulacion_pvc", "planning", "period", {
    population: "pvc", scopeKeys: ["period"]
  });
  E("utet-informe-final", "tit.regular.informe-final", "Informe Final del Proceso de Titulación · Regulares", "titulacion_regular", "report", "period_population", {
    population: "regular", scopeKeys: ["period", "population"],
    dependencies: ["tit.regular.plan-complexivo", "tit.regular.plan-trabajo", "tit.regular.cronograma-complexivo", "tit.requisitos.reporte-final", "tit.regular.plagio-trabajo", "tit.induccion.informe"]
  });
  E("utet-informe-final", "tit.pvc.informe-final", "Informe Final del Proceso de Titulación · PVC", "titulacion_pvc", "report", "period_population", {
    population: "pvc", scopeKeys: ["period", "population"],
    dependencies: ["tit.pvc.plan-articulo", "tit.pvc.cronograma-articulo", "tit.pvc.designacion-metodologicos", "tit.pvc.plagio-articulo", "tit.induccion.informe"]
  });
  E("utet-reporte-final-requisitos", "tit.requisitos.reporte-final", "Reporte Final de Requisitos", "titulacion", "compactReport", "period", {
    scopeKeys: ["period"]
  });
  E("utet-cronograma-complexivo", "tit.regular.cronograma-complexivo", "Cronograma de Exámenes Complexivos", "titulacion_regular", "schedule", "period_segment", {
    population: "regular", scopeKeys: ["period", "segment"], segments: ["superior", "universitario"]
  });
  E("utet-comunicado-complexivo", "tit.regular.comunicado-complexivo", "Comunicado de Titulación y Evaluación · Examen Complexivo", "titulacion_regular", "communication", "period_segment", {
    population: "regular", scopeKeys: ["period", "segment"], dependencies: ["tit.regular.cronograma-complexivo"]
  });
  E("utet-designacion-tutores", "tit.regular.designacion-tutores", "Designación de Tutores", "titulacion_regular", "designation", "period", {
    population: "regular", scopeKeys: ["period"], dependencies: ["tit.regular.plan-trabajo"]
  });
  E("utet-ficha-temas", "tit.regular.ficha-temas", "Ficha de Posibles Temas", "titulacion_regular", "compactReport", "period", {
    population: "regular", scopeKeys: ["period"], dependencies: ["tit.regular.plan-trabajo"]
  });
  E("utet-plagio-trabajo", "tit.regular.plagio-trabajo", "Porcentaje de Plagio · Trabajo de Titulación", "titulacion_regular", "plagiarism", "student", {
    population: "regular", scopeKeys: ["period", "student"]
  });
  E("utet-cronograma-articulo", "tit.pvc.cronograma-articulo", "Cronograma de Artículo Académico", "titulacion_pvc", "schedule", "period_segment", {
    population: "pvc", scopeKeys: ["period", "segment"]
  });
  E("utet-designacion-metodologicos", "tit.pvc.designacion-metodologicos", "Designación de Docentes Metodológicos", "titulacion_pvc", "designation", "period", {
    population: "pvc", scopeKeys: ["period"], dependencies: ["tit.pvc.plan-articulo"]
  });
  E("utet-plagio-articulo", "tit.pvc.plagio-articulo", "Porcentaje de Plagio · Artículo Académico", "titulacion_pvc", "plagiarism", "student", {
    population: "pvc", scopeKeys: ["period", "student"]
  });
  E("utet-informe-induccion", "tit.induccion.informe", "Informe de Finalización de la Inducción", "titulacion", "report", "period_population", {
    scopeKeys: ["period", "population"]
  });

  E("ugpa-necesidades-capacitacion", "cap.deteccion", "Detección de Necesidades de Capacitación", "capacitacion", "detection", "period", { scopeKeys: ["period"] });
  E("ugpa-plan-capacitacion", "cap.plan", "Plan Semestral de Capacitación Docente", "capacitacion", "planning", "period", {
    scopeKeys: ["period"], dependencies: ["cap.deteccion"]
  });
  E("ugpa-informe-capacitacion", "cap.informe-cumplimiento", "Informe de Cumplimiento del Plan de Capacitación", "capacitacion", "report", "period", {
    scopeKeys: ["period"], dependencies: ["cap.plan", "cap.informe-final", "cap.impacto"]
  });

  E("ugpa-necesidades-formacion", "form.deteccion", "Detección de Necesidades de Formación", "formacion", "detection", "period", { scopeKeys: ["period"] });
  E("ugpa-plan-formacion", "form.plan", "Plan Anual de Formación Docente", "formacion", "planning", "period", {
    scopeKeys: ["period"], dependencies: ["form.deteccion"]
  });
  E("ugpa-informe-formacion", "form.informe", "Informe de Cumplimiento del Plan de Formación", "formacion", "report", "period", {
    scopeKeys: ["period"], dependencies: ["form.plan"]
  });

  E("ugpa-acta-ccc", "ccc.acta-colectivos", "Acta de Colectivos Docentes", "construccion_curricular", "curricular", "career_session", {
    scopeKeys: ["period", "career", "session"]
  });
  E("ugpa-ficha-nivel", "ccc.ficha-nivel", "Ficha Individual de Análisis por Nivel", "construccion_curricular", "curricular", "career_level", {
    scopeKeys: ["period", "career", "level"], dependencies: ["ccc.acta-colectivos"]
  });
  E("ugpa-guia-carrera", "ccc.guia-carrera", "Guía Curricular de Aplicación Académica", "construccion_curricular", "curricular", "career", {
    scopeKeys: ["period", "career"], dependencies: ["ccc.ficha-nivel"]
  });

  E("ugpa-planificacion-capacitacion", "cap.planificacion-actividad", "Planificación de la Capacitación", "capacitacion", "planning", "activity", {
    scopeKeys: ["period", "activity"], dependencies: ["cap.plan"]
  });
  E("ugpa-acuerdo-patrocinio", "cap.patrocinio", "Acuerdo de Patrocinio Institucional", "capacitacion", "compactReport", "activity", {
    scopeKeys: ["period", "activity"], dependencies: ["cap.planificacion-actividad"], optional: true
  });
  E("ugpa-informe-final-capacitacion", "cap.informe-final", "Informe Final de Capacitación", "capacitacion", "report", "activity", {
    scopeKeys: ["period", "activity"], dependencies: ["cap.planificacion-actividad"]
  });
  E("ugpa-instrumento-impacto", "cap.instrumento-impacto", "Instrumento de Evaluación de la Capacitación", "capacitacion", "compactReport", "activity", {
    scopeKeys: ["period", "activity"], dependencies: ["cap.planificacion-actividad"]
  });
  E("ugpa-informe-impacto", "cap.impacto", "Informe de Impacto de Capacitación", "capacitacion", "report", "activity", {
    scopeKeys: ["period", "activity"], dependencies: ["cap.instrumento-impacto", "cap.informe-final"]
  });

  E("ugpa-plan-individual", "plan-individual.plan", "Plan Individual de Formación y Capacitación", "plan_individual", "individualPlan", "person", {
    scopeKeys: ["period", "person"], dependencies: ["form.deteccion", "cap.deteccion"]
  });
  E("ugpa-reporte-plan-individual", "plan-individual.reporte", "Reporte General de Resultados del Plan", "plan_individual", "report", "period", {
    scopeKeys: ["period"], dependencies: ["plan-individual.plan"]
  });
  E("ugpa-reporte-seguimiento", "form.seguimiento", "Reporte de Seguimiento de Formación Docente", "formacion", "report", "period", {
    scopeKeys: ["period"], dependencies: ["form.plan", "form.informe"]
  });
  E("ugpa-comunicado-matriz", "ccc.comunicado-matriz", "Comunicado de Carga de Matriz CCC", "construccion_curricular", "communication", "period", {
    scopeKeys: ["period"], dependencies: ["ccc.guia-carrera"]
  });

  const byEngine = new Map(engines.map((item) => [item.engineId, item]));
  const byDocument = new Map();
  engines.forEach((item) => {
    if (!byDocument.has(item.documentId)) byDocument.set(item.documentId, []);
    byDocument.get(item.documentId).push(item);
  });

  function getEngine(engineId) {
    return byEngine.get(engineId) || null;
  }

  function enginesForDocument(documentId) {
    return (byDocument.get(documentId) || []).map((item) => Object.assign({}, item, {
      sections: item.sections.map((sectionItem, index) => cloneNode(sectionItem, index + 1)),
      rules: item.rules.slice(),
      dependencies: item.dependencies.slice()
    }));
  }

  function allEngines() {
    return engines.map((item) => Object.assign({}, item, {
      sections: item.sections.map((sectionItem, index) => cloneNode(sectionItem, index + 1)),
      rules: item.rules.slice(),
      dependencies: item.dependencies.slice()
    }));
  }

  function filterCatalog(catalog) {
    const allowed = new Set(SELECTED_DOCUMENT_IDS);
    const units = (catalog.units || []).map((unit) => {
      const processes = (unit.processes || []).map((process) => {
        const documents = (process.documents || []).filter((document) => allowed.has(document.id));
        return Object.assign({}, process, { documents });
      }).filter((process) => process.documents.length);
      return Object.assign({}, unit, { processes });
    }).filter((unit) => unit.processes.length);
    return Object.assign({}, catalog, { units });
  }

  module.exports = {
    VERSION,
    BASE_RULES,
    VISUAL_TOOLSETS,
    SELECTED_DOCUMENT_IDS,
    allEngines,
    getEngine,
    enginesForDocument,
    filterCatalog
  };
})();
