(function () {
  "use strict";

  const catalog = window.DOCUMENT_CATALOG;
  const api = window.documentosApp;
  const view = document.getElementById("view");
  const title = document.getElementById("screenTitle");
  const breadcrumb = document.getElementById("breadcrumb");
  const backButton = document.getElementById("backButton");
  const toast = document.getElementById("toast");

  const state = {
    route: "home",
    history: [],
    unit: null,
    process: null,
    document: null,
    project: null,
    projects: [],
    templates: [],
    settings: null,
    aiProviders: [],
    busy: false
  };

  let saveTimer = null;
  let toastTimer = null;

  const escapeHtml = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const statusLabel = (status) => ({
    draft: "Borrador",
    analyzed: "Analizado",
    generated: "Generado",
    archived: "Archivado"
  }[status] || "Borrador");

  const statusClass = (status) => status === "generated" || status === "archived" ? "good" : status === "analyzed" ? "warn" : "";

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function setBusy(value) {
    state.busy = Boolean(value);
    document.querySelectorAll("button").forEach((button) => {
      if (button.dataset.allowBusy !== "true") button.disabled = state.busy;
    });
  }

  function pushHistory() {
    const snapshot = {
      route: state.route,
      unitId: state.unit && state.unit.id,
      processId: state.process && state.process.id,
      documentId: state.document && state.document.id,
      projectId: state.project && state.project.id
    };
    state.history.push(snapshot);
    if (state.history.length > 20) state.history.shift();
  }

  function setNav(route) {
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.route === route));
  }

  function setHeader(screenTitle, crumbs, canBack) {
    title.textContent = screenTitle || "Documentos";
    breadcrumb.textContent = crumbs || "Inicio";
    backButton.hidden = !canBack;
  }

  async function navigate(route, payload, remember) {
    if (remember !== false && state.route !== route) pushHistory();
    state.route = route;
    payload = payload || {};

    if (route === "home") {
      state.unit = null; state.process = null; state.document = null; state.project = null;
      setNav("home");
      await loadProjects();
      renderHome();
      return;
    }
    if (route === "unit") {
      state.unit = catalog.findUnit(payload.unitId);
      state.process = null; state.document = null; state.project = null;
      setNav("home"); renderUnit(); return;
    }
    if (route === "process") {
      const found = catalog.findProcess(payload.processId);
      if (found) { state.unit = found.unit; state.process = found.process; }
      state.document = null; state.project = null;
      setNav("home"); renderProcess(); return;
    }
    if (route === "editor") {
      if (payload.projectId) {
        const response = await api.getProject(payload.projectId);
        if (response && response.ok && response.project) {
          state.project = response.project;
          const found = catalog.findDocument(state.project.documentId);
          if (found) { state.unit = found.unit; state.process = found.process; state.document = found.document; }
        }
      } else if (payload.documentId) {
        const found = catalog.findDocument(payload.documentId);
        if (found) {
          state.unit = found.unit; state.process = found.process; state.document = found.document;
          const response = await api.createProject({
            unitId: found.unit.id,
            unitName: found.unit.fullName,
            processId: found.process.id,
            processCode: found.process.code,
            processName: found.process.fullName,
            documentId: found.document.id,
            documentName: found.document.name,
            documentType: found.document.type,
            codePattern: found.document.code,
            structure: found.document.structure,
            mode: found.document.mode,
            aiMode: state.settings && state.settings.generation ? state.settings.generation.defaultAiMode : "fallback"
          });
          if (response && response.ok) state.project = response.project;
        }
      }
      await loadTemplates();
      setNav("home"); renderEditor(); return;
    }
    if (route === "library") {
      setNav("library"); await loadProjects(); renderLibrary(); return;
    }
    if (route === "templates") {
      setNav("templates"); await loadTemplates(); renderTemplates(); return;
    }
    if (route === "ai") {
      setNav("ai"); await loadAi(); renderAi(); return;
    }
    if (route === "settings") {
      setNav("settings"); await loadSettings(); renderSettings(); return;
    }
  }

  async function goBack() {
    const previous = state.history.pop();
    if (!previous) return navigate("home", {}, false);
    await navigate(previous.route, {
      unitId: previous.unitId,
      processId: previous.processId,
      documentId: previous.documentId,
      projectId: previous.projectId
    }, false);
  }

  async function loadProjects() {
    const response = await api.listProjects();
    state.projects = response && response.ok ? response.projects || [] : [];
  }

  async function loadTemplates() {
    const response = await api.listTemplates();
    state.templates = response && response.ok ? response.templates || [] : [];
  }

  async function loadSettings() {
    const response = await api.getSettings();
    if (response && response.ok) state.settings = response.settings;
  }

  async function loadAi() {
    const response = await api.getAiProviders();
    state.aiProviders = response && response.ok ? response.providers || [] : [];
  }

  function unitCard(unit) {
    const documentCount = unit.processes.reduce((sum, process) => sum + process.documents.length, 0);
    return `<button class="unit-card" type="button" data-action="open-unit" data-id="${escapeHtml(unit.id)}">
      <span class="unit-icon">${escapeHtml(unit.icon)}</span>
      <h3>${escapeHtml(unit.name)}</h3>
      <p>${unit.processes.length} procesos · ${documentCount} documentos</p>
    </button>`;
  }

  function projectRows(projects, limit) {
    const items = typeof limit === "number" ? projects.slice(0, limit) : projects;
    if (!items.length) return `<div class="empty"><b>Sin documentos todavía</b>Crea uno desde UTET o UGPA.</div>`;
    return `<div class="doc-list">${items.map((project) => `<button class="doc-row" type="button" data-action="open-project" data-id="${escapeHtml(project.id)}">
      <span class="doc-icon">▤</span>
      <span class="doc-main"><h3>${escapeHtml(project.documentName || "Documento")}</h3><p>${escapeHtml(project.unitId)} · ${escapeHtml(project.processCode)} · ${new Date(project.updatedAt).toLocaleDateString()}</p></span>
      <span class="status ${statusClass(project.status)}">${statusLabel(project.status)}</span>
    </button>`).join("")}</div>`;
  }

  function renderHome() {
    setHeader("Documentos", "Inicio", false);
    const generated = state.projects.filter((item) => item.status === "generated" || item.status === "archived").length;
    const drafts = state.projects.filter((item) => item.status === "draft" || item.status === "analyzed").length;
    view.innerHTML = `
      <div class="hero">
        <section class="hero-copy"><h2>Crear es simple.</h2><p>Elige la unidad, el proceso y el documento. La app organiza el resto.</p></section>
        <section class="hero-side">
          <div class="quick-line"><span>Generados</span><b>${generated}</b></div>
          <div class="quick-line"><span>Borradores</span><b>${drafts}</b></div>
          <div class="quick-line"><span>Plantillas</span><b>${state.templates.length || "—"}</b></div>
        </section>
      </div>
      <div class="section-head"><div><h2>Unidades</h2></div></div>
      <div class="unit-grid">${catalog.units.map(unitCard).join("")}</div>
      <div class="section-head"><div><h2>Recientes</h2></div><button class="ghost" type="button" data-route="library">Ver todos</button></div>
      ${projectRows(state.projects, 5)}
    `;
  }

  function renderUnit() {
    if (!state.unit) return navigate("home", {}, false);
    setHeader(state.unit.name, `Inicio / ${state.unit.short}`, true);
    view.innerHTML = `
      <div class="section-head"><div><h2>Procesos</h2><p>${escapeHtml(state.unit.fullName)}</p></div></div>
      <div class="process-grid">${state.unit.processes.map((process) => `<button class="process-card" type="button" data-action="open-process" data-id="${escapeHtml(process.id)}">
        <span class="process-code">${escapeHtml(process.code)}</span>
        <h3>${escapeHtml(process.name)}</h3>
        <span class="process-count">${process.documents.length} documentos</span>
      </button>`).join("")}</div>
    `;
  }

  function renderProcess() {
    if (!state.unit || !state.process) return navigate("home", {}, false);
    setHeader(state.process.name, `${state.unit.short} / ${state.process.code}`, true);
    view.innerHTML = `
      <div class="section-head"><div><h2>Documentos</h2><p>${escapeHtml(state.process.fullName)}</p></div></div>
      <div class="doc-list">${state.process.documents.map((document) => `<button class="doc-row" type="button" data-action="new-document" data-id="${escapeHtml(document.id)}">
        <span class="doc-icon">${document.mode === "upload" ? "⇧" : "▤"}</span>
        <span class="doc-main"><h3>${escapeHtml(document.name)}</h3><p>${escapeHtml(document.code)}</p></span>
        <span class="doc-arrow">→</span>
      </button>`).join("")}</div>
    `;
  }

  function fieldHtml(definition) {
    const value = state.project && state.project.formData ? state.project.formData[definition.id] || "" : "";
    const cls = definition.full ? "field full" : "field";
    if (definition.type === "textarea") {
      return `<div class="${cls}"><label for="field-${definition.id}">${escapeHtml(definition.label)}</label><textarea id="field-${definition.id}" data-field="${escapeHtml(definition.id)}" placeholder="${escapeHtml(definition.placeholder || "")}">${escapeHtml(value)}</textarea></div>`;
    }
    return `<div class="${cls}"><label for="field-${definition.id}">${escapeHtml(definition.label)}</label><input id="field-${definition.id}" data-field="${escapeHtml(definition.id)}" type="${escapeHtml(definition.type || "text")}" value="${escapeHtml(value)}" placeholder="${escapeHtml(definition.placeholder || "")}" /></div>`;
  }

  function fileList(kind) {
    const items = (state.project.attachments || []).filter((item) => item.kind === kind);
    if (!items.length) return "";
    return `<div class="file-list">${items.map((item) => `<div class="file-chip"><div><b>${escapeHtml(item.name)}</b><small>${Math.max(1, Math.round((item.size || 0) / 1024))} KB</small></div><button type="button" data-action="remove-file" data-id="${escapeHtml(item.id)}" aria-label="Quitar">×</button></div>`).join("")}</div>`;
  }

  function templateSelect() {
    const selected = state.project.template && state.project.template.id ? state.project.template.id : "";
    const options = [`<option value="">Sin plantilla</option>`].concat(state.templates.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selected ? "selected" : ""}>${escapeHtml(item.name)}</option>`));
    return `<div class="field"><label>Plantilla Word</label><select id="templateSelect">${options.join("")}</select></div>`;
  }

  function analysisHtml() {
    const analysis = state.project.analysis;
    if (!analysis) return "";
    const tables = Array.isArray(analysis.tables) ? analysis.tables.length : 0;
    const charts = Array.isArray(analysis.charts) ? analysis.charts.length : 0;
    const findings = Array.isArray(analysis.keyFindings) ? analysis.keyFindings : [];
    const missing = Array.isArray(analysis.missingData) ? analysis.missingData : [];
    return `<section class="panel analysis">
      <div class="panel-title"><div><h2>Análisis listo</h2><small>${escapeHtml(analysis.provider || "Local")}</small></div><span class="status good">✓</span></div>
      <div class="metric-grid">
        <div class="metric"><b>${findings.length}</b><span>Hallazgos</span></div>
        <div class="metric"><b>${tables}</b><span>Tablas</span></div>
        <div class="metric"><b>${charts}</b><span>Gráficos</span></div>
        <div class="metric"><b>${missing.length}</b><span>Faltantes</span></div>
      </div>
      ${findings.length ? `<div><div class="section-head"><h3>Principal</h3></div><ul class="finding-list">${findings.slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}
      ${missing.length ? `<div><div class="section-head"><h3>Falta</h3></div><ul class="finding-list missing">${missing.slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}
      <div class="button-row end"><button class="ghost" type="button" data-action="analyze">Analizar otra vez</button><button class="primary" type="button" data-action="generate">Generar Word</button></div>
    </section>`;
  }

  function outputsHtml() {
    const outputs = (state.project.outputs || []).filter((item) => item.path);
    if (!outputs.length) return "";
    return `<section class="panel"><div class="panel-title"><h2>Listo</h2><span class="status good">Generado</span></div><div class="doc-list">${outputs.slice(0, 5).map((item) => `<div class="doc-row"><span class="doc-icon">W</span><span class="doc-main"><h3>${escapeHtml(item.label || "Documento Word")}</h3><p>${escapeHtml(item.path)}</p></span><span class="button-row"><button class="secondary" type="button" data-action="open-output" data-path="${escapeHtml(item.path)}">Abrir</button><button class="ghost" type="button" data-action="show-output" data-path="${escapeHtml(item.path)}">Carpeta</button></span></div>`).join("")}</div></section>`;
  }

  function renderEditor() {
    if (!state.document || !state.project) return navigate("home", {}, false);
    setHeader(state.document.name, `${state.unit.short} / ${state.process.code}`, true);

    if (state.document.mode === "upload") {
      view.innerHTML = `
        <div class="editor-grid">
          <section class="panel">
            <div class="panel-title"><div><h2>${escapeHtml(state.document.name)}</h2><small>${escapeHtml(state.document.code)}</small></div><span class="status ${statusClass(state.project.status)}">${statusLabel(state.project.status)}</span></div>
            <div class="form-grid">${state.document.fields.map(fieldHtml).join("")}</div>
          </section>
          <aside>
            <section class="panel compact"><div class="panel-title"><h3>Archivo</h3></div><button class="upload-button" type="button" data-action="add-files" data-kind="source"><b>+ Word / PDF</b><span>Subir</span></button>${fileList("source")}</section>
            <button class="primary" style="width:100%" type="button" data-action="archive-upload">Guardar</button>
          </aside>
        </div>${outputsHtml()}`;
      return;
    }

    view.innerHTML = `
      <div class="editor-grid">
        <section class="panel">
          <div class="panel-title"><div><h2>Datos</h2><small>${escapeHtml(state.document.code)}</small></div><span class="status ${statusClass(state.project.status)}">${statusLabel(state.project.status)}</span></div>
          <div class="form-grid">${state.document.fields.map(fieldHtml).join("")}</div>
        </section>
        <aside>
          <section class="panel compact">
            <div class="panel-title"><h3>Plantilla</h3><button class="ghost" type="button" data-action="import-template">+ Word</button></div>
            ${templateSelect()}
          </section>
          <section class="panel compact">
            <div class="panel-title"><h3>Fuentes</h3></div>
            <div class="upload-grid">
              <button class="upload-button" type="button" data-action="add-files" data-kind="source"><b>+ Documentos</b><span>Word · PDF</span></button>
              <button class="upload-button" type="button" data-action="add-files" data-kind="data"><b>+ Datos</b><span>Excel · CSV</span></button>
            </div>
            ${fileList("source")}${fileList("data")}
          </section>
          <section class="panel compact">
            <div class="panel-title"><h3>Evidencias</h3></div>
            <button class="upload-button" type="button" data-action="add-files" data-kind="evidence"><b>+ Imágenes</b><span>Fotos · capturas</span></button>
            ${fileList("evidence")}
          </section>
          <section class="panel compact">
            <div class="panel-title"><h3>Análisis</h3></div>
            <div class="mode-row">
              <label class="mode-option"><input type="radio" name="aiMode" value="fallback" ${state.project.aiMode !== "deep" ? "checked" : ""}><b>Automático</b><small>IA + respaldo</small></label>
              <label class="mode-option"><input type="radio" name="aiMode" value="deep" ${state.project.aiMode === "deep" ? "checked" : ""}><b>Profundo</b><small>Varias IAs</small></label>
            </div>
          </section>
          <button class="primary" style="width:100%" type="button" data-action="analyze">✦ Analizar</button>
        </aside>
      </div>
      ${analysisHtml()}
      ${outputsHtml()}
    `;
  }

  function renderLibrary(filter) {
    setHeader("Documentos", "Biblioteca local", false);
    const term = String(filter || "").toLowerCase();
    const items = term ? state.projects.filter((project) => `${project.documentName} ${project.unitId} ${project.processCode}`.toLowerCase().includes(term)) : state.projects;
    view.innerHTML = `<div class="search-wrap"><input class="search-input" id="librarySearch" type="search" placeholder="Buscar" value="${escapeHtml(filter || "")}" /></div>${projectRows(items)}`;
  }

  function renderTemplates() {
    setHeader("Plantillas", "Plantillas Word", false);
    view.innerHTML = `
      <section class="panel compact"><div class="panel-title"><div><h2>Plantillas Word</h2><small>${state.templates.length} guardadas</small></div><button class="primary" type="button" data-action="import-template">+ Plantilla</button></div>
      ${state.templates.length ? `<div class="doc-list">${state.templates.map((item) => `<div class="template-card"><span class="icon">W</span><div><h3>${escapeHtml(item.name)}</h3><p>${item.tokens.length ? `${item.tokens.length} campos detectados` : "Sin campos {{...}} detectados"}</p></div><span class="status ${item.tokens.length ? "good" : "warn"}">${item.tokens.length ? "Lista" : "Revisar"}</span></div>`).join("")}</div>` : `<div class="empty"><b>Sin plantillas</b>Sube un Word con campos como {{PERIODO}}.</div>`}
      </section>`;
  }

  function renderAi() {
    setHeader("IA", "Proveedores", false);
    view.innerHTML = `<div class="section-head"><div><h2>Proveedores</h2><p>Orden de respaldo automático.</p></div><button class="primary" type="button" data-action="save-ai">Guardar</button></div>
      <div class="provider-list">${state.aiProviders.map((provider) => `<section class="provider-card" data-provider="${escapeHtml(provider.id)}">
        <div class="provider-head"><div><h3>${escapeHtml(provider.name)}</h3><span class="status ${provider.hasKey ? "good" : ""}">${provider.hasKey ? "Clave guardada" : "Sin clave"}</span></div><label class="switch"><input data-ai="enabled" type="checkbox" ${provider.enabled ? "checked" : ""}><span class="slider"></span></label></div>
        <div class="provider-grid">
          <div class="field"><label>Modelo</label><input data-ai="model" type="text" value="${escapeHtml(provider.model)}" placeholder="Modelo" /></div>
          <div class="field"><label>Prioridad</label><input data-ai="priority" type="number" min="1" max="9" value="${escapeHtml(provider.priority)}" /></div>
          <div class="field full"><label>Endpoint</label><input data-ai="endpoint" type="text" value="${escapeHtml(provider.endpoint)}" /></div>
          <div class="field full"><label>API key</label><input data-ai="apiKey" type="password" value="" placeholder="${provider.hasKey ? "Guardada · deja vacío para conservar" : "Pega tu clave"}" /></div>
        </div>
      </section>`).join("")}</div>`;
  }

  function signerFields(key, label, person) {
    return `<div class="panel compact"><div class="panel-title"><h3>${label}</h3></div><div class="form-grid"><div class="field"><label>Nombre</label><input data-setting="${key}.nombre" value="${escapeHtml(person.nombre)}" /></div><div class="field"><label>Cargo</label><input data-setting="${key}.cargo" value="${escapeHtml(person.cargo)}" /></div></div></div>`;
  }

  function renderSettings() {
    setHeader("Ajustes", "Configuración local", false);
    const settings = state.settings || { signers: { elaboradoPor: {}, revisadoPor: {}, aprobadoPor: {} }, generation: {} };
    view.innerHTML = `<div class="section-head"><div><h2>Firmas</h2></div><button class="primary" type="button" data-action="save-settings">Guardar</button></div>
      ${signerFields("elaboradoPor", "Elaborado por", settings.signers.elaboradoPor)}
      ${signerFields("revisadoPor", "Revisado por", settings.signers.revisadoPor)}
      ${signerFields("aprobadoPor", "Aprobado por", settings.signers.aprobadoPor)}
      <section class="panel compact"><div class="panel-title"><h3>Generación</h3></div><div class="form-grid">
        <div class="field"><label>Modo IA</label><select id="defaultAiMode"><option value="fallback" ${settings.generation.defaultAiMode !== "deep" ? "selected" : ""}>Automático</option><option value="deep" ${settings.generation.defaultAiMode === "deep" ? "selected" : ""}>Profundo</option></select></div>
        <div class="field"><label>Abrir al generar</label><select id="openAfterGenerate"><option value="no" ${!settings.generation.openAfterGenerate ? "selected" : ""}>No</option><option value="yes" ${settings.generation.openAfterGenerate ? "selected" : ""}>Sí</option></select></div>
      </div></section>`;
  }

  function collectFormData() {
    const data = Object.assign({}, state.project.formData || {});
    document.querySelectorAll("[data-field]").forEach((input) => { data[input.dataset.field] = input.value; });
    return data;
  }

  async function persistEditor() {
    if (!state.project) return;
    state.project.formData = collectFormData();
    const mode = document.querySelector('input[name="aiMode"]:checked');
    if (mode) state.project.aiMode = mode.value;
    const templateSelectElement = document.getElementById("templateSelect");
    if (templateSelectElement) {
      state.project.template = state.templates.find((item) => item.id === templateSelectElement.value) || null;
    }
    const response = await api.saveProject(state.project);
    if (response && response.ok) state.project = response.project;
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persistEditor(), 450);
  }

  async function importTemplate() {
    const response = await api.importTemplate();
    if (!response || response.canceled) return;
    if (!response.ok) return showToast(response.error || "No se pudo importar.");
    await loadTemplates();
    if (state.route === "editor" && state.project) {
      state.project.template = response.template;
      await api.saveProject(state.project);
      renderEditor();
    } else renderTemplates();
    showToast(response.template.tokens.length ? "Plantilla lista." : "Plantilla guardada. No se detectaron campos {{...}}.");
  }

  async function addFiles(kind) {
    await persistEditor();
    setBusy(true);
    const response = await api.addFiles(state.project.id, kind);
    setBusy(false);
    if (!response || response.canceled) return;
    if (!response.ok) return showToast(response.error || "No se pudo agregar.");
    state.project = response.project;
    state.project.analysis = null;
    state.project.status = "draft";
    await api.saveProject(state.project);
    renderEditor();
  }

  async function removeFile(id) {
    const response = await api.removeFile(state.project.id, id);
    if (response && response.ok) {
      state.project = response.project;
      state.project.analysis = null;
      state.project.status = "draft";
      await api.saveProject(state.project);
      renderEditor();
    }
  }

  async function analyze() {
    await persistEditor();
    setBusy(true);
    const buttons = document.querySelectorAll('[data-action="analyze"]');
    buttons.forEach((button) => { button.innerHTML = '<span class="loading"><span class="spinner"></span>Analizando</span>'; });
    const response = await api.analyze(state.project.id, state.project.aiMode || "fallback");
    setBusy(false);
    if (!response || !response.ok) {
      showToast(response && response.error ? response.error : "No se pudo analizar.");
      renderEditor();
      return;
    }
    state.project = response.project;
    renderEditor();
    showToast("Análisis listo.");
  }

  async function generate() {
    await persistEditor();
    setBusy(true);
    const response = await api.generate(state.project.id);
    setBusy(false);
    if (!response || !response.ok) {
      showToast(response && response.error ? response.error : "No se pudo generar.");
      return;
    }
    state.project = response.project;
    renderEditor();
    showToast("Word generado.");
  }

  async function archiveUpload() {
    await persistEditor();
    const response = await api.archiveUpload(state.project.id);
    if (!response || !response.ok) return showToast(response && response.error ? response.error : "No se pudo guardar.");
    state.project = response.project;
    renderEditor();
    showToast("Archivo guardado.");
  }

  async function saveAi() {
    const providers = Array.from(document.querySelectorAll("[data-provider]")).map((card) => ({
      id: card.dataset.provider,
      enabled: card.querySelector('[data-ai="enabled"]').checked,
      model: card.querySelector('[data-ai="model"]').value.trim(),
      priority: Number(card.querySelector('[data-ai="priority"]').value || 9),
      endpoint: card.querySelector('[data-ai="endpoint"]').value.trim(),
      apiKey: card.querySelector('[data-ai="apiKey"]').value.trim()
    }));
    const response = await api.saveAiProviders(providers);
    if (!response || !response.ok) return showToast("No se pudieron guardar las IAs.");
    state.aiProviders = response.providers;
    renderAi();
    showToast("IA guardada.");
  }

  async function saveSettingsFromScreen() {
    const current = state.settings || { signers: {}, generation: {} };
    const signers = { elaboradoPor: {}, revisadoPor: {}, aprobadoPor: {} };
    document.querySelectorAll("[data-setting]").forEach((input) => {
      const [key, prop] = input.dataset.setting.split(".");
      signers[key][prop] = input.value.trim();
    });
    const payload = {
      signers,
      generation: {
        defaultAiMode: document.getElementById("defaultAiMode").value,
        openAfterGenerate: document.getElementById("openAfterGenerate").value === "yes",
        includeSourceTrace: current.generation.includeSourceTrace !== false
      }
    };
    const response = await api.saveSettings(payload);
    if (response && response.ok) {
      state.settings = response.settings;
      showToast("Ajustes guardados.");
    }
  }

  view.addEventListener("input", (event) => {
    if (event.target.matches("[data-field]")) scheduleSave();
    if (event.target.id === "librarySearch") renderLibrary(event.target.value);
  });
  view.addEventListener("change", (event) => {
    if (event.target.matches("[data-field], input[name='aiMode'], #templateSelect")) scheduleSave();
  });

  document.addEventListener("click", async (event) => {
    const routeButton = event.target.closest("[data-route]");
    if (routeButton) return navigate(routeButton.dataset.route);
    const button = event.target.closest("[data-action]");
    if (!button || state.busy) return;
    const action = button.dataset.action;
    if (action === "open-unit") return navigate("unit", { unitId: button.dataset.id });
    if (action === "open-process") return navigate("process", { processId: button.dataset.id });
    if (action === "new-document") return navigate("editor", { documentId: button.dataset.id });
    if (action === "open-project") return navigate("editor", { projectId: button.dataset.id });
    if (action === "import-template") return importTemplate();
    if (action === "add-files") return addFiles(button.dataset.kind);
    if (action === "remove-file") return removeFile(button.dataset.id);
    if (action === "analyze") return analyze();
    if (action === "generate") return generate();
    if (action === "archive-upload") return archiveUpload();
    if (action === "save-ai") return saveAi();
    if (action === "save-settings") return saveSettingsFromScreen();
    if (action === "open-output") return api.openFile(button.dataset.path);
    if (action === "show-output") return api.showFile(button.dataset.path);
  });

  backButton.addEventListener("click", goBack);

  async function init() {
    if (!api) {
      view.innerHTML = `<div class="empty"><b>Electron no disponible</b>Ejecuta la app con npm start.</div>`;
      return;
    }
    document.getElementById("appVersion").textContent = `v${api.version}`;
    await Promise.all([loadSettings(), loadTemplates(), loadProjects()]);
    renderHome();
  }

  init();
})();
