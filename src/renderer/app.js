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
    sync: null,
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
    generated: "PDF listo",
    archived: "Guardado"
  }[status] || "Borrador");

  const statusClass = (status) => status === "generated" || status === "archived"
    ? "good"
    : status === "analyzed"
      ? "warn"
      : "";

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function setBusy(value) {
    state.busy = Boolean(value);
    document.querySelectorAll("button").forEach((button) => {
      if (button.dataset.allowBusy !== "true") button.disabled = state.busy;
    });
  }

  function pushHistory() {
    state.history.push({
      route: state.route,
      unitId: state.unit && state.unit.id,
      processId: state.process && state.process.id,
      documentId: state.document && state.document.id,
      projectId: state.project && state.project.id
    });
    if (state.history.length > 20) state.history.shift();
  }

  function setNav(route) {
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.route === route);
    });
  }

  function setHeader(screenTitle, crumbs, canBack) {
    title.textContent = screenTitle || "Documentos";
    breadcrumb.textContent = crumbs || "Inicio";
    backButton.hidden = !canBack;
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

  async function loadSync() {
    const response = await api.getSyncStatus();
    state.sync = response && response.ok ? response.sync : null;
  }

  function activeTemplate(documentId) {
    return state.templates.find((item) => item.documentId === documentId && item.active) || null;
  }

  async function navigate(route, payload, remember) {
    if (remember !== false && state.route !== route) pushHistory();
    state.route = route;
    payload = payload || {};

    if (route === "home") {
      state.unit = null;
      state.process = null;
      state.document = null;
      state.project = null;
      setNav("home");
      await Promise.all([loadProjects(), loadTemplates()]);
      renderHome();
      return;
    }

    if (route === "unit") {
      state.unit = catalog.findUnit(payload.unitId);
      state.process = null;
      state.document = null;
      state.project = null;
      setNav("home");
      renderUnit();
      return;
    }

    if (route === "process") {
      const found = catalog.findProcess(payload.processId);
      if (found) {
        state.unit = found.unit;
        state.process = found.process;
      }
      state.document = null;
      state.project = null;
      setNav("home");
      await loadTemplates();
      renderProcess();
      return;
    }

    if (route === "editor") {
      await loadTemplates();

      if (payload.projectId) {
        const response = await api.getProject(payload.projectId);
        if (response && response.ok && response.project) {
          state.project = response.project;
          const found = catalog.findDocument(state.project.documentId);
          if (found) {
            state.unit = found.unit;
            state.process = found.process;
            state.document = found.document;
          }
        }
      } else if (payload.documentId) {
        const found = catalog.findDocument(payload.documentId);
        if (found) {
          state.unit = found.unit;
          state.process = found.process;
          state.document = found.document;
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
            mode: found.document.mode,
            aiMode: state.settings && state.settings.generation
              ? state.settings.generation.defaultAiMode
              : "fallback"
          });
          if (response && response.ok) state.project = response.project;
        }
      }

      setNav("home");
      renderEditor();
      return;
    }

    if (route === "library") {
      setNav("library");
      await loadProjects();
      renderLibrary();
      return;
    }

    if (route === "templates") {
      setNav("templates");
      await loadTemplates();
      renderTemplates();
      return;
    }

    if (route === "ai") {
      setNav("ai");
      await loadAi();
      renderAi();
      return;
    }

    if (route === "settings") {
      setNav("settings");
      await Promise.all([loadSettings(), loadSync()]);
      renderSettings();
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

  function unitCard(unit) {
    const count = unit.processes.reduce((sum, process) => sum + process.documents.length, 0);
    return `<button class="unit-card" type="button" data-action="open-unit" data-id="${escapeHtml(unit.id)}">
      <span class="unit-icon">${escapeHtml(unit.icon)}</span>
      <h3>${escapeHtml(unit.name)}</h3>
      <p>${unit.processes.length} procesos · ${count} documentos</p>
    </button>`;
  }

  function projectRows(projects, limit) {
    const items = typeof limit === "number" ? projects.slice(0, limit) : projects;
    if (!items.length) {
      return '<div class="empty"><b>Sin documentos</b>Crea uno desde UTET o UGPA.</div>';
    }

    return `<div class="doc-list">${items.map((project) => `
      <button class="doc-row" type="button" data-action="open-project" data-id="${escapeHtml(project.id)}">
        <span class="doc-icon">${project.status === "generated" ? "P" : "▤"}</span>
        <span class="doc-main">
          <h3>${escapeHtml(project.documentName || "Documento")}</h3>
          <p>${escapeHtml(project.unitId)} · ${escapeHtml(project.processCode)} · ${new Date(project.updatedAt).toLocaleDateString()}</p>
        </span>
        <span class="status ${statusClass(project.status)}">${statusLabel(project.status)}</span>
      </button>
    `).join("")}</div>`;
  }

  function renderHome() {
    setHeader("Documentos", "Inicio", false);
    const generated = state.projects.filter((item) => item.status === "generated").length;
    const drafts = state.projects.filter((item) => item.status === "draft" || item.status === "analyzed").length;
    const activeTemplates = state.templates.filter((item) => item.active && item.documentId).length;

    view.innerHTML = `
      <div class="hero">
        <section class="hero-copy">
          <h2>Plantilla → PDF.</h2>
          <p>Elige el documento. La plantilla decide qué datos pedir.</p>
        </section>
        <section class="hero-side">
          <div class="quick-line"><span>PDF</span><b>${generated}</b></div>
          <div class="quick-line"><span>Borradores</span><b>${drafts}</b></div>
          <div class="quick-line"><span>Plantillas activas</span><b>${activeTemplates}</b></div>
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
      <div class="process-grid">${state.unit.processes.map((process) => `
        <button class="process-card" type="button" data-action="open-process" data-id="${escapeHtml(process.id)}">
          <span class="process-code">${escapeHtml(process.code)}</span>
          <h3>${escapeHtml(process.name)}</h3>
          <span class="process-count">${process.documents.length} documentos</span>
        </button>
      `).join("")}</div>
    `;
  }

  function renderProcess() {
    if (!state.unit || !state.process) return navigate("home", {}, false);
    setHeader(state.process.name, `${state.unit.short} / ${state.process.code}`, true);

    view.innerHTML = `
      <div class="section-head"><div><h2>Documentos</h2><p>${escapeHtml(state.process.fullName)}</p></div></div>
      <div class="doc-list">${state.process.documents.map((document) => {
        const template = activeTemplate(document.id);
        const templateText = document.mode === "upload"
          ? "Archivo"
          : template
            ? `Plantilla v${template.version} lista`
            : "Falta plantilla";
        return `
          <button class="doc-row" type="button" data-action="new-document" data-id="${escapeHtml(document.id)}">
            <span class="doc-icon">${document.mode === "upload" ? "⇧" : template ? "✓" : "W"}</span>
            <span class="doc-main"><h3>${escapeHtml(document.name)}</h3><p>${escapeHtml(document.code)} · ${escapeHtml(templateText)}</p></span>
            <span class="doc-arrow">→</span>
          </button>
        `;
      }).join("")}</div>
    `;
  }

  function fileList(kind, markerName) {
    const items = (state.project.attachments || []).filter((item) =>
      item.kind === kind && (markerName == null || item.markerName === markerName)
    );
    if (!items.length) return "";

    return `<div class="file-list">${items.map((item) => `
      <div class="file-chip">
        <div><b>${escapeHtml(item.name)}</b><small>${Math.max(1, Math.round((item.size || 0) / 1024))} KB</small></div>
        <button type="button" data-action="remove-file" data-id="${escapeHtml(item.id)}" aria-label="Quitar">×</button>
      </div>
    `).join("")}</div>`;
  }

  function scalarField(marker) {
    const value = state.project.formData && state.project.formData[marker.name] != null
      ? state.project.formData[marker.name]
      : "";
    const required = marker.required ? " *" : "";

    if (marker.type === "TEXTO") {
      return `<div class="field full">
        <label>${escapeHtml(marker.label)}${required}</label>
        <textarea data-field="${escapeHtml(marker.name)}">${escapeHtml(value)}</textarea>
      </div>`;
    }

    const type = marker.type === "FECHA" ? "date" : marker.type === "NUMERO" ? "number" : "text";
    return `<div class="field">
      <label>${escapeHtml(marker.label)}${required}</label>
      <input data-field="${escapeHtml(marker.name)}" type="${type}" value="${escapeHtml(value)}" />
    </div>`;
  }

  function uploadField(marker) {
    const isData = marker.type === "DATOS";
    const kind = isData ? "data" : "evidence";
    const multiple = marker.type !== "IMAGEN";
    const hint = isData ? "Excel · CSV" : multiple ? "Varias imágenes" : "Una imagen";
    return `<div class="field-card">
      <div class="field-card-head"><b>${escapeHtml(marker.label)}${marker.required ? " *" : ""}</b><span>${hint}</span></div>
      <button class="upload-button" type="button" data-action="add-files" data-kind="${kind}" data-marker="${escapeHtml(marker.name)}" data-multiple="${multiple ? "true" : "false"}">
        <b>+ Subir</b><span>${hint}</span>
      </button>
      ${fileList(kind, marker.name)}
    </div>`;
  }

  function tableField(marker) {
    const columns = marker.columns && marker.columns.length ? marker.columns : ["Dato"];
    const rows = Array.isArray(state.project.formData && state.project.formData[marker.name])
      ? state.project.formData[marker.name]
      : [];

    return `<div class="field-card table-field full">
      <div class="field-card-head">
        <b>${escapeHtml(marker.label)}${marker.required ? " *" : ""}</b>
        <button class="ghost small-inline" type="button" data-action="add-table-row" data-marker="${escapeHtml(marker.name)}">+ Fila</button>
      </div>
      <div class="table-wrap">
        <table class="mini-table">
          <thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}<th></th></tr></thead>
          <tbody>
            ${rows.length ? rows.map((row, rowIndex) => `
              <tr>
                ${columns.map((column) => `<td><input data-table-marker="${escapeHtml(marker.name)}" data-row="${rowIndex}" data-column="${escapeHtml(column)}" value="${escapeHtml(row && row[column] != null ? row[column] : "")}" /></td>`).join("")}
                <td><button class="table-remove" type="button" data-action="remove-table-row" data-marker="${escapeHtml(marker.name)}" data-row="${rowIndex}">×</button></td>
              </tr>
            `).join("") : `<tr><td colspan="${columns.length + 1}" class="table-empty">Sin filas</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  function dynamicFields() {
    const template = state.project.template;
    if (!template) return "";
    const fields = template.fields || [];
    if (!fields.length) return '<div class="empty"><b>Sin datos manuales</b>Esta plantilla se completa automáticamente.</div>';

    return `<div class="dynamic-fields">
      <div class="form-grid">
        ${fields.filter((marker) => ["CAMPO", "TEXTO", "FECHA", "NUMERO"].includes(marker.type)).map(scalarField).join("")}
      </div>
      ${fields.filter((marker) => ["DATOS", "IMAGEN", "IMAGENES"].includes(marker.type)).map(uploadField).join("")}
      ${fields.filter((marker) => marker.type === "TABLA").map(tableField).join("")}
    </div>`;
  }

  function templateStatus(template) {
    if (!template) return "";
    const errors = template.validation && template.validation.errors ? template.validation.errors : [];
    const warnings = template.validation && template.validation.warnings ? template.validation.warnings : [];
    if (errors.length) {
      return `<div class="notice-error"><b>Plantilla con error</b><span>${escapeHtml(errors[0])}</span></div>`;
    }
    if (warnings.length) {
      return `<div class="notice-warn"><b>Plantilla lista con aviso</b><span>${escapeHtml(warnings[0])}</span></div>`;
    }
    return "";
  }

  function outputsHtml() {
    const outputs = (state.project.outputs || []).filter((item) => item.path);
    if (!outputs.length) return "";

    const pdf = outputs.find((item) => item.type === "pdf");
    const word = outputs.find((item) => item.type === "docx");

    return `<section class="panel output-panel">
      <div class="output-main">
        <span class="pdf-mark">PDF</span>
        <div><h2>Documento listo</h2><p>${pdf ? escapeHtml(pdf.path) : ""}</p></div>
        ${pdf ? `<button class="primary" type="button" data-action="open-output" data-path="${escapeHtml(pdf.path)}">Abrir PDF</button>` : ""}
      </div>
      <div class="button-row end">
        ${pdf ? `<button class="ghost" type="button" data-action="show-output" data-path="${escapeHtml(pdf.path)}">Carpeta</button>` : ""}
        ${word ? `<button class="ghost" type="button" data-action="open-output" data-path="${escapeHtml(word.path)}">Word</button>` : ""}
      </div>
    </section>`;
  }

  function renderUploadDocument() {
    setHeader(state.document.name, `${state.unit.short} / ${state.process.code}`, true);
    view.innerHTML = `
      <div class="editor-grid">
        <section class="panel">
          <div class="panel-title"><div><h2>${escapeHtml(state.document.name)}</h2><small>${escapeHtml(state.document.code)}</small></div><span class="status ${statusClass(state.project.status)}">${statusLabel(state.project.status)}</span></div>
          <div class="empty"><b>Archivo académico</b>Sube el documento y guárdalo localmente.</div>
        </section>
        <aside>
          <section class="panel compact">
            <button class="upload-button" type="button" data-action="add-files" data-kind="source" data-marker="" data-multiple="false"><b>+ Archivo</b><span>Word · PDF</span></button>
            ${fileList("source", "")}
          </section>
          <button class="primary" style="width:100%" type="button" data-action="archive-upload">Guardar</button>
        </aside>
      </div>`;
  }

  function renderEditor() {
    if (!state.document || !state.project) return navigate("home", {}, false);
    if (state.document.mode === "upload") return renderUploadDocument();

    setHeader(state.document.name, `${state.unit.short} / ${state.process.code}`, true);
    const template = state.project.template;
    if (!template) {
      view.innerHTML = `
        <section class="panel template-needed">
          <span class="word-mark">W</span>
          <h2>Falta la plantilla</h2>
          <p>Sube el Word de este documento. La app detectará sus campos.</p>
          <button class="primary" type="button" data-action="import-template">+ Plantilla Word</button>
        </section>`;
      return;
    }

    const aiCount = (template.aiFields || []).length;
    const fieldCount = (template.fields || []).length;
    const sourceCount = (state.project.attachments || []).filter((item) => item.kind === "source").length;

    view.innerHTML = `
      <div class="editor-grid">
        <section class="panel">
          <div class="panel-title">
            <div><h2>Datos</h2><small>${fieldCount} campos · plantilla v${template.version}</small></div>
            <span class="status ${statusClass(state.project.status)}">${statusLabel(state.project.status)}</span>
          </div>
          ${templateStatus(template)}
          ${dynamicFields()}
        </section>

        <aside>
          <section class="panel compact">
            <div class="panel-title"><h3>Plantilla</h3><button class="ghost" type="button" data-action="import-template">Cambiar</button></div>
            <div class="template-summary"><b>${escapeHtml(template.name)}</b><span>${(template.markers || []).length} campos detectados</span></div>
          </section>

          ${aiCount ? `
            <section class="panel compact">
              <div class="panel-title"><h3>IA</h3><span class="status good">${aiCount} campos</span></div>
              <div class="mode-row">
                <label class="mode-option">
                  <input type="radio" name="aiMode" value="fallback" ${state.project.aiMode !== "deep" ? "checked" : ""}>
                  <b>Automático</b><small>Con respaldo</small>
                </label>
                <label class="mode-option">
                  <input type="radio" name="aiMode" value="deep" ${state.project.aiMode === "deep" ? "checked" : ""}>
                  <b>Profundo</b><small>Varias IAs</small>
                </label>
              </div>
            </section>

            <section class="panel compact">
              <div class="panel-title"><h3>Fuentes</h3><span class="status">${sourceCount}</span></div>
              <button class="upload-button" type="button" data-action="add-files" data-kind="source" data-marker="" data-multiple="true"><b>+ Documentos</b><span>Word · PDF</span></button>
              ${fileList("source", "")}
            </section>
          ` : ""}

          <button class="primary generate-pdf" type="button" data-action="generate">Generar PDF</button>
        </aside>
      </div>
      ${outputsHtml()}
    `;
  }

  function renderLibrary(filter) {
    setHeader("Documentos", "Biblioteca local", false);
    const term = String(filter || "").toLowerCase();
    const items = term
      ? state.projects.filter((project) => `${project.documentName} ${project.unitId} ${project.processCode}`.toLowerCase().includes(term))
      : state.projects;

    view.innerHTML = `
      <div class="search-wrap"><input class="search-input" id="librarySearch" type="search" placeholder="Buscar" value="${escapeHtml(filter || "")}" /></div>
      ${projectRows(items)}
    `;
  }

  function documentOptionList(selected) {
    const options = catalog.allDocuments().map(({ unit, process, document }) => {
      const label = `${unit.short} · ${process.code} · ${document.name}`;
      return `<option value="${escapeHtml(document.id)}" ${document.id === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
    });
    return `<option value="">Asignar documento...</option>${options.join("")}`;
  }

  function renderTemplates() {
    setHeader("Plantillas", "Word", false);
    view.innerHTML = `
      <section class="panel compact">
        <div class="panel-title">
          <div><h2>Plantillas</h2><small>${state.templates.length} guardadas</small></div>
          <button class="primary" type="button" data-action="import-template-global">+ Word</button>
        </div>

        ${state.templates.length ? `<div class="doc-list">${state.templates.map((item) => {
          const found = item.documentId ? catalog.findDocument(item.documentId) : null;
          const label = found ? `${found.unit.short} · ${found.process.code} · ${found.document.name}` : "Sin asignar";
          const count = (item.markers || []).length;
          const hasError = item.validation && item.validation.errors && item.validation.errors.length;
          return `
            <div class="template-card template-card-wide">
              <span class="icon">W</span>
              <div>
                <h3>${escapeHtml(item.name)}</h3>
                <p>${escapeHtml(label)} · v${item.version} · ${count} campos</p>
                ${!item.documentId ? `<div class="assign-row"><select id="assign-${escapeHtml(item.id)}">${documentOptionList("")}</select><button class="secondary" type="button" data-action="assign-template" data-id="${escapeHtml(item.id)}">Asignar</button></div>` : ""}
              </div>
              <span class="status ${hasError ? "error" : item.active ? "good" : ""}">${hasError ? "Error" : item.active ? "Activa" : "Anterior"}</span>
            </div>
          `;
        }).join("")}</div>` : '<div class="empty"><b>Sin plantillas</b>Sube un Word con marcadores {{...}}.</div>'}
      </section>
    `;
  }

  function renderAi() {
    setHeader("IA", "Proveedores", false);
    view.innerHTML = `
      <div class="section-head"><div><h2>Proveedores</h2><p>Respaldo automático.</p></div><button class="primary" type="button" data-action="save-ai">Guardar</button></div>
      <div class="provider-list">${state.aiProviders.map((provider) => `
        <section class="provider-card" data-provider="${escapeHtml(provider.id)}">
          <div class="provider-head">
            <div><h3>${escapeHtml(provider.name)}</h3><span class="status ${provider.hasKey ? "good" : ""}">${provider.hasKey ? "Clave guardada" : "Sin clave"}</span></div>
            <label class="switch"><input data-ai="enabled" type="checkbox" ${provider.enabled ? "checked" : ""}><span class="slider"></span></label>
          </div>
          <div class="provider-grid">
            <div class="field"><label>Modelo</label><input data-ai="model" type="text" value="${escapeHtml(provider.model)}" /></div>
            <div class="field"><label>Prioridad</label><input data-ai="priority" type="number" min="1" max="9" value="${escapeHtml(provider.priority)}" /></div>
            <div class="field full"><label>Endpoint</label><input data-ai="endpoint" type="text" value="${escapeHtml(provider.endpoint)}" /></div>
            <div class="field full"><label>API key</label><input data-ai="apiKey" type="password" placeholder="${provider.hasKey ? "Guardada · deja vacío para conservar" : "Pega tu clave"}" /></div>
          </div>
        </section>
      `).join("")}</div>
    `;
  }

  function signerFields(key, label, person) {
    return `<div class="panel compact">
      <div class="panel-title"><h3>${label}</h3></div>
      <div class="form-grid">
        <div class="field"><label>Nombre</label><input data-setting="${key}.nombre" value="${escapeHtml(person.nombre)}" /></div>
        <div class="field"><label>Cargo</label><input data-setting="${key}.cargo" value="${escapeHtml(person.cargo)}" /></div>
      </div>
    </div>`;
  }

  function renderSettings() {
    setHeader("Ajustes", "Local", false);
    const settings = state.settings || {
      signers: { elaboradoPor: {}, revisadoPor: {}, aprobadoPor: {} },
      generation: {}
    };

    view.innerHTML = `
      <div class="section-head"><div><h2>Firmas</h2></div><button class="primary" type="button" data-action="save-settings">Guardar</button></div>
      ${signerFields("elaboradoPor", "Elaborado por", settings.signers.elaboradoPor)}
      ${signerFields("revisadoPor", "Revisado por", settings.signers.revisadoPor)}
      ${signerFields("aprobadoPor", "Aprobado por", settings.signers.aprobadoPor)}
      <section class="panel compact">
        <div class="panel-title"><h3>Generación</h3></div>
        <div class="form-grid">
          <div class="field"><label>IA</label><select id="defaultAiMode"><option value="fallback" ${settings.generation.defaultAiMode !== "deep" ? "selected" : ""}>Automático</option><option value="deep" ${settings.generation.defaultAiMode === "deep" ? "selected" : ""}>Profundo</option></select></div>
          <div class="field"><label>Abrir PDF</label><select id="openAfterGenerate"><option value="yes" ${settings.generation.openAfterGenerate ? "selected" : ""}>Sí</option><option value="no" ${!settings.generation.openAfterGenerate ? "selected" : ""}>No</option></select></div>
        </div>
      </section>
      <section class="panel compact">
        <div class="panel-title"><h3>Datos</h3><span class="status ${state.sync && state.sync.enabled ? "good" : "warn"}">${state.sync && state.sync.enabled ? "Sincronización activa" : "Externa pendiente"}</span></div>
        <div class="quick-line"><span>Base local</span><b>SQLite</b></div>
        <div class="quick-line"><span>Base externa</span><b>${state.sync && state.sync.provider ? escapeHtml(state.sync.provider) : "Pendiente"}</b></div>
      </section>
    `;
  }

  function collectFormData() {
    const data = Object.assign({}, state.project && state.project.formData || {});
    document.querySelectorAll("[data-field]").forEach((input) => {
      data[input.dataset.field] = input.value;
    });
    return data;
  }

  async function persistEditor() {
    if (!state.project) return;
    state.project.formData = collectFormData();
    const mode = document.querySelector('input[name="aiMode"]:checked');
    if (mode) state.project.aiMode = mode.value;
    const response = await api.saveProject(state.project);
    if (response && response.ok) state.project = response.project;
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persistEditor(), 450);
  }

  async function importTemplate(globalOnly) {
    const association = globalOnly || !state.document
      ? null
      : {
          unitId: state.unit.id,
          processId: state.process.id,
          documentId: state.document.id
        };

    const response = await api.importTemplate(association);
    if (!response || response.canceled) return;
    if (!response.ok) return showToast(response.error || "No se pudo importar.");

    await loadTemplates();

    if (!globalOnly && state.project) {
      state.project.template = response.template;
      state.project.analysis = null;
      state.project.status = "draft";
      await api.saveProject(state.project);
      renderEditor();
    } else {
      renderTemplates();
    }

    const errors = response.template.validation && response.template.validation.errors || [];
    showToast(errors.length ? errors[0] : "Plantilla guardada.");
  }

  async function assignTemplate(templateId) {
    const select = document.getElementById(`assign-${templateId}`);
    if (!select || !select.value) return showToast("Selecciona el documento.");
    const found = catalog.findDocument(select.value);
    if (!found) return showToast("Documento no válido.");

    const response = await api.updateTemplate(templateId, {
      unitId: found.unit.id,
      processId: found.process.id,
      documentId: found.document.id,
      active: true
    });

    if (!response || !response.ok) return showToast(response && response.error ? response.error : "No se pudo asignar.");
    await loadTemplates();
    renderTemplates();
    showToast("Plantilla asignada.");
  }

  async function addFiles(kind, markerName, multiple) {
    await persistEditor();
    setBusy(true);
    const response = await api.addFiles(state.project.id, kind, markerName || "", multiple);
    setBusy(false);
    if (!response || response.canceled) return;
    if (!response.ok) return showToast(response.error || "No se pudo agregar.");
    state.project = response.project;
    renderEditor();
  }

  async function removeFile(id) {
    const response = await api.removeFile(state.project.id, id);
    if (response && response.ok) {
      state.project = response.project;
      renderEditor();
    }
  }

  async function generatePdf() {
    await persistEditor();
    setBusy(true);
    const button = document.querySelector('[data-action="generate"]');
    if (button) button.innerHTML = '<span class="loading"><span class="spinner"></span>Generando PDF</span>';

    const response = await api.generate(state.project.id);
    setBusy(false);

    if (!response || !response.ok) {
      renderEditor();
      return showToast(response && response.error ? response.error : "No se pudo generar el PDF.");
    }

    state.project = response.project;
    renderEditor();
    showToast(`PDF generado con ${response.result.engine}.`);
  }

  async function archiveUpload() {
    await persistEditor();
    const response = await api.archiveUpload(state.project.id);
    if (!response || !response.ok) return showToast(response && response.error ? response.error : "No se pudo guardar.");
    state.project = response.project;
    renderEditor();
    showToast("Archivo guardado.");
  }

  function addTableRow(markerName) {
    const marker = (state.project.template.fields || []).find((item) => item.name === markerName && item.type === "TABLA");
    if (!marker) return;
    const rows = Array.isArray(state.project.formData[markerName]) ? state.project.formData[markerName].slice() : [];
    const row = {};
    (marker.columns && marker.columns.length ? marker.columns : ["Dato"]).forEach((column) => { row[column] = ""; });
    rows.push(row);
    state.project.formData[markerName] = rows;
    api.saveProject(state.project).then((response) => {
      if (response && response.ok) state.project = response.project;
      renderEditor();
    });
  }

  function removeTableRow(markerName, rowIndex) {
    const rows = Array.isArray(state.project.formData[markerName]) ? state.project.formData[markerName].slice() : [];
    rows.splice(Number(rowIndex), 1);
    state.project.formData[markerName] = rows;
    api.saveProject(state.project).then((response) => {
      if (response && response.ok) state.project = response.project;
      renderEditor();
    });
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
    const signers = { elaboradoPor: {}, revisadoPor: {}, aprobadoPor: {} };
    document.querySelectorAll("[data-setting]").forEach((input) => {
      const parts = input.dataset.setting.split(".");
      signers[parts[0]][parts[1]] = input.value.trim();
    });

    const response = await api.saveSettings({
      signers,
      generation: {
        defaultAiMode: document.getElementById("defaultAiMode").value,
        openAfterGenerate: document.getElementById("openAfterGenerate").value === "yes",
        includeSourceTrace: false
      }
    });

    if (response && response.ok) {
      state.settings = response.settings;
      showToast("Ajustes guardados.");
    }
  }

  view.addEventListener("input", (event) => {
    if (event.target.matches("[data-field]")) scheduleSave();

    if (event.target.matches("[data-table-marker]")) {
      const markerName = event.target.dataset.tableMarker;
      const rowIndex = Number(event.target.dataset.row);
      const column = event.target.dataset.column;
      const rows = Array.isArray(state.project.formData[markerName]) ? state.project.formData[markerName] : [];
      if (!rows[rowIndex]) rows[rowIndex] = {};
      rows[rowIndex][column] = event.target.value;
      state.project.formData[markerName] = rows;
      scheduleSave();
    }

    if (event.target.id === "librarySearch") renderLibrary(event.target.value);
  });

  view.addEventListener("change", (event) => {
    if (event.target.matches("[data-field], input[name='aiMode']")) scheduleSave();
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
    if (action === "import-template") return importTemplate(false);
    if (action === "import-template-global") return importTemplate(true);
    if (action === "assign-template") return assignTemplate(button.dataset.id);
    if (action === "add-files") return addFiles(button.dataset.kind, button.dataset.marker || "", button.dataset.multiple !== "false");
    if (action === "remove-file") return removeFile(button.dataset.id);
    if (action === "add-table-row") return addTableRow(button.dataset.marker);
    if (action === "remove-table-row") return removeTableRow(button.dataset.marker, button.dataset.row);
    if (action === "generate") return generatePdf();
    if (action === "archive-upload") return archiveUpload();
    if (action === "save-ai") return saveAi();
    if (action === "save-settings") return saveSettingsFromScreen();
    if (action === "open-output") return api.openFile(button.dataset.path);
    if (action === "show-output") return api.showFile(button.dataset.path);
  });

  backButton.addEventListener("click", goBack);

  async function init() {
    if (!api) {
      view.innerHTML = '<div class="empty"><b>Electron no disponible</b>Ejecuta la app con npm start.</div>';
      return;
    }

    document.getElementById("appVersion").textContent = `v${api.version}`;
    await Promise.all([loadSettings(), loadTemplates(), loadProjects()]);
    renderHome();
  }

  init();
})();
