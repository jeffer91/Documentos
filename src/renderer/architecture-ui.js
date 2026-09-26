(function () {
  "use strict";

  const api = window.documentosApp;
  const state = {
    dashboard: null,
    engines: [],
    providers: [],
    capabilities: null,
    dossier: null,
    segments: [],
    masterData: [],
    imports: [],
    knowledgeSources: [],
    citations: [],
    instances: [],
    instance: null,
    editorialValidation: null,
    citationValidation: null,
    dataReadiness: null,
    generationRun: null,
    sectionRecommendations: {},
    currentSectionKey: "",
    instanceStage: "document",
    launchDocumentId: "",
    processFamily: "",
    processPeriodId: "",
    busy: false,
    currentView: "home"
  };

  const view = () => document.getElementById("view");
  const title = () => document.getElementById("screenTitle");
  const breadcrumb = () => document.getElementById("breadcrumb");
  const backButton = () => document.getElementById("backButton");
  let sectionSaveTimer = null;
  let recommendingSections = false;

  const FORMATION_CAREER_OPTIONS = Object.freeze([
    "Enfermería",
    "Mecánica Automotriz",
    "Mecánica de Motos",
    "Diseño Multimedia",
    "Marketing",
    "Ventas",
    "Desarrollo de Software",
    "Ciberseguridad",
    "Redes y Telecomunicaciones"
  ]);

  const FORMATION_PROCESS_ENGINE_IDS = Object.freeze([
    "form.deteccion",
    "form.plan",
    "form.informe",
    "form.seguimiento"
  ]);

  const FORMATION_TRANSVERSAL_NEEDS = Object.freeze([
    "Metodologías activas y aprendizaje basado en proyectos",
    "Evaluación por resultados de aprendizaje y uso de rúbricas",
    "Inteligencia artificial aplicada a la docencia",
    "Investigación aplicada y producción académica",
    "Herramientas digitales para la enseñanza"
  ]);

  const FORMATION_CAREER_NEEDS = Object.freeze([
    { match: ["enfermer"], items: ["Simulación clínica y escenarios de alta fidelidad", "Actualización en procedimientos y seguridad del paciente", "Práctica basada en evidencia"] },
    { match: ["mecanica automotriz", "automotriz"], items: ["Diagnóstico electrónico automotriz", "Vehículos híbridos y eléctricos", "Sistemas de inyección y gestión electrónica"] },
    { match: ["motos", "motoc"], items: ["Diagnóstico electrónico de motocicletas", "Sistemas de inyección y encendido", "Mantenimiento de nuevas tecnologías de movilidad"] },
    { match: ["multimedia", "diseno"], items: ["Diseño de experiencias digitales", "Producción audiovisual con herramientas de IA", "Prototipado y contenidos interactivos"] },
    { match: ["marketing"], items: ["Analítica de marketing y visualización de datos", "IA generativa aplicada al marketing", "Comercio electrónico y automatización"] },
    { match: ["ventas"], items: ["Venta consultiva y negociación", "CRM y analítica comercial", "Social selling y canales digitales"] },
    { match: ["software", "desarrollo"], items: ["Arquitecturas cloud y despliegue", "Inteligencia artificial aplicada al desarrollo", "DevOps, pruebas y calidad de software"] },
    { match: ["ciberseguridad"], items: ["Seguridad ofensiva y defensiva", "Gestión de incidentes y respuesta", "Seguridad en nube y hardening"] },
    { match: ["redes", "telecom"], items: ["Redes definidas por software", "Ciberseguridad de redes", "Infraestructura cloud y virtualización"] }
  ]);

  function normalizeFormationText(value) {
    return String(value == null ? "" : value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function stableFormationHash(value) {
    const text = String(value || "");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function masterValue(key) {
    const item = (state.masterData || []).find((entry) => entry.key === key && entry.scopeType === "dossier" && !entry.scopeKey);
    return item ? item.value : null;
  }

  function formationNeedsForCareer(career, seed) {
    const normalized = normalizeFormationText(career);
    const specific = FORMATION_CAREER_NEEDS.find((group) => group.match.some((token) => normalized.includes(token)));
    const pool = (specific ? specific.items : [])
      .concat(FORMATION_TRANSVERSAL_NEEDS)
      .filter((item, index, items) => items.indexOf(item) === index);
    return pool.slice(0, 5).map((need, index) => {
      const score = 76 + (stableFormationHash(`${seed}|${need}|${index}`) % 20);
      return {
        need,
        priorityScore: score,
        priority: score >= 88 ? "Alta" : "Media",
        horizon: score >= 88 ? "Corto plazo" : "Mediano plazo"
      };
    });
  }

  function buildFormationSyntheticProfile(careers) {
    const cleanCareers = Array.from(new Set((careers || []).map((item) => String(item || "").trim()).filter(Boolean)));
    const periodCode = String(state.dossier && (state.dossier.periodCode || state.dossier.periodLabel) || "PERIODO");
    const doctorateCareerIndex = cleanCareers.length
      ? stableFormationHash(`${periodCode}|doctorado`) % cleanCareers.length
      : -1;

    const rows = cleanCareers.map((career, index) => {
      const seed = `${periodCode}|${normalizeFormationText(career)}`;
      const totalTeachers = 8 + (stableFormationHash(seed) % 8);
      const targetThirdPercent = 60 + (stableFormationHash(seed + "|tercer") % 11);
      let thirdLevel = Math.round(totalTeachers * targetThirdPercent / 100);
      thirdLevel = Math.max(1, Math.min(totalTeachers - 1, thirdLevel));
      const fourthLevel = totalTeachers - thirdLevel;
      const doctorate = index === doctorateCareerIndex && fourthLevel > 0 ? 1 : 0;
      const masters = fourthLevel - doctorate;
      return {
        career,
        totalTeachers,
        thirdLevel,
        masters,
        doctorate,
        fourthLevel,
        thirdLevelPercent: Number((thirdLevel * 100 / totalTeachers).toFixed(1)),
        fourthLevelPercent: Number((fourthLevel * 100 / totalTeachers).toFixed(1)),
        needs: formationNeedsForCareer(career, seed)
      };
    });

    const summary = rows.reduce((acc, row) => {
      acc.totalTeachers += row.totalTeachers;
      acc.thirdLevel += row.thirdLevel;
      acc.masters += row.masters;
      acc.doctorate += row.doctorate;
      acc.fourthLevel += row.fourthLevel;
      return acc;
    }, { totalTeachers: 0, thirdLevel: 0, masters: 0, doctorate: 0, fourthLevel: 0 });

    if (summary.totalTeachers) {
      summary.thirdLevelPercent = Number((summary.thirdLevel * 100 / summary.totalTeachers).toFixed(1));
      summary.fourthLevelPercent = Number((summary.fourthLevel * 100 / summary.totalTeachers).toFixed(1));
    } else {
      summary.thirdLevelPercent = 0;
      summary.fourthLevelPercent = 0;
    }

    return {
      schemaVersion: 1,
      kind: "synthetic_planning_profile",
      periodCode,
      periodLabel: String(state.dossier && state.dossier.periodLabel || periodCode),
      careers: rows,
      summary,
      rules: {
        teachersPerCareer: "8-15",
        thirdLevelTargetPercent: "60-70",
        fourthLevelTargetPercent: "30-40",
        doctorateInstitutionalMaximum: 1,
        doctoratePolicy: "preferentemente_uno_en_todo_el_instituto",
        deterministic: true
      },
      note: "Escenario estimado generado por reglas para planificación. No representa un levantamiento individual ni una encuesta.",
      generatedAt: new Date().toISOString()
    };
  }

  function formationProfile() {
    const value = masterValue("FORMACION_DOCENTE_SINTETICA");
    return value && typeof value === "object" ? value : null;
  }

  function formationSelectedCareers() {
    const stored = masterValue("FORMACION_CARRERAS");
    if (Array.isArray(stored)) return stored.map(String).filter(Boolean);
    const profile = formationProfile();
    return profile && Array.isArray(profile.careers) ? profile.careers.map((item) => item.career).filter(Boolean) : [];
  }

  const escapeHtml = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  function toast(message) {
    const element = document.getElementById("toast");
    if (!element) return;
    element.textContent = String(message || "");
    element.classList.add("show");
    setTimeout(() => element.classList.remove("show"), 3200);
  }

  function appDialog(options) {
    const config = options || {};
    const fields = Array.isArray(config.fields) ? config.fields : [];

    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "app-dialog-backdrop";
      backdrop.innerHTML = `
        <div class="app-dialog" role="dialog" aria-modal="true" aria-labelledby="app-dialog-title">
          <form class="app-dialog-form">
            <div class="app-dialog-head">
              <div>
                <h2 id="app-dialog-title">${escapeHtml(config.title || "Documentos ITSQMET")}</h2>
                ${config.message ? `<p>${escapeHtml(config.message)}</p>` : ""}
              </div>
              <button class="app-dialog-close" type="button" data-dialog-cancel aria-label="Cerrar">×</button>
            </div>
            ${fields.length ? `
              <div class="app-dialog-fields">
                ${fields.map((field) => {
                  const id = "dialog-" + escapeHtml(field.name || "value");
                  const label = escapeHtml(field.label || "");
                  const value = escapeHtml(field.value == null ? "" : field.value);
                  const placeholder = escapeHtml(field.placeholder || "");
                  const required = field.required ? "required" : "";
                  if (field.multiline) {
                    return `
                      <label class="app-dialog-field" for="${id}">
                        <span>${label}</span>
                        <textarea id="${id}" name="${escapeHtml(field.name)}" placeholder="${placeholder}" ${required}>${value}</textarea>
                      </label>
                    `;
                  }
                  if (field.type === "select") {
                    const options = (field.options || []).map((option) => {
                      const optionValue = typeof option === "object" ? option.value : option;
                      const optionLabel = typeof option === "object" ? option.label : option;
                      const selected = String(optionValue) === String(field.value == null ? "" : field.value) ? "selected" : "";
                      return `<option value="${escapeHtml(optionValue)}" ${selected}>${escapeHtml(optionLabel)}</option>`;
                    }).join("");
                    return `
                      <label class="app-dialog-field" for="${id}">
                        <span>${label}</span>
                        <select id="${id}" name="${escapeHtml(field.name)}" ${required}>${options}</select>
                      </label>
                    `;
                  }
                  const min = field.min == null ? "" : `min="${escapeHtml(field.min)}"`;
                  const max = field.max == null ? "" : `max="${escapeHtml(field.max)}"`;
                  const step = field.step == null ? "" : `step="${escapeHtml(field.step)}"`;
                  return `
                    <label class="app-dialog-field" for="${id}">
                      <span>${label}</span>
                      <input id="${id}" name="${escapeHtml(field.name)}" type="${escapeHtml(field.type || "text")}" value="${value}" placeholder="${placeholder}" ${min} ${max} ${step} ${required}>
                    </label>
                  `;
                }).join("")}
              </div>
            ` : ""}
            <div class="app-dialog-actions">
              ${config.cancelText === null ? "" : `<button class="ghost" type="button" data-dialog-cancel>${escapeHtml(config.cancelText || "Cancelar")}</button>`}
              <button class="${config.danger ? "danger-button" : "primary"}" type="submit">${escapeHtml(config.confirmText || "Aceptar")}</button>
            </div>
          </form>
        </div>
      `;

      let settled = false;
      const cleanup = () => {
        document.removeEventListener("keydown", onKeyDown, true);
        backdrop.remove();
      };
      const finish = (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };
      const onKeyDown = (event) => {
        if (event.key === "Escape" && config.cancelText !== null) {
          event.preventDefault();
          finish(null);
        }
      };

      backdrop.querySelectorAll("[data-dialog-cancel]").forEach((button) => {
        button.addEventListener("click", () => finish(null));
      });
      backdrop.addEventListener("mousedown", (event) => {
        if (event.target === backdrop && config.cancelText !== null) finish(null);
      });
      backdrop.querySelector("form").addEventListener("submit", (event) => {
        event.preventDefault();
        const values = {};
        new FormData(event.currentTarget).forEach((value, key) => { values[key] = String(value); });
        finish(values);
      });

      document.addEventListener("keydown", onKeyDown, true);
      document.body.appendChild(backdrop);
      window.setTimeout(() => {
        const first = backdrop.querySelector("input, textarea, select, button[type='submit']");
        if (first) first.focus();
      }, 0);
    });
  }

  async function appPrompt(message, defaultValue, options) {
    const config = options || {};
    const result = await appDialog({
      title: config.title || "Ingresar información",
      fields: [{
        name: "value",
        label: message,
        value: defaultValue == null ? "" : defaultValue,
        type: config.type || "text",
        multiline: Boolean(config.multiline),
        required: Boolean(config.required),
        placeholder: config.placeholder || ""
      }],
      confirmText: config.confirmText || "Continuar",
      cancelText: config.cancelText === undefined ? "Cancelar" : config.cancelText
    });
    return result ? result.value : null;
  }

  async function appConfirm(message, options) {
    const config = options || {};
    const result = await appDialog({
      title: config.title || "Confirmar",
      message,
      confirmText: config.confirmText || "Confirmar",
      cancelText: config.cancelText || "Cancelar",
      danger: Boolean(config.danger)
    });
    return Boolean(result);
  }

  async function appAlert(message, options) {
    const config = options || {};
    await appDialog({
      title: config.title || "Información",
      message,
      confirmText: config.confirmText || "Entendido",
      cancelText: null
    });
  }

  function setHeader(screenTitle, crumbs, canBack) {
    if (title()) title().textContent = screenTitle || "Procesos";
    if (breadcrumb()) breadcrumb().textContent = crumbs || "Procesos";
    if (backButton()) backButton().hidden = !canBack;
  }

  function setBusy(value) {
    state.busy = Boolean(value);
    document.querySelectorAll("[data-arch-action]").forEach((button) => { button.disabled = state.busy; });
  }

  function parseMaybeJson(value) {
    const text = String(value == null ? "" : value).trim();
    if (!text) return "";
    try { return JSON.parse(text); } catch (_error) { return text; }
  }

  async function loadHome() {
    const [dashboard, engines, providers, capabilities] = await Promise.all([
      api.getArchitectureDashboard(),
      api.listEngines(),
      api.listAiProviders(),
      api.getEditorialCapabilities()
    ]);
    state.dashboard = dashboard && dashboard.ok ? dashboard.dashboard : { periods: [], dossiers: [] };
    state.engines = engines && engines.ok ? engines.engines || [] : [];
    state.providers = providers && providers.ok ? providers.providers || [] : [];
    state.capabilities = capabilities && capabilities.ok ? capabilities : null;
  }

  async function loadDossier(dossierId) {
    const response = await api.getDossier(dossierId);
    if (!response || !response.ok || !response.dossier) throw new Error(response && response.error || "No se pudo abrir el expediente.");
    state.dossier = response.dossier;
    state.segments = response.segments || [];
    state.masterData = response.masterData || [];
    state.imports = response.imports || [];
    state.knowledgeSources = response.knowledgeSources || [];
    state.citations = response.citations || [];
    state.instances = response.instances || [];
    const engines = await api.listEngines();
    state.engines = engines && engines.ok ? engines.engines || [] : [];
  }

  async function loadInstance(instanceId) {
    const response = await api.getDocumentInstance(instanceId);
    if (!response || !response.ok || !response.instance) throw new Error(response && response.error || "No se pudo abrir el documento.");
    state.instance = response.instance;
    state.editorialValidation = response.editorialValidation || null;
    state.citationValidation = response.citationValidation || null;
    state.dataReadiness = response.dataReadiness || null;
    state.generationRun = response.generationRun || null;
    if (!state.dossier || state.dossier.id !== state.instance.dossierId) {
      await loadDossier(state.instance.dossierId);
    }
    const visible = state.instance.sections || [];
    if (!visible.some((item) => item.key === state.currentSectionKey)) {
      state.currentSectionKey = visible.length ? visible[0].key : "";
    }
    return state.instance;
  }

  function processOptions() {
    return [
      ["formacion|all", "Formación docente"],
      ["capacitacion|all", "Capacitación docente"],
      ["titulacion_regular|regular", "Titulación · Regulares"],
      ["titulacion_pvc|pvc", "Titulación · PVC"],
      ["construccion_curricular|all", "Construcción Curricular Continua"],
      ["plan_individual|all", "Plan individual"]
    ].map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  }

  function isFormationProcess() {
    return Boolean(state.dossier && state.dossier.processKey === "formacion");
  }

  function formationProcessEngines() {
    const byId = new Map((state.engines || []).map((engine) => [engine.engineId, engine]));
    return FORMATION_PROCESS_ENGINE_IDS.map((engineId) => byId.get(engineId)).filter(Boolean);
  }

  function formationPeriodOptionsMarkup() {
    const periods = state.dashboard && state.dashboard.periods || [];
    const selectedId = state.dossier && state.dossier.periodId || state.processPeriodId || "";
    return periods.map((period) =>
      `<option value="${escapeHtml(period.id)}" ${period.id === selectedId ? "selected" : ""}>${escapeHtml(period.label)}</option>`
    ).join("");
  }

  function formationDocumentCardMarkup(engine, index) {
    const instance = instanceForEngine(engine.engineId);
    const active = Boolean(state.instance && state.instance.engineId === engine.engineId);
    const required = instance && Array.isArray(instance.sections) ? instance.sections.filter((item) => item.required !== false) : [];
    const approved = required.filter((item) => item.status === "approved").length;
    let stateLabel = "Sin iniciar";
    let stateClass = "";
    if (instance && instance.finalFrozenAt) {
      stateLabel = "Final";
      stateClass = "good";
    } else if (instance) {
      stateLabel = required.length ? `${approved}/${required.length} secciones aprobadas` : "En edición";
      stateClass = approved && approved === required.length ? "good" : "";
    }
    return `
      <button class="process-document-card ${active ? "active" : ""}" type="button"
        data-arch-action="process-document" data-engine-id="${escapeHtml(engine.engineId)}">
        <span class="process-document-step">${index + 1}</span>
        <span class="process-document-copy">
          <b>${escapeHtml(engine.label)}</b>
          <small>${active ? "Documento abierto" : stateLabel}</small>
        </span>
        <span class="status ${stateClass}">${instance ? (instance.finalFrozenAt ? "Final" : "Activo") : "Pendiente"}</span>
      </button>
    `;
  }

  function formationProcessWorkspaceMarkup() {
    if (!isFormationProcess()) return "";
    const engines = formationProcessEngines();
    return `
      <section class="process-workspace-overview">
        <div class="process-workspace-top">
          <div>
            <span class="process-workspace-kicker">Proceso</span>
            <h2>Formación docente</h2>
            <p>El período y los datos se comparten entre todos los documentos de este proceso.</p>
          </div>
          <div class="process-period-control">
            <label for="formationProcessPeriod">Período de trabajo</label>
            <div class="process-period-row">
              <select id="formationProcessPeriod" data-formation-period-select>
                ${formationPeriodOptionsMarkup()}
              </select>
              <button class="secondary" type="button" data-arch-action="new-formation-period">+ Nuevo período</button>
            </div>
          </div>
        </div>
        <div class="process-document-grid">
          ${engines.map(formationDocumentCardMarkup).join("")}
        </div>
      </section>
    `;
  }

  async function ensureFormationDossier(periodId) {
    if (!state.dashboard) await loadHome();
    const period = (state.dashboard.periods || []).find((item) => item.id === periodId);
    if (!period) throw new Error("Período no válido.");
    let dossier = (state.dashboard.dossiers || []).find((item) =>
      item.periodId === periodId &&
      item.processKey === "formacion" &&
      (!item.population || item.population === "all")
    );
    if (!dossier) {
      const response = await api.createDossier({
        periodId,
        processKey: "formacion",
        population: "all",
        label: `Formación docente · ${period.label}`
      });
      if (!response || !response.ok) throw new Error(response && response.error || "No se pudo abrir el proceso de Formación.");
      dossier = response.dossier;
      await loadHome();
    }
    state.processFamily = "formacion";
    state.processPeriodId = periodId;
    try { localStorage.setItem("documentos-process-period-formacion", periodId); } catch (_error) { /* opcional */ }
    await loadDossier(dossier.id);
    return state.dossier;
  }

  async function switchFormationPeriod(periodId) {
    if (!periodId || state.busy) return;
    clearTimeout(sectionSaveTimer);
    if (state.instance && state.currentView === "instance" && state.instanceStage === "document") {
      const saved = await persistCurrentEditor();
      if (!saved) return;
    }
    const currentEngineId = state.instance && FORMATION_PROCESS_ENGINE_IDS.includes(state.instance.engineId)
      ? state.instance.engineId
      : "form.deteccion";
    setBusy(true);
    try {
      const dossier = await ensureFormationDossier(periodId);
      const engine = formationProcessEngines().find((item) => item.engineId === currentEngineId) ||
        formationProcessEngines()[0];
      if (!engine) throw new Error("No se encontró el motor de Formación.");
      await ensureEngineInDossier(engine, dossier.id);
    } finally {
      setBusy(false);
    }
  }

  async function openFormationProcess(documentId, preferredPeriodId) {
    state.processFamily = "formacion";
    if (!state.dashboard) await loadHome();
    let periods = state.dashboard && state.dashboard.periods || [];
    if (!periods.length) {
      const created = await newPeriod({ renderHome: false });
      if (!created) return renderHome();
      await loadHome();
      periods = state.dashboard && state.dashboard.periods || [];
      preferredPeriodId = created.id;
    }

    let remembered = "";
    try { remembered = localStorage.getItem("documentos-process-period-formacion") || ""; } catch (_error) { /* opcional */ }
    const directDossier = (state.dashboard.dossiers || []).find((dossier) =>
      dossier.processKey === "formacion" &&
      formationProcessEngines().some((engine) => engine.documentId === documentId && dossierMatchesEngine(dossier, engine))
    );
    const periodId = [preferredPeriodId, remembered, directDossier && directDossier.periodId, periods[0] && periods[0].id]
      .find((candidate) => candidate && periods.some((period) => period.id === candidate));
    if (!periodId) return renderHome();

    const dossier = await ensureFormationDossier(periodId);
    const engine = formationProcessEngines().find((item) => item.documentId === documentId) ||
      formationProcessEngines()[0];
    if (!engine) return toast("No se encontraron los documentos del proceso de Formación.");
    await ensureEngineInDossier(engine, dossier.id);
  }

  function periodCard(period) {
    return `
      <article class="arch-card">
        <div class="arch-card-head">
          <div><b>${escapeHtml(period.label)}</b><small>${escapeHtml(period.code)}</small></div>
          <span class="status good">${escapeHtml(period.status)}</span>
        </div>
        <div class="arch-create-row">
          <select id="arch-process-${escapeHtml(period.id)}">${processOptions()}</select>
          <button class="secondary small-inline" data-arch-action="create-dossier" data-period-id="${escapeHtml(period.id)}">+ Expediente</button>
        </div>
      </article>
    `;
  }

  function dossierCard(dossier) {
    const population = dossier.population && dossier.population !== "all" ? ` · ${dossier.population.toUpperCase()}` : "";
    return `
      <button class="arch-card arch-card-button" data-arch-action="open-dossier" data-id="${escapeHtml(dossier.id)}">
        <div class="arch-card-head">
          <div>
            <b>${escapeHtml(dossier.label)}</b>
            <small>${escapeHtml(dossier.periodLabel || dossier.periodCode)} · ${escapeHtml(dossier.processKey)}${escapeHtml(population)}</small>
          </div>
          <span>→</span>
        </div>
      </button>
    `;
  }

  function providerPanel() {
    const items = state.providers || [];
    return `
      <section class="panel compact">
        <div class="panel-title">
          <div><h3>IA automática</h3><small>Una IA puede redactar y revisarse; las adicionales revisan.</small></div>
          <span class="status ${items.some((item) => item.enabled) ? "good" : "warn"}">${items.filter((item) => item.enabled).length} activas</span>
        </div>
        ${items.length ? `<div class="arch-provider-list">${items.map((item) => `
          <div class="arch-provider">
            <div><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.kind)} · ${escapeHtml(item.model)} · ${escapeHtml(item.role)}</small></div>
            <div class="button-row">
              <button class="ghost small-inline" data-arch-action="test-provider" data-id="${escapeHtml(item.id)}">Probar</button>
              <button class="danger-button small-inline" data-arch-action="delete-provider" data-id="${escapeHtml(item.id)}">Quitar</button>
            </div>
          </div>
        `).join("")}</div>` : '<div class="notice-warn"><b>Sin IA configurada</b><span>La arquitectura funciona; configura una IA para generación automática.</span></div>'}
        <details class="arch-details">
          <summary>+ Agregar IA</summary>
          <div class="form-grid arch-form">
            <div class="field"><label>Nombre</label><input id="archProviderName" placeholder="Ej. GPT principal"></div>
            <div class="field"><label>Tipo</label><select id="archProviderKind"><option value="openai-compatible">OpenAI compatible</option><option value="anthropic">Anthropic</option></select></div>
            <div class="field full"><label>URL base</label><input id="archProviderUrl" placeholder="https://api.openai.com/v1"></div>
            <div class="field"><label>Modelo</label><input id="archProviderModel" placeholder="gpt-..."></div>
            <div class="field"><label>Rol</label><select id="archProviderRole"><option value="both">Redacta y revisa</option><option value="writer">Redacta</option><option value="reviewer">Solo revisa</option></select></div>
            <div class="field"><label>Clave API (se cifra localmente)</label><input id="archProviderKey" type="password"></div>
            <div class="field"><label>Variable de entorno (opcional)</label><input id="archProviderEnv" placeholder="OPENAI_API_KEY"></div>
          </div>
          <button class="primary" data-arch-action="save-provider">Guardar IA</button>
        </details>
      </section>
    `;
  }

  async function renderHome() {
    state.currentView = "home";
    state.instance = null;
    state.dossier = null;
    state.processFamily = "";
    state.processPeriodId = "";
    setHeader("Procesos", "Períodos y expedientes", false);
    await loadHome();
    const dashboard = state.dashboard || { periods: [], dossiers: [] };
    view().innerHTML = `
      <div class="arch-metrics">
        <div class="metric"><small>Documentos activos</small><b>${Number(dashboard.documentTypeCount || 0)}</b></div>
        <div class="metric"><small>Motores</small><b>${Number(dashboard.engineCount || 0)}</b></div>
        <div class="metric"><small>Períodos</small><b>${(dashboard.periods || []).length}</b></div>
        <div class="metric"><small>Finales congelados</small><b>${Number(dashboard.finalCount || 0)}</b></div>
      </div>

      <div class="section-head">
        <div><h2>Períodos</h2><p>Cada período pertenece al proceso completo: todos sus documentos heredan el mismo contexto y los mismos datos compartidos.</p></div>
        <button class="primary" data-arch-action="new-period">+ Período</button>
      </div>
      <div class="arch-grid">
        ${(dashboard.periods || []).length ? dashboard.periods.map(periodCard).join("") : '<div class="empty"><b>Sin períodos</b>Crea el primer período para comenzar.</div>'}
      </div>

      <div class="section-head"><div><h2>Procesos por período</h2><p>Cada combinación período + proceso usa un único expediente compartido para evitar duplicar datos entre documentos.</p></div></div>
      <div class="arch-grid">
        ${(dashboard.dossiers || []).length ? dashboard.dossiers.map(dossierCard).join("") : '<div class="empty"><b>Sin expedientes</b>Crea uno desde un período.</div>'}
      </div>

      <div class="section-head"><div><h2>Configuración de IA</h2></div></div>
      ${providerPanel()}
    `;
  }

  function processKeyForEngine(engine) {
    if (!engine) return "";
    if (engine.family === "titulacion") {
      if (engine.population === "pvc") return "titulacion_pvc";
      return "titulacion_regular";
    }
    return engine.family || "";
  }

  function dossierMatchesEngine(dossier, engine) {
    if (!dossier || !engine) return false;
    if (engine.family === dossier.processKey) return true;
    if (engine.family === "titulacion") {
      return dossier.processKey === "titulacion_regular" || dossier.processKey === "titulacion_pvc";
    }
    if (dossier.processKey === "titulacion_regular") {
      return engine.family === "titulacion_regular" || (engine.family === "titulacion" && engine.population !== "pvc");
    }
    if (dossier.processKey === "titulacion_pvc") {
      return engine.family === "titulacion_pvc" || (engine.family === "titulacion" && engine.population !== "regular");
    }
    return false;
  }

  async function ensureEngineInDossier(engine, dossierId) {
    await loadDossier(dossierId);
    let scopeKey = "";
    const cardinality = engine.cardinality || "period";
    if (cardinality === "period_population") {
      scopeKey = state.dossier.population || engine.population || "all";
    } else if (cardinality !== "period") {
      scopeKey = await appPrompt(`Identificador para ${cardinality}:`, "", { required: true }) || "";
      if (!scopeKey) return;
    }
    const response = await api.ensureDocumentInstance(state.dossier.id, engine.engineId, {
      type: cardinality,
      key: scopeKey
    });
    if (!response || !response.ok) return toast(response && response.error || "No se pudo abrir el documento.");
    state.instanceStage = engine.engineId === "form.deteccion" && !formationProfile()
      ? "preparation"
      : "document";
    state.currentSectionKey = "";
    state.sectionRecommendations = {};
    await renderInstance(response.instance.id);
  }

  async function openDocument(documentId) {
    state.currentView = "launcher";
    state.launchDocumentId = documentId || "";
    state.instance = null;
    state.dossier = null;
    state.sectionRecommendations = {};
    await loadHome();
    const engines = (state.engines || []).filter((engine) => engine.documentId === documentId);
    if (!engines.length) {
      setHeader("Documento", "Inicio / Documento", true);
      view().innerHTML = '<div class="empty"><b>Motor no disponible</b>Este documento todavía no tiene un motor documental activo.</div>';
      return;
    }

    if (engines.some((engine) => engine.family === "formacion")) {
      return openFormationProcess(documentId);
    }

    const directMatches = [];
    engines.forEach((engine) => {
      (state.dashboard && state.dashboard.dossiers || []).filter((dossier) => dossierMatchesEngine(dossier, engine))
        .forEach((dossier) => directMatches.push({ engine, dossier }));
    });
    if (engines.length === 1 && directMatches.length === 1) {
      return ensureEngineInDossier(engines[0], directMatches[0].dossier.id);
    }

    setHeader(engines[0].label, "Inicio / Seleccionar período", true);
    const periods = state.dashboard && state.dashboard.periods || [];
    const dossiers = state.dashboard && state.dashboard.dossiers || [];
    view().innerHTML = `
      <div class="document-launcher">
        <div class="section-head">
          <div>
            <h2>¿En qué período vas a trabajar?</h2>
            <p>Selecciona el período del proceso. Si ya existe un expediente para ese proceso, este documento reutilizará automáticamente su contexto y sus datos.</p>
          </div>
        </div>
        ${engines.map((engine) => {
          const matching = dossiers.filter((dossier) => dossierMatchesEngine(dossier, engine));
          return `
            <section class="panel compact launch-engine-group">
              <div class="panel-title">
                <div><h3>${escapeHtml(engine.label)}</h3><small>${escapeHtml(engine.engineId)} · ${engine.outlineStatus === "confirmed" ? "estructura confirmada" : "estructura base"}</small></div>
              </div>
              ${matching.length ? `
                <div class="launch-existing-list">
                  ${matching.map((dossier) => `
                    <button class="launch-row" type="button" data-arch-action="launch-existing" data-engine-id="${escapeHtml(engine.engineId)}" data-dossier-id="${escapeHtml(dossier.id)}">
                      <span><b>${escapeHtml(dossier.periodLabel)}</b><small>${escapeHtml(dossier.label)}</small></span><em>Abrir →</em>
                    </button>
                  `).join("")}
                </div>
              ` : '<div class="notice-soft"><b>Sin expediente todavía</b><span>Puedes crearlo directamente desde uno de los períodos disponibles.</span></div>'}
              ${periods.length ? `
                <div class="launch-period-grid">
                  ${periods.filter((period) => !matching.some((dossier) => dossier.periodId === period.id)).map((period) => `
                    <button class="ghost" type="button" data-arch-action="launch-period" data-engine-id="${escapeHtml(engine.engineId)}" data-period-id="${escapeHtml(period.id)}">
                      + ${escapeHtml(period.label)}
                    </button>
                  `).join("")}
                </div>
              ` : '<button class="primary" type="button" data-arch-action="new-period">+ Crear primer período</button>'}
            </section>
          `;
        }).join("")}
      </div>
    `;
  }

  async function renderDocuments() {
    state.currentView = "documents";
    state.instance = null;
    state.dossier = null;
    await loadHome();
    setHeader("Documentos", "Documentos", false);
    const instances = state.dashboard && state.dashboard.instances || [];
    view().innerHTML = `
      <div class="section-head">
        <div><h2>Documentos institucionales</h2><p>Borradores y versiones finales creados por los motores documentales.</p></div>
      </div>
      ${instances.length ? `<div class="document-instance-list">${instances.map((item) => `
        <button class="doc-row" type="button" data-arch-action="open-instance" data-id="${escapeHtml(item.id)}">
          <span class="doc-icon">${item.status === "final" ? "✓" : "▤"}</span>
          <span class="doc-main">
            <h3>${escapeHtml(item.label)}</h3>
            <p>${escapeHtml(item.periodLabel || "")} · ${escapeHtml(item.dossierLabel || "")}</p>
          </span>
          <span class="status ${item.status === "final" ? "good" : ""}">${item.status === "final" ? "Final" : "Borrador"}</span>
        </button>
      `).join("")}</div>` : '<div class="empty"><b>Sin documentos</b>Crea un documento desde Inicio o desde Procesos.</div>'}
    `;
  }

  async function launchPeriod(engineId, periodId) {
    const engine = (state.engines || []).find((item) => item.engineId === engineId);
    const period = state.dashboard && (state.dashboard.periods || []).find((item) => item.id === periodId);
    if (!engine || !period) return;
    const processKey = processKeyForEngine(engine);
    const population = engine.population && engine.population !== "all" ? engine.population : "all";
    const existing = (state.dashboard.dossiers || []).find((dossier) =>
      dossier.periodId === periodId &&
      dossierMatchesEngine(dossier, engine) &&
      (population === "all" || dossier.population === population || dossier.population === "all")
    );
    let dossier = existing;
    if (!dossier) {
      const response = await api.createDossier({
        periodId,
        processKey,
        population,
        label: `${engine.family === "formacion" ? "Formación docente" : engine.family === "capacitacion" ? "Capacitación docente" : engine.label} · ${period.label}`
      });
      if (!response || !response.ok) return toast(response && response.error || "No se pudo crear el expediente.");
      dossier = response.dossier;
    }
    await ensureEngineInDossier(engine, dossier.id);
  }

  function engineMatchesDossier(engine) {
    if (!state.dossier) return false;
    if (engine.family === state.dossier.processKey) return true;
    if (state.dossier.processKey === "titulacion_regular") {
      return engine.family === "titulacion_regular" || (engine.family === "titulacion" && engine.population !== "pvc");
    }
    if (state.dossier.processKey === "titulacion_pvc") {
      return engine.family === "titulacion_pvc" || (engine.family === "titulacion" && engine.population !== "regular");
    }
    return false;
  }

  function instanceForEngine(engineId) {
    return (state.instances || []).find((item) => item.engineId === engineId) || null;
  }

  function masterDataHtml() {
    if (!(state.masterData || []).length) return '<div class="empty compact-empty"><b>Sin datos maestros</b>Agrega carreras, cronogramas, responsables u otra información compartida.</div>';
    return `<div class="arch-data-list">${state.masterData.map((item) => `
      <div class="arch-data-row">
        <div><b>${escapeHtml(item.key)}</b><small>${escapeHtml(item.scopeType)}${item.scopeKey ? " · " + escapeHtml(item.scopeKey) : ""} · rev. ${item.revision}</small></div>
        <code>${escapeHtml(typeof item.value === "string" ? item.value : JSON.stringify(item.value))}</code>
      </div>
    `).join("")}</div>`;
  }

  function mappedFieldCount(mapping) {
    const input = mapping && typeof mapping === "object" ? mapping : {};
    const base = input.fields && typeof input.fields === "object"
      ? input.fields
      : Object.fromEntries(Object.entries(input).filter(([key]) => !["sheets", "sheetFields", "version"].includes(key)));
    let total = Object.keys(base || {}).length;
    const perSheet = input.sheets || input.sheetFields || {};
    Object.values(perSheet || {}).forEach((value) => {
      const fields = value && value.fields && typeof value.fields === "object" ? value.fields : value;
      if (fields && typeof fields === "object") total += Object.keys(fields).length;
    });
    return total;
  }

  function importsHtml() {
    if (!(state.imports || []).length) return '<div class="empty compact-empty"><b>Sin archivos de datos</b>El motor está listo para uno o varios Excel/CSV.</div>';
    return `<div class="arch-data-list">${state.imports.map((item) => {
      const profile = item.profile || {};
      const sheets = profile.sheets || [];
      const mapped = mappedFieldCount(item.mapping || {});
      return `
        <div class="arch-data-row">
          <div>
            <b>${escapeHtml(item.sourceName)}</b>
            <small>${Number(profile.totalRows || 0)} filas · ${sheets.length} hoja(s) · alcance: ${escapeHtml(item.scopeType || "dossier")}${item.scopeKey ? " / " + escapeHtml(item.scopeKey) : ""}</small>
            <small class="${mapped ? "arch-ok-text" : "arch-warn-text"}">Mapeo canónico: ${mapped ? mapped + " campo(s)" : "pendiente"} · SHA-256 ${escapeHtml(String(item.sha256 || "").slice(0, 12))}…</small>
          </div>
          <div class="button-row">
            <button class="ghost small-inline" data-arch-action="suggest-mapping" data-id="${escapeHtml(item.id)}">Sugerir</button>
            <button class="secondary small-inline" data-arch-action="edit-mapping" data-id="${escapeHtml(item.id)}">Mapeo</button>
          </div>
        </div>
      `;
    }).join("")}</div>`;
  }

  function citationForSource(sourceId) {
    return (state.citations || []).find((item) => item.sourceId === sourceId) || null;
  }

  function knowledgeHtml() {
    if (!(state.knowledgeSources || []).length) return '<div class="empty compact-empty"><b>Sin fuentes institucionales</b>Agrega reglamentos, manuales, políticas o normativa.</div>';
    return `<div class="arch-data-list">${state.knowledgeSources.map((item) => {
      const citation = citationForSource(item.id);
      return `
      <div class="arch-data-row">
        <div>
          <b>${escapeHtml(item.name)}</b>
          <small>${escapeHtml(item.sourceType)} · ${Number(item.textLength || 0)} caracteres · SHA-256 registrado</small>
          <small class="${citation && citation.complete ? "arch-ok-text" : "arch-warn-text"}">APA: ${citation && citation.complete ? "completo" : "pendiente de metadatos"}${citation && citation.sourceType ? " · " + escapeHtml(citation.sourceType) : ""}</small>
          ${citation && !citation.complete && citation.validation && citation.validation.errors && citation.validation.errors.length
            ? `<small class="arch-warn-text">${escapeHtml(citation.validation.errors.slice(0, 2).join(" · "))}</small>`
            : ""}
        </div>
        <div class="button-row">
          <button class="ghost small-inline" data-arch-action="edit-citation" data-source-id="${escapeHtml(item.id)}">APA</button>
          <button class="danger-button small-inline" data-arch-action="remove-knowledge" data-id="${escapeHtml(item.id)}">Quitar</button>
        </div>
      </div>
    `;
    }).join("")}</div>`;
  }

  function engineCard(engine) {
    const instance = instanceForEngine(engine.engineId);
    const outlineLabel = engine.outlineStatus === "confirmed" ? "estructura confirmada" : "estructura base";
    const dataLabel = Number(engine.dataBindingCount || 0) ? `${Number(engine.dataBindingCount)} vínculo(s) de datos` : "sin Excel obligatorio";
    const badges = [engine.cardinality, engine.population !== "all" ? engine.population : "", outlineLabel, dataLabel].filter(Boolean).join(" · ");
    if (instance) {
      const lifecycleLabel = instance.engineState === "migration_pending"
        ? "Migración pendiente"
        : instance.engineState === "frozen_historical"
          ? "Final histórica"
          : instance.stale
            ? "Desactualizado"
            : instance.status;
      const lifecycleClass = instance.status === "final" ? "good" : (instance.stale || instance.engineState === "migration_pending") ? "warn" : "";
      return `
        <article class="arch-engine-card ${instance.stale || instance.engineState === "migration_pending" ? "stale" : ""}">
          <div class="arch-card-head">
            <div>
              <b>${escapeHtml(engine.label)}</b>
              <small>${escapeHtml(badges)} · motor guardado v${escapeHtml(instance.engineVersion || "")}</small>
            </div>
            <span class="status ${lifecycleClass}">${escapeHtml(lifecycleLabel)}</span>
          </div>
          <button class="secondary" data-arch-action="open-instance" data-id="${escapeHtml(instance.id)}">Abrir motor</button>
        </article>
      `;
    }
    return `
      <article class="arch-engine-card">
        <div class="arch-card-head">
          <div><b>${escapeHtml(engine.label)}</b><small>${escapeHtml(badges)}</small></div>
          <span class="status">Sin crear</span>
        </div>
        <button class="ghost" data-arch-action="create-instance" data-engine-id="${escapeHtml(engine.engineId)}" data-cardinality="${escapeHtml(engine.cardinality)}">Crear</button>
      </article>
    `;
  }

  async function renderDossier(dossierId) {
    state.currentView = "dossier";
    state.instance = null;
    await loadDossier(dossierId || state.dossier && state.dossier.id);
    if (isFormationProcess()) {
      await loadHome();
      state.processFamily = "formacion";
      state.processPeriodId = state.dossier.periodId;
    }
    setHeader(
      isFormationProcess() ? "Formación docente" : state.dossier.label,
      isFormationProcess() ? `Procesos / Formación docente / ${state.dossier.periodLabel}` : `Procesos / ${state.dossier.periodLabel}`,
      true
    );
    const engines = state.engines.filter(engineMatchesDossier);
    view().innerHTML = `
      ${formationProcessWorkspaceMarkup()}
      <div class="arch-dossier-head">
        <div>
          <span class="process-code">${escapeHtml(state.dossier.processKey)}</span>
          <h2>${isFormationProcess() ? "Datos compartidos de Formación docente" : escapeHtml(state.dossier.label)}</h2>
          <p>${escapeHtml(state.dossier.periodLabel)}${isFormationProcess() ? " · disponibles para los cuatro documentos" : " · población: " + escapeHtml(state.dossier.population)}</p>
        </div>
        <div class="button-row">
          <button class="ghost small-inline" data-arch-action="clone-dossier">Copiar a otro período</button>
          <span class="status good">${isFormationProcess() ? "Datos del proceso" : "Expediente maestro"}</span>
        </div>
      </div>

      <div class="arch-two-col">
        <section class="panel compact">
          <div class="panel-title">
            <div><h3>Datos maestros</h3><small>Se ingresan una vez y los consumen los motores autorizados.</small></div>
            <button class="secondary small-inline" data-arch-action="add-master">+ Dato</button>
          </div>
          ${masterDataHtml()}
        </section>
        <section class="panel compact">
          <div class="panel-title">
            <div><h3>Excel / CSV</h3><small>Se conserva el original y una copia normalizada.</small></div>
            <button class="secondary small-inline" data-arch-action="add-data-import">+ Archivo</button>
          </div>
          ${importsHtml()}
        </section>
      </div>

      <section class="panel compact">
        <div class="panel-title">
          <div><h3>Fuentes institucionales</h3><small>Base Legal y Alineación Institucional se sustentan aquí.</small></div>
          <button class="secondary small-inline" data-arch-action="add-knowledge">+ Fuente</button>
        </div>
        ${knowledgeHtml()}
      </section>

      ${isFormationProcess() ? "" : `
        <div class="section-head">
          <div><h2>Motores documentales</h2><p>Cada documento tiene reglas propias aunque comparta datos con otros.</p></div>
        </div>
        <div class="arch-engine-grid">${engines.map(engineCard).join("")}</div>
      `}
    `;
  }

  function alertBlock(section) {
    if (state.instance && state.instance.finalFrozenAt) return "";
    const alerts = [];
    (section.alerts || []).forEach((alert) => alerts.push(Object.assign({ source: "section" }, alert || {})));
    (section.blocks || []).forEach((block) => {
      (block.alerts || []).forEach((alert) => alerts.push(Object.assign({
        source: "block",
        blockKey: block.key || ""
      }, alert || {})));
    });
    if (!alerts.length) return "";
    return `<div class="arch-alerts">${alerts.map((alert) => `
      <div class="arch-alert ${alert.severity === "error" ? "error" : ""}">
        <b>${escapeHtml(alert.type || "Alerta")}${alert.source === "block" && alert.blockKey ? " · " + escapeHtml(alert.blockKey) : ""}</b>
        <span>${escapeHtml(alert.message || "")}</span>
      </div>
    `).join("")}</div>`;
  }

  function blockSummary(section) {
    const blocks = section.blocks || [];
    if (!blocks.length) return '<span class="arch-muted-chip">Sin bloques estructurados</span>';
    return blocks.map((block) => {
      const label = block.type === "visual" && block.visualType ? `Visual: ${visualLabel(block.visualType)}` : block.type;
      return `<span class="arch-block-chip">${escapeHtml(label)}</span>`;
    }).join("");
  }

  function blockEditor(section) {
    const blocks = section.blocks || [];
    if (!blocks.length) {
      return `
        <textarea class="arch-section-text" id="arch-section-${escapeHtml(section.key)}" ${section.locked ? "disabled" : ""}>${escapeHtml(section.content)}</textarea>
        ${section.locked ? "" : `<button class="ghost small-inline" data-arch-action="save-section" data-key="${escapeHtml(section.key)}">Guardar edición</button>`}
      `;
    }

    return `
      <div class="arch-block-editor">
        ${blocks.map((block, index) => {
          const heading = block.type === "visual" && block.visualType
            ? `${index + 1}. Visual · ${visualLabel(block.visualType)}`
            : `${index + 1}. ${block.type} · ${block.role || "body"}`;
          if (["prose", "quote", "callout"].includes(block.type)) {
            return `
              <div class="arch-block-edit-card">
                <b>${escapeHtml(heading)}</b>
                <textarea data-arch-block-text data-section-key="${escapeHtml(section.key)}" data-block-key="${escapeHtml(block.key)}" ${section.locked ? "disabled" : ""}>${escapeHtml(block.text || "")}</textarea>
              </div>
            `;
          }
          if (block.type === "list") {
            const items = block.data && Array.isArray(block.data.items) ? block.data.items : [];
            return `
              <div class="arch-block-edit-card">
                <b>${escapeHtml(heading)}</b>
                <textarea data-arch-block-list data-section-key="${escapeHtml(section.key)}" data-block-key="${escapeHtml(block.key)}" ${section.locked ? "disabled" : ""}>${escapeHtml(items.join("\n"))}</textarea>
              </div>
            `;
          }
          return `
            <div class="arch-block-static">
              <div><b>${escapeHtml(heading)}</b><small>${escapeHtml(block.title || block.caption || "Bloque estructurado")}</small></div>
              <span class="status good">Preservado</span>
            </div>
          `;
        }).join("")}
      </div>
      ${section.locked ? "" : `<button class="ghost small-inline" data-arch-action="save-blocks" data-key="${escapeHtml(section.key)}">Guardar bloques editados</button>`}
    `;
  }

  function sectionStatusLabel(status) {
    return ({
      pending: "Pendiente",
      generated: "Generada",
      reviewed: "Generada",
      edited: "Editada",
      needs_review: "Revisar",
      migration_pending: "Revisar",
      approved: "Aprobada"
    }[status] || "Pendiente");
  }

  function sectionStatusClass(status) {
    if (status === "approved") return "good";
    if (status === "needs_review" || status === "migration_pending") return "warn";
    return "";
  }

  function readinessFor(sectionKey) {
    return state.dataReadiness && Array.isArray(state.dataReadiness.sections)
      ? state.dataReadiness.sections.find((item) => item.sectionKey === sectionKey) || null
      : null;
  }

  function structureSections() {
    return [].concat(state.instance && state.instance.sections || [], state.instance && state.instance.omittedSections || [])
      .sort((a, b) => String(a.sortPath || "").localeCompare(String(b.sortPath || ""), undefined, { numeric: true }));
  }

  function activeCurrentSection() {
    const list = state.instance && state.instance.sections || [];
    return list.find((item) => item.key === state.currentSectionKey) || list[0] || null;
  }

  function recommendationFor(sectionKey) {
    return state.sectionRecommendations && state.sectionRecommendations[sectionKey] || null;
  }

  function sectionIndexMarkup() {
    const items = structureSections();
    return `<div class="section-nav-list">${items.map((section) => {
      const included = section.included !== false;
      const recommendation = recommendationFor(section.key);
      const current = included && state.currentSectionKey === section.key;
      const optional = section.required === false && section.layout && section.layout.optionalToggle;
      return `
        <div class="section-nav-row ${current ? "active" : ""} ${included ? "" : "omitted"}" style="--section-level:${Math.max(1, Number(section.level || 1))}">
          <button class="section-nav-open" type="button" data-arch-action="${included ? "select-section" : "include-section"}" data-key="${escapeHtml(section.key)}">
            <span class="section-nav-number">${escapeHtml(section.numbering || "")}</span>
            <span class="section-nav-copy">
              <b>${escapeHtml(section.title)}</b>
              <small>${included ? sectionStatusLabel(section.status) : "No incluida"}${recommendation ? ` · IA: ${recommendation.include ? "incluir" : "omitir"}` : ""}</small>
            </span>
            ${included ? `<i class="status ${sectionStatusClass(section.status)}">${escapeHtml(sectionStatusLabel(section.status))}</i>` : ""}
          </button>
          ${optional ? `
            <button class="section-toggle ${included ? "on" : ""}" type="button" data-arch-action="toggle-section-included" data-key="${escapeHtml(section.key)}" data-included="${included ? "true" : "false"}" title="${included ? "Omitir del documento" : "Incluir en el documento"}">
              ${included ? "✓" : "+"}
            </button>
          ` : ""}
        </div>
      `;
    }).join("")}</div>`;
  }

  function sectionEditorMarkup(section) {
    const locked = Boolean(section.locked || state.instance.finalFrozenAt);
    const blocks = section.blocks || [];
    if (!blocks.length) {
      return `<textarea class="arch-section-text arch-current-editor" data-arch-editor="content" data-section-key="${escapeHtml(section.key)}" ${locked ? "disabled" : ""}>${escapeHtml(section.content || "")}</textarea>`;
    }
  
    return `<div class="arch-block-editor">${blocks.map((block, index) => {
      const heading = block.type === "visual" && block.visualType
        ? `${index + 1}. Visual · ${visualLabel(block.visualType)}`
        : `${index + 1}. ${block.type} · ${block.role || "body"}`;
      if (["prose", "quote", "callout"].includes(block.type)) {
        return `<div class="arch-block-edit-card">
          <b>${escapeHtml(heading)}</b>
          <textarea data-arch-editor="block-text" data-section-key="${escapeHtml(section.key)}" data-block-key="${escapeHtml(block.key)}" ${locked ? "disabled" : ""}>${escapeHtml(block.text || "")}</textarea>
        </div>`;
      }
      if (block.type === "list") {
        const items = block.data && Array.isArray(block.data.items) ? block.data.items : [];
        return `<div class="arch-block-edit-card">
          <b>${escapeHtml(heading)}</b>
          <textarea data-arch-editor="block-list" data-section-key="${escapeHtml(section.key)}" data-block-key="${escapeHtml(block.key)}" ${locked ? "disabled" : ""}>${escapeHtml(items.join("\n"))}</textarea>
        </div>`;
      }
      return `<div class="arch-block-static">
        <div><b>${escapeHtml(heading)}</b><small>${escapeHtml(block.title || block.caption || "Bloque estructurado")}</small></div>
        <span class="status good">Preservado</span>
      </div>`;
    }).join("")}</div>`;
  }

  function traceMarkup(section) {
    const readiness = readinessFor(section.key);
    const provenance = section.provenance || {};
    const allowed = section.allowedVisuals || [];
    const alerts = [];
    (section.alerts || []).forEach((alert) => alerts.push(alert));
    (section.blocks || []).forEach((block) => (block.alerts || []).forEach((alert) => alerts.push(alert)));
    return `<details class="section-trace">
      <summary>Ver respaldo y trazabilidad</summary>
      <div class="section-trace-grid">
        <div><b>Datos</b><span>${readiness && readiness.bindingId ? (readiness.ready ? "Listos" : (readiness.warnings || []).join(" · ") || "Pendientes") : "No requiere datos estructurados"}</span></div>
        <div><b>Origen</b><span>${escapeHtml(provenance.source || "sin generar")}${provenance.writerProvider ? " · " + escapeHtml(provenance.writerProvider) : ""}</span></div>
        <div><b>Visuales</b><span>${allowed.length ? escapeHtml(allowed.map(visualLabel).join(", ")) : "No requeridos"}</span></div>
        <div><b>Alertas</b><span>${alerts.length ? escapeHtml(alerts.slice(0, 4).map((item) => item.message || item.type || "Alerta").join(" · ")) : "Sin alertas"}</span></div>
      </div>
    </details>`;
  }

  function documentStageMarkup() {
    const section = activeCurrentSection();
    if (!section) return '<div class="empty"><b>Sin secciones activas</b>Incluye al menos una sección para continuar.</div>';
    const active = state.instance.sections || [];
    const index = active.findIndex((item) => item.key === section.key);
    const previous = index > 0 ? active[index - 1] : null;
    const next = index >= 0 && index < active.length - 1 ? active[index + 1] : null;
    const readiness = readinessFor(section.key);
    const recommendation = recommendationFor(section.key);
    return `
      <div class="section-workspace">
        <aside class="section-workspace-nav">
          <div class="section-nav-head">
            <div><b>Índice</b><small>${active.filter((item) => item.status === "approved").length}/${active.filter((item) => item.required !== false).length} obligatorias aprobadas</small></div>
            ${(structureSections().some((item) => item.required === false && item.layout && item.layout.aiRecommendation))
              ? `<button class="home-link" type="button" data-arch-action="recommend-sections">${Object.keys(state.sectionRecommendations || {}).length ? "Actualizar IA" : "Recomendar con IA"}</button>`
              : ""}
          </div>
          ${sectionIndexMarkup()}
        </aside>
        <section class="section-workspace-editor">
          <div class="section-editor-head">
            <div>
              <span class="process-code">${escapeHtml(section.numbering || "")} · ${escapeHtml(section.type)}</span>
              <h2>${escapeHtml(section.numbering ? section.numbering + ". " + section.title : section.title)}</h2>
              <p>${section.contract && section.contract.purpose ? escapeHtml(section.contract.purpose) : "Redacta, revisa y aprueba esta sección antes de continuar."}</p>
            </div>
            <span class="status ${sectionStatusClass(section.status)}">${escapeHtml(sectionStatusLabel(section.status))}</span>
          </div>
          ${recommendation ? `<div class="notice-soft"><b>Recomendación de IA</b><span>${recommendation.include ? "Conviene incluir esta subsección." : "Puede omitirse en este caso."} ${escapeHtml(recommendation.reason || "")}</span></div>` : ""}
          ${readiness && readiness.bindingId ? `<div class="notice-${readiness.ready ? "soft" : "warn"}"><b>${readiness.ready ? "Datos listos" : "Datos por revisar"}</b><span>${escapeHtml((readiness.warnings || []).join(" · ") || "La sección puede consultar los datos mapeados.")}</span></div>` : ""}
          ${alertBlock(section)}
          <div class="section-editor-actions">
            ${state.instance.finalFrozenAt ? "" : `<button class="primary" type="button" data-arch-action="generate-section" data-key="${escapeHtml(section.key)}">Generar / regenerar con IA</button>`}
            <button class="ghost" type="button" data-arch-action="export-section" data-key="${escapeHtml(section.key)}">Borrador de esta sección</button>
            ${state.instance.finalFrozenAt || section.locked
              ? '<span class="status good">Aprobada</span>'
              : `<button class="secondary" type="button" data-arch-action="approve-section" data-key="${escapeHtml(section.key)}">Aprobar sección</button>`}
            <span class="section-save-state">Guardado automáticamente ✓</span>
          </div>
          ${sectionEditorMarkup(section)}
          ${traceMarkup(section)}
          <div class="section-step-footer">
            <button class="ghost" type="button" data-arch-action="previous-section" ${previous ? "" : "disabled"}>← Anterior</button>
            <span>Sección ${index + 1} de ${active.length}</span>
            <button class="primary" type="button" data-arch-action="next-section" ${next ? "" : "disabled"}>Siguiente →</button>
          </div>
        </section>
      </div>
    `;
  }

  function formationPreparationMarkup() {
    const selected = formationSelectedCareers();
    const selectedSet = new Set(selected);
    const standardSet = new Set(FORMATION_CAREER_OPTIONS);
    const custom = selected.filter((item) => !standardSet.has(item));
    const profile = formationProfile();
    const activeProviders = (state.providers || []).filter((item) => item.enabled).length;
    const rows = profile && Array.isArray(profile.careers) ? profile.careers : [];
    const summary = profile && profile.summary || {};

    return `<div class="instance-preparation formation-preparation">
      <div class="prep-grid">
        <div class="prep-card"><span>Período</span><b>${escapeHtml(state.dossier && state.dossier.periodLabel || "Sin período")}</b><small>Dato obligatorio ya definido por el expediente</small></div>
        <div class="prep-card"><span>Carreras</span><b>${selected.length}</b><small>${selected.length ? "Seleccionadas para este período" : "Selecciona al menos una carrera"}</small></div>
        <div class="prep-card"><span>Población estimada</span><b>${Number(summary.totalTeachers || 0)}</b><small>${profile ? "Generada y guardada de forma determinística" : "Se generará automáticamente"}</small></div>
        <div class="prep-card"><span>IA automática</span><b>${activeProviders}</b><small>Proveedor(es) habilitado(s)</small></div>
      </div>

      <section class="panel compact formation-setup-panel">
        <div class="panel-title">
          <div>
            <h3>Carreras que participan en el período</h3>
            <small>Para este documento solo necesitas definir el período y las carreras. La población y la distribución académica se generan automáticamente.</small>
          </div>
          <span class="status ${profile ? "good" : "warn"}">${profile ? "Datos generados" : "Pendiente"}</span>
        </div>
        <div class="formation-career-grid">
          ${FORMATION_CAREER_OPTIONS.map((career) => `
            <label class="formation-career-option">
              <input type="checkbox" data-formation-career value="${escapeHtml(career)}" ${selectedSet.has(career) ? "checked" : ""}>
              <span>${escapeHtml(career)}</span>
            </label>
          `).join("")}
        </div>
        <label class="app-dialog-field formation-custom-field">
          <span>Otras carreras <small>(opcional, una por línea)</small></span>
          <textarea id="formationCustomCareers" placeholder="Escribe únicamente las carreras que no aparecen arriba">${escapeHtml(custom.join("\n"))}</textarea>
        </label>
        <div class="notice-soft">
          <b>Reglas automáticas</b>
          <span>8–15 docentes por carrera · 60–70% con tercer nivel · 30–40% con cuarto nivel · preferentemente 1 doctorado en todo el instituto. Las cifras se conservan al volver a abrir el documento.</span>
        </div>
        <div class="button-row end">
          <button class="primary" type="button" data-arch-action="save-formation-setup">${profile ? "Actualizar carreras y recalcular" : "Guardar carreras y generar datos"}</button>
        </div>
      </section>

      ${rows.length ? `
        <section class="panel compact formation-profile-panel">
          <div class="panel-title">
            <div><h3>Población docente estimada</h3><small>La app mantiene la coherencia matemática; la IA solo interpreta y redacta.</small></div>
            <span class="status good">${Number(summary.totalTeachers || 0)} docentes</span>
          </div>
          <div class="formation-profile-table-wrap">
            <table class="formation-profile-table">
              <thead><tr><th>Carrera</th><th>Total</th><th>Tercer nivel</th><th>Maestría</th><th>Doctorado</th></tr></thead>
              <tbody>
                ${rows.map((row) => `<tr>
                  <td>${escapeHtml(row.career)}</td>
                  <td>${Number(row.totalTeachers || 0)}</td>
                  <td>${Number(row.thirdLevel || 0)} <small>(${Number(row.thirdLevelPercent || 0)}%)</small></td>
                  <td>${Number(row.masters || 0)}</td>
                  <td>${Number(row.doctorate || 0)}</td>
                </tr>`).join("")}
              </tbody>
              <tfoot><tr><th>Total</th><th>${Number(summary.totalTeachers || 0)}</th><th>${Number(summary.thirdLevel || 0)}</th><th>${Number(summary.masters || 0)}</th><th>${Number(summary.doctorate || 0)}</th></tr></tfoot>
            </table>
          </div>
          <div class="formation-generate-row">
            <div>
              <b>Diagnóstico listo para generar</b>
              <span>La IA recibirá las mismas cifras guardadas para todas las secciones y construirá el documento completo sin volver a inventar cantidades.</span>
            </div>
            <button class="primary" type="button" data-arch-action="generate-document" ${activeProviders ? "" : "disabled"}>Generar diagnóstico completo</button>
          </div>
          ${activeProviders ? "" : '<div class="notice-warn"><b>Falta una IA activa</b><span>Configura un proveedor de IA para redactar el documento. La población estimada ya quedó guardada.</span></div>'}
        </section>
      ` : '<div class="notice-warn"><b>Falta seleccionar carreras</b><span>El documento no requiere Excel ni una plantilla Word. Selecciona las carreras para crear automáticamente el diagnóstico base.</span></div>'}
    </div>`;
  }

  function preparationStageMarkup() {
    if (state.instance && state.instance.engineId === "form.deteccion") return formationPreparationMarkup();
    const readiness = state.dataReadiness && state.dataReadiness.sections || [];
    const requiredPending = readiness.filter((item) => item.requirement === "required" && !item.ready);
    const activeProviders = (state.providers || []).filter((item) => item.enabled).length;
    return `<div class="instance-preparation">
      <div class="prep-grid">
        <div class="prep-card"><span>Período</span><b>${escapeHtml(state.dossier && state.dossier.periodLabel || "Sin período")}</b><small>Expediente: ${escapeHtml(state.dossier && state.dossier.label || "")}</small></div>
        <div class="prep-card"><span>Excel / CSV</span><b>${(state.imports || []).length}</b><small>${requiredPending.length ? requiredPending.length + " requisito(s) de datos pendientes" : "Datos obligatorios listos o no requeridos"}</small></div>
        <div class="prep-card"><span>Fuentes institucionales</span><b>${(state.knowledgeSources || []).length}</b><small>Normativa, políticas y documentos citables</small></div>
        <div class="prep-card"><span>IA automática</span><b>${activeProviders}</b><small>Proveedor(es) habilitado(s)</small></div>
      </div>
      ${requiredPending.length ? `<div class="notice-warn"><b>Preparación incompleta</b><span>${escapeHtml(requiredPending.slice(0, 5).map((item) => item.title + ": " + (item.warnings || []).join(" ")).join(" · "))}</span></div>` : '<div class="notice-soft"><b>Preparación lista</b><span>Puedes trabajar sección por sección. Las fuentes y datos siguen disponibles en el expediente maestro.</span></div>'}
      <button class="secondary" type="button" data-arch-action="open-current-dossier">Gestionar datos, fuentes y mapeos</button>
    </div>`;
  }

  function reviewStageMarkup() {
    const sections = state.instance.sections || [];
    const required = sections.filter((item) => item.required !== false);
    const pendingApproval = required.filter((item) => item.status !== "approved");
    const reviewNeeded = sections.filter((item) => item.status === "needs_review" || item.status === "migration_pending");
    const citationIssues = state.citationValidation
      ? (state.citationValidation.missing || []).concat(state.citationValidation.incomplete || [])
      : [];
    const editorialErrors = state.editorialValidation && state.editorialValidation.errors || [];
    return `<div class="instance-review">
      <div class="review-summary-grid">
        <div><b>${sections.filter((item) => item.status === "approved").length}</b><span>Aprobadas</span></div>
        <div><b>${pendingApproval.length}</b><span>Obligatorias por aprobar</span></div>
        <div><b>${reviewNeeded.length}</b><span>Requieren revisión</span></div>
        <div><b>${citationIssues.length + editorialErrors.length}</b><span>Controles finales</span></div>
      </div>
      ${pendingApproval.length ? `<div class="notice-warn"><b>Aún no puede cerrarse la versión final</b><span>${escapeHtml(pendingApproval.slice(0, 8).map((item) => (item.numbering ? item.numbering + ". " : "") + item.title).join(" · "))}</span></div>` : '<div class="notice-soft"><b>Secciones obligatorias aprobadas</b><span>Revisa ahora citas, estructura y salida antes de congelar la versión final.</span></div>'}
      ${citationIssues.length ? `<div class="notice-warn"><b>Citas APA pendientes</b><span>${escapeHtml(citationIssues.slice(0, 6).join(", "))}</span></div>` : ""}
      ${editorialErrors.length ? `<div class="notice-warn"><b>Control editorial pendiente</b><span>${escapeHtml(editorialErrors.slice(0, 5).join(" · "))}</span></div>` : ""}
      <button class="primary" type="button" data-arch-action="instance-stage" data-stage="output">Ir a salida</button>
    </div>`;
  }

  function outputStageMarkup() {
    return `<div class="instance-output">
      <div class="output-choice">
        <div><h3>Borrador</h3><p>Puedes generar Word/PDF en cualquier momento. Incluye alertas de revisión cuando existan.</p></div>
        <button class="ghost" type="button" data-arch-action="export-draft">Generar borrador Word + PDF</button>
      </div>
      <div class="output-choice">
        <div><h3>Versión final</h3><p>Solo puede cerrarse cuando todas las secciones obligatorias estén aprobadas y los controles finales sean válidos. Las alertas quedan en la trazabilidad interna y no forman parte de la versión final visible.</p></div>
        ${state.instance.finalFrozenAt
          ? '<div class="button-row"><button class="secondary" type="button" data-arch-action="export-final">Exportar final Word + PDF</button><button class="ghost" type="button" data-arch-action="working-copy">Nueva versión de trabajo</button></div>'
          : '<button class="secondary" type="button" data-arch-action="freeze-final">Aprobar y congelar versión final</button>'}
      </div>
    </div>`;
  }

  function instanceStageMarkup() {
    if (state.instanceStage === "preparation") return preparationStageMarkup();
    if (state.instanceStage === "review") return reviewStageMarkup();
    if (state.instanceStage === "output") return outputStageMarkup();
    return documentStageMarkup();
  }

  async function renderInstance(instanceId) {
    state.currentView = "instance";
    await loadInstance(instanceId || state.instance && state.instance.id);
    if (isFormationProcess()) {
      await loadHome();
      state.processFamily = "formacion";
      state.processPeriodId = state.dossier.periodId;
    }
    setHeader(
      isFormationProcess() ? "Formación docente" : state.instance.label,
      isFormationProcess()
        ? `Procesos / Formación docente / ${state.dossier.periodLabel}`
        : `Procesos / ${state.dossier ? state.dossier.label : "Documento"}`,
      true
    );
    const alertSummary = state.instance.alertTrace && state.instance.alertTrace.summary || { total: 0 };
    const alerts = state.instance.finalFrozenAt ? 0 : Number(alertSummary.total || 0);
    const required = (state.instance.sections || []).filter((item) => item.required !== false);
    const approved = required.filter((item) => item.status === "approved").length;
    const steps = [
      ["preparation", "Preparación"],
      ["document", "Documento"],
      ["review", "Revisión"],
      ["output", "Salida"]
    ];
  
    view().innerHTML = `
      ${formationProcessWorkspaceMarkup()}
      ${state.generationRun && state.generationRun.status === "partial" ? `<div class="notice-warn"><b>Generación parcial</b><span>${escapeHtml(generationMessage(state.generationRun))}</span><button class="ghost small-inline" type="button" data-arch-action="resume-document">Reanudar pendientes</button></div>` : ""}
      ${state.instance.stale ? `<div class="notice-warn"><b>Datos actualizados</b><span>${escapeHtml(state.instance.staleReason)}. Revisa las secciones afectadas.</span></div>` : ""}
      <div class="arch-dossier-head compact-document-head">
        <div>
          <span class="process-code">${escapeHtml(state.instance.engineId)} · v${escapeHtml(state.instance.engineVersion)}</span>
          <h2>${escapeHtml(state.instance.label)}</h2>
          <p>${escapeHtml(state.dossier && state.dossier.periodLabel || "")} · ${approved}/${required.length} secciones obligatorias aprobadas${alerts ? " · " + alerts + " alerta(s)" : ""}</p>
        </div>
        <div class="button-row document-head-actions">
          <button class="ghost small-inline" type="button" data-arch-action="export-draft">Descargar borrador</button>
          <span class="status ${state.instance.status === "final" ? "good" : ""}">${state.instance.status === "final" ? "Final congelada" : "Borrador"}</span>
        </div>
      </div>
      <div class="instance-stage-tabs">
        ${steps.map(([id, label], index) => `<button type="button" data-arch-action="instance-stage" data-stage="${id}" class="${state.instanceStage === id ? "active" : ""}"><span>${index + 1}</span>${label}</button>`).join("")}
      </div>
      ${instanceStageMarkup()}
    `;
  
    if (!Object.keys(state.sectionRecommendations || {}).length) {
      window.setTimeout(() => ensureSectionRecommendations(false), 50);
    }
  }

  async function refreshCurrent() {
    if (state.instance) return renderInstance(state.instance.id);
    if (state.dossier) return renderDossier(state.dossier.id);
    return renderHome();
  }

  const PERIOD_MONTHS = Object.freeze([
    { value: "1", label: "Enero", short: "ENE" },
    { value: "2", label: "Febrero", short: "FEB" },
    { value: "3", label: "Marzo", short: "MAR" },
    { value: "4", label: "Abril", short: "ABR" },
    { value: "5", label: "Mayo", short: "MAY" },
    { value: "6", label: "Junio", short: "JUN" },
    { value: "7", label: "Julio", short: "JUL" },
    { value: "8", label: "Agosto", short: "AGO" },
    { value: "9", label: "Septiembre", short: "SEP" },
    { value: "10", label: "Octubre", short: "OCT" },
    { value: "11", label: "Noviembre", short: "NOV" },
    { value: "12", label: "Diciembre", short: "DIC" }
  ]);

  function periodParts(values) {
    const startMonth = Number(values && values.startMonth);
    const startYear = Number(values && values.startYear);
    const endMonth = Number(values && values.endMonth);
    const endYear = Number(values && values.endYear);
    const startIndex = startYear * 12 + startMonth;
    const endIndex = endYear * 12 + endMonth;
    if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12 ||
        !Number.isInteger(endMonth) || endMonth < 1 || endMonth > 12 ||
        !Number.isInteger(startYear) || startYear < 2000 || startYear > 2100 ||
        !Number.isInteger(endYear) || endYear < 2000 || endYear > 2100) {
      return { error: "Selecciona meses y años válidos." };
    }
    if (endIndex < startIndex) return { error: "El período final no puede ser anterior al período inicial." };

    const start = PERIOD_MONTHS[startMonth - 1];
    const end = PERIOD_MONTHS[endMonth - 1];
    const sameYear = startYear === endYear;
    const code = sameYear
      ? `${start.short}-${end.short}-${startYear}`
      : `${start.short}-${startYear}-${end.short}-${endYear}`;
    const label = `${start.label} ${startYear} – ${end.label} ${endYear}`;
    const startDate = `${startYear}-${String(startMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(endYear, endMonth, 0).getDate();
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { startMonth, startYear, endMonth, endYear, code, label, startDate, endDate };
  }

  async function newPeriod(options) {
    const config = options || {};
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const monthOptions = PERIOD_MONTHS.map((item) => ({ value: item.value, label: item.label }));
    const values = await appDialog({
      title: "Crear período",
      message: "El período se aplica al proceso completo y será heredado por todos sus documentos.",
      fields: [
        {
          name: "startMonth",
          label: "Mes de inicio",
          type: "select",
          options: monthOptions,
          value: String(currentMonth),
          required: true
        },
        {
          name: "startYear",
          label: "Año de inicio",
          type: "number",
          value: String(currentYear),
          min: 2000,
          max: 2100,
          step: 1,
          required: true
        },
        {
          name: "endMonth",
          label: "Mes de finalización",
          type: "select",
          options: monthOptions,
          value: String(currentMonth),
          required: true
        },
        {
          name: "endYear",
          label: "Año de finalización",
          type: "number",
          value: String(currentYear),
          min: 2000,
          max: 2100,
          step: 1,
          required: true
        }
      ],
      confirmText: "Crear período"
    });
    if (!values) return;

    const period = periodParts(values);
    if (period.error) return toast(period.error);

    setBusy(true);
    const response = await api.createPeriod({
      startMonth: period.startMonth,
      startYear: period.startYear,
      endMonth: period.endMonth,
      endYear: period.endYear,
      code: period.code,
      label: period.label,
      startDate: period.startDate,
      endDate: period.endDate,
      metadata: {
        startMonth: period.startMonth,
        startYear: period.startYear,
        endMonth: period.endMonth,
        endYear: period.endYear,
        periodScope: "process"
      }
    });
    setBusy(false);
    if (!response || !response.ok) return toast(response && response.error || "No se pudo crear el período.");
    toast("Período creado. Se reutilizará en todo el proceso.");
    if (config.renderHome !== false) await renderHome();
    return response.period || null;
  }

  async function createDossier(button) {
    const select = document.getElementById(`arch-process-${button.dataset.periodId}`);
    if (!select) return;
    const [processKey, population] = String(select.value || "").split("|");
    const label = await appPrompt("Nombre del expediente:", `${select.options[select.selectedIndex].text} · ${button.dataset.periodId}`, { required: true });
    if (!label) return;
    const response = await api.createDossier({ periodId: button.dataset.periodId, processKey, population, label });
    if (!response || !response.ok) return toast(response && response.error || "No se pudo crear el expediente.");
    toast("Expediente creado.");
    await renderDossier(response.dossier.id);
  }

  async function saveFormationSetup() {
    if (!state.dossier || !state.instance || state.instance.engineId !== "form.deteccion") return;
    const checked = Array.from(document.querySelectorAll("[data-formation-career]:checked"))
      .map((input) => String(input.value || "").trim())
      .filter(Boolean);
    const customInput = document.getElementById("formationCustomCareers");
    const custom = String(customInput && customInput.value || "")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    const careers = Array.from(new Set(checked.concat(custom)));
    if (!careers.length) return toast("Selecciona al menos una carrera.");

    const profile = buildFormationSyntheticProfile(careers);
    setBusy(true);
    const careersResponse = await api.setMasterData(state.dossier.id, {
      key: "FORMACION_CARRERAS",
      value: careers,
      provenance: {
        source: "manual",
        verified: true,
        purpose: "scope_formacion_docente"
      },
      reason: "Actualización de carreras participantes del período"
    });
    if (!careersResponse || !careersResponse.ok) {
      setBusy(false);
      return toast(careersResponse && careersResponse.error || "No se pudieron guardar las carreras.");
    }
    const profileResponse = await api.setMasterData(state.dossier.id, {
      key: "FORMACION_DOCENTE_SINTETICA",
      value: profile,
      provenance: {
        source: "synthetic_rule_engine",
        verified: false,
        synthetic: true,
        deterministic: true,
        rules: profile.rules
      },
      reason: "Regeneración del escenario estimado de formación docente"
    });
    setBusy(false);
    if (!profileResponse || !profileResponse.ok) return toast(profileResponse && profileResponse.error || "No se pudo generar el perfil docente.");
    await loadDossier(state.dossier.id);
    toast("Carreras guardadas y diagnóstico base generado.");
    await renderInstance(state.instance.id);
  }

  async function addMaster() {
    const key = await appPrompt("Clave del dato compartido (ej. CARRERAS, CRONOGRAMA, RESPONSABLES):", "", { required: true });
    if (!key) return;
    const value = await appPrompt("Valor. Puedes pegar texto o JSON:", "", { multiline: true });
    if (value == null) return;
    const response = await api.setMasterData(state.dossier.id, {
      key: key.trim().toUpperCase().replace(/\s+/g, "_"),
      value: parseMaybeJson(value),
      provenance: { source: "manual", verified: true }
    });
    if (!response || !response.ok) return toast(response && response.error || "No se pudo guardar.");
    toast("Dato maestro guardado. Los documentos relacionados quedaron marcados para revisión.");
    await renderDossier(state.dossier.id);
  }

  async function addDataImport() {
    const response = await api.addDataImport(state.dossier.id, { type: "dossier", key: "" });
    if (!response || response.canceled) return;
    if (!response.ok) return toast(response.error || "No se pudo importar.");
    toast("Archivo importado y perfilado.");
    await renderDossier(state.dossier.id);
  }

  async function suggestMapping(importId) {
    const response = await api.suggestDataMapping(importId);
    if (!response || !response.ok) return toast(response && response.error || "No se pudo analizar el mapeo.");
    const suggestion = response.suggestion || {};
    const lines = [];
    (suggestion.sheets || []).forEach((sheet) => {
      lines.push(`[${sheet.sheet}]`);
      const entries = Object.entries(sheet.suggestions || {});
      if (!entries.length) lines.push("  Sin sugerencias seguras.");
      entries.forEach(([canonical, item]) => {
        lines.push(`  ${canonical} ← ${item.source} (${Math.round(Number(item.confidence || 0) * 100)}%)`);
      });
    });
    await appAlert(`Sugerencias de mapeo para ${suggestion.sourceName || "archivo"}\n\n${lines.join("\n")}\n\nEstas sugerencias no se aplican automáticamente.`, { title: "Sugerencias de mapeo" });
  }

  async function editMapping(importId) {
    const item = (state.imports || []).find((entry) => entry.id === importId);
    if (!item) return;
    const example = {
      fields: {
        student_id: "Cédula",
        student_name: "Estudiante",
        career: "Carrera",
        campus: "Sede",
        core: "Núcleo",
        component: "Componente",
        grade: "Nota"
      }
    };
    const initial = Object.keys(item.mapping || {}).length
      ? JSON.stringify(item.mapping, null, 2)
      : JSON.stringify(example, null, 2);
    const raw = await appPrompt("Mapeo canónico JSON. Cambia únicamente las columnas que existan en tu Excel:", initial, { multiline: true, title: "Editar mapeo" });
    if (raw == null) return;
    let mapping;
    try {
      mapping = JSON.parse(raw);
    } catch (_error) {
      return toast("El mapeo debe ser JSON válido.");
    }
    const response = await api.saveDataMapping(importId, mapping);
    if (!response || !response.ok) return toast(response && response.error || "No se pudo guardar el mapeo.");
    const warnings = response.dataImport && response.dataImport.mappingValidation && response.dataImport.mappingValidation.warnings || [];
    toast(warnings.length ? `Mapeo guardado con ${warnings.length} advertencia(s).` : "Mapeo guardado y listo para consultas.");
    await renderDossier(state.dossier.id);
  }

  async function addKnowledge() {
    const response = await api.addKnowledgeSource(state.dossier.id, {
      sourceType: "institutional",
      purpose: "base_legal_alignment",
      tags: ["base legal", "alineación institucional"]
    });
    if (!response || response.canceled) return;
    if (!response.ok) return toast(response.error || "No se pudo agregar la fuente.");
    toast("Fuente institucional agregada y versionada.");
    await renderDossier(state.dossier.id);
  }

  function citationMetadataTemplate(type, current) {
    const meta = Object.assign({}, current && current.metadata || {});
    const pick = (keys) => Object.fromEntries(keys.map((key) => [key, meta[key] || ""]));
    if (type === "journal_article") return pick(["journalTitle", "volume", "issue", "pages", "date"]);
    if (type === "book") return pick(["edition", "date"]);
    if (type === "book_chapter") return pick(["bookTitle", "editors", "pages", "date"]);
    if (type === "thesis") return pick(["thesisType", "institution", "repository", "date"]);
    if (type === "webpage") return pick(["siteName", "date"]);
    if (type === "report") return pick(["reportNumber", "date"]);
    if (type === "law") return pick(["legalNumber", "officialPublication", "jurisdiction", "date", "shortTitle"]);
    if (type === "regulation") return pick(["issuingBody", "regulationNumber", "officialPublication", "date", "shortTitle"]);
    if (type === "resolution") return pick(["issuingBody", "resolutionNumber", "identifier", "officialPublication", "date", "shortTitle"]);
    if (type === "standard") return pick(["standardNumber", "identifier", "date"]);
    if (type === "conference_paper") return pick(["conferenceName", "location", "date"]);
    if (type === "dataset") return pick(["repository", "date"]);
    return pick(["documentCode", "version", "date", "shortTitle"]);
  }

  async function editCitation(sourceId) {
    const source = (state.knowledgeSources || []).find((item) => item.id === sourceId);
    if (!source) return;
    const current = citationForSource(sourceId) || {};
    const types = state.capabilities && state.capabilities.citationTypes || [];
    const fallbackTypes = [
      { id: "institutional", label: "Documento institucional" },
      { id: "journal_article", label: "Artículo científico" },
      { id: "book", label: "Libro" },
      { id: "thesis", label: "Tesis" },
      { id: "webpage", label: "Página web" },
      { id: "report", label: "Informe" },
      { id: "law", label: "Ley" },
      { id: "regulation", label: "Reglamento" },
      { id: "resolution", label: "Resolución" }
    ];
    const available = types.length ? types : fallbackTypes;
    const currentIndex = Math.max(0, available.findIndex((item) => item.id === current.sourceType));
    const menu = available.map((item, index) => (index + 1) + ". " + item.label + " [" + item.id + "]").join("\n");
    const selected = await appPrompt("Tipo de fuente APA 7:\n\n" + menu + "\n\nEscribe el número:", String(currentIndex + 1), { title: "Referencia APA 7" });
    if (selected == null) return;
    const typeIndex = Number(selected) - 1;
    if (!Number.isInteger(typeIndex) || typeIndex < 0 || typeIndex >= available.length) return toast("Tipo de fuente no válido.");
    const sourceType = available[typeIndex].id;

    const corporateAuthor = await appPrompt("Autor institucional/corporativo (vacío si son autores personales):", current.corporateAuthor || "", { title: "Referencia APA 7" });
    if (corporateAuthor == null) return;
    const author = await appPrompt("Autor(es) personales. Usa “Apellido, Iniciales; Apellido, Iniciales” para varios:", current.author || "", { title: "Referencia APA 7" });
    if (author == null) return;
    const year = await appPrompt("Año (ej. 2026). Si hay fecha completa, puedes dejarlo vacío y ponerla en metadatos:", current.year || "", { title: "Referencia APA 7" });
    if (year == null) return;
    const titleValue = await appPrompt("Título de la fuente:", current.title || source.name || "", { title: "Referencia APA 7" });
    if (titleValue == null) return;
    const publisher = await appPrompt("Editorial / institución publicadora (cuando corresponda):", current.publisher || "", { title: "Referencia APA 7" });
    if (publisher == null) return;
    const url = await appPrompt("URL (cuando corresponda):", current.url || "", { title: "Referencia APA 7" });
    if (url == null) return;
    const doi = await appPrompt("DOI (cuando corresponda):", current.doi || "", { title: "Referencia APA 7" });
    if (doi == null) return;

    const template = citationMetadataTemplate(sourceType, current);
    const metadataRaw = await appPrompt(
      "Metadatos específicos en JSON. Completa los campos que correspondan al tipo seleccionado:",
      JSON.stringify(template, null, 2),
      { multiline: true, title: "Metadatos APA 7" }
    );
    if (metadataRaw == null) return;
    let metadata;
    try {
      metadata = Object.assign({}, current.metadata || {}, JSON.parse(metadataRaw), {
        reviewedByHuman: true,
        provisional: false
      });
    } catch (_error) {
      return toast("Los metadatos APA deben ser JSON válido.");
    }

    const response = await api.saveCitation(state.dossier.id, {
      citationKey: current.citationKey || "SRC:" + sourceId,
      sourceId,
      sourceType,
      corporateAuthor,
      author,
      year,
      title: titleValue,
      publisher,
      url,
      doi,
      metadata
    });
    if (!response || !response.ok) return toast(response && response.error || "No se pudo guardar la referencia APA.");
    const saved = response.citation;
    if (saved && !saved.complete) {
      const errors = saved.validation && saved.validation.errors || [];
      toast("Referencia guardada, pero todavía está incompleta: " + errors.slice(0, 2).join(" · "));
    } else {
      toast("Referencia APA 7 completa y guardada.");
    }
    await renderDossier(state.dossier.id);
  }

  async function cloneDossier() {
    const periodsResponse = await api.listPeriods();
    const periods = periodsResponse && periodsResponse.ok ? periodsResponse.periods || [] : [];
    const choices = periods.filter((item) => item.id !== state.dossier.periodId);
    if (!choices.length) return toast("Crea primero otro período.");
    const menu = choices.map((item, index) => `${index + 1}. ${item.label} [${item.code}]`).join("\n");
    const selected = await appPrompt(`¿A qué período copiar la base?\n${menu}\n\nEscribe el número:`, "1", { title: "Copiar expediente" });
    const index = Number(selected) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= choices.length) return;
    const target = choices[index];
    const label = await appPrompt("Nombre del nuevo expediente:", `${state.dossier.processKey} · ${target.label}`, { required: true, title: "Copiar expediente" });
    if (!label) return;
    const response = await api.cloneDossier(state.dossier.id, target.id, label);
    if (!response || !response.ok) return toast(response && response.error || "No se pudo copiar el expediente.");
    toast("Expediente copiado. Los datos heredados quedan pendientes de verificación para el nuevo período.");
    await renderDossier(response.dossier.id);
  }

  async function createInstance(button) {
    const engine = state.engines.find((item) => item.engineId === button.dataset.engineId);
    if (!engine) return;
    let scopeKey = "";
    const cardinality = button.dataset.cardinality || engine.cardinality;
    if (!["period"].includes(cardinality)) {
      scopeKey = await appPrompt(`Identificador para ${cardinality} (ej. estudiante, carrera, actividad o segmento):`, "", { required: true }) || "";
      if (!scopeKey && cardinality !== "period_population") return;
    }
    if (cardinality === "period_population" && !scopeKey) scopeKey = state.dossier.population || engine.population || "all";
    const response = await api.ensureDocumentInstance(state.dossier.id, engine.engineId, { type: cardinality, key: scopeKey });
    if (!response || !response.ok) return toast(response && response.error || "No se pudo crear el documento.");
    await renderInstance(response.instance.id);
  }

  async function saveSection(key, patch) {
    const response = await api.updateDocumentSection(state.instance.id, key, patch);
    if (!response || !response.ok) return toast(response && response.error || "No se pudo guardar la sección.");
    state.instance = response.instance;
    await renderInstance(state.instance.id);
  }

  async function saveBlocks(key) {
    const section = state.instance.sections.find((item) => item.key === key);
    if (!section) return;
    const blocks = (section.blocks || []).map((block) => {
      const next = Object.assign({}, block, { data: Object.assign({}, block.data || {}) });
      const textArea = document.querySelector(`[data-arch-block-text][data-section-key="${CSS.escape(key)}"][data-block-key="${CSS.escape(block.key)}"]`);
      if (textArea) next.text = textArea.value;
      const listArea = document.querySelector(`[data-arch-block-list][data-section-key="${CSS.escape(key)}"][data-block-key="${CSS.escape(block.key)}"]`);
      if (listArea) next.data.items = listArea.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
      return next;
    });
    const response = await api.setDocumentSectionBlocks(state.instance.id, key, blocks);
    if (!response || !response.ok) return toast(response && response.error || "No se pudieron guardar los bloques.");
    toast("Bloques actualizados sin perder tablas ni figuras.");
    await renderInstance(state.instance.id);
  }

  function recommendationCacheKey() {
    return state.instance ? `documentos-section-recommendations-${state.instance.id}-${state.instance.engineVersion}` : "";
  }

  function loadCachedRecommendations() {
    const key = recommendationCacheKey();
    if (!key) return {};
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function saveCachedRecommendations(items) {
    const key = recommendationCacheKey();
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(items || {})); } catch (_error) { /* opcional */ }
  }

  async function ensureSectionRecommendations(force) {
    if (!state.instance || recommendingSections) return;
    const candidates = structureSections().filter((item) => item.required === false && item.layout && item.layout.aiRecommendation);
    if (!candidates.length) return;
    if (!force) {
      const cached = loadCachedRecommendations();
      if (Object.keys(cached).length) {
        state.sectionRecommendations = cached;
        if (state.currentView === "instance" && state.instanceStage === "document") view().innerHTML = instanceStageMarkup();
        return;
      }
    }
    recommendingSections = true;
    try {
      const response = await api.recommendEngineSections(state.instance.id, {});
      if (!response || !response.ok || !response.result) return;
      const mapped = {};
      (response.result.recommendations || []).forEach((item) => {
        if (item && item.key) mapped[item.key] = item;
      });
      state.sectionRecommendations = mapped;
      saveCachedRecommendations(mapped);
      if (state.currentView === "instance" && state.instanceStage === "document") {
        view().innerHTML = instanceStageMarkup();
      }
    } finally {
      recommendingSections = false;
    }
  }

  function sectionSaveLabel(textValue) {
    const element = document.querySelector(".section-save-state");
    if (element) element.textContent = textValue;
  }

  async function persistCurrentEditor() {
    if (!state.instance || state.instance.finalFrozenAt) return true;
    const section = activeCurrentSection();
    if (!section || section.locked) return true;
    const blocks = section.blocks || [];
    sectionSaveLabel("Guardando...");

    if (!blocks.length) {
      const editor = document.querySelector('[data-arch-editor="content"]');
      if (!editor) return true;
      const value = editor.value;
      if (String(value) === String(section.content || "")) {
        sectionSaveLabel("Guardado automáticamente ✓");
        return true;
      }
      const response = await api.updateDocumentSection(state.instance.id, section.key, {
        content: value,
        status: "edited",
        provenance: Object.assign({}, section.provenance || {}, {
          source: "human",
          editedAt: new Date().toISOString()
        })
      });
      if (!response || !response.ok) {
        sectionSaveLabel("Error al guardar");
        toast(response && response.error || "No se pudo guardar la sección.");
        return false;
      }
      state.instance = response.instance;
      sectionSaveLabel("Guardado automáticamente ✓");
      return true;
    }

    const nextBlocks = blocks.map((block) => {
      const next = Object.assign({}, block, { data: Object.assign({}, block.data || {}) });
      const textArea = document.querySelector(`[data-arch-editor="block-text"][data-section-key="${CSS.escape(section.key)}"][data-block-key="${CSS.escape(block.key)}"]`);
      if (textArea) next.text = textArea.value;
      const listArea = document.querySelector(`[data-arch-editor="block-list"][data-section-key="${CSS.escape(section.key)}"][data-block-key="${CSS.escape(block.key)}"]`);
      if (listArea) next.data.items = listArea.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
      return next;
    });
    const currentSignature = JSON.stringify(blocks.map((item) => ({ key: item.key, text: item.text, data: item.data })));
    const nextSignature = JSON.stringify(nextBlocks.map((item) => ({ key: item.key, text: item.text, data: item.data })));
    if (currentSignature === nextSignature) {
      sectionSaveLabel("Guardado automáticamente ✓");
      return true;
    }
    const response = await api.setDocumentSectionBlocks(state.instance.id, section.key, nextBlocks);
    if (!response || !response.ok) {
      sectionSaveLabel("Error al guardar");
      toast(response && response.error || "No se pudieron guardar los cambios.");
      return false;
    }
    if (response.result && response.result.instance) state.instance = response.result.instance;
    sectionSaveLabel("Guardado automáticamente ✓");
    return true;
  }

  function scheduleSectionSave() {
    clearTimeout(sectionSaveTimer);
    sectionSaveLabel("Cambios pendientes...");
    sectionSaveTimer = setTimeout(() => {
      persistCurrentEditor().catch((error) => toast(error.message || String(error)));
    }, 700);
  }

  async function moveSection(delta) {
    clearTimeout(sectionSaveTimer);
    const saved = await persistCurrentEditor();
    if (!saved) return;
    const active = state.instance.sections || [];
    const index = active.findIndex((item) => item.key === state.currentSectionKey);
    const next = active[index + Number(delta || 0)];
    if (!next) return;
    state.currentSectionKey = next.key;
    await renderInstance(state.instance.id);
  }

  async function toggleSectionIncluded(sectionKey) {
    clearTimeout(sectionSaveTimer);
    const all = structureSections();
    const section = all.find((item) => item.key === sectionKey);
    if (!section) return;
    if (state.currentSectionKey === sectionKey && section.included !== false) {
      const saved = await persistCurrentEditor();
      if (!saved) return;
    }
    const response = await api.setDocumentSectionIncluded(state.instance.id, sectionKey, section.included === false);
    if (!response || !response.ok) return toast(response && response.error || "No se pudo actualizar la subsección.");
    state.instance = response.instance;
    if (!(state.instance.sections || []).some((item) => item.key === state.currentSectionKey)) {
      state.currentSectionKey = state.instance.sections && state.instance.sections.length ? state.instance.sections[0].key : "";
    }
    await renderInstance(state.instance.id);
  }

  async function approveCurrentSection(key) {
    clearTimeout(sectionSaveTimer);
    const saved = await persistCurrentEditor();
    if (!saved) return;
    const current = (state.instance.sections || []).find((item) => item.key === key);
    if (!current) return;
    const response = await api.updateDocumentSection(state.instance.id, key, {
      status: "approved",
      locked: true,
      content: current.content || "",
      provenance: Object.assign({}, current.provenance || {}, {
        approvedBy: "human",
        approvedAt: new Date().toISOString()
      })
    });
    if (!response || !response.ok) return toast(response && response.error || "No se pudo aprobar la sección.");
    state.instance = response.instance;
    toast("Sección aprobada.");
    await renderInstance(state.instance.id);
  }

  async function generateSection(key) {
    const current = state.instance.sections.find((item) => item.key === key);
    const provenance = current && current.provenance || {};
    const hasHumanEdits = Boolean(
      current &&
      (
        provenance.source === "human" ||
        provenance.blockEditedBy === "human" ||
        provenance.approvedBy === "human"
      )
    );

    if (current && (current.locked || current.status === "approved")) {
      return toast("La sección está aprobada y bloqueada. Crea una nueva versión de trabajo para modificarla.");
    }

    let overrideHuman = false;
    if (hasHumanEdits) {
      if (!await appConfirm("Esta sección tiene cambios manuales. ¿Deseas reemplazarlos con una nueva generación de IA?", { title: "Reemplazar cambios manuales", confirmText: "Reemplazar" })) return;
      overrideHuman = true;
    }

    setBusy(true);
    const response = await api.generateEngineSection(state.instance.id, key, {
      reviewers: 2,
      overrideHuman
    });
    setBusy(false);
    if (!response || !response.ok) return toast(response && response.error || "No se pudo generar la sección.");
    state.instance = response.instance;
    const updated = state.instance.sections.find((item) => item.key === key);
    toast(updated && updated.status === "needs_review"
      ? "Sección generada, pero requiere revisión humana."
      : "Sección generada y revisada.");
    await renderInstance(state.instance.id);
  }

  function generationMessage(run) {
    if (!run) return "Documento generado y revisado por bloques.";
    const result = run.result || {};
    const completed = Array.isArray(result.completed) ? result.completed.length : 0;
    const preserved = Array.isArray(result.preserved) ? result.preserved.length : 0;
    const failed = Array.isArray(result.failed) ? result.failed.length : 0;
    const blocked = Array.isArray(result.blocked) ? result.blocked.length : 0;
    if (run.status === "partial" || failed || blocked) {
      return `Generación parcial: ${completed} completada(s), ${preserved} preservada(s), ${failed} fallida(s), ${blocked} bloqueada(s). Puedes reanudar pendientes.`;
    }
    return `Generación completa: ${completed} sección(es) generada(s) y ${preserved} preservada(s).`;
  }

  async function generateDocument() {
    setBusy(true);
    const response = state.instance.stale
      ? await api.regenerateStaleDocument(state.instance.id, { reviewers: 2, continueOnError: true })
      : await api.generateEngineDocument(state.instance.id, { reviewers: 2, continueOnError: true });
    setBusy(false);
    if (!response || !response.ok) return toast(response && response.error || "No se pudo generar el documento.");
    state.instance = response.instance;
    state.generationRun = response.generationRun || state.instance.generationRun || null;
    toast(generationMessage(state.generationRun));
    await renderInstance(state.instance.id);
  }

  async function resumeDocument() {
    setBusy(true);
    const response = await api.resumeEngineDocument(state.instance.id, {
      reviewers: 2,
      continueOnError: true
    });
    setBusy(false);
    if (!response || !response.ok) return toast(response && response.error || "No se pudo reanudar la generación.");
    state.instance = response.instance;
    state.generationRun = response.generationRun || state.instance.generationRun || null;
    toast(generationMessage(state.generationRun));
    await renderInstance(state.instance.id);
  }

  function selectedSections() {
    return Array.from(document.querySelectorAll("[data-arch-section-select]:checked")).map((item) => item.value);
  }

  async function exportDocument(options) {
    setBusy(true);
    const response = await api.exportEngineDocument(state.instance.id, options || {});
    setBusy(false);
    if (!response) return toast("No se pudo exportar.");
    if (!response.ok) {
      const result = response.result || {};
      if (response.error) return toast(response.error);
      const missing = Array.isArray(result.missingFormats) && result.missingFormats.length
        ? ` Falta: ${result.missingFormats.map((item) => String(item).toUpperCase()).join(", ")}.`
        : "";
      const assets = Array.isArray(result.missingAssets) && result.missingAssets.length
        ? ` Recursos visuales pendientes: ${result.missingAssets.length}.`
        : "";
      return toast("Exportación incompleta." + missing + assets);
    }
    const generated = response.result && Array.isArray(response.result.generatedFormats)
      ? response.result.generatedFormats.map((item) => String(item).toUpperCase()).join(" + ")
      : "";
    toast(generated ? `Exportación creada: ${generated}.` : "Exportación creada.");
  }

  async function freezeFinal() {
    const response = await api.freezeDocumentInstance(state.instance.id);
    if (!response || !response.ok) return toast(response && response.error || "No se pudo aprobar la versión final.");
    state.instance = response.instance;
    const traceTotal = Number(state.instance.alertTrace && state.instance.alertTrace.summary && state.instance.alertTrace.summary.total || 0);
    toast(traceTotal
      ? `Versión final congelada. ${traceTotal} alerta(s) quedaron solo en trazabilidad interna.`
      : "Versión final congelada. Los cambios futuros no la modificarán.");
    await renderInstance(state.instance.id);
  }

  async function saveProvider() {
    const input = {
      name: document.getElementById("archProviderName").value,
      kind: document.getElementById("archProviderKind").value,
      baseUrl: document.getElementById("archProviderUrl").value,
      model: document.getElementById("archProviderModel").value,
      role: document.getElementById("archProviderRole").value,
      apiKey: document.getElementById("archProviderKey").value,
      apiKeyEnv: document.getElementById("archProviderEnv").value,
      enabled: true
    };
    const response = await api.saveAiProvider(input);
    if (!response || !response.ok) return toast(response && response.error || "No se pudo guardar la IA.");
    toast("IA guardada localmente.");
    await renderHome();
  }

  document.addEventListener("input", (event) => {
    if (!event.target.closest('[data-arch-editor]')) return;
    if (!state.instance || state.currentView !== "instance" || state.instanceStage !== "document") return;
    scheduleSectionSave();
  });

  document.addEventListener("change", (event) => {
    const select = event.target.closest("[data-formation-period-select]");
    if (!select) return;
    switchFormationPeriod(select.value).catch((error) => {
      setBusy(false);
      toast(error.message || String(error));
    });
  });

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-arch-action]");
    if (!button || state.busy) return;
    const action = button.dataset.archAction;
    try {
      if (action === "instance-stage") {
        clearTimeout(sectionSaveTimer);
        if (state.instanceStage === "document") await persistCurrentEditor();
        state.instanceStage = button.dataset.stage || "document";
        return renderInstance(state.instance.id);
      }
      if (action === "select-section") {
        clearTimeout(sectionSaveTimer);
        const saved = await persistCurrentEditor();
        if (!saved) return;
        state.currentSectionKey = button.dataset.key;
        return renderInstance(state.instance.id);
      }
      if (action === "previous-section") return moveSection(-1);
      if (action === "next-section") return moveSection(1);
      if (action === "toggle-section-included" || action === "include-section") return toggleSectionIncluded(button.dataset.key);
      if (action === "recommend-sections") {
        await ensureSectionRecommendations(true);
        return toast("Recomendación de subsecciones actualizada.");
      }
      if (action === "save-formation-setup") return saveFormationSetup();
      if (action === "open-current-dossier") return renderDossier(state.dossier.id);
      if (action === "launch-existing") {
        const engine = (state.engines || []).find((item) => item.engineId === button.dataset.engineId);
        if (!engine) return;
        return ensureEngineInDossier(engine, button.dataset.dossierId);
      }
      if (action === "process-document") {
        const engine = formationProcessEngines().find((item) => item.engineId === button.dataset.engineId);
        if (!engine || !state.dossier) return;
        clearTimeout(sectionSaveTimer);
        if (state.instance && state.instanceStage === "document") {
          const saved = await persistCurrentEditor();
          if (!saved) return;
        }
        state.instanceStage = "document";
        return ensureEngineInDossier(engine, state.dossier.id);
      }
      if (action === "new-formation-period") {
        const created = await newPeriod({ renderHome: false });
        if (!created) return;
        await loadHome();
        return switchFormationPeriod(created.id);
      }
      if (action === "launch-period") return launchPeriod(button.dataset.engineId, button.dataset.periodId);
      if (action === "new-period") return newPeriod();
      if (action === "create-dossier") return createDossier(button);
      if (action === "open-dossier") { state.instance = null; return renderDossier(button.dataset.id); }
      if (action === "add-master") return addMaster();
      if (action === "add-data-import") return addDataImport();
      if (action === "suggest-mapping") return suggestMapping(button.dataset.id);
      if (action === "edit-mapping") return editMapping(button.dataset.id);
      if (action === "add-knowledge") return addKnowledge();
      if (action === "clone-dossier") return cloneDossier();
      if (action === "edit-citation") return editCitation(button.dataset.sourceId);
      if (action === "remove-knowledge") {
        const response = await api.removeKnowledgeSource(button.dataset.id);
        if (!response || !response.ok) return toast(response && response.error || "No se pudo quitar la fuente.");
        return renderDossier(state.dossier.id);
      }
      if (action === "create-instance") return createInstance(button);
      if (action === "open-instance") return renderInstance(button.dataset.id);
      if (action === "save-section") {
        const input = document.getElementById(`arch-section-${button.dataset.key}`);
        return saveSection(button.dataset.key, { content: input ? input.value : "", status: "edited", provenance: { source: "human", editedAt: new Date().toISOString() } });
      }
      if (action === "save-blocks") return saveBlocks(button.dataset.key);
      if (action === "approve-section") return approveCurrentSection(button.dataset.key);
      if (action === "generate-section") return generateSection(button.dataset.key);
      if (action === "generate-document") return generateDocument();
      if (action === "resume-document") return resumeDocument();
      if (action === "export-section") return exportDocument({ sectionKeys: [button.dataset.key], includeAlerts: true, final: false, formats: ["docx", "pdf"] });
      if (action === "export-selected") {
        const keys = selectedSections();
        if (!keys.length) return toast("Selecciona al menos una sección.");
        return exportDocument({ sectionKeys: keys, includeAlerts: true, final: false, formats: ["docx", "pdf"] });
      }
      if (action === "export-draft") return exportDocument({ includeAlerts: true, final: false, formats: ["docx", "pdf"] });
      if (action === "freeze-final") return freezeFinal();
      if (action === "export-final") return exportDocument({ includeAlerts: false, final: true, formats: ["docx", "pdf"] });
      if (action === "working-copy") {
        const response = await api.createWorkingCopy(state.instance.id);
        if (!response || !response.ok) return toast(response && response.error || "No se pudo crear la nueva versión.");
        return renderInstance(response.instance.id);
      }
      if (action === "save-provider") return saveProvider();
      if (action === "test-provider") {
        setBusy(true);
        const response = await api.testAiProvider(button.dataset.id);
        setBusy(false);
        return toast(response && response.ok ? "Conexión de IA correcta." : response && response.error || "Falló la prueba.");
      }
      if (action === "delete-provider") {
        if (!await appConfirm("¿Quitar esta IA?", { title: "Quitar IA", confirmText: "Quitar", danger: true })) return;
        const response = await api.deleteAiProvider(button.dataset.id);
        if (!response || !response.ok) return toast(response && response.error || "No se pudo quitar.");
        return renderHome();
      }
    } catch (error) {
      setBusy(false);
      toast(error.message || String(error));
    }
  });

  async function goBack() {
    if (state.currentView === "instance" && isFormationProcess()) {
      await renderHome();
      return true;
    }
    if (state.currentView === "instance" && state.dossier) {
      await renderDossier(state.dossier.id);
      return true;
    }
    if (state.currentView === "dossier") {
      await renderHome();
      return true;
    }
    if (state.currentView === "launcher") return false;
    if (state.currentView === "documents") return false;
    return false;
  }

  window.DocumentArchitectureUI = {
    renderHome,
    renderDocuments,
    openDocument,
    renderDossier,
    renderInstance,
    refreshCurrent,
    goBack,
    isActive() {
      return Boolean(document.querySelector('.nav-item[data-route="architecture"].active'));
    }
  };
})();
