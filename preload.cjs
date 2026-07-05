/* =========================================================
Archivo: preload.cjs
Ruta: /preload.cjs
Funciones principales:
- Comunicar de forma segura Electron con la pantalla.
- Exponer funciones autorizadas para generar documentos.
========================================================= */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("documentosApp", {
  version: "1.1.0",
  modo: "electron",
  generateCover: function (data) {
    return ipcRenderer.invoke("documents:generate-cover", data);
  }
});
