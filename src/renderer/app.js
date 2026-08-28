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
    aiProviders: [],
    sync: null,
    errors: [],
    errorCount: 0,
    versions: [],
    busy: false,
    editorGuide: null,
    saveState: "saved"
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

  async function loadAi() {
    const response = await api.getAiProviders();
    state.aiProviders = response && response.ok ? response.providers || [] : [];
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
      await loadVersions();
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
      return Array.isArray(rows) && rows.length > 0;
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
      .filter((group) => group.indexes.size >= 3 && group.fields.length >= 9)
      .map((group) => {
        const priority = manual.find((field) => field.name === `CAP_${group.prefix}`) || null;
        const analysis = aiFields.find((field) =>
          field.name === `ANALISIS_${group.prefix}` ||
          (field.name.endsWith(`_${group.prefix}`) && /diagn[oó]stico/i.test(field.label || ""))
        );
        const relation = aiFields.find((field) => field.name === `RELACION_GENERICA_${group.prefix}`);
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
      });
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
    const requiredMissing = manual.filter((field) => field.required && !fieldIsComplete(field));
    const incomplete = manual.filter((field) => !fieldIsComplete(field));
    const aiCount = (template.aiFields || []).length;
    const sysCount = (template.systemFields || []).length;
    const calcCount = (template.fields || []).filter((field) => field.type === "CALC").length;
    const warnings = template.validation && template.validation.warnings || [];
    const errors = template.validation && template.validation.errors || [];

    return `
      <div class="review-hero">
        <div class="review-score"><strong>${stats.percent}%</strong><span>datos completados</span></div>
        <div><h3>Revisión del documento</h3><p>La app mantiene ocultos los procesos automáticos y te muestra únicamente lo que necesita atención.</p></div>
      </div>
      <div class="review-grid">
        <div class="review-card"><span>Datos manuales</span><b>${stats.completed}/${stats.total}</b><small>${incomplete.length ? `${incomplete.length} pendientes` : "Completo"}</small></div>
        <div class="review-card"><span>IA</span><b>${aiCount}</b><small>contenidos automáticos</small></div>
        <div class="review-card"><span>Sistema</span><b>${sysCount}</b><small>valores automáticos</small></div>
        <div class="review-card"><span>Cálculos</span><b>${calcCount}</b><small>se ejecutan al generar</small></div>
      </div>
      ${requiredMissing.length ? `<div class="review-alert"><b>Faltan ${requiredMissing.length} campos obligatorios</b><span>${requiredMissing.slice(0, 6).map((field) => escapeHtml(field.label)).join(" · ")}${requiredMissing.length > 6 ? "…" : ""}</span></div>` : '<div class="review-ok"><b>Campos obligatorios completos</b><span>El documento está listo para la generación técnica.</span></div>'}
      ${errors.length ? `<div class="notice-error"><b>La plantilla tiene errores</b><span>${escapeHtml(errors[0])}</span></div>` : ""}
      ${!errors.length && warnings.length ? `<div class="notice-warn"><b>Aviso de plantilla</b><span>${escapeHtml(warnings[0])}</span></div>` : ""}
      <button class="primary review-generate" type="button" data-action="generate" ${requiredMissing.length || errors.length ? "disabled" : ""}>Generar documento PDF</button>
      <small class="review-hint">${requiredMissing.length ? "Completa los campos obligatorios para habilitar la generación." : "La IA, los cálculos y los campos del sistema se procesarán automáticamente."}</small>
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
    const sourceCount = (state.project.attachments || []).filter((item) => item.kind === "source").length;
    const plan = buildEditorPlan(template);
    const guide = ensureEditorGuide(plan);

    view.innerHTML = `
      <div class="editor-grid guided-editor-grid">
        <section class="panel guide-main-panel">
          ${templateStatus(template)}
          ${guidedEditorContent(template, plan, guide)}
        </section>

        <aside class="guide-aside">
          ${guideNavigation(plan, guide)}

          <section class="panel compact">
            <div class="panel-title"><h3>Plantilla</h3><button class="ghost small-inline" type="button" data-action="import-template">Cambiar</button></div>
            <div class="template-summary">
              <b>${escapeHtml(template.name)}</b>
              <span>Plantilla v${template.version} · lista</span>
            </div>
            <div class="template-metrics">
              <span><b>${manualCount}</b> datos</span>
              <span><b>${aiCount}</b> IA</span>
              <span><b>${systemCount + calcCount}</b> automáticos</span>
            </div>
          </section>

          ${aiCount ? `
            <section class="panel compact">
              <div class="panel-title"><h3>IA</h3><span class="status good">${aiCount} automáticos</span></div>
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
        </aside>
      </div>
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
          <div class="field"><label>IA</label><select id="defaultAiMode"><option value="fallback" ${settings.generation.defaultAiMode !== "deep" ? "selected" : ""}>Automático</option><option value="deep" ${settings.generation.defaultAiMode === "deep" ? "selected" : ""}>Profundo</option></select></div>
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

  async function persistEditor() {
    if (!state.project) return;
    state.saveState = "saving";
    updateSaveStateLabel();
    if (state.project.status === "generated") state.project.status = "draft";
    state.project.analysis = null;
    state.project.formData = collectFormData();
    clearCalculatedValues();
    const mode = document.querySelector('input[name="aiMode"]:checked');
    if (mode) state.project.aiMode = mode.value;
    const response = await api.saveProject(state.project);
    if (response && response.ok) {
      state.project = response.project;
      state.saveState = "saved";
      updateSaveStateLabel();
    }
  }

  function scheduleSave() {
    state.saveState = "saving";
    updateSaveStateLabel();
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
      state.editorGuide = null;
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
    await loadVersions();
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
    await loadVersions();
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
    state.project.analysis = null;
    clearCalculatedValues();
    api.saveProject(state.project).then((response) => {
      if (response && response.ok) state.project = response.project;
      renderEditor();
    });
  }

  function removeTableRow(markerName, rowIndex) {
    const rows = Array.isArray(state.project.formData[markerName]) ? state.project.formData[markerName].slice() : [];
    rows.splice(Number(rowIndex), 1);
    state.project.formData[markerName] = rows;
    state.project.status = "draft";
    state.project.analysis = null;
    clearCalculatedValues();
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
    if (action === "assign-template") return assignTemplate(button.dataset.id);
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
    if (action === "save-ai") return saveAi();
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
