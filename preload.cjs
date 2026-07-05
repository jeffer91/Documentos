/* =========================================================
Archivo: preload.cjs
Ruta: /preload.cjs
Funciones principales:
- Comunicar de forma segura Electron con la pantalla.
- Exponer funciones autorizadas para generar documentos.
- Exponer historial, apertura de archivos y ajustes locales.
========================================================= */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("documentosApp", {
  version: "1.3.0",
  modo: "electron",
  generateCover: function (data) {
    return ipcRenderer.invoke("documents:generate-cover", data);
  },
  getHistory: function () {
    return ipcRenderer.invoke("documents:get-history");
  },
  openFile: function (filePath) {
    return ipcRenderer.invoke("documents:open-file", filePath);
  },
  getSettings: function () {
    return ipcRenderer.invoke("documents:get-settings");
  },
  saveSettings: function (settings) {
    return ipcRenderer.invoke("documents:save-settings", settings);
  }
});
