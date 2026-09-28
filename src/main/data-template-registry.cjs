const dataBindings = require("./document-data-binding-service.cjs");

const PROCESS_ENGINES = Object.freeze({
  formacion: Object.freeze(["form.deteccion", "form.plan", "form.informe", "form.seguimiento"]),
  capacitacion: Object.freeze([
    "cap.deteccion", "cap.plan", "cap.planificacion-actividad", "cap.patrocinio",
    "cap.informe-final", "cap.instrumento-impacto", "cap.impacto", "cap.informe-cumplimiento"
  ]),
  titulacion_regular: Object.freeze([
    "tit.regular.plan-complexivo", "tit.regular.plan-trabajo", "tit.regular.cronograma-complexivo",
    "tit.regular.comunicado-complexivo", "tit.regular.designacion-tutores", "tit.regular.ficha-temas",
    "tit.regular.plagio-trabajo", "tit.requisitos.reporte-final", "tit.induccion.informe",
    "tit.regular.informe-final"
  ]),
  titulacion_pvc: Object.freeze([
    "tit.pvc.plan-articulo", "tit.pvc.cronograma-articulo", "tit.pvc.designacion-metodologicos",
    "tit.pvc.plagio-articulo", "tit.requisitos.reporte-final", "tit.induccion.informe",
    "tit.pvc.informe-final"
  ]),
  construccion_curricular: Object.freeze([
    "ccc.acta-colectivos", "ccc.ficha-nivel", "ccc.guia-carrera", "ccc.comunicado-matriz"
  ]),
  plan_individual: Object.freeze(["plan-individual.plan", "plan-individual.reporte"])
});

const LABELS = Object.freeze({
  record_id: "ID registro",
  student_id: "Cédula estudiante",
  student_name: "Estudiante",
  person_id: "ID persona",
  teacher_id: "Cédula docente",
  teacher_name: "Docente",
  career: "Carrera",
  campus: "Sede",
  core: "Núcleo",
  component: "Componente",
  grade: "Nota",
  modality: "Modalidad",
  level: "Nivel",
  period: "Período",
  population: "Población",
  segment: "Segmento",
  session: "Sesión",
  status: "Estado",
  requirement_name: "Requisito",
  requirement_status: "Estado del requisito",
  requirement_date: "Fecha de requisito",
  topic: "Tema",
  document_title: "Título del documento",
  tutor_name: "Tutor",
  methodologist_name: "Metodológico",
  plagiarism_percent: "Porcentaje de similitud",
  attendance: "Asistencia",
  attendance_date: "Fecha de asistencia",
  need: "Necesidad detectada",
  priority: "Prioridad",
  competency: "Competencia",
  area: "Área",
  availability: "Disponibilidad",
  preferred_schedule: "Horario preferido",
  formation_interest: "Interés de formación",
  interest: "Interés",
  qualitative_response: "Respuesta cualitativa",
  comment: "Observación",
  years_experience: "Años de experiencia",
  formation_level: "Nivel de formación",
  degree_level: "Nivel del título",
  contract_type: "Tipo de contrato",
  dedication: "Dedicación",
  recurrence: "Recurrencia",
  recurrence_percent: "Porcentaje de recurrencia",
  impact: "Impacto",
  alignment: "Alineación",
  viability: "Viabilidad",
  priority_score: "Puntaje de prioridad",
  activity_id: "ID actividad",
  activity_name: "Actividad",
  event_name: "Evento",
  start_date: "Fecha de inicio",
  end_date: "Fecha de fin",
  event_date: "Fecha",
  responsible: "Responsable",
  training_name: "Capacitación",
  completion: "Cumplimiento",
  hours: "Horas",
  satisfaction_score: "Satisfacción",
  impact_score: "Impacto",
  formation_program: "Programa de formación",
  institution: "Institución",
  coordination: "Coordinación",
  academic_unit: "Unidad académica",
  subject: "Asignatura",
  finding: "Hallazgo",
  agreement: "Acuerdo",
  due_date: "Fecha límite"
});

const EXPLICIT_SLOTS = Object.freeze({
  "formacion.carreras": Object.freeze({
    key: "formacion.carreras",
    processKey: "formacion",
    introducedBy: "form.deteccion",
    label: "Carreras del período",
    description: "Carreras que participan en el proceso de Formación docente.",
    fields: Object.freeze([{ key: "career", label: "Carrera", required: true, type: "text" }])
  }),
  "formacion.docentes": Object.freeze({
    key: "formacion.docentes",
    processKey: "formacion",
    introducedBy: "form.deteccion",
    label: "Docentes por carrera",
    description: "Base docente del período. Los documentos posteriores reutilizan esta información.",
    fields: Object.freeze([
      { key: "teacher_id", label: "Cédula docente", required: false, type: "text" },
      { key: "teacher_name", label: "Docente", required: true, type: "text" },
      { key: "career", label: "Carrera", required: true, type: "text" },
      { key: "formation_level", label: "Nivel de formación", required: false, type: "text" },
      { key: "degree_level", label: "Nivel del título", required: false, type: "text" },
      { key: "contract_type", label: "Tipo de contrato", required: false, type: "text" },
      { key: "dedication", label: "Dedicación", required: false, type: "text" }
    ])
  }),
  "formacion.planificacion": Object.freeze({
    key: "formacion.planificacion",
    processKey: "formacion",
    introducedBy: "form.plan",
    label: "Planificación y cronograma",
    description: "Fechas, actividades y responsables definidos para el Plan de Formación.",
    fields: Object.freeze([
      { key: "activity_id", label: "ID actividad", required: false, type: "text" },
      { key: "activity_name", label: "Actividad", required: true, type: "text" },
      { key: "career", label: "Carrera", required: false, type: "text" },
      { key: "start_date", label: "Fecha de inicio", required: true, type: "date" },
      { key: "end_date", label: "Fecha de fin", required: false, type: "date" },
      { key: "responsible", label: "Responsable", required: false, type: "text" },
      { key: "modality", label: "Modalidad", required: false, type: "text" },
      { key: "status", label: "Estado", required: false, type: "text" }
    ])
  }),
  "formacion.resultados": Object.freeze({
    key: "formacion.resultados",
    processKey: "formacion",
    introducedBy: "form.informe",
    label: "Resultados de formación",
    description: "Resultados reales del período para consolidar el informe.",
    fields: Object.freeze([
      { key: "formation_program", label: "Programa de formación", required: true, type: "text" },
      { key: "teacher_id", label: "Cédula docente", required: false, type: "text" },
      { key: "teacher_name", label: "Docente", required: false, type: "text" },
      { key: "career", label: "Carrera", required: false, type: "text" },
      { key: "formation_level", label: "Nivel de formación", required: false, type: "text" },
      { key: "institution", label: "Institución", required: false, type: "text" },
      { key: "start_date", label: "Fecha de inicio", required: false, type: "date" },
      { key: "end_date", label: "Fecha de fin", required: false, type: "date" },
      { key: "status", label: "Estado", required: false, type: "text" }
    ])
  }),
  "formacion.seguimiento": Object.freeze({
    key: "formacion.seguimiento",
    processKey: "formacion",
    introducedBy: "form.seguimiento",
    label: "Seguimiento de formación",
    description: "Datos de seguimiento posteriores a la ejecución del plan.",
    fields: Object.freeze([
      { key: "formation_program", label: "Programa de formación", required: true, type: "text" },
      { key: "teacher_id", label: "Cédula docente", required: false, type: "text" },
      { key: "teacher_name", label: "Docente", required: false, type: "text" },
      { key: "career", label: "Carrera", required: false, type: "text" },
      { key: "completion", label: "Cumplimiento", required: false, type: "text" },
      { key: "hours", label: "Horas", required: false, type: "number" },
      { key: "satisfaction_score", label: "Satisfacción", required: false, type: "number" },
      { key: "impact_score", label: "Impacto", required: false, type: "number" },
      { key: "status", label: "Estado", required: false, type: "text" }
    ])
  })
});

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function labelForField(field) {
  if (LABELS[field]) return LABELS[field];
  return String(field || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function bindingFields(engineId) {
  const bindings = dataBindings.bindingsForEngine(engineId) || [];
  const required = new Set();
  const optional = new Set();
  bindings.forEach((item) => {
    (item.requiredAll || []).forEach((field) => required.add(String(field)));
    (item.requiredAny || []).forEach((group) => (group || []).forEach((field) => optional.add(String(field))));
    (item.optionalFields || []).forEach((field) => optional.add(String(field)));
    (item.scopeFields || []).forEach((field) => optional.add(String(field)));
  });
  required.forEach((field) => optional.delete(field));
  return [
    ...Array.from(required).map((key) => ({ key, label: labelForField(key), required: true, type: "text" })),
    ...Array.from(optional).map((key) => ({ key, label: labelForField(key), required: false, type: "text" }))
  ];
}

function bindingRequiredAny(engineId) {
  const groups = [];
  (dataBindings.bindingsForEngine(engineId) || []).forEach((item) => {
    (item.requiredAny || []).forEach((group) => {
      const normalized = Array.from(new Set((group || []).map(String).filter(Boolean)));
      if (!normalized.length) return;
      const signature = normalized.slice().sort().join("|");
      if (!groups.some((entry) => entry.signature === signature)) {
        groups.push({ signature, fields: normalized });
      }
    });
  });
  return groups.map((entry) => entry.fields);
}

function genericSlot(processKey, engineId) {
  const fields = bindingFields(engineId);
  if (!fields.length) return null;
  return {
    key: `${processKey}.${engineId}.datos`,
    processKey,
    introducedBy: engineId,
    label: "Datos requeridos",
    description: "Plantilla estructurada para los datos requeridos por este documento.",
    requiredAny: bindingRequiredAny(engineId),
    fields
  };
}

function processForEngine(engineId, preferredProcessKey) {
  if (preferredProcessKey && (PROCESS_ENGINES[preferredProcessKey] || []).includes(engineId)) return preferredProcessKey;
  return Object.keys(PROCESS_ENGINES).find((key) => PROCESS_ENGINES[key].includes(engineId)) || "";
}

function ownSlots(engineId, processKey) {
  const key = processForEngine(engineId, processKey);
  if (!key) return [];
  if (key === "formacion") {
    return Object.values(EXPLICIT_SLOTS).filter((item) => item.introducedBy === engineId).map(clone);
  }
  const fallback = genericSlot(key, engineId);
  return fallback ? [fallback] : [];
}

function slotsForEngine(engineId, processKey) {
  const key = processForEngine(engineId, processKey);
  const order = PROCESS_ENGINES[key] || [];
  const index = order.indexOf(engineId);
  if (index < 0) return ownSlots(engineId, key);
  const slots = [];
  order.slice(0, index + 1).forEach((id) => {
    ownSlots(id, key).forEach((slot) => {
      if (!slots.some((item) => item.key === slot.key)) slots.push(slot);
    });
  });
  return slots.map((slot) => Object.assign(slot, {
    inherited: slot.introducedBy !== engineId,
    currentEngineId: engineId
  }));
}

function slotForEngine(engineId, processKey, datasetKey) {
  return slotsForEngine(engineId, processKey).find((item) => item.key === datasetKey) || null;
}

function templateMapping(slot) {
  const fields = {};
  (slot && slot.fields || []).forEach((field) => { fields[field.key] = field.label; });
  return { version: 1, fields };
}

function templateHeaders(slot) {
  return (slot && slot.fields || []).map((field) => field.label);
}

module.exports = {
  PROCESS_ENGINES,
  EXPLICIT_SLOTS,
  labelForField,
  bindingFields,
  bindingRequiredAny,
  processForEngine,
  ownSlots,
  slotsForEngine,
  slotForEngine,
  templateMapping,
  templateHeaders
};
