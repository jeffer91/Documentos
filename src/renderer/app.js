(function () {
  "use strict";

  let catalog = null;
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
    sync: null,
    errors: [],
    errorCount: 0,
    versions: [],
    busy: false,
    editorGuide: null,
    saveState: "saved",
    requirements: null,
    externalAi: {
      templateId: "",
      guide: "",
      mode: "manual_ai",
      fieldsText: "",
      prompt: "",
      response: "",
      preview: null,
      canUndo: false
    }
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

  function prepareCatalog(data) {
    const units = data && Array.isArray(data.units) ? data.units : [];
    return {
      units,
      findUnit(unitId) {
        return units.find((unit) => unit.id === unitId) || null;
      },
      findProcess(processId) {
        for (const unit of units) {
          const process = (unit.processes || []).find((item) => item.id === processId);
          if (process) return { unit, process };
        }
        return null;
      },
      findDocument(documentId) {
        for (const unit of units) {
          for (const process of unit.processes || []) {
            const document = (process.documents || []).find((item) => item.id === documentId);
            if (document) return { unit, process, document };
          }
        }
        return null;
      },
      allDocuments() {
        return units.flatMap((unit) =>
          (unit.processes || []).flatMap((process) =>
            (process.documents || []).map((document) => ({ unit, process, document }))
          )
        );
      }
    };
  }

  async function loadCatalog() {
    const response = await api.getCatalog();
    if (!response || !response.ok || !response.catalog) {
      throw new Error("No se pudo cargar el catálogo local.");
    }
    catalog = prepareCatalog(response.catalog);
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


  async function loadSync() {
    const response = await api.getSyncStatus();
    state.sync = response && response.ok ? response.sync : null;
  }

  function updateErrorBadge() {
    const badge = document.getElementById("errorBadge");
    if (!badge) return;
    badge.textContent = String(state.errorCount || 0);
    badge.hidden = !state.errorCount;
  }

  async function refreshErrorCount() {
    const response = await api.getErrorCount();
    state.errorCount = response && response.ok ? Number(response.count || 0) : 0;
    updateErrorBadge();
  }

  async function loadErrors() {
    const response = await api.listErrors({ includeResolved: false, limit: 100 });
    state.errors = response && response.ok ? response.errors || [] : [];
    state.errorCount = response && response.ok ? Number(response.count || 0) : 0;
    updateErrorBadge();
  }

  async function loadVersions() {
    if (!state.project) {
      state.versions = [];
      return;
    }
    const response = await api.listVersions(state.project.id);
    state.versions = response && response.ok ? response.versions || [] : [];
  }

  async function loadRequirements() {
    if (!state.project || !state.project.template) {
      state.requirements = null;
      return;
    }
    const response = await api.getTemplateRequirements(state.project.id);
    state.requirements = response && response.ok ? response.data || null : null;
  }

  function resetExternalAi() {
    state.externalAi = {
      templateId: state.project && state.project.template ? state.project.template.id : "",
      guide: "",
      mode: "manual_ai",
      fieldsText: "",
      prompt: "",
      response: "",
      preview: null,
      canUndo: false
    };
  }

  async function loadExternalAi() {
    if (!state.project || !state.project.template) {
      resetExternalAi();
      return;
    }

    const currentMode = "manual_ai";
    const previousResponse = state.externalAi && state.externalAi.templateId === state.project.template.id
      ? state.externalAi.response || ""
      : "";

    const guideResponse = await api.getExternalAiGuide(state.project.id);
    const data = guideResponse && guideResponse.ok ? guideResponse.data || {} : {};
    state.externalAi = {
      templateId: state.project.template.id,
      guide: data.guide || "",
      mode: currentMode,
      fieldsText: "",
      prompt: "",
      response: previousResponse,
      preview: null,
      canUndo: Boolean(data.canUndo)
    };

    const promptResponse = await api.buildExternalAiPrompt(
      state.project.id,
      "manual_ai",
      state.externalAi.guide
    );
    if (promptResponse && promptResponse.ok && promptResponse.data) {
      state.externalAi.fieldsText = promptResponse.data.fieldsText || "";
      state.externalAi.prompt = promptResponse.data.prompt || "";
      state.externalAi.manualCount = Number(promptResponse.data.manualCount || 0);
      state.externalAi.aiCount = Number(promptResponse.data.aiCount || 0);
      state.externalAi.tableCount = Number(promptResponse.data.tableCount || 0);
      state.externalAi.fieldCount = Number(promptResponse.data.fieldCount || 0);
    }
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
            aiMode: "external"
          });
          if (response && response.ok) state.project = response.project;
        }
      }

      setNav("home");
      await Promise.all([loadVersions(), loadExternalAi(), loadRequirements()]);
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

    if (route === "settings") {
      setNav("settings");
      await Promise.all([loadSettings(), loadSync()]);
      renderSettings();
      return;
    }

    if (route === "system") {
      setNav("system");
      await loadErrors();
      renderSystem();
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

        if (document.mode === "upload") {
          return `
            <button class="doc-row" type="button" data-action="new-document" data-id="${escapeHtml(document.id)}">
              <span class="doc-icon">⇧</span>
              <span class="doc-main"><h3>${escapeHtml(document.name)}</h3><p>${escapeHtml(document.code)} · Archivo</p></span>
              <span class="doc-arrow">→</span>
            </button>
          `;
        }

        return `
          <div class="doc-row doc-row-manage">
            <button class="doc-open-zone" type="button" data-action="new-document" data-id="${escapeHtml(document.id)}">
              <span class="doc-icon">${template ? "✓" : "W"}</span>
              <span class="doc-main"><h3>${escapeHtml(document.name)}</h3><p>${escapeHtml(document.code)} · ${escapeHtml(templateText)}</p></span>
            </button>
            <div class="doc-template-actions">
              ${template ? `
                <button class="ghost small-inline" type="button" data-action="replace-template-document" data-template-id="${escapeHtml(template.id)}" data-document-id="${escapeHtml(document.id)}">Reemplazar</button>
                <button class="danger-button small-inline" type="button" data-action="delete-template" data-template-id="${escapeHtml(template.id)}">Eliminar</button>
              ` : `
                <button class="secondary small-inline" type="button" data-action="upload-template-document" data-document-id="${escapeHtml(document.id)}">+ Plantilla</button>
              `}
              <button class="doc-arrow-button" type="button" data-action="new-document" data-id="${escapeHtml(document.id)}" aria-label="Abrir documento">→</button>
            </div>
          </div>
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

    if (marker.type === "LISTA") {
      const options = marker.options || [];
      return `<div class="field">
        <label>${escapeHtml(marker.label)}${required}</label>
        <select data-field="${escapeHtml(marker.name)}">
          <option value="">Selecciona</option>
          ${options.map((option) => `<option value="${escapeHtml(option)}" ${String(value) === String(option) ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
        </select>
      </div>`;
    }

    if (marker.type === "BUSCAR") {
      return `<div class="field">
        <label>${escapeHtml(marker.label)}${required}</label>
        <input data-field="${escapeHtml(marker.name)}" type="text" value="${escapeHtml(value)}" placeholder="Buscar o escribir" />
        <small>Fuente: ${escapeHtml(marker.lookupSource || "pendiente")}</small>
      </div>`;
    }

    const type = marker.type === "FECHA" ? "date" : marker.type === "NUMERO" ? "number" : "text";
    return `<div class="field">
      <label>${escapeHtml(marker.label)}${required}</label>
      <input data-field="${escapeHtml(marker.name)}" type="${type}" value="${escapeHtml(value)}" />
    </div>`;
  }

  function derivedField(marker) {
    const value = state.project.formData && state.project.formData[marker.name] != null
      ? state.project.formData[marker.name]
      : "";
    return `<div class="field derived-field">
      <label>${escapeHtml(marker.label)}${marker.required ? " *" : ""}</label>
      <div class="derived-value">${value === "" ? "Pendiente de calcular" : escapeHtml(value)}</div>
      <small>${escapeHtml(marker.formula || marker.config || "")}</small>
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

  function tableInput(marker, column, row, rowIndex) {
    const value = row && row[column.label] != null ? row[column.label] : "";
    const type = column.type === "FECHA" ? "date" : column.type === "NUMERO" ? "number" : "text";
    return `<input
      data-table-marker="${escapeHtml(marker.name)}"
      data-row="${rowIndex}"
      data-column="${escapeHtml(column.label)}"
      type="${type}"
      value="${escapeHtml(value)}"
    />`;
  }

  function tableField(marker) {
    const defs = marker.columnDefs && marker.columnDefs.length
      ? marker.columnDefs
      : (marker.columns && marker.columns.length ? marker.columns : ["Dato"]).map((label) => ({ label, type: "CAMPO" }));
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
          <thead><tr>${defs.map((column) => `<th>${escapeHtml(column.label)}<small>${escapeHtml(column.type)}</small></th>`).join("")}<th></th></tr></thead>
          <tbody>
            ${rows.length ? rows.map((row, rowIndex) => `
              <tr>
                ${defs.map((column) => `<td>${tableInput(marker, column, row, rowIndex)}</td>`).join("")}
                <td><button class="table-remove" type="button" data-action="remove-table-row" data-marker="${escapeHtml(marker.name)}" data-row="${rowIndex}">×</button></td>
              </tr>
            `).join("") : `<tr><td colspan="${defs.length + 1}" class="table-empty">Sin filas</td></tr>`}
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

    const calculated = fields.filter((marker) => marker.type === "CALC");
    return `<div class="dynamic-fields">
      <div class="form-grid">
        ${fields.filter((marker) => ["CAMPO", "TEXTO", "FECHA", "NUMERO", "LISTA", "BUSCAR"].includes(marker.type)).map(scalarField).join("")}
      </div>
      ${fields.filter((marker) => ["DATOS", "IMAGEN", "IMAGENES"].includes(marker.type)).map(uploadField).join("")}
      ${fields.filter((marker) => marker.type === "TABLA").map(tableField).join("")}
      ${calculated.length ? `
        <div class="derived-section">
          <div class="field-card-head">
            <div><b>Campos calculados</b><span>Se obtienen de otros campos o datos.</span></div>
            <button class="ghost small-inline" type="button" data-action="recalculate">Recalcular</button>
          </div>
          <div class="form-grid">${calculated.map(derivedField).join("")}</div>
        </div>
      ` : ""}
    </div>`;
  }


  const GUIDE_MANUAL_TYPES = new Set(["CAMPO", "TEXTO", "FECHA", "NUMERO", "LISTA", "BUSCAR", "DATOS", "TABLA", "IMAGEN", "IMAGENES"]);

  function manualTemplateFields(template) {
    return (template && template.fields || []).filter((field) => field.valid !== false && GUIDE_MANUAL_TYPES.has(field.type));
  }

  function fieldValue(marker) {
    return state.project && state.project.formData && state.project.formData[marker.name] != null
      ? state.project.formData[marker.name]
      : "";
  }

  function fieldIsComplete(marker) {
    if (!marker) return false;
    if (["DATOS", "IMAGEN", "IMAGENES"].includes(marker.type)) {
      const kind = marker.type === "DATOS" ? "data" : "evidence";
      return (state.project.attachments || []).some((item) => item.kind === kind && item.markerName === marker.name);
    }
    if (marker.type === "TABLA") {
      const rows = fieldValue(marker);
      const defs = Array.isArray(marker.columnDefs) ? marker.columnDefs : [];
      return Array.isArray(rows) && rows.some((row) =>
        defs.length
          ? defs.some((column) => String(row && row[column.label] == null ? "" : row[column.label]).trim() !== "")
          : Object.values(row || {}).some((cell) => String(cell == null ? "" : cell).trim() !== "")
      );
    }
    const value = fieldValue(marker);
    return value != null && String(value).trim() !== "";
  }

  function completionFor(fields) {
    const list = (fields || []).filter(Boolean);
    const completed = list.filter(fieldIsComplete).length;
    return {
      total: list.length,
      completed,
      percent: list.length ? Math.round((completed / list.length) * 100) : 100
    };
  }

  function guideStorageKey() {
    return state.project ? `documentos-guide-${state.project.id}` : "";
  }

  function loadGuidePosition(stepCount) {
    const key = guideStorageKey();
    let saved = null;
    try { saved = key ? JSON.parse(localStorage.getItem(key) || "null") : null; } catch (_error) { saved = null; }
    return {
      projectId: state.project && state.project.id,
      step: Math.max(0, Math.min(Number(saved && saved.step || 0), Math.max(0, stepCount - 1))),
      career: Math.max(0, Number(saved && saved.career || 0))
    };
  }

  function persistGuidePosition() {
    if (!state.editorGuide || !state.project) return;
    try {
      localStorage.setItem(guideStorageKey(), JSON.stringify({
        step: state.editorGuide.step || 0,
        career: state.editorGuide.career || 0
      }));
    } catch (_error) { /* almacenamiento opcional */ }
  }

  function careerGroups(template) {
    const groups = new Map();
    const manual = manualTemplateFields(template);
    manual.forEach((field) => {
      const match = String(field.name || "").match(/^([A-Z0-9]+)_(N|TIPO|REC|PCT)(\d+)$/);
      if (!match) return;
      const prefix = match[1];
      const group = groups.get(prefix) || { prefix, fields: [], indexes: new Set() };
      group.fields.push(field);
      group.indexes.add(Number(match[3]));
      groups.set(prefix, group);
    });

    const aiFields = template && template.aiFields || [];
    return Array.from(groups.values())
      .filter((group) => group.indexes.size >= 5 && group.fields.length >= 15)
      .map((group) => {
        const priority = manual.find((field) => field.name === `CAP_${group.prefix}`) || null;
        const analysis = aiFields.find((field) =>
          field.name === `ANALISIS_${group.prefix}` ||
          (field.name.endsWith(`_${group.prefix}`) && /diagn[oó]stico/i.test(field.label || ""))
        );
        const relation = aiFields.find((field) => field.name === `RELACION_GENERICA_${group.prefix}`);
        if (!priority && !analysis) return null;
        let title = group.prefix;
        const sourceLabel = (analysis && analysis.label) || (relation && relation.label) || (priority && priority.label) || "";
        if (sourceLabel.includes(" - ")) title = sourceLabel.split(" - ").pop().trim();
        else if (priority) title = String(priority.label || "").replace(/^Capacitaci[oó]n priorizada\s*-?\s*/i, "").trim() || group.prefix;
        return {
          prefix: group.prefix,
          title,
          fields: priority ? group.fields.concat(priority) : group.fields,
          priority
        };
      })
      .filter(Boolean);
  }

  function buildEditorPlan(template) {
    const manual = manualTemplateFields(template);
    const careers = careerGroups(template);
    const careerNames = new Set(careers.flatMap((group) => group.fields.map((field) => field.name)));
    const specialDetection = careers.length >= 3 && manual.some((field) => /^INST_/.test(field.name));

    if (!specialDetection) {
      const evidence = manual.filter((field) => ["DATOS", "IMAGEN", "IMAGENES"].includes(field.type));
      const regular = manual.filter((field) => !["DATOS", "IMAGEN", "IMAGENES"].includes(field.type));
      const chunks = [];
      for (let i = 0; i < regular.length; i += 14) {
        chunks.push({
          key: `data-${Math.floor(i / 14) + 1}`,
          title: regular.length > 14 ? `Datos ${Math.floor(i / 14) + 1}` : "Datos",
          subtitle: "Información solicitada por la plantilla",
          where: "Campos del documento",
          kind: "standard",
          fields: regular.slice(i, i + 14)
        });
      }
      if (evidence.length) chunks.push({
        key: "evidence",
        title: "Evidencias y archivos",
        subtitle: "Documentos, datos e imágenes",
        where: "Anexos y fuentes del documento",
        kind: "standard",
        fields: evidence
      });
      chunks.push({
        key: "review",
        title: "Revisión",
        subtitle: "Comprobar y generar",
        where: "Documento completo",
        kind: "review",
        fields: manual
      });
      return { special: false, careers: [], steps: chunks };
    }

    const evidenceNames = /TOTAL_RESPUESTAS_VALIDAS|DESTINATARIOS_CONVOCATORIA|FECHA_CONVOCATORIA/;
    const evidence = manual.filter((field) => ["DATOS", "IMAGEN", "IMAGENES"].includes(field.type) || evidenceNames.test(field.name));
    const institutional = manual.filter((field) => /^INST_/.test(field.name));
    const generic = manual.filter((field) => /^(CAP_GENERICA|CRIT_GEN_|ALT_GEN_|FORT_GEN_|LIM_GEN_|RES_GEN_|ENC_)/.test(field.name));
    const general = manual.filter((field) => field.name === "PERIODO");
    const assigned = new Set([...general, ...institutional, ...generic, ...evidence].map((field) => field.name));
    careerNames.forEach((name) => assigned.add(name));
    const summary = manual.filter((field) => !assigned.has(field.name));

    const steps = [
      {
        key: "general",
        title: "Datos generales",
        subtitle: "Información que se reutiliza en todo el documento",
        where: "Portada, encabezado y alcance temporal",
        kind: "standard",
        fields: general
      },
      {
        key: "institutional",
        title: "Necesidades institucionales",
        subtitle: "Registro consolidado de necesidades recurrentes",
        where: "5.1 · Síntesis general de resultados",
        kind: "institutional",
        fields: institutional
      },
      {
        key: "generic",
        title: "Capacitación genérica",
        subtitle: "Criterios, alternativas y evidencia cuantitativa",
        where: "5.2 · Capacitación genérica institucional",
        kind: "generic",
        fields: generic
      },
      {
        key: "careers",
        title: "Necesidades por carrera",
        subtitle: `${careers.length} carreras detectadas`,
        where: "5 · Resultados del diagnóstico por carrera",
        kind: "careers",
        fields: careers.flatMap((group) => group.fields)
      },
      {
        key: "summary",
        title: "Resumen ejecutivo",
        subtitle: "Caracterización y consolidación final",
        where: "6 · Resumen ejecutivo de resultados",
        kind: "standard",
        fields: summary
      },
      {
        key: "evidence",
        title: "Evidencias y fuentes",
        subtitle: "Archivos, base de datos y soportes",
        where: "10 · Anexos y fuentes del diagnóstico",
        kind: "standard",
        fields: evidence
      },
      {
        key: "review",
        title: "Revisión",
        subtitle: "Comprobar y generar el documento",
        where: "Documento completo",
        kind: "review",
        fields: manual
      }
    ].filter((step) => step.kind === "review" || step.fields.length);

    return { special: true, careers, steps };
  }

  function ensureEditorGuide(plan) {
    if (!state.editorGuide || state.editorGuide.projectId !== (state.project && state.project.id)) {
      state.editorGuide = loadGuidePosition(plan.steps.length);
    }
    state.editorGuide.step = Math.max(0, Math.min(state.editorGuide.step || 0, Math.max(0, plan.steps.length - 1)));
    state.editorGuide.career = Math.max(0, Math.min(state.editorGuide.career || 0, Math.max(0, plan.careers.length - 1)));
    return state.editorGuide;
  }

  function compactControl(marker, className) {
    if (!marker) return '<span class="guide-missing">—</span>';
    const value = fieldValue(marker);
    const cls = className ? ` class="${className}"` : "";
    if (marker.type === "LISTA") {
      return `<select${cls} data-field="${escapeHtml(marker.name)}">
        <option value="">Selecciona</option>
        ${(marker.options || []).map((option) => `<option value="${escapeHtml(option)}" ${String(value) === String(option) ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
      </select>`;
    }
    const type = marker.type === "FECHA" ? "date" : marker.type === "NUMERO" ? "number" : "text";
    if (marker.type === "TEXTO" && className && className.includes("multiline")) {
      return `<textarea${cls} data-field="${escapeHtml(marker.name)}">${escapeHtml(value)}</textarea>`;
    }
    return `<input${cls} data-field="${escapeHtml(marker.name)}" type="${type}" value="${escapeHtml(value)}" />`;
  }

  function guidedScalarField(marker, where) {
    if (["DATOS", "IMAGEN", "IMAGENES"].includes(marker.type)) return uploadField(marker);
    if (marker.type === "TABLA") return tableField(marker);

    const value = fieldValue(marker);
    const required = marker.required ? " *" : "";
    let control = "";
    if (marker.type === "TEXTO") {
      control = `<textarea data-field="${escapeHtml(marker.name)}">${escapeHtml(value)}</textarea>`;
    } else if (marker.type === "LISTA") {
      control = `<select data-field="${escapeHtml(marker.name)}">
        <option value="">Selecciona</option>
        ${(marker.options || []).map((option) => `<option value="${escapeHtml(option)}" ${String(value) === String(option) ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
      </select>`;
    } else if (marker.type === "BUSCAR") {
      control = `<input data-field="${escapeHtml(marker.name)}" type="text" value="${escapeHtml(value)}" placeholder="Buscar o escribir" />`;
    } else {
      const type = marker.type === "FECHA" ? "date" : marker.type === "NUMERO" ? "number" : "text";
      control = `<input data-field="${escapeHtml(marker.name)}" type="${type}" value="${escapeHtml(value)}" />`;
    }

    return `<div class="field guide-field ${marker.type === "TEXTO" ? "full" : ""}">
      <label>${escapeHtml(marker.label)}${required}</label>
      ${control}
      <small class="field-context">Se usa en: ${escapeHtml(where || "documento")}</small>
    </div>`;
  }

  function renderInstitutionalStep(step) {
    const byName = new Map(step.fields.map((field) => [field.name, field]));
    const rows = [1, 2, 3, 4, 5].map((index) => ({
      need: byName.get(`INST_N${index}`),
      presence: byName.get(`INST_PRES${index}`),
      percent: byName.get(`INST_PCT${index}`)
    })).filter((row) => row.need || row.presence || row.percent);

    if (!rows.length) return `<div class="form-grid">${step.fields.map((field) => guidedScalarField(field, step.where)).join("")}</div>`;

    return `
      <div class="guide-explainer">Completa cada necesidad en una sola fila. La app la distribuirá en todos los lugares correspondientes de la plantilla.</div>
      <div class="table-wrap guide-table-wrap">
        <table class="guide-matrix">
          <thead><tr><th>#</th><th>Necesidad institucional</th><th>Presencia</th><th>% recurrencia</th></tr></thead>
          <tbody>
            ${rows.map((row, index) => `<tr>
              <td class="guide-row-number">${index + 1}</td>
              <td>${compactControl(row.need, "guide-cell-input")}</td>
              <td>${compactControl(row.presence, "guide-cell-input")}</td>
              <td>${compactControl(row.percent, "guide-cell-input guide-number")}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function renderGenericStep(step) {
    const byName = new Map(step.fields.map((field) => [field.name, field]));
    const cap = byName.get("CAP_GENERICA");
    const criteria = [1,2,3,4,5].map((i) => byName.get(`CRIT_GEN_${i}`)).filter(Boolean);
    const alternatives = [1,2,3,4].map((i) => ({
      alt: byName.get(`ALT_GEN_${i}`),
      strong: byName.get(`FORT_GEN_${i}`),
      limit: byName.get(`LIM_GEN_${i}`),
      result: byName.get(`RES_GEN_${i}`)
    })).filter((row) => row.alt || row.strong || row.limit || row.result);
    const survey = [1,2,3,4].map((i) => ({
      aspect: byName.get(`ENC_ASP_${i}`),
      percent: byName.get(`ENC_PCT_${i}`)
    })).filter((row) => row.aspect || row.percent);

    const used = new Set();
    [cap, ...criteria].filter(Boolean).forEach((field) => used.add(field.name));
    alternatives.forEach((row) => Object.values(row).filter(Boolean).forEach((field) => used.add(field.name)));
    survey.forEach((row) => Object.values(row).filter(Boolean).forEach((field) => used.add(field.name)));
    const rest = step.fields.filter((field) => !used.has(field.name));

    return `
      ${cap ? `<div class="guide-focus-card"><span>Capacitación institucional priorizada</span>${compactControl(cap, "guide-focus-input")}</div>` : ""}
      ${criteria.length ? `<div class="guide-subsection"><h3>Criterios de priorización</h3><p>Selecciona el nivel de cumplimiento de cada criterio.</p><div class="form-grid">${criteria.map((field) => guidedScalarField(field, step.where)).join("")}</div></div>` : ""}
      ${alternatives.length ? `<div class="guide-subsection"><h3>Alternativas evaluadas</h3><p>Compara las alternativas antes de definir la seleccionada.</p>
        <div class="table-wrap guide-table-wrap"><table class="guide-matrix wide">
          <thead><tr><th>#</th><th>Alternativa</th><th>Fortalezas</th><th>Limitaciones</th><th>Resultado</th></tr></thead>
          <tbody>${alternatives.map((row, index) => `<tr>
            <td class="guide-row-number">${index + 1}</td>
            <td>${compactControl(row.alt, "guide-cell-input")}</td>
            <td>${compactControl(row.strong, "guide-cell-input multiline")}</td>
            <td>${compactControl(row.limit, "guide-cell-input multiline")}</td>
            <td>${compactControl(row.result, "guide-cell-input")}</td>
          </tr>`).join("")}</tbody>
        </table></div>
      </div>` : ""}
      ${survey.length ? `<div class="guide-subsection"><h3>Resultados de encuesta</h3><p>Registra los aspectos evaluados y su porcentaje.</p>
        <div class="table-wrap guide-table-wrap"><table class="guide-matrix">
          <thead><tr><th>#</th><th>Aspecto evaluado</th><th>% docentes</th></tr></thead>
          <tbody>${survey.map((row, index) => `<tr>
            <td class="guide-row-number">${index + 1}</td>
            <td>${compactControl(row.aspect, "guide-cell-input multiline")}</td>
            <td>${compactControl(row.percent, "guide-cell-input guide-number")}</td>
          </tr>`).join("")}</tbody>
        </table></div>
      </div>` : ""}
      ${rest.length ? `<div class="form-grid">${rest.map((field) => guidedScalarField(field, step.where)).join("")}</div>` : ""}
    `;
  }

  function renderCareersStep(step, plan, guide) {
    const careers = plan.careers || [];
    if (!careers.length) return '<div class="empty"><b>Sin carreras detectadas</b>No hay grupos repetitivos en esta plantilla.</div>';
    const group = careers[Math.max(0, Math.min(guide.career || 0, careers.length - 1))];
    const byName = new Map(group.fields.map((field) => [field.name, field]));
    const rows = [1,2,3,4,5].map((index) => ({
      need: byName.get(`${group.prefix}_N${index}`),
      type: byName.get(`${group.prefix}_TIPO${index}`),
      recurrence: byName.get(`${group.prefix}_REC${index}`),
      percent: byName.get(`${group.prefix}_PCT${index}`)
    })).filter((row) => row.need || row.type || row.recurrence || row.percent);
    const stats = completionFor(group.fields);
    const priority = group.priority;

    return `
      <div class="career-toolbar">
        <button class="ghost small-inline" type="button" data-action="guide-career-prev" ${guide.career <= 0 ? "disabled" : ""}>←</button>
        <div class="career-select-wrap">
          <span>Carrera ${guide.career + 1} de ${careers.length}</span>
          <select id="careerSelector">
            ${careers.map((item, index) => `<option value="${index}" ${index === guide.career ? "selected" : ""}>${escapeHtml(item.title)}</option>`).join("")}
          </select>
        </div>
        <button class="ghost small-inline" type="button" data-action="guide-career-next" ${guide.career >= careers.length - 1 ? "disabled" : ""}>→</button>
      </div>
      <div class="career-headline">
        <div><span>Resultados por carrera</span><h3>${escapeHtml(group.title)}</h3><small>Se usa en: 5 · Resultados del diagnóstico · ${escapeHtml(group.title)}</small></div>
        <span class="status ${stats.percent === 100 ? "good" : ""}">${stats.completed}/${stats.total}</span>
      </div>
      <div class="table-wrap guide-table-wrap">
        <table class="guide-matrix wide">
          <thead><tr><th>#</th><th>Necesidad</th><th>Tipo</th><th>Recurrencia</th><th>% recurrencia</th></tr></thead>
          <tbody>${rows.map((row, index) => `<tr>
            <td class="guide-row-number">${index + 1}</td>
            <td>${compactControl(row.need, "guide-cell-input multiline")}</td>
            <td>${compactControl(row.type, "guide-cell-input")}</td>
            <td>${compactControl(row.recurrence, "guide-cell-input")}</td>
            <td>${compactControl(row.percent, "guide-cell-input guide-number")}</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
      ${priority ? `<div class="guide-focus-card career-priority"><span>Capacitación priorizada para ${escapeHtml(group.title)}</span>${compactControl(priority, "guide-focus-input")}</div>` : ""}
    `;
  }

  function reviewStepContent(plan, template) {
    const manual = manualTemplateFields(template);
    const stats = completionFor(manual);
    const requirementData = state.requirements || {};
    const allRequirements = Array.isArray(requirementData.requirements) ? requirementData.requirements : [];
    const requiredMissing = allRequirements.filter((item) => item.blocking && ["missing", "warning"].includes(item.status));
    const incomplete = allRequirements.filter((item) => !["ready", "automatic"].includes(item.status));
    const aiCount = (template.aiFields || []).length;
    const sysCount = (template.systemFields || []).length;
    const calcCount = (template.fields || []).filter((field) => field.type === "CALC").length;
    const warnings = template.validation && template.validation.warnings || [];
    const errors = template.validation && template.validation.errors || [];
    const overallTotal = Number(requirementData.summary && requirementData.summary.total || 0);
    const overallReady = Number(requirementData.summary && requirementData.summary.ready || 0);
    const overallPercent = overallTotal ? Math.round((overallReady / overallTotal) * 100) : stats.percent;

    return `
      <div class="review-hero">
        <div class="review-score"><strong>${overallPercent}%</strong><span>requisitos resueltos</span></div>
        <div><h3>Revisión del documento</h3><p>La app mantiene ocultos los procesos automáticos y te muestra únicamente lo que necesita atención.</p></div>
      </div>
      <div class="review-grid">
        <div class="review-card"><span>Datos manuales</span><b>${stats.completed}/${stats.total}</b><small>${incomplete.length ? `${incomplete.length} pendientes` : "Completo"}</small></div>
        <div class="review-card"><span>Redacción externa</span><b>${aiCount}</b><small>se importa desde IA externa</small></div>
        <div class="review-card"><span>Sistema</span><b>${sysCount}</b><small>valores automáticos</small></div>
        <div class="review-card"><span>Cálculos</span><b>${calcCount}</b><small>se ejecutan al generar</small></div>
      </div>
      ${requiredMissing.length ? `<div class="review-alert"><b>Faltan ${requiredMissing.length} requisitos obligatorios</b><span>${requiredMissing.slice(0, 6).map((field) => escapeHtml(field.label + " · " + field.literal)).join(" · ")}${requiredMissing.length > 6 ? "…" : ""}</span></div>` : '<div class="review-ok"><b>Campos obligatorios completos</b><span>El documento está listo para la generación técnica.</span></div>'}
      ${errors.length ? `<div class="notice-error"><b>La plantilla tiene errores</b><span>${escapeHtml(errors[0])}</span></div>` : ""}
      ${!errors.length && warnings.length ? `<div class="notice-warn"><b>Aviso de plantilla</b><span>${escapeHtml(warnings[0])}</span></div>` : ""}
      <button class="primary review-generate" type="button" data-action="generate" ${requiredMissing.length || errors.length ? "disabled" : ""}>Generar documento PDF</button>
      <small class="review-hint">${requiredMissing.length ? "Completa los campos obligatorios para habilitar la generación." : "Los campos del sistema y cálculos son automáticos; la redacción proviene de la IA externa."}</small>
    `;
  }

  function renderGuideStep(step, plan, guide, template) {
    if (!step) return "";
    if (step.kind === "institutional") return renderInstitutionalStep(step);
    if (step.kind === "generic") return renderGenericStep(step);
    if (step.kind === "careers") return renderCareersStep(step, plan, guide);
    if (step.kind === "review") return reviewStepContent(plan, template);
    return `<div class="form-grid guide-standard-grid">${step.fields.map((field) => guidedScalarField(field, step.where)).join("")}</div>`;
  }

  function guideNavigation(plan, guide) {
    const totalStats = completionFor(manualTemplateFields(state.project.template));
    return `
      <section class="panel compact guide-progress-panel">
        <div class="progress-head"><div><h3>Progreso</h3><small id="saveStateLabel">${state.saveState === "saving" ? "Guardando…" : "Guardado automáticamente ✓"}</small></div><b>${totalStats.percent}%</b></div>
        <div class="progress-track"><span style="width:${totalStats.percent}%"></span></div>
        <div class="guide-step-list">
          ${plan.steps.map((step, index) => {
            const stats = completionFor(step.fields);
            const active = index === guide.step;
            const done = step.kind === "review" ? totalStats.percent === 100 : stats.total > 0 && stats.completed === stats.total;
            const detail = step.kind === "careers"
              ? `${(plan.careers || []).filter((group) => completionFor(group.fields).percent === 100).length}/${(plan.careers || []).length} carreras`
              : step.kind === "review"
                ? "Comprobar y generar"
                : `${stats.completed}/${stats.total}`;
            return `<button type="button" class="guide-step ${active ? "active" : ""} ${done ? "done" : ""}" data-action="guide-step" data-index="${index}">
              <span class="guide-step-index">${done ? "✓" : index + 1}</span>
              <span class="guide-step-copy"><b>${escapeHtml(step.title)}</b><small>${escapeHtml(detail)}</small></span>
            </button>`;
          }).join("")}
        </div>
      </section>`;
  }

  function guidedEditorContent(template, plan, guide) {
    const step = plan.steps[guide.step];
    const stats = completionFor(step.fields);
    return `
      <div class="guide-page-head">
        <div>
          <span class="guide-kicker">Paso ${guide.step + 1} de ${plan.steps.length}</span>
          <h2>${escapeHtml(step.title)}</h2>
          <p>${escapeHtml(step.subtitle || "")}</p>
          <small>Se usa en: ${escapeHtml(step.where || "documento")}</small>
        </div>
        ${step.kind !== "review" ? `<span class="status ${stats.percent === 100 ? "good" : ""}">${stats.completed}/${stats.total}</span>` : ""}
      </div>
      ${renderGuideStep(step, plan, guide, template)}
      <div class="guide-footer">
        <button class="ghost" type="button" data-action="guide-prev" ${guide.step <= 0 ? "disabled" : ""}>← Anterior</button>
        <span>Paso ${guide.step + 1} de ${plan.steps.length}</span>
        <button class="primary" type="button" data-action="guide-next" ${guide.step >= plan.steps.length - 1 ? "disabled" : ""}>Siguiente →</button>
      </div>
    `;
  }

  function updateSaveStateLabel() {
    const label = document.getElementById("saveStateLabel");
    if (label) label.textContent = state.saveState === "saving" ? "Guardando…" : "Guardado automáticamente ✓";
  }

  async function changeGuideStep(nextStep) {
    if (!state.project) return;
    await persistEditor();
    const plan = buildEditorPlan(state.project.template);
    ensureEditorGuide(plan);
    state.editorGuide.step = Math.max(0, Math.min(Number(nextStep), plan.steps.length - 1));
    persistGuidePosition();
    renderEditor();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function changeGuideCareer(nextCareer) {
    if (!state.project) return;
    await persistEditor();
    const plan = buildEditorPlan(state.project.template);
    ensureEditorGuide(plan);
    state.editorGuide.career = Math.max(0, Math.min(Number(nextCareer), Math.max(0, plan.careers.length - 1)));
    persistGuidePosition();
    renderEditor();
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    if (!state.project || state.project.status !== "generated") return "";
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

  const REQUIREMENT_CATEGORY_LABELS = {
    system: "Sistema / automáticos",
    data: "Datos",
    writing: "Redacción externa",
    tables: "Tablas",
    files: "Archivos de datos",
    evidence: "Evidencias",
    calculations: "Cálculos",
    charts: "Gráficos",
    other: "Otros"
  };

  function requirementStatusLabel(item) {
    if (item.status === "ready") return "Listo";
    if (item.status === "automatic") return "Automático";
    if (item.status === "warning") return "Revisar";
    if (item.status === "missing") return "Falta";
    return item.required ? "Falta" : "Pendiente";
  }

  function requirementActionHtml(item) {
    if (item.type === "SISTEMA" && ["CODIGO", "CODIGO_DOCUMENTO"].includes(item.name) && item.status === "warning") {
      const current = state.project && state.project.formData && (state.project.formData.NUMERO_DOCUMENTO || state.project.formData.NUMERO) || "";
      return `<div class="requirement-code-input"><label>Número del documento</label><input data-field="NUMERO_DOCUMENTO" type="number" min="1" step="1" value="${escapeHtml(current)}" placeholder="01"></div>`;
    }
    if (item.action === "upload_data") {
      return `<button class="ghost small-inline" type="button" data-action="add-files" data-kind="data" data-marker="${escapeHtml(item.name)}" data-multiple="false">Cargar Excel / CSV</button>`;
    }
    if (item.action === "upload_evidence") {
      return `<button class="ghost small-inline" type="button" data-action="add-files" data-kind="evidence" data-marker="${escapeHtml(item.name)}" data-multiple="${item.multiple ? "true" : "false"}">Cargar evidencia</button>`;
    }
    if (item.action === "table") {
      return `<button class="ghost small-inline" type="button" data-action="add-table-row" data-marker="${escapeHtml(item.name)}">+ Fila manual</button>`;
    }
    if (
      item.type === "SISTEMA" &&
      ["ELABORADO_POR", "CARGO_ELABORADO", "REVISADO_POR", "CARGO_REVISADO", "APROBADO_POR", "CARGO_APROBADO"].includes(item.name) &&
      ["missing", "pending"].includes(item.status)
    ) {
      return '<button class="ghost small-inline" type="button" data-route="settings">Ir a Ajustes</button>';
    }
    return "";
  }

  function requirementValueHtml(item) {
    if (item.type === "TABLA") {
      const rows = Array.isArray(item.value) ? item.value.length : 0;
      return rows ? `<span class="requirement-value">${rows} fila(s) cargadas</span>` : "";
    }
    if (["DATOS", "IMAGEN", "IMAGENES"].includes(item.type)) {
      const count = Number(item.value || 0);
      return count ? `<span class="requirement-value">${count} archivo(s)</span>` : "";
    }
    if (item.value != null && String(item.value).trim() !== "") {
      const value = String(item.value);
      return `<span class="requirement-value" title="${escapeHtml(value)}">${escapeHtml(value.length > 120 ? value.slice(0, 117) + "…" : value)}</span>`;
    }
    return "";
  }

  function requirementItemHtml(item) {
    const columns = Array.isArray(item.columns) && item.columns.length
      ? `<div class="requirement-columns">${item.columns.map((column) => `<span><b>${escapeHtml(column.name)}</b> · ${escapeHtml(column.type)}</span>`).join("")}</div>`
      : "";
    return `
      <article class="requirement-item status-${escapeHtml(item.status)}">
        <div class="requirement-item-main">
          <div class="requirement-item-title">
            <b>${escapeHtml(item.label)}</b>
            ${item.blocking ? '<span class="req-required">' + (item.required ? 'Obligatorio' : 'Requiere dato') + '</span>' : '<span class="req-optional">Opcional</span>'}
          </div>
          <code>${escapeHtml(item.literal)}</code>
          <div class="requirement-meta">
            <span>${escapeHtml(item.type === "IA" ? "REDACCION" : item.type)}</span>
            <span>Fuente: ${escapeHtml(item.source)}</span>
            ${Array.isArray(item.locations) && item.locations.length ? `<span>Ubicación: ${escapeHtml(item.locations.join(" · "))}</span>` : ""}
            ${Array.isArray(item.contexts) && item.contexts.length ? `<span>Sección: ${escapeHtml(item.contexts.join(" · "))}</span>` : ""}
            <span>${Number(item.occurrenceCount || 1)} aparición${Number(item.occurrenceCount || 1) === 1 ? "" : "es"}</span>
          </div>
          ${columns}
          ${item.blockingReason ? `<p class="requirement-note">${escapeHtml(item.blockingReason)}</p>` : ""}
          ${item.note ? `<p class="requirement-note">${escapeHtml(item.note)}</p>` : ""}
          ${requirementValueHtml(item)}
        </div>
        <div class="requirement-item-side">
          <span class="requirement-status">${escapeHtml(requirementStatusLabel(item))}</span>
          ${requirementActionHtml(item)}
        </div>
      </article>
    `;
  }

  function templateRequirementsHtml() {
    const data = state.requirements;
    if (!data || !Array.isArray(data.requirements)) return "";
    const summary = data.summary || {};
    const categories = Object.keys(REQUIREMENT_CATEGORY_LABELS)
      .map((key) => ({
        key,
        label: REQUIREMENT_CATEGORY_LABELS[key],
        items: data.requirements.filter((item) => item.category === key)
      }))
      .filter((group) => group.items.length);

    return `
      <section class="panel requirements-panel">
        <div class="panel-title requirements-title">
          <div>
            <h2>Requisitos de la plantilla</h2>
            <small>La app muestra el marcador exacto del Word, su sección, dónde aparece, quién lo llena y su estado actual.</small>
          </div>
          <span class="status ${Number(summary.blocking || 0) ? "warn" : "good"}">${Number(summary.ready || 0)}/${Number(summary.total || 0)} resueltos</span>
        </div>
        ${data.associationWarning ? `<div class="notice-warn requirements-association-warning"><b>Revisa la plantilla</b><span>${escapeHtml(data.associationWarning)}</span></div>` : ""}
        <div class="requirements-summary">
          <span><b>${Number(summary.total || 0)}</b> requisitos únicos</span>
          <span><b>${Number(summary.blocking || 0)}</b> obligatorios faltantes</span>
          <span><b>${Number(summary.warnings || 0)}</b> por revisar</span>
        </div>
        ${categories.map((group) => `
          <details class="requirements-group" ${["system","data","files","evidence"].includes(group.key) ? "open" : ""}>
            <summary><span>${escapeHtml(group.label)}</span><b>${group.items.length}</b></summary>
            <div class="requirements-list">${group.items.map(requirementItemHtml).join("")}</div>
          </details>
        `).join("")}
      </section>
    `;
  }

  function externalAiIssueList(preview) {
    if (!preview) return "";
    const problemItems = (preview.items || []).filter((item) => item.status === "error" || item.conflict);
    const visible = problemItems.slice(0, 20);
    if (!visible.length) return '<div class="external-ai-ok"><b>Respuesta lista</b><span>No se detectaron campos con errores.</span></div>';

    return `<div class="external-ai-issues">${visible.map((item) => `
      <div class="external-ai-issue ${item.status === "error" ? "error" : "warn"}">
        <b>${escapeHtml(item.label || item.name)}</b>
        <span>${escapeHtml(item.message || "Revisar este campo.")}</span>
      </div>
    `).join("")}${problemItems.length > visible.length ? `<small>+${problemItems.length - visible.length} observaciones adicionales</small>` : ""}</div>`;
  }

  function externalAiPreviewHtml() {
    const preview = state.externalAi && state.externalAi.preview;
    if (!preview) return "";
    const summary = preview.summary || {};
    const generalMessages = []
      .concat(preview.errors || [])
      .concat(preview.warnings || []);

    return `
      <div class="external-ai-preview">
        <div class="external-ai-summary">
          <span><b>${Number(summary.valid || 0)}</b> válidos</span>
          <span><b>${Number(summary.empty || 0)}</b> vacíos</span>
          <span><b>${Number(summary.errors || 0)}</b> errores</span>
          <span><b>${Number(summary.conflicts || 0)}</b> conflictos</span>
        </div>
        ${generalMessages.length ? `<div class="notice-warn"><b>Validación</b><span>${generalMessages.slice(0, 3).map(escapeHtml).join(" · ")}</span></div>` : ""}
        ${externalAiIssueList(preview)}
        <div class="button-row end">
          <label class="external-ai-overwrite"><input id="externalAiOverwrite" type="checkbox"> Sobrescribir si ya existe un valor</label>
          <button class="primary" type="button" data-action="external-ai-import" ${preview.canImport ? "" : "disabled"}>Importar campos válidos</button>
        </div>
      </div>
    `;
  }

  function externalAiHtml(template) {
    const data = state.externalAi || {};
    const aiCount = Number(data.aiCount || 0);
    const manualCount = Number(data.manualCount || 0);
    const tableCount = Number(data.tableCount || 0);
    const total = Number(data.fieldCount || (manualCount + aiCount + tableCount));

    return `
      <section class="panel external-ai-panel external-ai-simple">
        <div class="panel-title external-ai-title">
          <div>
            <h2>IA externa</h2>
            <small>La app prepara el prompt. Tú lo usas en ChatGPT, Claude, Gemini u otra IA y pegas aquí el resultado.</small>
          </div>
          <span class="status good">IA externa · ${total} elementos</span>
        </div>

        <div class="external-ai-simple-flow">
          <div class="external-ai-section">
            <div class="external-ai-section-head">
              <div><span>1</span><div><h3>Preparar prompt</h3><p>Incluye los datos, las redacciones y las tablas que puede devolver la IA. Sistema, archivos y evidencias se resuelven aparte en la app.</p></div></div>
            </div>

            <label class="external-ai-label" for="externalAiGuide">Instrucciones adicionales <small>(opcional)</small></label>
            <textarea id="externalAiGuide" class="external-ai-textarea guide compact-guide" placeholder="Solo si este documento necesita una indicación especial. Puedes dejarlo vacío.">${escapeHtml(data.guide || "")}</textarea>

            <div class="external-ai-counts">
              <span>${total} elementos para IA externa</span>
              <span>${manualCount} datos</span>
              <span>${aiCount} redacciones</span>
              <span>${tableCount} tablas</span>
            </div>

            <div class="external-ai-main-action">
              <button class="primary external-ai-copy-main" type="button" data-action="external-ai-copy-prompt" ${data.prompt ? "" : "disabled"}>Copiar prompt para IA externa</button>
              <small>Al copiar, las instrucciones opcionales se guardan automáticamente para esta plantilla v${template.version}.</small>
            </div>

            <details class="external-ai-details">
              <summary>Ver estructura que se enviará</summary>
              <textarea class="external-ai-textarea fields" readonly>${escapeHtml(data.fieldsText || "")}</textarea>
            </details>

            <details class="external-ai-details">
              <summary>Ver prompt generado</summary>
              <textarea class="external-ai-textarea prompt" readonly>${escapeHtml(data.prompt || "")}</textarea>
            </details>
          </div>

          <div class="external-ai-section">
            <div class="external-ai-section-head">
              <div><span>2</span><div><h3>Importar respuesta</h3><p>Pega el único bloque que devolvió la IA externa. La app lo valida antes de llenar el documento.</p></div></div>
              ${data.canUndo ? '<button class="ghost small-inline" type="button" data-action="external-ai-undo">Deshacer última importación</button>' : ""}
            </div>

            <textarea id="externalAiResponse" class="external-ai-textarea response" placeholder="//FORMATO:ITSQMET-DOCUMENTO-V2//&#10;//DOCUMENTO:...//&#10;//PLANTILLA:...//&#10;//VERSION-PLANTILLA:...//&#10;//MODO:DOCUMENTO-COMPLETO//&#10;&#10;//CAMPO:...//&#10;contenido&#10;//FIN:...//&#10;&#10;//FIN-DOCUMENTO//">${escapeHtml(data.response || "")}</textarea>

            <div class="button-row end external-ai-analyze-row">
              <button class="secondary" type="button" data-action="external-ai-preview">Analizar respuesta</button>
            </div>

            ${externalAiPreviewHtml()}
          </div>
        </div>
      </section>
    `;
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
    const manualCount = manualTemplateFields(template).length;
    const systemCount = (template.systemFields || []).length;
    const calcCount = (template.fields || []).filter((field) => field.type === "CALC").length;
    const plan = buildEditorPlan(template);
    const guide = ensureEditorGuide(plan);

    view.innerHTML = `
      ${templateRequirementsHtml()}
      <div class="editor-grid guided-editor-grid">
        <section class="panel guide-main-panel">
          ${templateStatus(template)}
          ${guidedEditorContent(template, plan, guide)}
        </section>

        <aside class="guide-aside">
          ${guideNavigation(plan, guide)}

          <section class="panel compact">
            <div class="panel-title"><h3>Plantilla</h3><button class="ghost small-inline" type="button" data-action="import-template">Reemplazar</button></div>
            <div class="template-summary">
              <b>${escapeHtml(template.name)}</b>
              <span>Plantilla v${template.version} · lista</span>
            </div>
            <div class="template-metrics">
              <span><b>${manualCount}</b> datos</span>
              <span><b>${aiCount}</b> redacción externa</span>
              <span><b>${systemCount + calcCount}</b> automáticos</span>
            </div>
          </section>


        </aside>
      </div>
      ${externalAiHtml(template)}
      ${outputsHtml()}
      ${versionsHtml()}
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
                <div class="template-actions">
                  ${item.documentId && item.active ? `<button class="ghost small-inline" type="button" data-action="replace-template-document" data-template-id="${escapeHtml(item.id)}" data-document-id="${escapeHtml(item.documentId)}">Reemplazar</button>` : ""}
                  <button class="danger-button small-inline" type="button" data-action="delete-template" data-template-id="${escapeHtml(item.id)}">Eliminar</button>
                </div>
              </div>
              <span class="status ${hasError ? "error" : item.active ? "good" : ""}">${hasError ? "Error" : item.active ? "Activa" : "Anterior"}</span>
            </div>
          `;
        }).join("")}</div>` : '<div class="empty"><b>Sin plantillas</b>Sube un Word con marcadores {{...}}.</div>'}
      </section>
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

  function renderSystem() {
    setHeader("Sistema", "Errores y estado", false);

    const errors = state.errors || [];
    const body = errors.length
      ? `<div class="error-list">${errors.map((item) => `
          <article class="error-item ${item.severity === "warning" ? "warning" : item.severity === "info" ? "info" : ""}">
            <div class="error-item-head">
              <div>
                <b>${escapeHtml(item.message)}</b>
                <span>${escapeHtml(item.module)}${item.action ? " · " + escapeHtml(item.action) : ""}</span>
              </div>
              <time>${new Date(item.createdAt).toLocaleString()}</time>
            </div>
            ${item.detail ? `<details><summary>Detalle técnico</summary><pre>${escapeHtml(item.detail)}</pre></details>` : ""}
          </article>
        `).join("")}</div>`
      : '<div class="system-ok"><span>✓</span><div><b>Todo correcto</b><small>No hay errores pendientes.</small></div></div>';

    view.innerHTML = `
      <section class="panel compact">
        <div class="panel-title">
          <div><h2>Sistema</h2><small>Errores registrados por la aplicación</small></div>
          <span class="status ${state.errorCount ? "error" : "good"}">${state.errorCount ? state.errorCount + " pendientes" : "Sin errores"}</span>
        </div>
        ${body}
        <div class="button-row end" style="margin-top:14px">
          ${errors.length ? '<button class="ghost" type="button" data-action="resolve-errors">Marcar resueltos</button>' : ""}
          <button class="ghost" type="button" data-action="clear-resolved-errors">Limpiar resueltos</button>
        </div>
      </section>
    `;
  }

  function versionsHtml() {
    if (!state.versions || !state.versions.length) return "";

    return `<section class="panel compact history-panel">
      <div class="panel-title">
        <div><h3>Historial</h3><small>Versiones guardadas como información</small></div>
        <span class="status good">${state.versions.length}</span>
      </div>
      <div class="version-list">
        ${state.versions.map((item) => `
          <div class="version-row">
            <div>
              <b>v${item.version}</b>
              <span>${new Date(item.createdAt).toLocaleString()}</span>
              <small>${item.fieldCount} campos · ${item.fileCount} archivos${item.provider ? " · " + escapeHtml(item.provider) : ""}</small>
            </div>
            <button class="ghost small-inline" type="button" data-action="restore-version" data-version="${item.version}">Cargar</button>
          </div>
        `).join("")}
      </div>
    </section>`;
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
          <div class="field"><label>Abrir PDF</label><select id="openAfterGenerate"><option value="yes" ${settings.generation.openAfterGenerate ? "selected" : ""}>Sí</option><option value="no" ${!settings.generation.openAfterGenerate ? "selected" : ""}>No</option></select></div>
        </div>
      </section>
      <section class="panel compact">
        <div class="panel-title"><h3>Datos</h3><span class="status ${state.sync && state.sync.enabled ? "good" : "warn"}">${state.sync && state.sync.enabled ? "Sincronización activa" : "Externa pendiente"}</span></div>
        <div class="quick-line"><span>Base local</span><b>SQLite</b></div>
        <div class="quick-line"><span>Base externa</span><b>${state.sync && state.sync.provider ? escapeHtml(state.sync.provider) : "Pendiente"}</b></div>
        <div class="button-row" style="margin-top:12px">
          <button class="ghost" type="button" data-action="create-backup">Respaldar</button>
          <button class="ghost" type="button" data-action="restore-backup">Restaurar</button>
        </div>
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

  function clearCalculatedValues() {
    const fields = state.project && state.project.template && state.project.template.fields || [];
    fields.filter((field) => field.type === "CALC").forEach((field) => {
      delete state.project.formData[field.name];
    });
  }

  function preservedExternalAnalysis() {
    const external = state.project && state.project.analysis && state.project.analysis.externalGeneratedFields;
    if (!external || typeof external !== "object" || !Object.keys(external).length) return null;
    const fields = Object.assign({}, external);
    const sources = {};
    Object.keys(fields).forEach((name) => { sources[name] = ["IA externa"]; });
    return {
      provider: "IA externa",
      generatedAt: new Date().toISOString(),
      generatedFields: fields,
      externalGeneratedFields: fields,
      fieldSources: sources,
      keyFindings: [],
      missingData: [],
      tables: [],
      charts: [],
      sourceTrace: [],
      notes: "Contenido importado mediante ITSQMET-DOCUMENTO-V2."
    };
  }

  async function persistEditor() {
    if (!state.project) return;
    state.saveState = "saving";
    updateSaveStateLabel();
    if (state.project.status === "generated") state.project.status = "draft";
    state.project.analysis = preservedExternalAnalysis();
    state.project.formData = collectFormData();
    clearCalculatedValues();
    const response = await api.saveProject(state.project);
    if (response && response.ok) {
      state.project = response.project;
      state.saveState = "saved";
      updateSaveStateLabel();
      await loadRequirements();
    }
  }

  function scheduleSave() {
    state.saveState = "saving";
    updateSaveStateLabel();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persistEditor(), 450);
  }

  function readExternalAiInputs() {
    const guide = document.getElementById("externalAiGuide");
    const response = document.getElementById("externalAiResponse");
    if (guide) state.externalAi.guide = guide.value;
    if (response) state.externalAi.response = response.value;
    state.externalAi.mode = "manual_ai";
  }

  async function saveExternalAiGuide() {
    if (!state.project) return;
    readExternalAiInputs();
    const response = await api.saveExternalAiGuide(state.project.id, state.externalAi.guide);
    if (!response || !response.ok) return showToast(response && response.error ? response.error : "No se pudo guardar la guía.");
    state.externalAi.guide = response.data && response.data.guide || state.externalAi.guide;
    state.externalAi.canUndo = Boolean(response.data && response.data.canUndo);
    await buildExternalAiPrompt(false);
    showToast("Guía guardada para esta plantilla.");
  }

  async function buildExternalAiPrompt(showMessage) {
    if (!state.project) return;
    readExternalAiInputs();
    const response = await api.buildExternalAiPrompt(
      state.project.id,
      state.externalAi.mode,
      state.externalAi.guide
    );
    if (!response || !response.ok) return showToast(response && response.error ? response.error : "No se pudo preparar el prompt.");

    const data = response.data || {};
    state.externalAi.fieldsText = data.fieldsText || "";
    state.externalAi.prompt = data.prompt || "";
    state.externalAi.manualCount = Number(data.manualCount || 0);
    state.externalAi.aiCount = Number(data.aiCount || 0);
    state.externalAi.tableCount = Number(data.tableCount || 0);
    state.externalAi.fieldCount = Number(data.fieldCount || 0);
    state.externalAi.preview = null;
    renderEditor();
    if (showMessage !== false) showToast("Prompt actualizado.");
  }

  async function copyExternalAiPrompt() {
    if (!state.project) return;
    readExternalAiInputs();

    const saved = await api.saveExternalAiGuide(state.project.id, state.externalAi.guide);
    if (!saved || !saved.ok) {
      return showToast(saved && saved.error ? saved.error : "No se pudieron guardar las instrucciones.");
    }

    const built = await api.buildExternalAiPrompt(
      state.project.id,
      "manual_ai",
      state.externalAi.guide
    );
    if (!built || !built.ok || !built.data) {
      return showToast(built && built.error ? built.error : "No se pudo preparar el prompt.");
    }

    state.externalAi.mode = "manual_ai";
    state.externalAi.fieldsText = built.data.fieldsText || "";
    state.externalAi.prompt = built.data.prompt || "";
    state.externalAi.manualCount = Number(built.data.manualCount || 0);
    state.externalAi.aiCount = Number(built.data.aiCount || 0);
    state.externalAi.tableCount = Number(built.data.tableCount || 0);
    state.externalAi.fieldCount = Number(built.data.fieldCount || 0);
    state.externalAi.canUndo = Boolean(saved.data && saved.data.canUndo);

    const copied = await api.copyText(state.externalAi.prompt);
    if (!copied || !copied.ok) return showToast("No se pudo copiar el prompt.");

    renderEditor();
    showToast("Prompt completo copiado. Pégalo en tu IA externa.");
  }

  async function previewExternalAiResponse() {
    if (!state.project) return;
    readExternalAiInputs();
    if (!state.externalAi.response.trim()) return showToast("Pega primero la respuesta de la IA.");
    const response = await api.previewExternalAiResponse(
      state.project.id,
      state.externalAi.response,
      "manual_ai"
    );
    if (!response || !response.ok) return showToast(response && response.error ? response.error : "No se pudo analizar la respuesta.");
    state.externalAi.preview = response.preview;
    renderEditor();
  }

  async function importExternalAiResponse() {
    if (!state.project) return;
    readExternalAiInputs();
    const overwrite = Boolean(document.getElementById("externalAiOverwrite") && document.getElementById("externalAiOverwrite").checked);
    const response = await api.applyExternalAiResponse(
      state.project.id,
      state.externalAi.response,
      "manual_ai",
      overwrite
    );
    if (!response || !response.ok) return showToast(response && response.error ? response.error : "No se pudo importar la respuesta.");

    const result = response.result || {};
    state.project = result.project || state.project;
    state.externalAi.canUndo = Boolean(result.canUndo);
    state.externalAi.preview = null;
    await Promise.all([loadVersions(), loadRequirements()]);
    renderEditor();
    showToast(String(result.imported || 0) + " elementos importados.");
  }

  async function undoExternalAiImport() {
    if (!state.project) return;
    const response = await api.undoExternalAiImport(state.project.id);
    if (!response || !response.ok) return showToast(response && response.error ? response.error : "No se pudo deshacer.");
    const result = response.result || {};
    state.project = result.project || state.project;
    state.externalAi.canUndo = Boolean(result.canUndo);
    state.externalAi.preview = null;
    await loadRequirements();
    renderEditor();
    showToast("Última importación deshecha.");
  }

  function associationForDocument(documentId) {
    const found = catalog.findDocument(documentId);
    if (!found) return null;
    return {
      unitId: found.unit.id,
      processId: found.process.id,
      documentId: found.document.id
    };
  }

  async function importTemplateForDocument(documentId, oldTemplateId) {
    const association = associationForDocument(documentId);
    if (!association) return showToast("Documento no válido.");

    const response = await api.importTemplate(association);
    if (!response || response.canceled) return;
    if (!response.ok) return showToast(response.error || "No se pudo importar.");

    const errors = response.template.validation && response.template.validation.errors || [];
    if (errors.length) {
      await loadTemplates();
      if (state.route === "process") renderProcess();
      else renderTemplates();
      showToast("Plantilla no reemplazada: " + errors[0]);
      return;
    }

    if (oldTemplateId && oldTemplateId !== response.template.id) {
      const removed = await api.deleteTemplate(oldTemplateId);
      if (!removed || !removed.ok) {
        showToast("La nueva plantilla quedó activa, pero no se pudo retirar la anterior.");
      }
    }

    await loadTemplates();
    if (state.route === "process") renderProcess();
    else renderTemplates();

    showToast("Plantilla reemplazada correctamente.");
  }

  async function deleteTemplateFromUi(templateId) {
    const item = state.templates.find((template) => template.id === templateId);
    if (!item) return showToast("No se encontró la plantilla.");

    const label = item.documentId
      ? (catalog.findDocument(item.documentId)?.document?.name || item.name)
      : item.name;
    if (!window.confirm(`¿Eliminar la plantilla de "${label}"?\n\nLos documentos históricos conservarán su referencia, pero esta plantilla dejará de aparecer y de usarse para nuevos documentos.`)) return;

    const response = await api.deleteTemplate(templateId);
    if (!response || !response.ok) return showToast(response && response.error ? response.error : "No se pudo eliminar.");

    await loadTemplates();

    if (state.project && state.project.template && state.project.template.id === templateId) {
      state.project.template = null;
      state.project.analysis = null;
      state.project.status = "draft";
      await api.saveProject(state.project);
    }

    if (state.route === "process") renderProcess();
    else if (state.route === "templates") renderTemplates();
    else if (state.route === "editor") renderEditor();

    showToast("Plantilla eliminada.");
  }

  async function importTemplate(globalOnly) {
    clearTimeout(saveTimer);
    const previousTemplateId = !globalOnly && state.project && state.project.template
      ? state.project.template.id
      : null;
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

    const errors = response.template.validation && response.template.validation.errors || [];
    if (errors.length) {
      await loadTemplates();
      if (globalOnly) renderTemplates();
      else renderEditor();
      showToast("Plantilla no aplicada: " + errors[0]);
      return;
    }

    if (!globalOnly && previousTemplateId && previousTemplateId !== response.template.id) {
      await api.deleteTemplate(previousTemplateId);
    }

    await loadTemplates();

    if (!globalOnly && state.project) {
      const staleAttachments = (state.project.attachments || []).slice();
      let cleanupFailed = false;
      for (const attachment of staleAttachments) {
        const removed = await api.removeFile(state.project.id, attachment.id);
        if (removed && removed.ok && removed.project) state.project = removed.project;
        else cleanupFailed = true;
      }

      state.project.template = response.template;
      state.editorGuide = null;
      state.project.formData = {};
      state.project.analysis = null;
      state.project.status = "draft";
      state.project.generatedCode = "";
      const saved = await api.saveProject(state.project);
      if (saved && saved.ok) state.project = saved.project;
      await Promise.all([loadExternalAi(), loadRequirements()]);
      renderEditor();
      if (cleanupFailed) {
        showToast("Plantilla reemplazada, pero uno o más archivos anteriores no pudieron eliminarse. Revisa Sistema.");
        return;
      }
    } else {
      renderTemplates();
    }

    showToast(!globalOnly && previousTemplateId
      ? "Plantilla reemplazada. Campos y archivos del borrador anterior fueron reiniciados."
      : "Plantilla guardada.");
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
    await loadRequirements();
    renderEditor();
  }

  async function removeFile(id) {
    const response = await api.removeFile(state.project.id, id);
    if (response && response.ok) {
      state.project = response.project;
      await loadRequirements();
      renderEditor();
    }
  }

  async function recalculate() {
    await persistEditor();
    setBusy(true);
    const response = await api.calculate(state.project.id);
    setBusy(false);

    if (!response || !response.ok) {
      await refreshErrorCount();
      renderEditor();
      return showToast(response && response.error ? response.error : "No se pudieron calcular los campos.");
    }

    state.project = response.project;
    await loadRequirements();
    renderEditor();
    showToast("Campos calculados.");
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
    await Promise.all([loadVersions(), loadRequirements()]);
    renderEditor();
    const warnings = state.project.analysis && Array.isArray(state.project.analysis.missingData) ? state.project.analysis.missingData.length : 0;
    showToast(warnings ? `PDF generado. ${warnings} aviso(s) de información.` : `PDF generado con ${response.result.engine}.`);
  }

  async function restoreVersion(version) {
    if (!state.project) return;
    const response = await api.restoreVersion(state.project.id, Number(version));
    if (!response || !response.ok) {
      await refreshErrorCount();
      return showToast(response && response.error ? response.error : "No se pudo cargar la versión.");
    }
    state.project = response.project;
    await Promise.all([loadVersions(), loadRequirements(), loadExternalAi()]);
    renderEditor();
    showToast(`Versión ${version} cargada como borrador.`);
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
    state.project.status = "draft";
    state.project.analysis = preservedExternalAnalysis();
    clearCalculatedValues();
    api.saveProject(state.project).then((response) => {
      if (response && response.ok) {
        state.project = response.project;
        loadRequirements().then(() => renderEditor());
      } else {
        renderEditor();
      }
    });
  }

  function removeTableRow(markerName, rowIndex) {
    const rows = Array.isArray(state.project.formData[markerName]) ? state.project.formData[markerName].slice() : [];
    rows.splice(Number(rowIndex), 1);
    state.project.formData[markerName] = rows;
    state.project.status = "draft";
    state.project.analysis = preservedExternalAnalysis();
    clearCalculatedValues();
    api.saveProject(state.project).then((response) => {
      if (response && response.ok) {
        state.project = response.project;
        loadRequirements().then(() => renderEditor());
      } else {
        renderEditor();
      }
    });
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
        defaultAiMode: "external",
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

    if (event.target.id === "externalAiGuide") state.externalAi.guide = event.target.value;
    if (event.target.id === "externalAiResponse") state.externalAi.response = event.target.value;
    if (event.target.id === "librarySearch") renderLibrary(event.target.value);
  });

  view.addEventListener("change", (event) => {
    if (event.target.matches("[data-field]")) scheduleSave();
    if (event.target.id === "careerSelector") changeGuideCareer(Number(event.target.value));
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
    if (action === "upload-template-document") return importTemplateForDocument(button.dataset.documentId, null);
    if (action === "replace-template-document") return importTemplateForDocument(button.dataset.documentId, button.dataset.templateId);
    if (action === "delete-template") return deleteTemplateFromUi(button.dataset.templateId);
    if (action === "assign-template") return assignTemplate(button.dataset.id);
    if (action === "external-ai-save-guide") return saveExternalAiGuide();
    if (action === "external-ai-copy-prompt") return copyExternalAiPrompt();
    if (action === "external-ai-preview") return previewExternalAiResponse();
    if (action === "external-ai-import") return importExternalAiResponse();
    if (action === "external-ai-undo") return undoExternalAiImport();
    if (action === "add-files") return addFiles(button.dataset.kind, button.dataset.marker || "", button.dataset.multiple !== "false");
    if (action === "remove-file") return removeFile(button.dataset.id);
    if (action === "add-table-row") return addTableRow(button.dataset.marker);
    if (action === "remove-table-row") return removeTableRow(button.dataset.marker, button.dataset.row);
    if (action === "recalculate") return recalculate();
    if (action === "guide-step") return changeGuideStep(Number(button.dataset.index));
    if (action === "guide-prev") return changeGuideStep((state.editorGuide && state.editorGuide.step || 0) - 1);
    if (action === "guide-next") return changeGuideStep((state.editorGuide && state.editorGuide.step || 0) + 1);
    if (action === "guide-career-prev") return changeGuideCareer((state.editorGuide && state.editorGuide.career || 0) - 1);
    if (action === "guide-career-next") return changeGuideCareer((state.editorGuide && state.editorGuide.career || 0) + 1);
    if (action === "generate") return generatePdf();
    if (action === "archive-upload") return archiveUpload();
    if (action === "save-settings") return saveSettingsFromScreen();
    if (action === "open-output") return api.openFile(button.dataset.path);
    if (action === "show-output") return api.showFile(button.dataset.path);
    if (action === "restore-version") return restoreVersion(button.dataset.version);
    if (action === "resolve-errors") {
      const response = await api.resolveAllErrors();
      if (response && response.ok) {
        await loadErrors();
        renderSystem();
        return showToast("Errores marcados como resueltos.");
      }
      return showToast("No se pudieron actualizar los errores.");
    }
    if (action === "clear-resolved-errors") {
      const response = await api.clearResolvedErrors();
      if (response && response.ok) {
        await loadErrors();
        renderSystem();
        return showToast("Historial de errores resueltos limpiado.");
      }
      return showToast("No se pudo limpiar el historial.");
    }
    if (action === "create-backup") {
      const response = await api.createBackup();
      if (!response || response.canceled) return;
      return showToast(response.ok ? "Respaldo creado." : (response.error || "No se pudo crear el respaldo."));
    }
    if (action === "restore-backup") {
      const response = await api.restoreBackup();
      if (!response || response.canceled) return;
      return showToast(response.ok ? "Respaldo restaurado. Reiniciando..." : (response.error || "No se pudo restaurar."));
    }
  });

  backButton.addEventListener("click", goBack);

  async function init() {
    if (!api) {
      view.innerHTML = '<div class="empty"><b>Electron no disponible</b>Ejecuta la app con npm start.</div>';
      return;
    }

    document.getElementById("appVersion").textContent = `v${api.version}`;

    window.addEventListener("error", (event) => {
      api.reportError({
        severity: "error",
        module: "renderer",
        action: "window-error",
        message: event.message || "Error de interfaz",
        detail: event.error && event.error.stack ? event.error.stack : ""
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      api.reportError({
        severity: "error",
        module: "renderer",
        action: "unhandledrejection",
        message: reason && reason.message ? reason.message : "Promesa rechazada en la interfaz",
        detail: reason && reason.stack ? reason.stack : String(reason || "")
      });
    });

    try {
      await loadCatalog();
      await Promise.all([loadSettings(), loadTemplates(), loadProjects(), refreshErrorCount()]);
      setInterval(refreshErrorCount, 15000);
      renderHome();
    } catch (error) {
      view.innerHTML = `<div class="empty"><b>No se pudo iniciar</b>${escapeHtml(error.message || String(error))}</div>`;
    }
  }

  init();
})();
