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
    busy: false,
    currentView: "home"
  };

  const view = () => document.getElementById("view");
  const title = () => document.getElementById("screenTitle");
  const breadcrumb = () => document.getElementById("breadcrumb");
  const backButton = () => document.getElementById("backButton");

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
        <div><h2>Períodos</h2><p>Los datos quedan separados por período y se reutilizan entre documentos del mismo proceso.</p></div>
        <button class="primary" data-arch-action="new-period">+ Período</button>
      </div>
      <div class="arch-grid">
        ${(dashboard.periods || []).length ? dashboard.periods.map(periodCard).join("") : '<div class="empty"><b>Sin períodos</b>Crea el primer período para comenzar.</div>'}
      </div>

      <div class="section-head"><div><h2>Expedientes</h2><p>Formación, Capacitación, Regulares y PVC se mantienen separados.</p></div></div>
      <div class="arch-grid">
        ${(dashboard.dossiers || []).length ? dashboard.dossiers.map(dossierCard).join("") : '<div class="empty"><b>Sin expedientes</b>Crea uno desde un período.</div>'}
      </div>

      <div class="section-head"><div><h2>Configuración de IA</h2></div></div>
      ${providerPanel()}
    `;
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
    setHeader(state.dossier.label, `Procesos / ${state.dossier.periodLabel}`, true);
    const engines = state.engines.filter(engineMatchesDossier);
    view().innerHTML = `
      <div class="arch-dossier-head">
        <div>
          <span class="process-code">${escapeHtml(state.dossier.processKey)}</span>
          <h2>${escapeHtml(state.dossier.label)}</h2>
          <p>${escapeHtml(state.dossier.periodLabel)} · población: ${escapeHtml(state.dossier.population)}</p>
        </div>
        <div class="button-row">
          <button class="ghost small-inline" data-arch-action="clone-dossier">Copiar a otro período</button>
          <span class="status good">Expediente maestro</span>
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

      <div class="section-head">
        <div><h2>Motores documentales</h2><p>Cada documento tiene reglas propias aunque comparta datos con otros.</p></div>
      </div>
      <div class="arch-engine-grid">${engines.map(engineCard).join("")}</div>
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

  function sectionCard(section) {
    const level = Math.max(1, Number(section.level || 1));
    const allowed = section.allowedVisuals || [];
    const contract = section.contract || {};
    const number = section.numbering || String(section.order || "");
    const readiness = state.dataReadiness && Array.isArray(state.dataReadiness.sections)
      ? state.dataReadiness.sections.find((item) => item.sectionKey === section.key)
      : null;
    const readinessLabel = !readiness || !readiness.bindingId
      ? ""
      : readiness.ready
        ? "Datos listos"
        : readiness.status === "no_imports"
          ? "Sin Excel/CSV"
          : readiness.status === "mapping_pending"
            ? "Mapeo pendiente"
            : readiness.status === "missing_fields"
              ? "Campos faltantes"
              : "Datos pendientes";
    const readinessClass = readiness && readiness.ready ? "good" : "warn";
    return `
      <article class="arch-section-card level-${level}" style="--section-level:${level}">
        <div class="arch-section-head">
          <div class="arch-section-title-wrap">
            <label><input type="checkbox" data-arch-section-select value="${escapeHtml(section.key)}"> <b>${escapeHtml(number)}.</b> ${escapeHtml(section.title)}</label>
            <small>Nivel ${level} · ${escapeHtml(section.type)} · ${(section.blocks || []).length} bloque(s)${readinessLabel ? " · " + escapeHtml(readinessLabel) : ""}</small>
          </div>
          <div class="button-row">
            <span class="status ${section.status === "approved" ? "good" : section.alerts && section.alerts.length ? "warn" : ""}">${escapeHtml(section.status)}</span>
            <button class="ghost small-inline" data-arch-action="generate-section" data-key="${escapeHtml(section.key)}">IA</button>
            <button class="ghost small-inline" data-arch-action="export-section" data-key="${escapeHtml(section.key)}">Borrador</button>
            <button class="secondary small-inline" data-arch-action="approve-section" data-key="${escapeHtml(section.key)}">${section.locked ? "Aprobada" : "Aprobar"}</button>
          </div>
        </div>
        ${readiness && readiness.bindingId ? `<div class="notice-${readiness.ready ? "soft" : "warn"}"><b class="${readinessClass === "good" ? "arch-ok-text" : "arch-warn-text"}">${escapeHtml(readinessLabel)}</b><span>${escapeHtml((readiness.warnings || []).slice(0, 2).join(" · ") || (readiness.ready ? "La sección tiene los campos necesarios para consultar los datos." : "Revisa el archivo y su mapeo."))}</span></div>` : ""}
        ${contract.purpose ? `<div class="notice-soft arch-contract"><b>Regla propia</b><span>${escapeHtml(contract.purpose)}</span></div>` : ""}
        ${allowed.length ? `<div class="arch-visual-tools"><span>Herramientas habilitadas:</span>${allowed.map((id) => `<em>${escapeHtml(visualLabel(id))}</em>`).join("")}</div>` : ""}
        <div class="arch-block-summary">${blockSummary(section)}</div>
        ${alertBlock(section)}
        ${blockEditor(section)}
      </article>
    `;
  }

  async function renderInstance(instanceId) {
    state.currentView = "instance";
    await loadInstance(instanceId || state.instance && state.instance.id);
    setHeader(state.instance.label, `Procesos / ${state.dossier ? state.dossier.label : "Documento"}`, true);
    const alertSummary = state.instance.alertTrace && state.instance.alertTrace.summary || { total: 0, bySeverity: {} };
    const alerts = state.instance.finalFrozenAt ? 0 : Number(alertSummary.total || 0);
    const editorialErrors = state.editorialValidation && state.editorialValidation.errors || [];
    const editorialWarnings = state.editorialValidation && state.editorialValidation.warnings || [];
    const citationIssues = state.citationValidation
      ? (state.citationValidation.missing || []).concat(state.citationValidation.incomplete || [])
      : [];
    view().innerHTML = `
      ${editorialErrors.length ? `<div class="notice-warn"><b>Control editorial pendiente</b><span>${escapeHtml(editorialErrors.slice(0,3).join(" · "))}</span></div>` : ""}
      ${!editorialErrors.length && editorialWarnings.length ? `<div class="notice-soft"><b>Observaciones editoriales</b><span>${escapeHtml(editorialWarnings.slice(0,3).join(" · "))}</span></div>` : ""}
      ${citationIssues.length ? `<div class="notice-warn"><b>Citas APA pendientes</b><span>${escapeHtml(citationIssues.slice(0,6).join(", "))}</span></div>` : ""}
      ${state.generationRun && state.generationRun.status === "partial" ? `<div class="notice-warn"><b>Generación parcial</b><span>${escapeHtml(generationMessage(state.generationRun))}</span></div>` : ""}
      ${state.instance.finalFrozenAt && Number(alertSummary.total || 0) ? `<div class="notice-soft"><b>Trazabilidad interna</b><span>${Number(alertSummary.total || 0)} alerta(s) quedaron congeladas para auditoría. No forman parte de la versión final visible.</span></div>` : ""}
      ${state.instance.engineState === "frozen_historical" ? `<div class="notice-soft"><b>Versión final histórica</b><span>Esta versión permanece congelada con el motor v${escapeHtml(state.instance.engineVersion)}. El motor vigente es v${escapeHtml(state.instance.currentEngineVersion)} y no modificará esta final.</span></div>` : ""}
      ${state.instance.archivedSectionCount ? `<div class="notice-soft"><b>Historial estructural preservado</b><span>${Number(state.instance.archivedSectionCount)} sección(es) retirada(s) del motor permanecen archivadas y fuera del documento activo.</span></div>` : ""}
      ${state.instance.stale ? `<div class="notice-warn"><b>Datos actualizados</b><span>${escapeHtml(state.instance.staleReason)}. Regenera las secciones no bloqueadas.</span></div>` : ""}
      <div class="arch-dossier-head">
        <div>
          <span class="process-code">${escapeHtml(state.instance.engineId)} · v${escapeHtml(state.instance.engineVersion)}</span>
          <h2>${escapeHtml(state.instance.label)}</h2>
          <p>${escapeHtml(state.instance.scopeType)}${state.instance.scopeKey ? " · " + escapeHtml(state.instance.scopeKey) : ""} · ${state.instance.engine && state.instance.engine.outlineStatus === "confirmed" ? "estructura confirmada" : "estructura base"} · ${Number(state.instance.engine && state.instance.engine.outlineSummary && state.instance.engine.outlineSummary.nodeCount || state.instance.sections.length)} punto(s) · migraciones: ${Number(state.instance.migrationRevision || 0)}${state.instance.lastMigratedAt ? " · última: " + escapeHtml(String(state.instance.lastMigratedAt).slice(0, 10)) : ""}</p>
        </div>
        <span class="status ${state.instance.status === "final" ? "good" : alerts ? "warn" : ""}">${state.instance.status === "final" ? "Final congelada" : alerts + " alerta(s)"}</span>
      </div>

      <div class="button-row arch-toolbar">
        <button class="primary" data-arch-action="generate-document">Generar / revisar todo</button>
        ${state.generationRun && state.generationRun.result && state.generationRun.result.resumable
          ? '<button class="ghost" data-arch-action="resume-document">Reanudar pendientes</button>'
          : ''}
        <button class="ghost" data-arch-action="export-selected">Borrador seleccionado</button>
        <button class="ghost" data-arch-action="export-draft">Borrador completo</button>
        ${state.instance.finalFrozenAt
          ? '<button class="secondary" data-arch-action="export-final">Versión final limpia</button><button class="ghost" data-arch-action="working-copy">Nueva versión de trabajo</button>'
          : '<button class="secondary" data-arch-action="freeze-final">Aprobar versión final</button>'}
      </div>

      <div class="arch-sections">${state.instance.sections.map(sectionCard).join("")}</div>
    `;
  }

  async function refreshCurrent() {
    if (state.instance) return renderInstance(state.instance.id);
    if (state.dossier) return renderDossier(state.dossier.id);
    return renderHome();
  }

  async function newPeriod() {
    const code = window.prompt("Código del período (ej. FEB-AGO-2026):");
    if (!code) return;
    const label = window.prompt("Nombre visible del período:", code);
    if (!label) return;
    const startDate = window.prompt("Fecha de inicio (AAAA-MM-DD, opcional):", "") || "";
    const endDate = window.prompt("Fecha de fin (AAAA-MM-DD, opcional):", "") || "";
    const response = await api.createPeriod({ code, label, startDate, endDate });
    if (!response || !response.ok) return toast(response && response.error || "No se pudo crear el período.");
    toast("Período creado.");
    await renderHome();
  }

  async function createDossier(button) {
    const select = document.getElementById(`arch-process-${button.dataset.periodId}`);
    if (!select) return;
    const [processKey, population] = String(select.value || "").split("|");
    const label = window.prompt("Nombre del expediente:", `${select.options[select.selectedIndex].text} · ${button.dataset.periodId}`);
    if (!label) return;
    const response = await api.createDossier({ periodId: button.dataset.periodId, processKey, population, label });
    if (!response || !response.ok) return toast(response && response.error || "No se pudo crear el expediente.");
    toast("Expediente creado.");
    await renderDossier(response.dossier.id);
  }

  async function addMaster() {
    const key = window.prompt("Clave del dato compartido (ej. CARRERAS, CRONOGRAMA, RESPONSABLES):");
    if (!key) return;
    const value = window.prompt("Valor. Puedes pegar texto o JSON:");
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
    window.alert(`Sugerencias de mapeo para ${suggestion.sourceName || "archivo"}\n\n${lines.join("\n")}\n\nEstas sugerencias no se aplican automáticamente.`);
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
    const raw = window.prompt("Mapeo canónico JSON. Cambia únicamente las columnas que existan en tu Excel:", initial);
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
    const selected = window.prompt("Tipo de fuente APA 7:\n\n" + menu + "\n\nEscribe el número:", String(currentIndex + 1));
    if (selected == null) return;
    const typeIndex = Number(selected) - 1;
    if (!Number.isInteger(typeIndex) || typeIndex < 0 || typeIndex >= available.length) return toast("Tipo de fuente no válido.");
    const sourceType = available[typeIndex].id;

    const corporateAuthor = window.prompt("Autor institucional/corporativo (vacío si son autores personales):", current.corporateAuthor || "");
    if (corporateAuthor == null) return;
    const author = window.prompt("Autor(es) personales. Usa “Apellido, Iniciales; Apellido, Iniciales” para varios:", current.author || "");
    if (author == null) return;
    const year = window.prompt("Año (ej. 2026). Si hay fecha completa, puedes dejarlo vacío y ponerla en metadatos:", current.year || "");
    if (year == null) return;
    const titleValue = window.prompt("Título de la fuente:", current.title || source.name || "");
    if (titleValue == null) return;
    const publisher = window.prompt("Editorial / institución publicadora (cuando corresponda):", current.publisher || "");
    if (publisher == null) return;
    const url = window.prompt("URL (cuando corresponda):", current.url || "");
    if (url == null) return;
    const doi = window.prompt("DOI (cuando corresponda):", current.doi || "");
    if (doi == null) return;

    const template = citationMetadataTemplate(sourceType, current);
    const metadataRaw = window.prompt(
      "Metadatos específicos en JSON. Completa los campos que correspondan al tipo seleccionado:",
      JSON.stringify(template, null, 2)
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
    const selected = window.prompt(`¿A qué período copiar la base?\n${menu}\n\nEscribe el número:`, "1");
    const index = Number(selected) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= choices.length) return;
    const target = choices[index];
    const label = window.prompt("Nombre del nuevo expediente:", `${state.dossier.processKey} · ${target.label}`);
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
      scopeKey = window.prompt(`Identificador para ${cardinality} (ej. estudiante, carrera, actividad o segmento):`, "") || "";
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
      if (!window.confirm("Esta sección tiene cambios manuales. ¿Deseas reemplazarlos con una nueva generación de IA?")) return;
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

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-arch-action]");
    if (!button || state.busy) return;
    const action = button.dataset.archAction;
    try {
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
      if (action === "approve-section") {
        const current = state.instance.sections.find((item) => item.key === button.dataset.key);
        return saveSection(button.dataset.key, { status: "approved", locked: true, content: current && current.content || "", provenance: Object.assign({}, current && current.provenance || {}, { approvedBy: "human", approvedAt: new Date().toISOString() }) });
      }
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
        if (!window.confirm("¿Quitar esta IA?")) return;
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
    if (state.currentView === "instance" && state.dossier) {
      await renderDossier(state.dossier.id);
      return true;
    }
    if (state.currentView === "dossier") {
      await renderHome();
      return true;
    }
    return false;
  }

  window.DocumentArchitectureUI = {
    renderHome,
    renderDossier,
    renderInstance,
    refreshCurrent,
    goBack,
    isActive() {
      return Boolean(document.querySelector('.nav-item[data-route="architecture"].active'));
    }
  };
})();
