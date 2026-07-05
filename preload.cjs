/* =========================================================
Archivo: preload.cjs
Ruta: /preload.cjs
Funciones principales:
- Comunicar de forma segura Electron con la pantalla.
- Exponer funciones autorizadas para generar documentos.
- Exponer historial local y apertura de archivos.
========================================================= */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("documentosApp", {
  version: "1.2.0",
  modo: "electron",
  generateCover: function (data) {
    return ipcRenderer.invoke("documents:generate-cover", data);
  },
  getHistory: function () {
    return ipcRenderer.invoke("documents:get-history");
  },
  openFile: function (filePath) {
    return ipcRenderer.invoke("documents:open-file", filePath);
  }
});
