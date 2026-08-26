const { openDatabase, queueSync } = require("./database-service.cjs");

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
  const db = openDatabase(userDataPath);
  const row = db.prepare("SELECT value_json FROM settings WHERE key = 'app_settings'").get();
  if (!row) return merge(DEFAULT_SETTINGS);
  try { return merge(JSON.parse(row.value_json)); } catch (_error) { return merge(DEFAULT_SETTINGS); }
}

function saveSettings(userDataPath, settings) {
  const db = openDatabase(userDataPath);
  const next = merge(settings);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO settings(key, value_json, updated_at)
    VALUES('app_settings', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `).run(JSON.stringify(next), now);

  queueSync(db, "settings", "app_settings", "update", next);
  return next;
}

module.exports = { DEFAULT_SETTINGS, readSettings, saveSettings };
