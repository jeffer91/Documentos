const fs = require("fs");
const path = require("path");
const { root } = require("./workspace-service.cjs");

const SETTINGS_FILE = "settings.json";
const DEFAULT_SETTINGS = {
  signers: {
    elaboradoPor: { nombre: "Mgs. Jefferson Villarreal", cargo: "Coordinador de Titulación y Eficiencia Terminal" },
    revisadoPor: { nombre: "Mgs. Martha Tomalá", cargo: "Coordinadora General de Carreras" },
    aprobadoPor: { nombre: "Dr. Alex León", cargo: "Vicerrector" }
  },
  generation: {
    defaultAiMode: "fallback",
    includeSourceTrace: false,
    openAfterGenerate: true
  }
};

function filePath(userDataPath) {
  return path.join(root(userDataPath), SETTINGS_FILE);
}

function text(value, fallback) {
  return String(value || fallback || "").trim();
}

function merge(input) {
  const data = input && typeof input === "object" ? input : {};
  const signers = data.signers || {};
  const generation = data.generation || {};

  return {
    signers: {
      elaboradoPor: {
        nombre: text(signers.elaboradoPor && signers.elaboradoPor.nombre, DEFAULT_SETTINGS.signers.elaboradoPor.nombre),
        cargo: text(signers.elaboradoPor && signers.elaboradoPor.cargo, DEFAULT_SETTINGS.signers.elaboradoPor.cargo)
      },
      revisadoPor: {
        nombre: text(signers.revisadoPor && signers.revisadoPor.nombre, DEFAULT_SETTINGS.signers.revisadoPor.nombre),
        cargo: text(signers.revisadoPor && signers.revisadoPor.cargo, DEFAULT_SETTINGS.signers.revisadoPor.cargo)
      },
      aprobadoPor: {
        nombre: text(signers.aprobadoPor && signers.aprobadoPor.nombre, DEFAULT_SETTINGS.signers.aprobadoPor.nombre),
        cargo: text(signers.aprobadoPor && signers.aprobadoPor.cargo, DEFAULT_SETTINGS.signers.aprobadoPor.cargo)
      }
    },
    generation: {
      defaultAiMode: generation.defaultAiMode === "deep" ? "deep" : "fallback",
      includeSourceTrace: generation.includeSourceTrace === true,
      openAfterGenerate: generation.openAfterGenerate !== false
    }
  };
}

function readSettings(userDataPath) {
  const target = filePath(userDataPath);
  if (!fs.existsSync(target)) return merge(DEFAULT_SETTINGS);
  try {
    return merge(JSON.parse(fs.readFileSync(target, "utf8")));
  } catch (_error) {
    return merge(DEFAULT_SETTINGS);
  }
}

function saveSettings(userDataPath, settings) {
  const next = merge(settings);
  fs.writeFileSync(filePath(userDataPath), JSON.stringify(next, null, 2), "utf8");
  return next;
}

module.exports = {
  DEFAULT_SETTINGS,
  readSettings,
  saveSettings
};
