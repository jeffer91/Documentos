(function (root, factory) {
  const catalog = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = catalog;
  if (root) root.DOCUMENT_CATALOG = catalog;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const D = (id, name, type, code, options) => Object.assign({
    id, name, type, code, mode: "template"
  }, options || {});

  const units = [
    {
      id: "UTET",
      short: "UTET",
      name: "Titulación",
      fullName: "Unidad de Titulación y Eficiencia Terminal",
      icon: "T",
      processes: [
        {
          id: "utet-94", code: "UTET-PRO-94", name: "Normativa", fullName: "Regulación de normativa de la UTET",
          documents: [
            D("utet-reglamento", "Reglamento de la UTET", "REG", "CTI-REG-14"),
            D("utet-resolucion-ocs", "Resolución del OCS", "RES", "ITSQMET-OCS-AÑO-MES-0X"),
            D("utet-acta-consejo", "Acta de Consejo", "ACT", "ACC-ITSQMET-OCS-AÑO-MES-0X"),
            D("utet-acta-socializacion", "Acta de Socialización", "ACT", "UTET-ACT-0X-PRO-94-AÑO-MES")
          ]
        },
        {
          id: "utet-56", code: "UTET-PRO-56", name: "Planificación", fullName: "Planificación semestral del proceso de titulación",
          documents: [
            D("utet-plan-complexivo", "Planificación de Examen Complexivo", "RGI", "UTET-RGI1-0X-PRO-56-AÑO-MES"),
            D("utet-plan-trabajo", "Planificación de Trabajo de Titulación", "RGI", "UTET-RGI2-0X-PRO-56-AÑO-MES"),
            D("utet-plan-articulo", "Planificación de Artículo Académico", "RGI", "UTET-RGI3-0X-PRO-56-AÑO-MES")
          ]
        },
        {
          id: "utet-95", code: "UTET-PRO-95", name: "Evaluación", fullName: "Evaluación semestral del proceso de titulación",
          documents: [D("utet-informe-final", "Informe Final del Proceso de Titulación", "INF", "UTET-INF-0X-PRO-95-AÑO-MES")]
        },
        {
          id: "utet-58", code: "UTET-PRO-58", name: "Requisitos", fullName: "Seguimiento de requisitos",
          documents: [
            D("utet-acta-requisitos", "Acta de Seguimiento de Requisitos", "ACT", "UTET-ACT-0X-PRO-58-AÑO-MES"),
            D("utet-informe-individual-requisitos", "Informe Individual de Verificación", "RGI", "UTET-RGI1-0X-PRO-58-AÑO-MES"),
            D("utet-reporte-final-requisitos", "Reporte Final de Requisitos", "RGI", "UTET-RGI2-0X-PRO-58-AÑO-MES")
          ]
        },
        {
          id: "utet-59", code: "UTET-PRO-59", name: "Guías", fullName: "Gestión de Guías de Integración Curricular",
          documents: [
            D("utet-formato-guia", "Formato de Guía de Integración Curricular", "RGI", "UTET-RGI-0X-PRO-59-AÑO-MES"),
            D("utet-guia", "Guía de Integración Curricular", "GUIA", "UTET-GUIA-0X-PRO-59-AÑO-MES")
          ]
        },
        {
          id: "utet-88", code: "UTET-PRO-88", name: "Seminarios", fullName: "Ejecución de Seminarios Complexivos",
          manualNote: "El manual también muestra UTET-PRO-45 en la tabla final; validar la codificación oficial.",
          documents: [
            D("utet-solicitud-complexivo", "Solicitud de Ingreso a Titulación", "OFI", "OFI-ITSQMET-UTET-AÑO-MES-0X"),
            D("utet-cronograma-complexivo", "Cronograma de Exámenes Complexivos", "MEM", "MEM-ITSQMET-UTET-AÑO-MES-0X"),
            D("utet-guias-complexivo", "Guías de Integración Curricular", "GUIA", "UTET-GUIA-0X"),
            D("utet-plan-nucleo", "Plan de Estudios del Núcleo Complexivo", "PLAN", "UTET-PLAN-NUCLEO-AÑO-MES")
          ]
        },
        {
          id: "utet-93", code: "UTET-PRO-93", name: "Examen", fullName: "Ejecución de Examen Complexivo",
          documents: [
            D("utet-comunicado-complexivo", "Comunicado de Titulación y Evaluación", "COM", "COM-ITSQMET-UTET-AÑO-MES-0X"),
            D("utet-acta-complexivo", "Acta de Titulación por Examen Complexivo", "ACT", "AT-ITSQMET-UTET-AÑO-MES-0X")
          ]
        },
        {
          id: "utet-96", code: "UTET-PRO-96", name: "Ingreso trabajo", fullName: "Ingreso al Trabajo de Titulación",
          documents: [
            D("utet-solicitud-trabajo", "Solicitud de Ingreso a Titulación", "OFI", "OFI-ITSQMET-UTET-AÑO-MES-0X"),
            D("utet-cronograma-trabajo", "Cronograma de Trabajo de Titulación", "MEM", "MEM-ITSQMET-UTET-AÑO-MES-0X"),
            D("utet-designacion-tutores", "Designación de Tutores", "RGI", "UTET-RGI1-0X-PRO-96-AÑO-MES"),
            D("utet-ficha-temas", "Ficha de Posibles Temas", "RGI", "UTET-RGI2-0X-PRO-96-AÑO-MES")
          ]
        },
        {
          id: "utet-164", code: "UTET-PRO-164", name: "Trabajo", fullName: "Ejecución del Trabajo de Titulación",
          documents: [
            D("utet-plan-trabajo-ejecucion", "Plan de Trabajo de Titulación", "PLAN", "UTET-PLAN-TRABAJO-AÑO-MES"),
            D("utet-borrador1", "Trabajo de Titulación · Borrador 1", "DOC", "TRABAJO-B1", { mode: "upload" }),
            D("utet-borrador2", "Trabajo de Titulación · Borrador 2", "DOC", "TRABAJO-B2", { mode: "upload" }),
            D("utet-final-trabajo", "Trabajo de Titulación · Final", "DOC", "TRABAJO-FINAL", { mode: "upload" }),
            D("utet-plagio-trabajo", "Porcentaje de Plagio", "MEM", "MEM-ITSQMET-UTET-AÑO-MES-0X"),
            D("utet-comunicado-trabajo", "Comunicado de Titulación y Evaluación", "COM", "COM-ITSQMET-UTET-AÑO-MES-0X"),
            D("utet-acta-trabajo", "Acta de Titulación por Trabajo", "ACT", "AT-ITSQMET-UTET-AÑO-MES-0X")
          ]
        },
        {
          id: "utet-57", code: "UTET-PRO-57", name: "Artículo", fullName: "Gestión de Artículo Académico",
          documents: [
            D("utet-solicitud-articulo", "Solicitud de Ingreso", "OFI", "OFI-ITSQMET-UTET-AÑO-MES-0X"),
            D("utet-cronograma-articulo", "Cronograma de Artículo Académico", "MEM", "MEM-ITSQMET-UTET-AÑO-MES-0X"),
            D("utet-designacion-metodologicos", "Designación de Docentes Metodológicos", "RGI", "UTET-RGI1-0X-PRO-57-AÑO-MES"),
            D("utet-pregunta-investigacion", "Pregunta de Investigación", "RGI", "UTET-RGI2-0X-PRO-57-AÑO-MES"),
            D("utet-articulo-b1", "Artículo Académico · Borrador I", "DOC", "ARTICULO-B1", { mode: "upload" }),
            D("utet-articulo-final", "Artículo Académico · Final", "DOC", "ARTICULO-FINAL", { mode: "upload" }),
            D("utet-comunicado-articulo", "Comunicado de Titulación y Evaluación", "COM", "COM-ITSQMET-UTET-AÑO-MES-0X"),
            D("utet-plagio-articulo", "Porcentaje de Plagio", "MEM", "MEM-ITSQMET-UTET-AÑO-MES-0X"),
            D("utet-acta-articulo", "Acta de Titulación por Artículo", "ACT", "AT-ITSQMET-UTET-AÑO-MES-0X")
          ]
        },
        {
          id: "utet-97", code: "UTET-PRO-97", name: "Inducción", fullName: "Inducción del Proceso de Titulación",
          documents: [
            D("utet-asistencia-induccion", "Registro de Asistencia", "RGI", "UTET-RGI1-0X-PRO-97-AÑO-MES"),
            D("utet-informe-induccion", "Informe de Finalización de la Inducción", "INF", "UTET-INF-0X-PRO-97-AÑO-MES")
          ]
        }
      ]
    },
    {
      id: "UGPA",
      short: "UGPA",
      name: "Procesos académicos",
      fullName: "Unidad de Gestión de Procesos Académicos",
      icon: "A",
      processes: [
        {
          id: "ugpa-70", code: "UGPA-PRO-70", name: "Capacitación", fullName: "Capacitación Docente",
          documents: [
            D("ugpa-necesidades-capacitacion", "Detección de Necesidades de Capacitación", "RGI", "UGPA-RGI1-0X-PRO-70-AÑO-MES"),
            D("ugpa-plan-capacitacion", "Plan Semestral de Capacitación Docente", "RGI", "UGPA-RGI2-0X-PRO-70-AÑO-MES"),
            D("ugpa-informe-capacitacion", "Informe de Cumplimiento del Plan", "RGI", "UGPA-RGI3-0X-PRO-70-AÑO-MES")
          ]
        },
        {
          id: "ugpa-31", code: "UGPA-PRO-31", name: "Formación", fullName: "Formación Docente",
          documents: [
            D("ugpa-necesidades-formacion", "Detección de Necesidades de Formación", "RGI", "UGPA-RGI1-0X-PRO-31-AÑO-MES"),
            D("ugpa-plan-formacion", "Plan Anual de Formación Docente", "RGI", "UGPA-RGI2-0X-PRO-31-AÑO-MES"),
            D("ugpa-informe-formacion", "Informe de Cumplimiento del Plan de Formación", "RGI", "UGPA-RGI3-0X-PRO-31-AÑO-MES")
          ]
        },
        {
          id: "ugpa-60", code: "UGPA-PRO-60", name: "Construcción curricular", fullName: "Construcción Curricular Continua",
          documents: [
            D("ugpa-acta-ccc", "Acta de Colectivos Docentes", "ACT", "UGPA-RGI1-0X-PRO-60-AÑO-MES"),
            D("ugpa-ficha-nivel", "Ficha Individual de Análisis por Nivel", "RGI", "UGPA-RI2-0X-PRO-60-AÑO-MES"),
            D("ugpa-guia-carrera", "Guía Curricular de Aplicación Académica", "RGI", "RGI3-0X-PRO-60-AÑO-MES")
          ]
        },
        {
          id: "ugpa-134", code: "UGPA-PRO-134", name: "Ejecución capacitación", fullName: "Ejecución de Capacitación Docente",
          documents: [
            D("ugpa-planificacion-capacitacion", "Planificación de la Capacitación", "RGI", "UGPA-RGI1-0X-PRO-134-AÑO-MES"),
            D("ugpa-acuerdo-patrocinio", "Acuerdo de Patrocinio Institucional", "RGI", "UGPA-RGI2-0X-PRO-134-AÑO-MES"),
            D("ugpa-informe-final-capacitacion", "Informe Final de Capacitación", "INF", "UGPA-INF-0X-PRO-134-AÑO-MES")
          ]
        },
        {
          id: "ugpa-135", code: "UGPA-PRO-135", name: "Impacto", fullName: "Medición de Impacto de la Capacitación Docente",
          documents: [
            D("ugpa-instrumento-impacto", "Instrumento de Evaluación de la Capacitación", "RGI", "UGPA-RGI1-0X-PRO-135-AÑO-MES"),
            D("ugpa-informe-impacto", "Informe de Impacto de Capacitación", "INF", "UGPA-INF-0X-PRO-135-AÑO-MES")
          ]
        },
        {
          id: "ugpa-251", code: "UGPA-PRO-251", name: "Plan individual", fullName: "Planificación de Capacitación y Formación Individual",
          documents: [
            D("ugpa-plan-individual", "Plan Individual de Formación y Capacitación", "RGI", "UGPA-RGI1-0X-PRO-251-AÑO-MES"),
            D("ugpa-reporte-plan-individual", "Reporte General de Resultados del Plan", "RGI", "UGPA-RGI2-0X-PRO-251-AÑO-MES")
          ]
        },
        {
          id: "ugpa-248", code: "UGPA-PRO-248", name: "Seguimiento", fullName: "Seguimiento al Proceso de Formación del Personal Docente",
          documents: [D("ugpa-reporte-seguimiento", "Reporte de Seguimiento de Formación Docente", "RGI", "UGPA-RGI1-0X-PRO-248-AÑO-MES")]
        },
        {
          id: "ugpa-321", code: "UGPA-PRO-321", name: "Matriz curricular", fullName: "Generación, Emisión y Validación de Matriz de Ejecución Curricular",
          documents: [D("ugpa-comunicado-matriz", "Comunicado de Carga de Matriz CCC", "COM", "COM-ITSQMET-UGPA-AÑO-MES-0X")]
        }
      ]
    }
  ];

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
    return units.flatMap((unit) =>
      unit.processes.flatMap((process) =>
        process.documents.map((document) => ({ unit, process, document }))
      )
    );
  }

  return { units, findUnit, findProcess, findDocument, allDocuments };
});
