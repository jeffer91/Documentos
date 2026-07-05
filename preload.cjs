/* =========================================================
Archivo: preload.cjs
Ruta: /preload.cjs
Funciones principales:
- Comunicar de forma segura Electron con la pantalla.
- Exponer información básica de la app al renderer.
========================================================= */

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("documentosApp", {
  version: "1.0.0",
  modo: "electron"
});
