const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
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
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
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

function safeResponse(action) {
  try {
    return action();
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}

function registerIpc() {
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
      return { ok: false, error: error.message || String(error) };
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
      return { ok: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle("templates:list", () => ({ ok: true, templates: templates.listTemplates(userData()) }));
  ipcMain.handle("templates:update", (_event, templateId, patch) => safeResponse(() => ({
    ok: true,
    template: templates.updateTemplate(userData(), templateId, patch || {})
  })));

  ipcMain.handle("analysis:run", async (_event, projectId, mode) => {
    try {
      let project = workspace.getProject(userData(), projectId);
      if (!project) throw new Error("No se encontró el documento.");

      const validation = validateProject(project);
      if (!validation.ok) return { ok: false, validation, error: validation.errors[0] };

      project.aiMode = mode || project.aiMode || "fallback";
      project = workspace.saveProject(userData(), project);

      const sources = await analyzeAttachments(project.attachments || []);
      const analysis = await analyzeWithAi(userData(), project, sources, project.aiMode);
      project = workspace.recordAnalysis(userData(), projectId, analysis, "analyzed");

      return { ok: true, analysis, project, validation };
    } catch (error) {
      return { ok: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle("documents:generate", async (_event, projectId) => {
    try {
      let project = workspace.getProject(userData(), projectId);
      if (!project) throw new Error("No se encontró el documento.");

      const validation = validateProject(project);
      if (!validation.ok) return { ok: false, validation, error: validation.errors[0] };

      const sources = await analyzeAttachments(project.attachments || []);
      const analysis = await analyzeWithAi(userData(), project, sources, project.aiMode || "fallback");
      project = workspace.recordAnalysis(userData(), projectId, analysis, "analyzed");

      const aiValidation = validateAiFields(project, analysis);
      if (!aiValidation.ok) {
        return { ok: false, validation: aiValidation, error: aiValidation.errors[0] };
      }

      const settings = readSettings(userData());
      const result = await generateDocument(userData(), project, analysis, settings.signers, __dirname);
      project = workspace.addGeneration(userData(), projectId, result);

      const primary = project.outputs.find((item) => item.type === "pdf");
      if (settings.generation.openAfterGenerate && primary && primary.path) {
        await shell.openPath(primary.path);
      }

      return { ok: true, result, project };
    } catch (error) {
      return { ok: false, error: error.message || String(error) };
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
      return { ok: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle("files:open", async (_event, filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return { ok: false, error: "Archivo no disponible." };
    const error = await shell.openPath(filePath);
    return error ? { ok: false, error } : { ok: true };
  });

  ipcMain.handle("files:show", async (_event, filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return { ok: false, error: "Archivo no disponible." };
    shell.showItemInFolder(filePath);
    return { ok: true };
  });

  ipcMain.handle("settings:get", () => ({ ok: true, settings: readSettings(userData()) }));
  ipcMain.handle("settings:save", (_event, settings) => ({ ok: true, settings: saveSettings(userData(), settings) }));

  ipcMain.handle("ai:get", () => ({ ok: true, providers: aiProviders.publicProviders(userData()) }));
  ipcMain.handle("ai:save", (_event, providers) => ({ ok: true, providers: aiProviders.saveProviders(userData(), providers) }));

  ipcMain.handle("sync:get-status", () => ({ ok: true, sync: syncService.getSyncStatus(userData()) }));
}

app.whenReady().then(() => {
  const db = database.openDatabase(userData());
  database.seedCatalog(db, catalog);
  migrateLegacy(db, database.workspaceRoot(userData()));

  registerIpc();
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
