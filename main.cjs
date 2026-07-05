/* =========================================================
Archivo: main.cjs
Ruta: /main.cjs
Funciones principales:
- Iniciar la aplicación Electron.
- Crear la ventana principal.
- Conectar la pantalla con el generador de Word.
========================================================= */

const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const { generateCoverDocx } = require("./src/main/document-generator.cjs");

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 720,
    title: "Generador de Documentos ITSQMET",
    backgroundColor: "#f4f6f8",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  mainWindow.on("closed", function () {
    mainWindow = null;
  });
}

function safeFileName(value) {
  return String(value || "portada")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function registerIpcHandlers() {
  ipcMain.handle("documents:generate-cover", async function (_event, data) {
    try {
      const baseName = safeFileName(data && data.code ? data.code : "portada-institucional");
      const result = await dialog.showSaveDialog(mainWindow, {
        title: "Guardar portada Word",
        defaultPath: baseName + ".docx",
        filters: [{ name: "Documento Word", extensions: ["docx"] }]
      });

      if (result.canceled || !result.filePath) {
        return { ok: false, canceled: true };
      }

      const savedPath = await generateCoverDocx(data, result.filePath);
      return { ok: true, path: savedPath };
    } catch (error) {
      return { ok: false, error: error.message || String(error) };
    }
  });
}

app.whenReady().then(function () {
  registerIpcHandlers();
  createMainWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
