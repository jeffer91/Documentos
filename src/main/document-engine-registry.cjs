(function () {
  "use strict";

  const outline = require("./document-outline-service.cjs");
  const dataBindings = require("./document-data-binding-service.cjs");
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
    // null = la jerarquía decide: solo nivel 1 inicia página nueva.
    pageBreakBefore: null,
    keepWithNext: true,
    allowedVisuals: [],
    contract: {},
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

  // Biblioteca de secciones reutilizables. La biblioteca NO decide qué secciones
  // componen un documento: cada engineId tiene su propio blueprint explícito.
  const SECTION_LIBRARY = Object.freeze({
    INTRODUCCION: COMMON.intro,
    BASE_LEGAL: COMMON.legal,
    ALINEACION_INSTITUCIONAL: COMMON.alignment,
    METODOLOGIA: COMMON.methodology,
    RESULTADOS: COMMON.results,
    ANALISIS_RESULTADOS: COMMON.analysis,
    RESUMEN_EJECUTIVO: COMMON.executive,
    CONCLUSIONES: COMMON.conclusions,
    RECOMENDACIONES: COMMON.recommendations,
    REFERENCIAS: COMMON.references,
    ANEXOS: COMMON.annexes,

    CARACTERIZACION: section("CARACTERIZACION", "Caracterización del contexto", "data_ai"),
    NECESIDADES_PRIORIZADAS: section("NECESIDADES_PRIORIZADAS", "Necesidades priorizadas", "derived_ai", {
      derivedFrom: ["RESULTADOS", "ANALISIS_RESULTADOS"]
    }),
    OBJETIVOS: section("OBJETIVOS", "Objetivos", "semi_stable_ai"),
    OBJETIVO: section("OBJETIVO", "Objetivo", "stable_ai"),
    ALCANCE: section("ALCANCE", "Alcance", "semi_stable_ai"),
    PLANIFICACION: section("PLANIFICACION", "Planificación", "data_ai"),
    CRONOGRAMA: section("CRONOGRAMA", "Cronograma", "data_table"),
    SEGUIMIENTO: section("SEGUIMIENTO", "Seguimiento y control", "semi_stable_ai"),
    CONSIDERACIONES: section("CONSIDERACIONES", "Consideraciones", "semi_stable_ai"),
    CONCLUSIONES_PLANIFICACION: section("CONCLUSIONES", "Conclusiones", "derived_ai", {
      derivedFrom: ["PLANIFICACION", "CRONOGRAMA", "SEGUIMIENTO"]
    }),

    ANTECEDENTES: section("ANTECEDENTES", "Antecedentes", "stable_ai"),
    CRITERIOS: section("CRITERIOS", "Criterios de designación", "semi_stable_ai"),
    DESIGNACIONES: section("DESIGNACIONES", "Designaciones", "data_table"),
    RESPONSABILIDADES: section("RESPONSABILIDADES", "Responsabilidades", "stable_ai"),

    IDENTIFICACION: section("IDENTIFICACION", "Identificación", "data"),
    FUENTE_ANTIPLAGIO: section("FUENTE_ANTIPLAGIO", "Fuente del análisis", "data"),
    RESULTADO_ANTIPLAGIO: section("RESULTADO_ANTIPLAGIO", "Resultado de antiplagio", "data_ai", { privacy: "student_specific" }),
    OBSERVACIONES: section("OBSERVACIONES", "Observaciones", "ai"),

    ANALISIS_CURRICULAR: section("ANALISIS_CURRICULAR", "Análisis curricular", "data_ai"),
    ACUERDOS: section("ACUERDOS", "Acuerdos y acciones", "data_ai"),
    CONCLUSIONES_CURRICULAR: section("CONCLUSIONES", "Conclusiones", "derived_ai", {
      derivedFrom: ["ANALISIS_CURRICULAR", "ACUERDOS"]
    }),
    RECOMENDACIONES_CURRICULAR: section("RECOMENDACIONES", "Recomendaciones", "derived_ai", {
      derivedFrom: ["ANALISIS_CURRICULAR", "ACUERDOS", "CONCLUSIONES"]
    }),

    ANTECEDENTE: section("ANTECEDENTE", "Antecedente", "stable_ai"),
    INFORMACION: section("INFORMACION", "Información comunicada", "data_ai"),
    DISPOSICIONES: section("DISPOSICIONES", "Disposiciones", "semi_stable_ai"),

    DIAGNOSTICO_INDIVIDUAL: section("DIAGNOSTICO_INDIVIDUAL", "Diagnóstico individual", "data_ai"),
    PLAN_INDIVIDUAL: section("PLAN_INDIVIDUAL", "Plan individual", "data_table"),
    SEGUIMIENTO_INDIVIDUAL: section("SEGUIMIENTO", "Seguimiento", "data_ai")
  });

  const FORM_DETECTION_BLUEPRINT = Object.freeze([
    { use: "INTRODUCCION", overrides: {
      title: "Introducción",
      contract: {
        purpose: "Presentar el propósito, alcance y contexto del diagnóstico de necesidades de formación docente.",
        sourcePolicy: "datos_maestros_y_fuentes_institucionales",
        evidenceRequired: true,
        visualPolicy: "none",
        dataNeeds: [],
        promptInstructions: ["No anticipar resultados que todavía no hayan sido analizados."]
      }
    }},
    { use: "BASE_LEGAL", overrides: {
      title: "Base Legal",
      contract: {
        purpose: "Sustentar el diagnóstico exclusivamente en normativa y fuentes institucionales registradas.",
        sourcePolicy: "fuentes_institucionales_citables",
        evidenceRequired: true,
        visualPolicy: "none",
        dataNeeds: [],
        promptInstructions: ["Usar únicamente fuentes con metadatos de cita completos cuando se incorporen citas."]
      }
    }},
    { use: "ALINEACION_INSTITUCIONAL", overrides: {
      title: "Alineación Estratégica",
      contract: {
        purpose: "Relacionar las necesidades de formación con la planificación, objetivos y prioridades institucionales disponibles.",
        sourcePolicy: "fuentes_institucionales_y_datos_maestros",
        evidenceRequired: true,
        visualPolicy: "optional",
        dataNeeds: [],
        promptInstructions: ["Explicar la relación estratégica sin inventar planes, objetivos ni indicadores."]
      }
    }},
    section("METODOLOGIA", "Metodología y Enfoque", "semi_stable_ai", {
      contract: {
        purpose: "Describir de forma reproducible cómo se levantó, organizó y analizó la información.",
        sourcePolicy: "datos_maestros_instrumentos_y_metadatos_del_levantamiento",
        evidenceRequired: true,
        visualPolicy: "recommended",
        dataNeeds: [],
        promptInstructions: ["La metodología debe corresponder con los datos realmente disponibles y no describir procedimientos que no hayan sido ejecutados."]
      },
      children: [
        section("METODOLOGIA_OBJETIVO_GENERAL", "Objetivo General", "stable_ai"),
        section("METODOLOGIA_OBJETIVOS_ESPECIFICOS", "Objetivos Específicos", "stable_ai"),
        section("METODOLOGIA_ESTRATEGIA_LEVANTAMIENTO", "Estrategia de levantamiento", "semi_stable_ai"),
        section("METODOLOGIA_POBLACION_MUESTRA", "Población y muestra", "data_ai"),
        section("METODOLOGIA_INSTRUMENTOS", "Instrumentos", "semi_stable_ai"),
        section("METODOLOGIA_PROCEDIMIENTO", "Procedimiento", "semi_stable_ai"),
        section("METODOLOGIA_FLUJO", "Diagrama de flujo del proceso", "analysis_ai", {
          allowedVisuals: ["process_flow"],
          contract: {
            purpose: "Representar visualmente las etapas reales del levantamiento y análisis.",
            sourcePolicy: "metodologia_verificada",
            evidenceRequired: true,
            visualPolicy: "required",
            dataNeeds: [],
            promptInstructions: ["Generar un visual process_flow solo con pasos respaldados por el procedimiento descrito."]
          }
        }),
        section("METODOLOGIA_CRITERIOS_ANALISIS", "Criterios de análisis", "semi_stable_ai")
      ]
    }),
    section("CARACTERIZACION_CLAUSTRO", "Caracterización del Claustro Docente", "data_ai", {
      contract: {
        purpose: "Describir el claustro utilizando únicamente dimensiones presentes en la base de datos.",
        sourcePolicy: "datos_estructurados",
        evidenceRequired: true,
        visualPolicy: "recommended",
        dataNeeds: [],
        promptInstructions: ["Omitir dimensiones sin datos suficientes."]
      },
      children: [
        section("CARACTERIZACION_COORDINACIONES", "Distribución por coordinación académica o carrera", "data_ai", { required: false, allowedVisuals: ["bar", "cards"], layout: { optionalToggle: true, aiRecommendation: true } }),
        section("CARACTERIZACION_FORMACION", "Perfil académico y nivel de formación", "data_ai", { required: false, allowedVisuals: ["bar", "cards"], layout: { optionalToggle: true, aiRecommendation: true } }),
        section("CARACTERIZACION_EXPERIENCIA", "Experiencia docente", "data_ai", { required: false, allowedVisuals: ["bar", "cards"], layout: { optionalToggle: true, aiRecommendation: true } }),
        section("CARACTERIZACION_VINCULACION", "Vinculación y dedicación docente", "data_ai", { required: false, allowedVisuals: ["bar", "cards"], layout: { optionalToggle: true, aiRecommendation: true } }),
        section("CARACTERIZACION_AREAS", "Áreas o campos de conocimiento", "data_ai", { required: false, allowedVisuals: ["bar", "cards"], layout: { optionalToggle: true, aiRecommendation: true } })
      ]
    }),
    section("ANALISIS_INTERPRETACION", "Análisis e Interpretación de Resultados", "analysis_ai", {
      contract: {
        purpose: "Integrar el análisis cuantitativo y cualitativo del diagnóstico sin recalcular los agregados entregados por la aplicación.",
        sourcePolicy: "datos_estructurados_y_fuentes_institucionales",
        evidenceRequired: true,
        visualPolicy: "recommended",
        dataNeeds: [],
        promptInstructions: ["Cada interpretación debe señalar la evidencia que la sustenta."]
      },
      children: [
        section("ANALISIS_GLOBAL", "Análisis global", "data_ai", { allowedVisuals: ["bar", "cards"] }),
        section("ANALISIS_BRECHAS", "Análisis de brechas", "analysis_ai", { allowedVisuals: ["gap_analysis"] }),
        section("ANALISIS_DISPONIBILIDAD", "Disponibilidad para formación", "data_ai", { allowedVisuals: ["bar", "cards"] }),
        section("ANALISIS_INTERESES", "Intereses formativos", "data_ai", { allowedVisuals: ["bar", "cards"] }),
        section("ANALISIS_COMPARATIVO_CARRERA", "Comparativo por carrera", "data_ai", { allowedVisuals: ["bar", "cards"] }),
        section("ANALISIS_CUALITATIVO", "Análisis cualitativo", "analysis_ai", { allowedVisuals: ["cards"] }),
        section("ANALISIS_TRIANGULACION", "Triangulación de información", "analysis_ai"),
        section("ANALISIS_MATRIZ_PRIORIZACION", "Matriz de priorización", "analysis_ai", {
          allowedVisuals: ["impact_matrix"],
          contract: {
            purpose: "Explicar la priorización calculada por la aplicación; la IA no asigna puntajes arbitrarios.",
            sourcePolicy: "calculos_deterministicos_y_datos",
            evidenceRequired: true,
            visualPolicy: "recommended",
            dataNeeds: [],
            promptInstructions: ["Interpretar la matriz recibida sin modificar puntajes ni recalcular resultados."]
          }
        }),
        section("ANALISIS_ARBOL_PROBLEMAS", "Árbol de problemas", "analysis_ai", {
          allowedVisuals: ["problem_tree"],
          contract: {
            purpose: "Representar causas y efectos sustentados por los hallazgos.",
            sourcePolicy: "hallazgos_analizados",
            evidenceRequired: true,
            visualPolicy: "required",
            dataNeeds: [],
            promptInstructions: ["No incorporar causas o efectos sin respaldo en resultados."]
          }
        }),
        section("ANALISIS_MAPA_CALOR", "Mapa de calor de necesidades", "data_ai", {
          allowedVisuals: ["heatmap"],
          contract: {
            purpose: "Visualizar intensidad o recurrencia de necesidades por carrera o dimensión.",
            sourcePolicy: "datos_estructurados",
            evidenceRequired: true,
            visualPolicy: "required",
            dataNeeds: [],
            promptInstructions: ["Usar exclusivamente los valores calculados suministrados por la aplicación."]
          }
        }),
        section("ANALISIS_FODA", "Análisis estratégico FODA", "analysis_ai", { allowedVisuals: ["foda"] }),
        section("ANALISIS_SINTESIS", "Síntesis de hallazgos", "derived_ai", {
          derivedFrom: ["ANALISIS_GLOBAL","ANALISIS_BRECHAS","ANALISIS_DISPONIBILIDAD","ANALISIS_INTERESES","ANALISIS_COMPARATIVO_CARRERA","ANALISIS_CUALITATIVO","ANALISIS_TRIANGULACION","ANALISIS_MATRIZ_PRIORIZACION","ANALISIS_ARBOL_PROBLEMAS","ANALISIS_MAPA_CALOR","ANALISIS_FODA"]
        })
      ]
    }),
    section("LINEAS_FORMACION_COORDINACION", "Líneas de Formación por Coordinación Académica", "data_ai", {
      contract: {
        purpose: "Traducir los hallazgos en líneas de formación diferenciadas por coordinación académica o carrera.",
        sourcePolicy: "datos_filtrados_por_coordinacion",
        evidenceRequired: true,
        visualPolicy: "optional",
        dataNeeds: [],
        promptInstructions: ["Crear apartados únicamente para coordinaciones o carreras presentes en los datos."]
      },
      layout: { dynamicSubsections: "career", aiRecommendation: true }
    }),
    section("COBERTURA_INSTITUCIONAL", "Cobertura Institucional", "data_ai", {
      allowedVisuals: ["bar", "cards"],
      contract: {
        purpose: "Explicar el alcance y representatividad del levantamiento por las dimensiones disponibles.",
        sourcePolicy: "datos_estructurados",
        evidenceRequired: true,
        visualPolicy: "recommended",
        dataNeeds: [],
        promptInstructions: ["Identificar limitaciones de cobertura cuando existan."]
      }
    }),
    section("PRIORIZACION_INSTITUCIONAL", "Propuesta de Priorización Institucional", "derived_ai", {
      derivedFrom: ["ANALISIS_SINTESIS","COBERTURA_INSTITUCIONAL","LINEAS_FORMACION_COORDINACION"],
      children: [
        section("PRIORIZACION_CRITICAS", "Necesidades críticas", "derived_ai", { derivedFrom: ["ANALISIS_MATRIZ_PRIORIZACION","ANALISIS_SINTESIS"] }),
        section("PRIORIZACION_CORTO_PLAZO", "Corto plazo", "derived_ai", { derivedFrom: ["PRIORIZACION_CRITICAS"] }),
        section("PRIORIZACION_MEDIANO_PLAZO", "Mediano plazo", "derived_ai", { derivedFrom: ["PRIORIZACION_CRITICAS"] }),
        section("PRIORIZACION_LARGO_PLAZO", "Largo plazo", "derived_ai", { derivedFrom: ["PRIORIZACION_CRITICAS"] }),
        section("PRIORIZACION_INDICADORES", "Indicadores de seguimiento", "derived_ai", { derivedFrom: ["PRIORIZACION_CORTO_PLAZO","PRIORIZACION_MEDIANO_PLAZO","PRIORIZACION_LARGO_PLAZO"] })
      ]
    }),
    { use: "RESUMEN_EJECUTIVO", overrides: {
      title: "Resumen Ejecutivo",
      derivedFrom: ["ANALISIS_SINTESIS","PRIORIZACION_INSTITUCIONAL","COBERTURA_INSTITUCIONAL"],
      maxWords: 600
    }},
    { use: "CONCLUSIONES", overrides: {
      title: "Conclusiones",
      derivedFrom: ["ANALISIS_SINTESIS","PRIORIZACION_INSTITUCIONAL"]
    }},
    { use: "RECOMENDACIONES", overrides: {
      title: "Recomendaciones",
      derivedFrom: ["CONCLUSIONES","PRIORIZACION_INSTITUCIONAL"]
    }},
    { use: "REFERENCIAS", overrides: { title: "Bibliografía", required: false }},
    { use: "ANEXOS", overrides: { title: "Anexos", required: false }}
  ]);

  // Fuente de estructura: 1 blueprint por engineId. No existe fallback a un
  // perfil genérico. Dos motores pueden empezar con la misma secuencia hoy,
  // pero la secuencia pertenece a cada motor y podrá evolucionar por separado.
  const ENGINE_BLUEPRINTS = Object.freeze({
    "tit.regular.plan-complexivo": Object.freeze(["INTRODUCCION","BASE_LEGAL","ALINEACION_INSTITUCIONAL","OBJETIVOS","ALCANCE","METODOLOGIA","PLANIFICACION","CRONOGRAMA","SEGUIMIENTO","CONCLUSIONES_PLANIFICACION","ANEXOS"]),
    "tit.regular.plan-trabajo": Object.freeze(["INTRODUCCION","BASE_LEGAL","ALINEACION_INSTITUCIONAL","OBJETIVOS","ALCANCE","METODOLOGIA","PLANIFICACION","CRONOGRAMA","SEGUIMIENTO","CONCLUSIONES_PLANIFICACION","ANEXOS"]),
    "tit.pvc.plan-articulo": Object.freeze(["INTRODUCCION","BASE_LEGAL","ALINEACION_INSTITUCIONAL","OBJETIVOS","ALCANCE","METODOLOGIA","PLANIFICACION","CRONOGRAMA","SEGUIMIENTO","CONCLUSIONES_PLANIFICACION","ANEXOS"]),

    "tit.regular.informe-final": Object.freeze(["INTRODUCCION","BASE_LEGAL","ALINEACION_INSTITUCIONAL","METODOLOGIA","RESULTADOS","ANALISIS_RESULTADOS","RESUMEN_EJECUTIVO","CONCLUSIONES","RECOMENDACIONES","REFERENCIAS","ANEXOS"]),
    "tit.pvc.informe-final": Object.freeze(["INTRODUCCION","BASE_LEGAL","ALINEACION_INSTITUCIONAL","METODOLOGIA","RESULTADOS","ANALISIS_RESULTADOS","RESUMEN_EJECUTIVO","CONCLUSIONES","RECOMENDACIONES","REFERENCIAS","ANEXOS"]),
    "tit.requisitos.reporte-final": Object.freeze(["INTRODUCCION","METODOLOGIA","RESULTADOS","ANALISIS_RESULTADOS","RESUMEN_EJECUTIVO","CONCLUSIONES","RECOMENDACIONES","REFERENCIAS","ANEXOS"]),

    "tit.regular.cronograma-complexivo": Object.freeze(["OBJETIVO","ALCANCE","CRONOGRAMA","CONSIDERACIONES","ANEXOS"]),
    "tit.regular.comunicado-complexivo": Object.freeze(["ANTECEDENTE","INFORMACION","DISPOSICIONES"]),
    "tit.regular.designacion-tutores": Object.freeze(["ANTECEDENTES","CRITERIOS","DESIGNACIONES","RESPONSABILIDADES","ANEXOS"]),
    "tit.regular.ficha-temas": Object.freeze(["INTRODUCCION","METODOLOGIA","RESULTADOS","ANALISIS_RESULTADOS","RESUMEN_EJECUTIVO","CONCLUSIONES","RECOMENDACIONES","REFERENCIAS","ANEXOS"]),
    "tit.regular.plagio-trabajo": Object.freeze(["IDENTIFICACION","FUENTE_ANTIPLAGIO","RESULTADO_ANTIPLAGIO","OBSERVACIONES","ANEXOS"]),

    "tit.pvc.cronograma-articulo": Object.freeze(["OBJETIVO","ALCANCE","CRONOGRAMA","CONSIDERACIONES","ANEXOS"]),
    "tit.pvc.designacion-metodologicos": Object.freeze(["ANTECEDENTES","CRITERIOS","DESIGNACIONES","RESPONSABILIDADES","ANEXOS"]),
    "tit.pvc.plagio-articulo": Object.freeze(["IDENTIFICACION","FUENTE_ANTIPLAGIO","RESULTADO_ANTIPLAGIO","OBSERVACIONES","ANEXOS"]),
    "tit.induccion.informe": Object.freeze(["INTRODUCCION","BASE_LEGAL","ALINEACION_INSTITUCIONAL","METODOLOGIA","RESULTADOS","ANALISIS_RESULTADOS","RESUMEN_EJECUTIVO","CONCLUSIONES","RECOMENDACIONES","REFERENCIAS","ANEXOS"]),

    "cap.deteccion": Object.freeze(["INTRODUCCION","BASE_LEGAL","ALINEACION_INSTITUCIONAL","METODOLOGIA","CARACTERIZACION","RESULTADOS",{"use":"ANALISIS_RESULTADOS","overrides":{"contract":{"purpose":"Interpretar cualitativa y cuantitativamente los hallazgos para explicar causas, brechas y prioridades.","sourcePolicy":"resultados_y_fuentes_institucionales","evidenceRequired":true,"visualPolicy":"recommended","dataNeeds":[],"promptInstructions":["Seleccionar solo las herramientas de análisis que aporten al caso.","Puede utilizar Ishikawa, FODA, CAME, árbol de problemas, matriz de impacto u otras herramientas habilitadas cuando correspondan."]}}},"NECESIDADES_PRIORIZADAS","CONCLUSIONES","RECOMENDACIONES","ANEXOS"]),
    "cap.plan": Object.freeze(["INTRODUCCION","BASE_LEGAL","ALINEACION_INSTITUCIONAL","OBJETIVOS","ALCANCE","METODOLOGIA","PLANIFICACION","CRONOGRAMA","SEGUIMIENTO","CONCLUSIONES_PLANIFICACION","ANEXOS"]),
    "cap.informe-cumplimiento": Object.freeze(["INTRODUCCION","BASE_LEGAL","ALINEACION_INSTITUCIONAL","METODOLOGIA","RESULTADOS","ANALISIS_RESULTADOS","RESUMEN_EJECUTIVO","CONCLUSIONES","RECOMENDACIONES","REFERENCIAS","ANEXOS"]),

    "form.deteccion": FORM_DETECTION_BLUEPRINT,
    "form.plan": Object.freeze(["INTRODUCCION","BASE_LEGAL","ALINEACION_INSTITUCIONAL","OBJETIVOS","ALCANCE","METODOLOGIA","PLANIFICACION","CRONOGRAMA","SEGUIMIENTO","CONCLUSIONES_PLANIFICACION","ANEXOS"]),
    "form.informe": Object.freeze(["INTRODUCCION","BASE_LEGAL","ALINEACION_INSTITUCIONAL","METODOLOGIA","RESULTADOS","ANALISIS_RESULTADOS","RESUMEN_EJECUTIVO","CONCLUSIONES","RECOMENDACIONES","REFERENCIAS","ANEXOS"]),

    "ccc.acta-colectivos": Object.freeze(["INTRODUCCION","BASE_LEGAL","ALINEACION_INSTITUCIONAL","METODOLOGIA","ANALISIS_CURRICULAR","ACUERDOS","CONCLUSIONES_CURRICULAR","RECOMENDACIONES_CURRICULAR","ANEXOS"]),
    "ccc.ficha-nivel": Object.freeze(["INTRODUCCION","BASE_LEGAL","ALINEACION_INSTITUCIONAL","METODOLOGIA","ANALISIS_CURRICULAR","ACUERDOS","CONCLUSIONES_CURRICULAR","RECOMENDACIONES_CURRICULAR","ANEXOS"]),
    "ccc.guia-carrera": Object.freeze(["INTRODUCCION","BASE_LEGAL","ALINEACION_INSTITUCIONAL","METODOLOGIA","ANALISIS_CURRICULAR","ACUERDOS","CONCLUSIONES_CURRICULAR","RECOMENDACIONES_CURRICULAR","ANEXOS"]),

    "cap.planificacion-actividad": Object.freeze(["INTRODUCCION","BASE_LEGAL","ALINEACION_INSTITUCIONAL","OBJETIVOS","ALCANCE","METODOLOGIA","PLANIFICACION","CRONOGRAMA","SEGUIMIENTO","CONCLUSIONES_PLANIFICACION","ANEXOS"]),
    "cap.patrocinio": Object.freeze(["INTRODUCCION","METODOLOGIA","RESULTADOS","ANALISIS_RESULTADOS","RESUMEN_EJECUTIVO","CONCLUSIONES","RECOMENDACIONES","REFERENCIAS","ANEXOS"]),
    "cap.informe-final": Object.freeze(["INTRODUCCION","BASE_LEGAL","ALINEACION_INSTITUCIONAL","METODOLOGIA","RESULTADOS","ANALISIS_RESULTADOS","RESUMEN_EJECUTIVO","CONCLUSIONES","RECOMENDACIONES","REFERENCIAS","ANEXOS"]),
    "cap.instrumento-impacto": Object.freeze(["INTRODUCCION","METODOLOGIA","RESULTADOS","ANALISIS_RESULTADOS","RESUMEN_EJECUTIVO","CONCLUSIONES","RECOMENDACIONES","REFERENCIAS","ANEXOS"]),
    "cap.impacto": Object.freeze(["INTRODUCCION","BASE_LEGAL","ALINEACION_INSTITUCIONAL","METODOLOGIA","RESULTADOS","ANALISIS_RESULTADOS","RESUMEN_EJECUTIVO","CONCLUSIONES","RECOMENDACIONES","REFERENCIAS","ANEXOS"]),

    "plan-individual.plan": Object.freeze(["INTRODUCCION","DIAGNOSTICO_INDIVIDUAL","PLAN_INDIVIDUAL","SEGUIMIENTO_INDIVIDUAL","ANEXOS"]),
    "plan-individual.reporte": Object.freeze(["INTRODUCCION","BASE_LEGAL","ALINEACION_INSTITUCIONAL","METODOLOGIA","RESULTADOS","ANALISIS_RESULTADOS","RESUMEN_EJECUTIVO","CONCLUSIONES","RECOMENDACIONES","REFERENCIAS","ANEXOS"]),
    "form.seguimiento": Object.freeze(["INTRODUCCION","BASE_LEGAL","ALINEACION_INSTITUCIONAL","METODOLOGIA","RESULTADOS","ANALISIS_RESULTADOS","RESUMEN_EJECUTIVO","CONCLUSIONES","RECOMENDACIONES","REFERENCIAS","ANEXOS"]),
    "ccc.comunicado-matriz": Object.freeze(["ANTECEDENTE","INFORMACION","DISPOSICIONES"])
  });

  const ALL_VISUAL_TOOLS = Array.from(new Set(
    Object.values(VISUAL_TOOLSETS).flat()
  ));

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.getOwnPropertyNames(value).forEach((key) => deepFreeze(value[key]));
    return Object.freeze(value);
  }

  function compileSectionsForEngine(engineId) {
    const blueprint = ENGINE_BLUEPRINTS[engineId];
    if (!blueprint) throw new Error(`El motor ${engineId} no tiene blueprint independiente.`);
    const compiled = outline.compileOutline(engineId, blueprint, SECTION_LIBRARY, {
      allowedVisuals: ALL_VISUAL_TOOLS
    });
    const sections = dataBindings.decorateSections(engineId, compiled.sections);
    const dataPlanValidation = dataBindings.validatePlan(engineId, sections);
    if (!dataPlanValidation.ok) {
      throw new Error(dataPlanValidation.errors.join(" | "));
    }
    return Object.assign({}, compiled, {
      sections,
      dataPlanValidation,
      dataBindings: dataBindings.bindingsForEngine(engineId) || []
    });
  }

  function cloneEngine(item) {
    return item ? outline.deepClone(item) : null;
  }

  function engineStructureReport(engineId) {
    const engine = engines.find((item) => item.engineId === engineId);
    if (!engine) return null;
    const validation = outline.validateCompiledOutline(engineId, engine.sections, {
      allowedVisuals: ALL_VISUAL_TOOLS
    });
    return {
      engineId,
      outlineStatus: engine.outlineStatus || "scaffold",
      outlineVersion: Number(engine.outlineVersion || 1),
      ok: validation.ok,
      errors: validation.errors,
      warnings: validation.warnings,
      summary: validation.summary
    };
  }

  function allStructureReports() {
    return engines.map((item) => engineStructureReport(item.engineId));
  }

  function dataPlanReport() {
    const report = dataBindings.plansReport(engines.map((item) => item.engineId));
    const invalidPlans = engines
      .map((item) => ({
        engineId: item.engineId,
        validation: dataBindings.validatePlan(item.engineId, item.sections)
      }))
      .filter((item) => !item.validation.ok);
    return Object.assign({}, report, {
      invalidPlans,
      valid: report.enginesWithoutPlan.length === 0 && invalidPlans.length === 0
    });
  }

  function registryIndependenceReport() {
    const ids = Object.keys(ENGINE_BLUEPRINTS);
    const engineIds = engines.map((item) => item.engineId);
    const missingBlueprints = engineIds.filter((engineId) => !ENGINE_BLUEPRINTS[engineId]);
    const orphanBlueprints = ids.filter((engineId) => !engineIds.includes(engineId));
    const owners = engines.map((item) => item.definitionOwner);
    const invalidStructures = engines
      .map((item) => engineStructureReport(item.engineId))
      .filter((item) => item && !item.ok)
      .map((item) => ({ engineId: item.engineId, errors: item.errors }));
    return {
      engineCount: engines.length,
      blueprintCount: ids.length,
      uniqueDefinitionOwners: new Set(owners).size,
      missingBlueprints,
      orphanBlueprints,
      invalidStructures,
      independent: (
        engines.length > 0 &&
        engines.length === ids.length &&
        new Set(owners).size === engines.length &&
        missingBlueprints.length === 0 &&
        orphanBlueprints.length === 0 &&
        invalidStructures.length === 0
      )
    };
  }

  const engines = [];
  function E(documentId, engineId, label, family, legacyProfile, cardinality, options) {
    if (engines.some((item) => item.engineId === engineId)) {
      throw new Error(`Motor duplicado: ${engineId}.`);
    }
    const input = outline.deepClone(options || {});
    const compiled = compileSectionsForEngine(engineId);
    const engine = Object.assign({
      documentId,
      engineId,
      label,
      family,
      // Se mantiene solo por compatibilidad de hash con instancias existentes.
      // Ya no construye sections ni crea herencia estructural.
      profile: legacyProfile,
      legacyProfile,
      definitionOwner: engineId,
      definitionSource: "engine_blueprint",
      independentDefinition: true,
      cardinality,
      version: VERSION,
      outlineStatus: "scaffold",
      outlineVersion: 1,
      outlineSummary: compiled.validation.summary,
      dataPlanStatus: "configured",
      dataPlanVersion: 1,
      dataBindingCount: compiled.dataBindings.length,
      sections: compiled.sections,
      rules: BASE_RULES.slice(),
      dependencies: [],
      scopeKeys: [],
      segments: [],
      population: "all",
      active: true
    }, input);
    // options.sections no puede sustituir silenciosamente la definición del registro.
    engine.sections = compiled.sections;
    engine.definitionOwner = engineId;
    engine.definitionSource = "engine_blueprint";
    engine.independentDefinition = true;
    engines.push(deepFreeze(engine));
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

  E("ugpa-necesidades-formacion", "form.deteccion", "Detección de Necesidades de Formación", "formacion", "detection", "period", { scopeKeys: ["period"], version: "4.1.0", outlineStatus: "confirmed", outlineVersion: 2, workflowMode: "sectional" });
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

  const independence = registryIndependenceReport();
  if (!independence.independent) {
    throw new Error(`Registro de motores no independiente: ${JSON.stringify(independence)}`);
  }

  const byEngine = new Map(engines.map((item) => [item.engineId, item]));
  const byDocument = new Map();
  engines.forEach((item) => {
    if (!byDocument.has(item.documentId)) byDocument.set(item.documentId, []);
    byDocument.get(item.documentId).push(item);
  });

  function getEngine(engineId) {
    return cloneEngine(byEngine.get(engineId) || null);
  }

  function enginesForDocument(documentId) {
    return (byDocument.get(documentId) || []).map(cloneEngine);
  }

  function allEngines() {
    return engines.map(cloneEngine);
  }

  function blueprintForEngine(engineId) {
    const blueprint = ENGINE_BLUEPRINTS[engineId];
    return blueprint ? outline.deepClone(blueprint) : null;
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
    blueprintForEngine,
    registryIndependenceReport,
    engineStructureReport,
    allStructureReports,
    dataPlanReport,
    getEngine,
    enginesForDocument,
    filterCatalog
  };
})();
