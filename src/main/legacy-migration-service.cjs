const fs = require("fs");
const path = require("path");
const { metaGet, metaSet } = require("./database-service.cjs");

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (_error) { return fallback; }
}

function json(value) {
  return JSON.stringify(value == null ? null : value);
}

function migrateTemplates(db, rootDir) {
  const file = path.join(rootDir, "templates", "templates.json");
  const items = readJson(file, []);
  if (!Array.isArray(items)) return 0;

  const insertTemplate = db.prepare(`
    INSERT OR IGNORE INTO templates
      (id, document_id, unit_id, process_id, name, version, local_path, active, confidence, imported_at, validation_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const deleteFields = db.prepare("DELETE FROM template_fields WHERE template_id = ?");
  const insertField = db.prepare(`
    INSERT INTO template_fields
      (template_id, type, name, label, required, config, columns_json, raw, valid, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  const tx = db.transaction(() => {
    items.forEach((item) => {
      if (!item || !item.id || !item.localPath) return;
      const now = item.importedAt || new Date().toISOString();
      insertTemplate.run(
        item.id,
        item.documentId || null,
        item.unitId || null,
        item.processId || null,
        item.name || path.basename(item.localPath),
        Number(item.version || 1),
        item.localPath,
        item.active === false ? 0 : 1,
        Number(item.confidence || 0),
        now,
        json(item.validation || {}),
        now
      );

      deleteFields.run(item.id);
      const markers = Array.isArray(item.markers)
        ? item.markers
        : Array.isArray(item.fields)
          ? item.fields
          : [];

      markers.forEach((marker, index) => {
        if (!marker || !marker.type || !marker.name) return;
        insertField.run(
          item.id,
          marker.type,
          marker.name,
          marker.label || marker.name,
          marker.required ? 1 : 0,
          marker.config || "",
          json(marker.columns || []),
          marker.raw || `${marker.type}:${marker.name}`,
          marker.valid === false ? 0 : 1,
          index
        );
      });
      count += 1;
    });
  });

  tx();
  return count;
}

function migrateProjects(db, rootDir) {
  const projectsDir = path.join(rootDir, "projects");
  if (!fs.existsSync(projectsDir)) return 0;

  const insertProject = db.prepare(`
    INSERT OR IGNORE INTO projects
      (id, document_id, template_id, status, unit_id, unit_name, process_id, process_code, process_name,
       document_name, document_type, code_pattern, mode, ai_mode, generated_code, analysis_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const upsertField = db.prepare(`
    INSERT INTO project_fields(project_id, field_name, value_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(project_id, field_name) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at
  `);

  const insertFile = db.prepare(`
    INSERT OR IGNORE INTO files(id, project_id, kind, marker_name, name, extension, size, local_path, added_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAnalysis = db.prepare(`
    INSERT OR IGNORE INTO ai_analyses(id, project_id, provider, content_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertGeneration = db.prepare(`
    INSERT OR IGNORE INTO generations(id, project_id, version, generated_code, pdf_path, docx_path, engine, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  const dirs = fs.readdirSync(projectsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());

  const tx = db.transaction(() => {
    dirs.forEach((entry) => {
      const project = readJson(path.join(projectsDir, entry.name, "project.json"), null);
      if (!project || !project.id) return;

      const createdAt = project.createdAt || new Date().toISOString();
      const updatedAt = project.updatedAt || createdAt;
      const templateId = project.template && project.template.id ? project.template.id : null;

      insertProject.run(
        project.id,
        project.documentId || null,
        templateId,
        project.status || "draft",
        project.unitId || "",
        project.unitName || "",
        project.processId || "",
        project.processCode || "",
        project.processName || "",
        project.documentName || "",
        project.documentType || "",
        project.codePattern || "",
        project.mode || "template",
        "external",
        project.generatedCode || "",
        project.analysis ? json(project.analysis) : null,
        createdAt,
        updatedAt
      );

      Object.entries(project.formData || {}).forEach(([key, value]) => {
        upsertField.run(project.id, key, json(value), updatedAt);
      });

      (project.attachments || []).forEach((file) => {
        if (!file || !file.id || !file.localPath) return;
        insertFile.run(
          file.id,
          project.id,
          file.kind || "source",
          file.markerName || "",
          file.name || path.basename(file.localPath),
          file.extension || path.extname(file.localPath),
          Number(file.size || 0),
          file.localPath,
          file.addedAt || updatedAt
        );
      });

      if (project.analysis) {
        insertAnalysis.run(
          `analysis-${project.id}-legacy`,
          project.id,
          project.analysis.provider || "Legacy",
          json(project.analysis),
          project.analysis.generatedAt || updatedAt
        );
      }

      const outputs = Array.isArray(project.outputs) ? project.outputs : [];
      const pdf = outputs.find((item) => item.type === "pdf" && item.path);
      const docx = outputs.find((item) => item.type === "docx" && item.path);
      if (pdf || docx) {
        insertGeneration.run(
          `gen-${project.id}-legacy`,
          project.id,
          1,
          project.generatedCode || "",
          pdf ? pdf.path : null,
          docx ? docx.path : null,
          "Legacy",
          updatedAt
        );
      }

      count += 1;
    });
  });

  tx();
  return count;
}

function migrateSettings(db, rootDir) {
  const now = new Date().toISOString();
  const settings = readJson(path.join(rootDir, "settings.json"), null);
  if (settings) {
    db.prepare(`
      INSERT OR IGNORE INTO settings(key, value_json, updated_at)
      VALUES('app_settings', ?, ?)
    `).run(json(settings), now);
  }

}

function migrateLegacy(db, rootDir) {
  if (metaGet(db, "legacy_migration_v1") === "done") return { migrated: false };

  const result = {
    migrated: true,
    templates: migrateTemplates(db, rootDir),
    projects: migrateProjects(db, rootDir)
  };
  migrateSettings(db, rootDir);
  metaSet(db, "legacy_migration_v1", "done");
  return result;
}

module.exports = { migrateLegacy };
