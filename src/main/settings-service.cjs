/* =========================================================
Archivo: settings-service.cjs
Ruta: /src/main/settings-service.cjs
Funciones principales:
- Guardar ajustes locales de la app.
- Leer unidad, sigla y firmantes por defecto.
- Mantener valores seguros si el archivo de ajustes falla.
========================================================= */

const fs = require("fs");
const path = require("path");

const SETTINGS_FILE = "documentos-settings.json";

const DEFAULT_SETTINGS = {
  unitName: "Titulación y Eficiencia Terminal",
  unitCode: "UTET",
  signers: {
    elaboradoPor: {
      nombre: "Mgs. Jefferson Villarreal",
      cargo: "Coordinador de Titulación y Eficiencia Terminal"
    },
    revisadoPor: {
      nombre: "Mgs Martha Tomalá",
      cargo: "Coordinadora General de Carreras"
    },
    aprobadoPor: {
      nombre: "Dr. Alex León",
      cargo: "Vicerrector"
    }
  }
};

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getSettingsPath(userDataPath) {
  ensureDir(userDataPath);
  return path.join(userDataPath, SETTINGS_FILE);
}

function mergeSettings(input) {
  const data = input && typeof input === "object" ? input : {};
  const signers = data.signers && typeof data.signers === "object" ? data.signers : {};

  return {
    unitName: data.unitName || DEFAULT_SETTINGS.unitName,
    unitCode: data.unitCode || DEFAULT_SETTINGS.unitCode,
    signers: {
      elaboradoPor: {
        nombre: signers.elaboradoPor && signers.elaboradoPor.nombre ? signers.elaboradoPor.nombre : DEFAULT_SETTINGS.signers.elaboradoPor.nombre,
        cargo: signers.elaboradoPor && signers.elaboradoPor.cargo ? signers.elaboradoPor.cargo : DEFAULT_SETTINGS.signers.elaboradoPor.cargo
      },
      revisadoPor: {
        nombre: signers.revisadoPor && signers.revisadoPor.nombre ? signers.revisadoPor.nombre : DEFAULT_SETTINGS.signers.revisadoPor.nombre,
        cargo: signers.revisadoPor && signers.revisadoPor.cargo ? signers.revisadoPor.cargo : DEFAULT_SETTINGS.signers.revisadoPor.cargo
      },
      aprobadoPor: {
        nombre: signers.aprobadoPor && signers.aprobadoPor.nombre ? signers.aprobadoPor.nombre : DEFAULT_SETTINGS.signers.aprobadoPor.nombre,
        cargo: signers.aprobadoPor && signers.aprobadoPor.cargo ? signers.aprobadoPor.cargo : DEFAULT_SETTINGS.signers.aprobadoPor.cargo
      }
    }
  };
}

function readSettings(userDataPath) {
  const filePath = getSettingsPath(userDataPath);

  if (!fs.existsSync(filePath)) {
    return mergeSettings(DEFAULT_SETTINGS);
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return mergeSettings(JSON.parse(raw));
  } catch (_error) {
    return mergeSettings(DEFAULT_SETTINGS);
  }
}

function saveSettings(userDataPath, settings) {
  const filePath = getSettingsPath(userDataPath);
  const next = mergeSettings(settings);
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2), "utf8");
  return next;
}

module.exports = {
  DEFAULT_SETTINGS,
  readSettings,
  saveSettings
};
