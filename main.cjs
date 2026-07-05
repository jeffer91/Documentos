/* =========================================================
Archivo: main.cjs
Ruta: /main.cjs
Funciones principales:
- Iniciar la aplicación Electron.
- Crear la ventana principal.
- Conectar la pantalla con el generador de Word y PDF.
- Guardar y consultar historial local.
========================================================= */

const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("path");
const { generateCoverDocx } = require("./src/main/document-generator.cjs");
const { generateCoverPdf } = require("./src/main/pdf-generator.cjs");
const { addHistoryItem, readHistory } = require("./src/main/history-service.cjs");

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

function getOutputConfig(data) {
  const outputType = data && data.outputType === "pdf" ? "pdf" : "docx";

  if (outputType === "pdf") {
    return {
      outputType: "pdf",
      extension: "pdf",
      title: "Guardar portada PDF",
      filterName: "Documento PDF"
    };
  }

  return {
    outputType: "docx",
    extension: "docx",
    title: "Guardar portada Word",
    filterName: "Documento Word"
  };
}

async function generateByOutputType(data, filePath) {
  if (data && data.outputType === "pdf") {
    return generateCoverPdf(data, filePath);
  }

  return generateCoverDocx(data, filePath);
}

function registerIpcHandlers() {
  ipcMain.handle("documents:generate-cover", async function (_event, data) {
    try {
      const config = getOutputConfig(data);
      const baseName = safeFileName(data && data.code ? data.code : "portada-institucional");
      const result = await dialog.showSaveDialog(mainWindow, {
        title: config.title,
        defaultPath: baseName + "." + config.extension,
        filters: [{ name: config.filterName, extensions: [config.extension] }]
      });

      if (result.canceled || !result.filePath) {
        return { ok: false, canceled: true };
      }

      const savedPath = await generateByOutputType(data, result.filePath);
      const historyItem = addHistoryItem(app.getPath("userData"), {
        typeKey: data.typeKey,
        typeLabel: data.typeLabel,
        title: data.title,
        code: data.code,
        outputType: config.outputType,
        filePath: savedPath
      });

      return { ok: true, path: savedPath, outputType: config.outputType, historyItem: historyItem };
    } catch (error) {
      return { ok: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle("documents:get-history", async function () {
    return { ok: true, items: readHistory(app.getPath("userData")) };
  });

  ipcMain.handle("documents:open-file", async function (_event, filePath) {
    if (!filePath) return { ok: false, error: "Ruta vacía" };
    const result = await shell.openPath(filePath);
    return result ? { ok: false, error: result } : { ok: true };
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
