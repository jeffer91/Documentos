(function () {
  "use strict";

  const field = (id, label, type, options) => Object.assign({ id, label, type: type || "text" }, options || {});

  const F = {
    period: field("periodo", "Período", "text", { placeholder: "Mayo – Noviembre 2026" }),
    date: field("fecha", "Fecha", "date"),
    topic: field("tema", "Tema", "text"),
    objective: field("objetivo", "Objetivo", "textarea", { full: true }),
    context: field("contexto", "Información clave", "textarea", { full: true, placeholder: "Cuéntame lo realizado, lo necesario o lo ocurrido." }),
    scope: field("alcance", "Alcance", "textarea", { full: true }),
    results: field("resultados", "Resultados / datos clave", "textarea", { full: true }),
    methodology: field("metodologia", "Cómo se realizó", "textarea", { full: true }),
    population: field("poblacion", "Población", "text"),
    instrument: field("instrumento", "Instrumento", "text"),
    place: field("lugar", "Lugar", "text"),
    start: field("horaInicio", "Hora inicio", "time"),
    end: field("horaFin", "Hora fin", "time"),
    participants: field("participantes", "Participantes", "textarea", { full: true, placeholder: "Nombres, cargos o grupos participantes." }),
    topics: field("temasTratados", "Temas tratados", "textarea", { full: true }),
    commitments: field("compromisos", "Compromisos", "textarea", { full: true }),
    responsible: field("responsables", "Responsables", "textarea", { full: true }),
    schedule: field("cronograma", "Cronograma / fechas", "textarea", { full: true }),
    resources: field("recursos", "Recursos", "textarea", { full: true }),
    indicators: field("indicadores", "Indicadores", "textarea", { full: true }),
    needs: field("necesidades", "Necesidades detectadas", "textarea", { full: true }),
    priority: field("priorizacion", "Priorización", "textarea", { full: true }),
    audience: field("destinatarios", "Destinatarios", "textarea", { full: true }),
    subject: field("asunto", "Asunto", "text"),
    person: field("persona", "Persona / docente", "text"),
    role: field("funcion", "Función", "text"),
    legal: field("baseLegal", "Base legal disponible", "textarea", { full: true, placeholder: "Solo si ya la conoces. También puedes subir normativa." }),
    observations: field("observaciones", "Observaciones", "textarea", { full: true }),
    training: field("capacitador", "Capacitador / responsable", "text"),
    immediateBoss: field("jefeInmediato", "Jefe inmediato", "text")
  };

  const PROFILE = {
    regulation: {
      fields: [F.topic, F.context, F.scope, F.legal],
      structure: ["Considerando", "Normas generales", "Objeto y ámbito de aplicación", "Definiciones", "Disposiciones generales", "Certificación"]
    },
    policy: {
      fields: [F.topic, F.context, F.scope, F.legal],
      structure: ["Introducción", "Alcance y ámbito de aplicación", "Definiciones", "Roles y responsables", "Política", "Anexos"]
    },
    instruction: {
      fields: [F.topic, F.context, F.scope],
      structure: ["Introducción", "Alcance y ámbito de aplicación", "Instructivo", "Anexos"]
    },
    manual: {
      fields: [F.topic, F.context, F.scope, F.legal],
      structure: ["Descriptivo del manual", "Mapa de procesos", "Introducción", "Procesos", "Flujogramas", "Caracterización", "Indicadores", "Documentos internos y externos"]
    },
    planning: {
      fields: [F.period, F.objective, F.context, F.schedule, F.responsible],
      structure: ["Antecedentes", "Objetivo", "Alcance", "Metodología de planificación", "Actividades y cronograma", "Responsables", "Recursos", "Indicadores", "Seguimiento"]
    },
    report: {
      fields: [F.period, F.objective, F.methodology, F.results, F.observations],
      structure: ["Antecedentes", "Objetivo", "Alcance", "Metodología", "Resultados", "Resumen ejecutivo", "Conclusiones", "Recomendaciones", "Anexos"]
    },
    requirements: {
      fields: [F.period, F.context, F.results, F.observations],
      structure: ["Objetivo", "Alcance", "Metodología de verificación", "Estado de requisitos", "Resultados", "Incidencias", "Conclusiones", "Anexos"]
    },
    guide: {
      fields: [F.period, F.topic, F.objective, F.context],
      structure: ["Presentación", "Objetivos", "Resultados de aprendizaje", "Contenidos", "Orientaciones metodológicas", "Actividades", "Evaluación", "Bibliografía", "Anexos"]
    },
    act: {
      fields: [F.date, F.start, F.end, F.place, F.subject, F.participants, F.topics, F.commitments],
      structure: ["Participantes", "Temas tratados", "Tareas o compromisos", "Próxima reunión"]
    },
    designation: {
      fields: [F.period, F.person, F.role, F.context, F.responsible],
      structure: ["Antecedentes", "Designación", "Funciones y responsabilidades", "Vigencia", "Comunicación"]
    },
    communication: {
      fields: [F.date, F.audience, F.subject, F.context],
      structure: ["Asunto", "Antecedentes", "Comunicado", "Disposiciones"]
    },
    request: {
      fields: [F.date, F.period, F.audience, F.subject, F.context],
      structure: ["Destinatario", "Asunto", "Antecedentes", "Solicitud", "Cierre"]
    },
    scheduleMemo: {
      fields: [F.period, F.subject, F.schedule, F.responsible, F.observations],
      structure: ["Asunto", "Objetivo", "Cronograma", "Responsables", "Disposiciones"]
    },
    workPlan: {
      fields: [F.period, F.objective, F.context, F.schedule, F.responsible],
      structure: ["Datos generales", "Objetivo", "Alcance", "Actividades", "Cronograma", "Entregables", "Seguimiento"]
    },
    socialization: {
      fields: [F.date, F.start, F.end, F.place, F.topic, F.training, F.objective, F.context, F.results],
      structure: ["Objetivo general", "Temas abordados", "Material utilizado", "Desarrollo de la socialización", "Resultados obtenidos", "Conclusiones y recomendaciones", "Evidencias"]
    },
    attendance: {
      fields: [F.topic, F.date, F.training, F.immediateBoss, F.context],
      structure: ["Datos de la actividad", "Participantes", "Firmas"]
    },
    needs: {
      fields: [F.period, F.population, F.instrument, F.context, F.needs, F.priority],
      structure: ["Ficha técnica", "Población", "Instrumento", "Metodología", "Necesidades detectadas", "Priorización", "Brechas", "Conclusiones", "Recomendaciones"]
    },
    trainingPlan: {
      fields: [F.period, F.objective, F.needs, F.schedule, F.resources, F.indicators],
      structure: ["Diagnóstico", "Objetivo", "Alcance", "Plan de actividades", "Cronograma", "Recursos", "Indicadores", "Seguimiento"]
    },
    impact: {
      fields: [F.period, F.population, F.instrument, F.methodology, F.results],
      structure: ["Objetivo", "Población y muestra", "Instrumento", "Metodología", "Indicadores", "Resultados", "Análisis de impacto", "Conclusiones", "Recomendaciones"]
    },
    curricularAnalysis: {
      fields: [F.period, F.topic, F.context, F.results, F.observations],
      structure: ["Datos generales", "Criterios de análisis", "Hallazgos", "Brechas", "Resultados", "Acciones de mejora"]
    },
    individualPlan: {
      fields: [F.period, F.person, F.needs, F.objective, F.schedule, F.observations],
      structure: ["Datos del docente", "Necesidades", "Objetivos", "Acciones", "Cronograma", "Evidencias", "Seguimiento"]
    },
    instrument: {
      fields: [F.period, F.topic, F.population, F.objective, F.context],
      structure: ["Objetivo", "Población objetivo", "Dimensiones", "Ítems", "Escala de valoración", "Aplicación"]
    },
    academicFile: {
      fields: [F.period, F.topic, F.person, F.observations],
      structure: [],
      mode: "upload"
    }
  };

  function doc(id, name, type, code, profile, extra) {
    const base = PROFILE[profile] || PROFILE.report;
    return Object.assign({
      id,
      name,
      type,
      code,
      profile,
      mode: base.mode || "generate",
      fields: base.fields.map((item) => Object.assign({}, item)),
      structure: base.structure.slice(),
      accepts: { template: true, sources: true, data: true, evidence: true }
    }, extra || {});
  }

  const UTET = {
    id: "UTET",
    short: "UTET",
    name: "Titulación",
    fullName: "Unidad de Titulación y Eficiencia Terminal",
    icon: "T",
    processes: [
      {
        id: "utet-94", code: "UTET-PRO-94", name: "Normativa", fullName: "Regulación de normativa de la UTET", documents: [
          doc("utet-reglamento", "Reglamento de la UTET", "REG", "CTI-REG-14", "regulation"),
          doc("utet-resolucion-ocs", "Resolución del OCS", "RES", "ITSQMET-OCS-AÑO-MES-0X", "communication", { accepts: { template: true, sources: true, data: false, evidence: true } }),
          doc("utet-acta-consejo", "Acta de Consejo", "ACT", "ACC-ITSQMET-OCS-AÑO-MES-0X", "act"),
          doc("utet-acta-socializacion", "Acta de Socialización", "ACT", "UTET-ACT-0X-PRO-94-AÑO-MES", "socialization")
        ]
      },
      {
        id: "utet-56", code: "UTET-PRO-56", name: "Planificación", fullName: "Planificación semestral del proceso de titulación", documents: [
          doc("utet-plan-complexivo", "Planificación de Examen Complexivo", "RGI", "UTET-RGI1-0X-PRO-56-AÑO-MES", "planning"),
          doc("utet-plan-trabajo", "Planificación de Trabajo de Titulación", "RGI", "UTET-RGI2-0X-PRO-56-AÑO-MES", "planning"),
          doc("utet-plan-articulo", "Planificación de Artículo Académico", "RGI", "UTET-RGI3-0X-PRO-56-AÑO-MES", "planning", {
            structure: ["Antecedentes", "Objetivo", "Alcance", "Articulación con el proceso de titulación", "Metodología de planificación", "Cronograma", "Responsables", "Indicadores", "Seguimiento"]
          })
        ]
      },
      {
        id: "utet-95", code: "UTET-PRO-95", name: "Evaluación", fullName: "Evaluación semestral del proceso de titulación", documents: [
          doc("utet-informe-final", "Informe Final del Proceso de Titulación", "INF", "UTET-INF-0X-PRO-95-AÑO-MES", "report", {
            structure: ["Antecedentes", "Objetivo", "Metodología", "Resultados generales", "Resultados por modalidad y carrera", "Indicadores", "Resumen ejecutivo", "Conclusiones", "Recomendaciones", "Anexos"]
          })
        ]
      },
      {
        id: "utet-58", code: "UTET-PRO-58", name: "Requisitos", fullName: "Seguimiento de requisitos", documents: [
          doc("utet-acta-requisitos", "Acta de Seguimiento de Requisitos", "ACT", "UTET-ACT-0X-PRO-58-AÑO-MES", "act"),
          doc("utet-informe-individual-requisitos", "Informe Individual de Verificación", "RGI", "UTET-RGI1-0X-PRO-58-AÑO-MES", "requirements", { fields: [F.period, F.person, F.context, F.results, F.observations] }),
          doc("utet-reporte-final-requisitos", "Reporte Final de Requisitos", "RGI", "UTET-RGI2-0X-PRO-58-AÑO-MES", "requirements", {
            structure: ["Objetivo", "Población evaluada", "Metodología de verificación", "Resultados por carrera", "Pendientes", "Indicadores", "Conclusiones", "Anexos"]
          })
        ]
      },
      {
        id: "utet-59", code: "UTET-PRO-59", name: "Guías", fullName: "Gestión de Guías de Integración Curricular", documents: [
          doc("utet-formato-guia", "Formato de Guía de Integración Curricular", "RGI", "UTET-RGI-0X-PRO-59-AÑO-MES", "guide"),
          doc("utet-guia", "Guía de Integración Curricular", "GUIA", "UTET-GUIA-0X-PRO-59-AÑO-MES", "guide")
        ]
      },
      {
        id: "utet-88", code: "UTET-PRO-88", name: "Seminarios", fullName: "Ejecución de Seminarios Complexivos", manualNote: "El manual también muestra UTET-PRO-45 en la tabla final; validar codificación oficial.", documents: [
          doc("utet-solicitud-complexivo", "Solicitud de Ingreso a Titulación", "OFI", "OFI-ITSQMET-UTET-AÑO-MES-0X", "request"),
          doc("utet-cronograma-complexivo", "Cronograma de Exámenes Complexivos", "MEM", "MEM-ITSQMET-UTET-AÑO-MES-0X", "scheduleMemo"),
          doc("utet-guias-complexivo", "Guías de Integración Curricular", "GUIA", "UTET-GUIA-0X", "guide"),
          doc("utet-plan-nucleo", "Plan de Estudios del Núcleo Complexivo", "PLAN", "UTET-PLAN-NUCLEO-AÑO-MES", "planning")
        ]
      },
      {
        id: "utet-93", code: "UTET-PRO-93", name: "Examen", fullName: "Ejecución de Examen Complexivo", documents: [
          doc("utet-comunicado-complexivo", "Comunicado de Titulación y Evaluación", "COM", "COM-ITSQMET-UTET-AÑO-MES-0X", "communication"),
          doc("utet-acta-complexivo", "Acta de Titulación por Examen Complexivo", "ACT", "AT-ITSQMET-UTET-AÑO-MES-0X", "act", { fields: [F.date, F.person, F.subject, F.results, F.observations] })
        ]
      },
      {
        id: "utet-96", code: "UTET-PRO-96", name: "Ingreso trabajo", fullName: "Ingreso al Trabajo de Titulación", documents: [
          doc("utet-solicitud-trabajo", "Solicitud de Ingreso a Titulación", "OFI", "OFI-ITSQMET-UTET-AÑO-MES-0X", "request"),
          doc("utet-cronograma-trabajo", "Cronograma de Trabajo de Titulación", "MEM", "MEM-ITSQMET-UTET-AÑO-MES-0X", "scheduleMemo"),
          doc("utet-designacion-tutores", "Designación de Tutores", "RGI", "UTET-RGI1-0X-PRO-96-AÑO-MES", "designation"),
          doc("utet-ficha-temas", "Ficha de Posibles Temas", "RGI", "UTET-RGI2-0X-PRO-96-AÑO-MES", "curricularAnalysis", { fields: [F.period, F.topic, F.context, F.objective, F.observations] })
        ]
      },
      {
        id: "utet-164", code: "UTET-PRO-164", name: "Trabajo", fullName: "Ejecución del Trabajo de Titulación", documents: [
          doc("utet-plan-trabajo-ejecucion", "Plan de Trabajo de Titulación", "PLAN", "UTET-PLAN-TRABAJO-AÑO-MES", "workPlan"),
          doc("utet-borrador1", "Trabajo de Titulación · Borrador 1", "DOC", "TRABAJO-B1", "academicFile"),
          doc("utet-borrador2", "Trabajo de Titulación · Borrador 2", "DOC", "TRABAJO-B2", "academicFile"),
          doc("utet-final-trabajo", "Trabajo de Titulación · Final", "DOC", "TRABAJO-FINAL", "academicFile"),
          doc("utet-plagio-trabajo", "Porcentaje de Plagio", "MEM", "MEM-ITSQMET-UTET-AÑO-MES-0X", "report", { fields: [F.period, F.person, F.results, F.observations], structure: ["Datos del trabajo", "Resultado de similitud", "Análisis", "Observaciones", "Conclusión"] }),
          doc("utet-comunicado-trabajo", "Comunicado de Titulación y Evaluación", "COM", "COM-ITSQMET-UTET-AÑO-MES-0X", "communication"),
          doc("utet-acta-trabajo", "Acta de Titulación por Trabajo", "ACT", "AT-ITSQMET-UTET-AÑO-MES-0X", "act", { fields: [F.date, F.person, F.subject, F.results, F.observations] })
        ]
      },
      {
        id: "utet-57", code: "UTET-PRO-57", name: "Artículo", fullName: "Gestión de Artículo Académico", documents: [
          doc("utet-solicitud-articulo", "Solicitud de Ingreso", "OFI", "OFI-ITSQMET-UTET-AÑO-MES-0X", "request"),
          doc("utet-cronograma-articulo", "Cronograma de Artículo Académico", "MEM", "MEM-ITSQMET-UTET-AÑO-MES-0X", "scheduleMemo"),
          doc("utet-designacion-metodologicos", "Designación de Docentes Metodológicos", "RGI", "UTET-RGI1-0X-PRO-57-AÑO-MES", "designation"),
          doc("utet-pregunta-investigacion", "Pregunta de Investigación", "RGI", "UTET-RGI2-0X-PRO-57-AÑO-MES", "curricularAnalysis", { fields: [F.period, F.topic, F.context, F.objective] }),
          doc("utet-articulo-b1", "Artículo Académico · Borrador I", "DOC", "ARTICULO-B1", "academicFile"),
          doc("utet-articulo-final", "Artículo Académico · Final", "DOC", "ARTICULO-FINAL", "academicFile"),
          doc("utet-comunicado-articulo", "Comunicado de Titulación y Evaluación", "COM", "COM-ITSQMET-UTET-AÑO-MES-0X", "communication"),
          doc("utet-plagio-articulo", "Porcentaje de Plagio", "MEM", "MEM-ITSQMET-UTET-AÑO-MES-0X", "report", { fields: [F.period, F.person, F.results, F.observations], structure: ["Datos del artículo", "Resultado de similitud", "Análisis", "Observaciones", "Conclusión"] }),
          doc("utet-acta-articulo", "Acta de Titulación por Artículo", "ACT", "AT-ITSQMET-UTET-AÑO-MES-0X", "act", { fields: [F.date, F.person, F.subject, F.results, F.observations] })
        ]
      },
      {
        id: "utet-97", code: "UTET-PRO-97", name: "Inducción", fullName: "Inducción del Proceso de Titulación", documents: [
          doc("utet-asistencia-induccion", "Registro de Asistencia", "RGI", "UTET-RGI1-0X-PRO-97-AÑO-MES", "attendance"),
          doc("utet-informe-induccion", "Informe de Finalización de la Inducción", "INF", "UTET-INF-0X-PRO-97-AÑO-MES", "socialization", {
            structure: ["Objetivo", "Convocatoria y participantes", "Temas abordados", "Desarrollo", "Resultados", "Resumen ejecutivo", "Conclusiones y recomendaciones", "Evidencias"]
          })
        ]
      }
    ]
  };

  const UGPA = {
    id: "UGPA",
    short: "UGPA",
    name: "Procesos académicos",
    fullName: "Unidad de Gestión de Procesos Académicos",
    icon: "A",
    processes: [
      {
        id: "ugpa-70", code: "UGPA-PRO-70", name: "Capacitación", fullName: "Capacitación Docente", documents: [
          doc("ugpa-necesidades-capacitacion", "Detección de Necesidades de Capacitación", "RGI", "UGPA-RGI1-0X-PRO-70-AÑO-MES", "needs"),
          doc("ugpa-plan-capacitacion", "Plan Semestral de Capacitación Docente", "RGI", "UGPA-RGI2-0X-PRO-70-AÑO-MES", "trainingPlan"),
          doc("ugpa-informe-capacitacion", "Informe de Cumplimiento del Plan", "RGI", "UGPA-RGI3-0X-PRO-70-AÑO-MES", "report", {
            structure: ["Objetivo", "Metodología de seguimiento", "Ejecución del plan", "Resultados", "Resumen ejecutivo", "Nivel de cumplimiento", "Conclusiones", "Recomendaciones", "Anexos"]
          })
        ]
      },
      {
        id: "ugpa-31", code: "UGPA-PRO-31", name: "Formación", fullName: "Formación Docente", documents: [
          doc("ugpa-necesidades-formacion", "Detección de Necesidades de Formación", "RGI", "UGPA-RGI1-0X-PRO-31-AÑO-MES", "needs"),
          doc("ugpa-plan-formacion", "Plan Anual de Formación Docente", "RGI", "UGPA-RGI2-0X-PRO-31-AÑO-MES", "trainingPlan"),
          doc("ugpa-informe-formacion", "Informe de Cumplimiento del Plan de Formación", "RGI", "UGPA-RGI3-0X-PRO-31-AÑO-MES", "report", {
            structure: ["Objetivo", "Metodología de seguimiento", "Ejecución", "Resultados", "Resumen ejecutivo", "Cumplimiento de metas", "Conclusiones", "Recomendaciones", "Anexos"]
          })
        ]
      },
      {
        id: "ugpa-60", code: "UGPA-PRO-60", name: "Construcción curricular", fullName: "Construcción Curricular Continua", documents: [
          doc("ugpa-acta-ccc", "Acta de Colectivos Docentes", "ACT", "UGPA-RGI1-0X-PRO-60-AÑO-MES", "act"),
          doc("ugpa-ficha-nivel", "Ficha Individual de Análisis por Nivel", "RGI", "UGPA-RI2-0X-PRO-60-AÑO-MES", "curricularAnalysis"),
          doc("ugpa-guia-carrera", "Guía Curricular de Aplicación Académica", "RGI", "RGI3-0X-PRO-60-AÑO-MES", "guide")
        ]
      },
      {
        id: "ugpa-134", code: "UGPA-PRO-134", name: "Ejecución capacitación", fullName: "Ejecución de Capacitación Docente", documents: [
          doc("ugpa-planificacion-capacitacion", "Planificación de la Capacitación", "RGI", "UGPA-RGI1-0X-PRO-134-AÑO-MES", "trainingPlan"),
          doc("ugpa-acuerdo-patrocinio", "Acuerdo de Patrocinio Institucional", "RGI", "UGPA-RGI2-0X-PRO-134-AÑO-MES", "communication", { fields: [F.period, F.person, F.subject, F.context, F.commitments] }),
          doc("ugpa-informe-final-capacitacion", "Informe Final de Capacitación", "INF", "UGPA-INF-0X-PRO-134-AÑO-MES", "report", {
            structure: ["Objetivo", "Metodología", "Participación", "Resultados", "Resumen ejecutivo", "Evaluación de la capacitación", "Conclusiones", "Recomendaciones", "Evidencias"]
          })
        ]
      },
      {
        id: "ugpa-135", code: "UGPA-PRO-135", name: "Impacto", fullName: "Medición de Impacto de la Capacitación Docente", documents: [
          doc("ugpa-instrumento-impacto", "Instrumento de Evaluación de la Capacitación", "RGI", "UGPA-RGI1-0X-PRO-135-AÑO-MES", "instrument"),
          doc("ugpa-informe-impacto", "Informe de Impacto de Capacitación", "INF", "UGPA-INF-0X-PRO-135-AÑO-MES", "impact")
        ]
      },
      {
        id: "ugpa-251", code: "UGPA-PRO-251", name: "Plan individual", fullName: "Planificación de Capacitación y Formación Individual", documents: [
          doc("ugpa-plan-individual", "Plan Individual de Formación y Capacitación", "RGI", "UGPA-RGI1-0X-PRO-251-AÑO-MES", "individualPlan"),
          doc("ugpa-reporte-plan-individual", "Reporte General de Resultados del Plan", "RGI", "UGPA-RGI2-0X-PRO-251-AÑO-MES", "report", {
            structure: ["Cobertura", "Metodología de seguimiento", "Avance", "Resultados", "Indicadores", "Resumen ejecutivo", "Hallazgos", "Conclusiones", "Recomendaciones"]
          })
        ]
      },
      {
        id: "ugpa-248", code: "UGPA-PRO-248", name: "Seguimiento", fullName: "Seguimiento al Proceso de Formación del Personal Docente", documents: [
          doc("ugpa-reporte-seguimiento", "Reporte de Seguimiento de Formación Docente", "RGI", "UGPA-RGI1-0X-PRO-248-AÑO-MES", "report", {
            structure: ["Objetivo", "Cobertura", "Metodología", "Estado de avance", "Resultados", "Alertas", "Conclusiones", "Acciones de seguimiento"]
          })
        ]
      },
      {
        id: "ugpa-321", code: "UGPA-PRO-321", name: "Matriz curricular", fullName: "Generación, Emisión y Validación de Matriz de Ejecución Curricular", documents: [
          doc("ugpa-comunicado-matriz", "Comunicado de Carga de Matriz CCC", "COM", "COM-ITSQMET-UGPA-AÑO-MES-0X", "communication", { fields: [F.date, F.period, F.audience, F.subject, F.results, F.observations] })
        ]
      }
    ]
  };

  const units = [UTET, UGPA];

  function findUnit(unitId) {
    return units.find((unit) => unit.id === unitId) || null;
  }

  function findProcess(processId) {
    for (const unit of units) {
      const process = unit.processes.find((item) => item.id === processId);
      if (process) return { unit, process };
    }
    return null;
  }

  function findDocument(documentId) {
    for (const unit of units) {
      for (const process of unit.processes) {
        const document = process.documents.find((item) => item.id === documentId);
        if (document) return { unit, process, document };
      }
    }
    return null;
  }

  function allDocuments() {
    return units.flatMap((unit) => unit.processes.flatMap((process) => process.documents.map((document) => ({ unit, process, document }))));
  }

  window.DOCUMENT_CATALOG = { units, findUnit, findProcess, findDocument, allDocuments };
})();
