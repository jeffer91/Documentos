const { app, BrowserWindow, dialog, ipcMain, shell, clipboard } = require("electron");
const path = require("path");
const fs = require("fs");
const catalog = require("./src/renderer/catalog.js");
const database = require("./src/main/database-service.cjs");
const { migrateLegacy } = require("./src/main/legacy-migration-service.cjs");
const workspace = require("./src/main/workspace-service.cjs");
const templates = require("./src/main/template-service.cjs");
const { analyzeAttachments } = require("./src/main/source-service.cjs");
const { analyzeWithAi } = require("./src/main/ai-service.cjs");
const aiProviders = require("./src/main/ai-provider-service.cjs");
const { generateDocument } = require("./src/main/document-composer.cjs");
const { validateProject, validateAiFields } = require("./src/main/project-validator.cjs");
const { readSettings, saveSettings } = require("./src/main/settings-service.cjs");
const syncService = require("./src/main/sync-service.cjs");
const backupService = require("./src/main/backup-service.cjs");
const errorService = require("./src/main/error-service.cjs");
const { applyCalculations } = require("./src/main/calculation-service.cjs");
const externalAiExchange = require("./src/main/external-ai-exchange.cjs");

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    title: "Documentos ITSQMET",
    backgroundColor: "#f4f6f8",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    try {
      errorService.record(userData(), {
        severity: "error",
        module: "renderer",
        action: "render-process-gone",
        message: "La interfaz se cerró inesperadamente.",
        detail: JSON.stringify(details || {})
      });
    } catch (_error) { /* ignore */ }
  });
  mainWindow.on("closed", () => { mainWindow = null; });
}

function userData() {
  return app.getPath("userData");
}

function filtersFor(kind) {
  if (kind === "template") return [{ name: "Plantilla Word", extensions: ["docx"] }];
  if (kind === "evidence") return [{ name: "Imágenes", extensions: ["png", "jpg", "jpeg", "webp"] }];
  if (kind === "data") return [{ name: "Datos", extensions: ["xlsx", "xls", "csv"] }];
  return [{ name: "Fuentes", extensions: ["docx", "pdf", "xlsx", "xls", "csv", "txt", "md", "json"] }];
}

function reportError(moduleName, actionName, error, userMessage) {
  try {
    errorService.recordError(userData(), moduleName || "app", actionName || "", error, userMessage);
  } catch (_error) {
    // El registro de errores nunca debe bloquear la app.
  }
}

function failure(moduleName, actionName, error, userMessage) {
  reportError(moduleName, actionName, error, userMessage);
  return { ok: false, error: userMessage || (error && error.message ? error.message : String(error)) };
}

function safeResponse(action, moduleName, actionName) {
  try {
    return action();
  } catch (error) {
    return failure(moduleName || "app", actionName || "operation", error);
  }
}

function registerIpc() {
  ipcMain.handle("catalog:get", () => ({ ok: true, catalog: database.getCatalog(database.openDatabase(userData())) }));

  ipcMain.handle("projects:create", (_event, meta) => safeResponse(() => {
    const input = Object.assign({}, meta || {});
    if (input.mode !== "upload") {
      input.template = templates.activeTemplateForDocument(userData(), input.documentId);
    }
    return { ok: true, project: workspace.createProject(userData(), input) };
  }));

  ipcMain.handle("projects:list", () => ({ ok: true, projects: workspace.listProjects(userData()) }));
  ipcMain.handle("projects:get", (_event, id) => ({ ok: true, project: workspace.getProject(userData(), id) }));
  ipcMain.handle("projects:save", (_event, project) => safeResponse(() => ({
    ok: true,
    project: workspace.saveProject(userData(), project)
  })));

  ipcMain.handle("projects:add-files", async (_event, projectId, kind, markerName, multiple) => {
    const properties = multiple === false ? ["openFile"] : ["openFile", "multiSelections"];
    const result = await dialog.showOpenDialog(mainWindow, {
      title: kind === "evidence" ? "Agregar imágenes" : kind === "data" ? "Agregar datos" : "Agregar fuentes",
      properties,
      filters: filtersFor(kind)
    });

    if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };

    try {
      return Object.assign(
        { ok: true },
        workspace.addAttachments(userData(), projectId, kind, result.filePaths, markerName || "")
      );
    } catch (error) {
      return failure("files", "add", error);
    }
  });

  ipcMain.handle("projects:remove-file", (_event, projectId, attachmentId) => safeResponse(() => ({
    ok: true,
    project: workspace.removeAttachment(userData(), projectId, attachmentId)
  })));

  ipcMain.handle("templates:import", async (_event, association) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Importar plantilla Word",
      properties: ["openFile"],
      filters: filtersFor("template")
    });

    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };

    try {
      return {
        ok: true,
        template: templates.importTemplate(userData(), result.filePaths[0], association || null)
      };
    } catch (error) {
      return failure("templates", "import", error);
    }
  });

  ipcMain.handle("templates:list", () => ({ ok: true, templates: templates.listTemplates(userData()) }));
  ipcMain.handle("templates:update", (_event, templateId, patch) => safeResponse(() => ({
    ok: true,
    template: templates.updateTemplate(userData(), templateId, patch || {})
  })));

  ipcMain.handle("templates:delete", (_event, templateId) => safeResponse(() => ({
    ok: true,
    result: templates.deleteTemplate(userData(), templateId)
  })));

  ipcMain.handle("external-ai:guide-get", (_event, projectId) => safeResponse(() => ({
    ok: true,
    data: externalAiExchange.getGuide(userData(), projectId)
  })));

  ipcMain.handle("external-ai:guide-save", (_event, projectId, guideText) => safeResponse(() => ({
    ok: true,
    data: externalAiExchange.saveGuide(userData(), projectId, guideText)
  })));

  ipcMain.handle("external-ai:build-prompt", (_event, projectId, mode, guideText) => safeResponse(() => ({
    ok: true,
    data: externalAiExchange.buildPrompt(userData(), projectId, mode, guideText)
  })));

  ipcMain.handle("external-ai:preview", (_event, projectId, rawText, mode) => safeResponse(() => ({
    ok: true,
    preview: externalAiExchange.previewResponse(userData(), projectId, rawText, mode)
  })));

  ipcMain.handle("external-ai:apply", (_event, projectId, rawText, mode, overwrite) => safeResponse(() => ({
    ok: true,
    result: externalAiExchange.applyResponse(userData(), projectId, rawText, mode, overwrite)
  })));

  ipcMain.handle("external-ai:undo", (_event, projectId) => safeResponse(() => ({
    ok: true,
    result: externalAiExchange.undoLastImport(userData(), projectId)
  })));

  ipcMain.handle("clipboard:write", (_event, text) => safeResponse(() => {
    clipboard.writeText(String(text || ""));
    return { ok: true };
  }));

  ipcMain.handle("analysis:run", async (_event, projectId, mode) => {
    try {
      let project = workspace.getProject(userData(), projectId);
      if (!project) throw new Error("No se encontró el documento.");

      const validation = validateProject(project);
      if (!validation.ok) return { ok: false, validation, error: validation.errors[0] };

      project.aiMode = mode || project.aiMode || "fallback";
      project = workspace.saveProject(userData(), project);

      const sources = await analyzeAttachments(project.attachments || []);
      const calculated = applyCalculations(project, sources);
      if (!calculated.ok) {
        calculated.errors.forEach((message) => {
          errorService.record(userData(), {
            severity: "error",
            module: "calculation",
            action: "analysis",
            message,
            detail: ""
          });
        });
        return { ok: false, validation: calculated, error: calculated.errors[0] };
      }
      project = workspace.saveProject(userData(), calculated.project);
      let analysis = await analyzeWithAi(userData(), project, sources, project.aiMode);
      analysis = externalAiExchange.mergeExternalGeneratedFields(project, analysis);
      project = workspace.recordAnalysis(userData(), projectId, analysis, "analyzed");

      return { ok: true, analysis, project, validation };
    } catch (error) {
      return failure("analysis", "run", error);
    }
  });

  ipcMain.handle("calculations:run", async (_event, projectId) => {
    try {
      let project = workspace.getProject(userData(), projectId);
      if (!project) throw new Error("No se encontró el documento.");

      const validation = validateProject(project);
      if (!validation.ok) {
        return { ok: false, validation, error: validation.errors[0] };
      }

      const sources = await analyzeAttachments(project.attachments || []);
      const calculated = applyCalculations(project, sources);

      if (!calculated.ok) {
        calculated.errors.forEach((message) => {
          errorService.record(userData(), {
            severity: "error",
            module: "calculation",
            action: "preview",
            message,
            detail: ""
          });
        });
        return { ok: false, validation: calculated, error: calculated.errors[0] };
      }

      project = workspace.saveProject(userData(), calculated.project);
      return { ok: true, project, calculated: calculated.calculated, warnings: calculated.warnings };
    } catch (error) {
      return failure("calculation", "preview", error);
    }
  });

  ipcMain.handle("documents:generate", async (_event, projectId) => {
    try {
      let project = workspace.getProject(userData(), projectId);
      if (!project) throw new Error("No se encontró el documento.");

      const validation = validateProject(project);
      if (!validation.ok) return { ok: false, validation, error: validation.errors[0] };

      const sources = await analyzeAttachments(project.attachments || []);
      const calculated = applyCalculations(project, sources);
      if (!calculated.ok) {
        calculated.errors.forEach((message) => {
          errorService.record(userData(), {
            severity: "error",
            module: "calculation",
            action: "generate",
            message,
            detail: ""
          });
        });
        return { ok: false, validation: calculated, error: calculated.errors[0] };
      }
      project = workspace.saveProject(userData(), calculated.project);
      let analysis = await analyzeWithAi(userData(), project, sources, project.aiMode || "fallback");
      analysis = externalAiExchange.mergeExternalGeneratedFields(project, analysis);
      project = workspace.recordAnalysis(userData(), projectId, analysis, "analyzed");

      const aiValidation = validateAiFields(project, analysis);
      if (!aiValidation.ok) {
        return { ok: false, validation: aiValidation, error: aiValidation.errors[0] };
      }

      const settings = readSettings(userData());
      const generationVersion = workspace.nextDocumentVersion(userData(), projectId);
      const result = await generateDocument(userData(), project, analysis, settings.signers, __dirname, generationVersion);
      project = workspace.addGeneration(userData(), projectId, result);

      const primary = project.outputs.find((item) => item.type === "pdf");
      if (settings.generation.openAfterGenerate && primary && primary.path) {
        await shell.openPath(primary.path);
      }

      return { ok: true, result, project };
    } catch (error) {
      return failure("documents", "generate", error);
    }
  });

  ipcMain.handle("documents:archive-upload", async (_event, projectId) => {
    try {
      const project = workspace.getProject(userData(), projectId);
      if (!project) throw new Error("No se encontró el documento.");

      const files = (project.attachments || []).filter((item) => item.kind === "source");
      if (!files.length) throw new Error("Sube al menos un archivo.");

      project.status = "archived";
      return { ok: true, project: workspace.saveProject(userData(), project) };
    } catch (error) {
      return failure("documents", "archive", error);
    }
  });

  function workspaceFileAllowed(filePath) {
    if (!filePath) return false;
    const rootPath = path.resolve(database.workspaceRoot(userData()));
    const target = path.resolve(filePath);
    return target === rootPath || target.startsWith(rootPath + path.sep);
  }

  ipcMain.handle("files:open", async (_event, filePath) => {
    if (!workspaceFileAllowed(filePath) || !fs.existsSync(filePath)) {
      return failure("files", "open", new Error("Archivo no disponible o fuera del espacio de trabajo."));
    }
    const error = await shell.openPath(filePath);
    return error ? failure("files", "open", new Error(error)) : { ok: true };
  });

  ipcMain.handle("files:show", async (_event, filePath) => {
    if (!workspaceFileAllowed(filePath) || !fs.existsSync(filePath)) {
      return failure("files", "show", new Error("Archivo no disponible o fuera del espacio de trabajo."));
    }
    shell.showItemInFolder(filePath);
    return { ok: true };
  });

  ipcMain.handle("settings:get", () => safeResponse(
    () => ({ ok: true, settings: readSettings(userData()) }),
    "settings",
    "get"
  ));
  ipcMain.handle("settings:save", (_event, settings) => safeResponse(
    () => ({ ok: true, settings: saveSettings(userData(), settings) }),
    "settings",
    "save"
  ));

  ipcMain.handle("ai:get", () => safeResponse(
    () => ({ ok: true, providers: aiProviders.publicProviders(userData()) }),
    "ai",
    "get"
  ));
  ipcMain.handle("ai:save", (_event, providers) => safeResponse(
    () => ({ ok: true, providers: aiProviders.saveProviders(userData(), providers) }),
    "ai",
    "save"
  ));

  ipcMain.handle("sync:get-status", () => safeResponse(
    () => ({ ok: true, sync: syncService.getSyncStatus(userData()) }),
    "sync",
    "status"
  ));

  ipcMain.handle("versions:list", (_event, projectId) => safeResponse(
    () => ({ ok: true, versions: workspace.listDocumentVersions(userData(), projectId) }),
    "versions",
    "list"
  ));

  ipcMain.handle("versions:get", (_event, projectId, version) => safeResponse(
    () => ({ ok: true, version: workspace.getDocumentVersion(userData(), projectId, version) }),
    "versions",
    "get"
  ));

  ipcMain.handle("versions:restore", (_event, projectId, version) => safeResponse(
    () => ({ ok: true, project: workspace.restoreDocumentVersion(userData(), projectId, version) }),
    "versions",
    "restore"
  ));

  ipcMain.handle("errors:list", (_event, options) => safeResponse(
    () => ({ ok: true, errors: errorService.list(userData(), options || {}), count: errorService.countOpen(userData()) }),
    "errors",
    "list"
  ));

  ipcMain.handle("errors:count", () => safeResponse(
    () => ({ ok: true, count: errorService.countOpen(userData()) }),
    "errors",
    "count"
  ));

  ipcMain.handle("errors:resolve-all", () => safeResponse(
    () => ({ ok: true, result: errorService.resolveAll(userData()) }),
    "errors",
    "resolve-all"
  ));

  ipcMain.handle("errors:clear-resolved", () => safeResponse(
    () => ({ ok: true, result: errorService.clearResolved(userData()) }),
    "errors",
    "clear-resolved"
  ));

  ipcMain.handle("errors:report", (_event, payload) => safeResponse(
    () => ({ ok: true, error: errorService.record(userData(), payload || {}) }),
    "errors",
    "report"
  ));

  ipcMain.handle("backup:create", async () => {
    const selected = await dialog.showOpenDialog(mainWindow, {
      title: "Guardar respaldo",
      properties: ["openDirectory", "createDirectory"]
    });
    if (selected.canceled || !selected.filePaths[0]) return { ok: false, canceled: true };

    try {
      return { ok: true, backup: await backupService.createBackup(userData(), selected.filePaths[0]) };
    } catch (error) {
      return failure("backup", "create", error);
    }
  });

  ipcMain.handle("backup:restore", async () => {
    const selected = await dialog.showOpenDialog(mainWindow, {
      title: "Restaurar respaldo",
      properties: ["openDirectory"]
    });
    if (selected.canceled || !selected.filePaths[0]) return { ok: false, canceled: true };

    try {
      const result = backupService.restoreBackup(userData(), selected.filePaths[0]);
      setTimeout(() => {
        app.relaunch();
        app.exit(0);
      }, 500);
      return { ok: true, restore: result };
    } catch (error) {
      return failure("backup", "restore", error);
    }
  });
}

app.whenReady().then(() => {
  const db = database.openDatabase(userData());
  database.seedCatalogIfEmpty(db, catalog);
  try {
    migrateLegacy(db, database.workspaceRoot(userData()));
    workspace.backfillObjectStore(userData());
  } catch (error) {
    reportError("database", "legacy-migration", error);
  }

  registerIpc();

  process.on("uncaughtException", (error) => {
    reportError("main", "uncaughtException", error);
  });
  process.on("unhandledRejection", (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason || "Promesa rechazada"));
    reportError("main", "unhandledRejection", error);
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  database.closeAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
