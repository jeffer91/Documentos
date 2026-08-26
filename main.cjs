const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const workspace = require("./src/main/workspace-service.cjs");
const templates = require("./src/main/template-service.cjs");
const { analyzeAttachments } = require("./src/main/source-service.cjs");
const { analyzeWithAi } = require("./src/main/ai-service.cjs");
const aiProviders = require("./src/main/ai-provider-service.cjs");
const { generateDocument } = require("./src/main/document-composer.cjs");
const { readSettings, saveSettings } = require("./src/main/settings-service.cjs");

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

function userData() { return app.getPath("userData"); }

function filtersFor(kind) {
  if (kind === "template") return [{ name: "Word", extensions: ["docx"] }];
  if (kind === "evidence") return [{ name: "Evidencias", extensions: ["png", "jpg", "jpeg", "webp", "pdf", "docx"] }];
  if (kind === "data") return [{ name: "Datos", extensions: ["xlsx", "xls", "csv"] }];
  return [{ name: "Fuentes", extensions: ["docx", "pdf", "xlsx", "xls", "csv", "txt", "md", "json"] }];
}

function registerIpc() {
  ipcMain.handle("projects:create", (_event, meta) => ({ ok: true, project: workspace.createProject(userData(), meta) }));
  ipcMain.handle("projects:list", () => ({ ok: true, projects: workspace.listProjects(userData()) }));
  ipcMain.handle("projects:get", (_event, id) => ({ ok: true, project: workspace.getProject(userData(), id) }));
  ipcMain.handle("projects:save", (_event, project) => ({ ok: true, project: workspace.saveProject(userData(), project) }));

  ipcMain.handle("projects:add-files", async (_event, projectId, kind) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: kind === "evidence" ? "Agregar evidencias" : kind === "data" ? "Agregar datos" : "Agregar fuentes",
      properties: ["openFile", "multiSelections"],
      filters: filtersFor(kind)
    });
    if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };
    try { return Object.assign({ ok: true }, workspace.addAttachments(userData(), projectId, kind, result.filePaths)); }
    catch (error) { return { ok: false, error: error.message || String(error) }; }
  });

  ipcMain.handle("projects:remove-file", (_event, projectId, attachmentId) => {
    try { return { ok: true, project: workspace.removeAttachment(userData(), projectId, attachmentId) }; }
    catch (error) { return { ok: false, error: error.message || String(error) }; }
  });

  ipcMain.handle("templates:import", async () => {
    const result = await dialog.showOpenDialog(mainWindow, { title: "Importar plantilla Word", properties: ["openFile"], filters: filtersFor("template") });
    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
    try { return { ok: true, template: templates.importTemplate(userData(), result.filePaths[0]) }; }
    catch (error) { return { ok: false, error: error.message || String(error) }; }
  });
  ipcMain.handle("templates:list", () => ({ ok: true, templates: templates.listTemplates(userData()) }));

  ipcMain.handle("analysis:run", async (_event, projectId, mode) => {
    try {
      const project = workspace.getProject(userData(), projectId);
      if (!project) throw new Error("No se encontró el documento.");
      const sources = await analyzeAttachments(project.attachments || []);
      const analysis = await analyzeWithAi(userData(), project, sources, mode || project.aiMode || "fallback");
      project.analysis = analysis;
      project.aiMode = mode || project.aiMode || "fallback";
      project.status = "analyzed";
      workspace.saveProject(userData(), project);
      return { ok: true, analysis, project };
    } catch (error) {
      return { ok: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle("documents:generate", async (_event, projectId) => {
    try {
      const project = workspace.getProject(userData(), projectId);
      if (!project) throw new Error("No se encontró el documento.");
      if (!project.analysis) {
        const sources = await analyzeAttachments(project.attachments || []);
        project.analysis = await analyzeWithAi(userData(), project, sources, project.aiMode || "fallback");
      }
      const settings = readSettings(userData());
      const result = await generateDocument(userData(), project, project.analysis, settings.signers);
      project.outputs = result.outputs.filter((item) => item.path).concat(project.outputs || []).slice(0, 20);
      project.status = "generated";
      project.generatedCode = result.code;
      workspace.saveProject(userData(), project);
      if (settings.generation.openAfterGenerate && project.outputs[0] && project.outputs[0].path) await shell.openPath(project.outputs[0].path);
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
      workspace.saveProject(userData(), project);
      return { ok: true, project };
    } catch (error) { return { ok: false, error: error.message || String(error) }; }
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
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
