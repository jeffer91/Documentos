const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("documentosApp", {
  version: "2.3.0",
  getCatalog: () => ipcRenderer.invoke("catalog:get"),
  createProject: (meta) => ipcRenderer.invoke("projects:create", meta),
  listProjects: () => ipcRenderer.invoke("projects:list"),
  getProject: (id) => ipcRenderer.invoke("projects:get", id),
  saveProject: (project) => ipcRenderer.invoke("projects:save", project),
  addFiles: (projectId, kind, markerName, multiple) => ipcRenderer.invoke("projects:add-files", projectId, kind, markerName, multiple),
  removeFile: (projectId, attachmentId) => ipcRenderer.invoke("projects:remove-file", projectId, attachmentId),
  importTemplate: (association) => ipcRenderer.invoke("templates:import", association || null),
  listTemplates: () => ipcRenderer.invoke("templates:list"),
  updateTemplate: (templateId, patch) => ipcRenderer.invoke("templates:update", templateId, patch),
  analyze: (projectId, mode) => ipcRenderer.invoke("analysis:run", projectId, mode),
  generate: (projectId) => ipcRenderer.invoke("documents:generate", projectId),
  archiveUpload: (projectId) => ipcRenderer.invoke("documents:archive-upload", projectId),
  openFile: (filePath) => ipcRenderer.invoke("files:open", filePath),
  showFile: (filePath) => ipcRenderer.invoke("files:show", filePath),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  getAiProviders: () => ipcRenderer.invoke("ai:get"),
  saveAiProviders: (providers) => ipcRenderer.invoke("ai:save", providers),
  getSyncStatus: () => ipcRenderer.invoke("sync:get-status"),
  createBackup: () => ipcRenderer.invoke("backup:create"),
  restoreBackup: () => ipcRenderer.invoke("backup:restore")
});
