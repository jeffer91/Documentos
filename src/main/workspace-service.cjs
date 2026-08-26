const fs = require("fs");
const path = require("path");
const { workspaceRoot, openDatabase, queueSync } = require("./database-service.cjs");
const { sha256 } = require("./file-integrity-service.cjs");

const BLOCK_TYPES = new Set(["DATOS", "TABLA", "IMAGEN", "IMAGENES", "GRAFICO", "GRAFICOS"]);
const USER_TYPES = new Set(["CAMPO", "TEXTO", "FECHA", "NUMERO", "DATOS", "TABLA", "IMAGEN", "IMAGENES"]);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function root(userDataPath) {
  const dir = workspaceRoot(userDataPath);
  ensureDir(path.join(dir, "projects"));
  ensureDir(path.join(dir, "templates"));
  return dir;
}

function projectsDir(userDataPath) {
  return path.join(root(userDataPath), "projects");
}

function projectDir(userDataPath, projectId) {
  const dir = path.join(projectsDir(userDataPath), projectId);
  ensureDir(dir);
  ["sources", "evidence", "data", "generated"].forEach((name) => ensureDir(path.join(dir, name)));
  return dir;
}

function generatedDir(userDataPath, projectId) {
  return path.join(projectDir(userDataPath, projectId), "generated");
}

function safeName(name) {
  return String(name || "archivo")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function newId(prefix) {
  return `${prefix || "item"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseJson(value, fallback) {
  if (value == null || value === "") return fallback;
  try { return JSON.parse(value); } catch (_error) { return fallback; }
}

function markerFromRow(row) {
  const type = row.type;
  return {
    raw: row.raw,
    token: row.raw,
    valid: Boolean(row.valid),
    type,
    name: row.name,
    label: row.label || row.name,
    required: Boolean(row.required),
    config: row.config || "",
    columns: parseJson(row.columns_json, []),
    isBlock: BLOCK_TYPES.has(type),
    isUserInput: USER_TYPES.has(type),
    isAi: type === "IA",
    isSystem: type === "SISTEMA"
  };
}

function templateById(db, templateId) {
  if (!templateId) return null;
  const row = db.prepare("SELECT * FROM templates WHERE id = ?").get(templateId);
  if (!row) return null;

  const markers = db.prepare(
    "SELECT * FROM template_fields WHERE template_id = ? ORDER BY sort_order, id"
  ).all(templateId).map(markerFromRow);

  return {
    id: row.id,
    documentId: row.document_id || "",
    unitId: row.unit_id || "",
    processId: row.process_id || "",
    name: row.name,
    version: row.version,
    localPath: row.local_path,
    active: Boolean(row.active),
    confidence: row.confidence || 0,
    importedAt: row.imported_at,
    sha256: row.sha256 || "",
    markers,
    fields: markers.filter((marker) => marker.valid && marker.isUserInput),
    aiFields: markers.filter((marker) => marker.valid && marker.isAi),
    systemFields: markers.filter((marker) => marker.valid && marker.isSystem),
    validation: parseJson(row.validation_json, { errors: [], warnings: [], ok: true })
  };
}

function formDataForProject(db, projectId) {
  const rows = db.prepare(
    "SELECT field_name, value_json FROM project_fields WHERE project_id = ?"
  ).all(projectId);
  const formData = {};
  rows.forEach((row) => {
    formData[row.field_name] = parseJson(row.value_json, "");
  });
  return formData;
}

function attachmentsForProject(db, projectId) {
  return db.prepare(
    "SELECT * FROM files WHERE project_id = ? ORDER BY added_at"
  ).all(projectId).map((row) => ({
    id: row.id,
    kind: row.kind,
    markerName: row.marker_name || "",
    name: row.name,
    extension: row.extension || "",
    size: row.size || 0,
    localPath: row.local_path,
    sha256: row.sha256 || "",
    integrityCheckedAt: row.integrity_checked_at || "",
    addedAt: row.added_at
  }));
}

function outputsForProject(db, projectId) {
  const row = db.prepare(
    "SELECT * FROM generations WHERE project_id = ? ORDER BY created_at DESC LIMIT 1"
  ).get(projectId);

  if (!row) return [];

  const outputs = [];
  if (row.pdf_path) {
    outputs.push({
      type: "pdf",
      label: "PDF actual",
      path: row.pdf_path,
      primary: true,
      generationId: row.id
    });
  }
  if (row.docx_path) {
    outputs.push({
      type: "docx",
      label: "Word de respaldo",
      path: row.docx_path,
      primary: false,
      generationId: row.id
    });
  }
  return outputs;
}

function versionStats(db, projectId) {
  const row = db.prepare(
    "SELECT COUNT(*) AS total, MAX(version) AS current_version FROM document_versions WHERE project_id = ?"
  ).get(projectId);
  return {
    total: Number(row && row.total || 0),
    current: Number(row && row.current_version || 0)
  };
}

function normalizeProject(input) {
  const p = input && typeof input === "object" ? input : {};
  return {
    id: p.id || newId("doc"),
    createdAt: p.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: p.status || "draft",
    unitId: p.unitId || "",
    unitName: p.unitName || "",
    processId: p.processId || "",
    processCode: p.processCode || "",
    processName: p.processName || "",
    documentId: p.documentId || "",
    documentName: p.documentName || "",
    documentType: p.documentType || "",
    documentVersion: p.documentVersion || "1.0",
    codePattern: p.codePattern || "",
    mode: p.mode || "template",
    formData: p.formData && typeof p.formData === "object" ? p.formData : {},
    aiMode: p.aiMode || "fallback",
    template: p.template || null,
    attachments: Array.isArray(p.attachments) ? p.attachments : [],
    analysis: p.analysis || null,
    outputs: Array.isArray(p.outputs) ? p.outputs : [],
    generatedCode: p.generatedCode || "",
    informationVersionCount: Number(p.informationVersionCount || 0),
    currentInformationVersion: Number(p.currentInformationVersion || 0)
  };
}

function hydrateProject(db, row) {
  if (!row) return null;
  const stats = versionStats(db, row.id);

  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    unitId: row.unit_id || "",
    unitName: row.unit_name || "",
    processId: row.process_id || "",
    processCode: row.process_code || "",
    processName: row.process_name || "",
    documentId: row.document_id || "",
    documentName: row.document_name || "",
    documentType: row.document_type || "",
    documentVersion: row.document_version || "1.0",
    codePattern: row.code_pattern || "",
    mode: row.mode || "template",
    formData: formDataForProject(db, row.id),
    aiMode: row.ai_mode || "fallback",
    template: templateById(db, row.template_id),
    attachments: attachmentsForProject(db, row.id),
    analysis: parseJson(row.analysis_json, null),
    outputs: outputsForProject(db, row.id),
    generatedCode: row.generated_code || "",
    informationVersionCount: stats.total,
    currentInformationVersion: stats.current
  };
}

function createProject(userDataPath, metadata) {
  const db = openDatabase(userDataPath);
  const project = normalizeProject(metadata || {});
  projectDir(userDataPath, project.id);

  db.prepare(`
    INSERT INTO projects
      (id, document_id, template_id, status, unit_id, unit_name, process_id, process_code, process_name,
       document_name, document_type, document_version, code_pattern, mode, ai_mode, generated_code, analysis_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    project.id,
    project.documentId || null,
    project.template && project.template.id ? project.template.id : null,
    project.status,
    project.unitId,
    project.unitName,
    project.processId,
    project.processCode,
    project.processName,
    project.documentName,
    project.documentType,
    project.documentVersion,
    project.codePattern,
    project.mode,
    project.aiMode,
    project.generatedCode,
    project.analysis ? JSON.stringify(project.analysis) : null,
    project.createdAt,
    project.updatedAt
  );

  queueSync(db, "project", project.id, "create", {
    documentId: project.documentId,
    status: project.status
  });
  return getProject(userDataPath, project.id);
}

function saveProject(userDataPath, input) {
  const db = openDatabase(userDataPath);
  const project = normalizeProject(input);
  const existing = db.prepare("SELECT created_at FROM projects WHERE id = ?").get(project.id);
  if (!existing) return createProject(userDataPath, project);

  const now = new Date().toISOString();
  const templateId = project.template && project.template.id ? project.template.id : null;

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE projects SET
        document_id = ?, template_id = ?, status = ?, unit_id = ?, unit_name = ?, process_id = ?,
        process_code = ?, process_name = ?, document_name = ?, document_type = ?, document_version = ?, code_pattern = ?,
        mode = ?, ai_mode = ?, generated_code = ?, analysis_json = ?, updated_at = ?
      WHERE id = ?
    `).run(
      project.documentId || null,
      templateId,
      project.status,
      project.unitId,
      project.unitName,
      project.processId,
      project.processCode,
      project.processName,
      project.documentName,
      project.documentType,
      project.documentVersion,
      project.codePattern,
      project.mode,
      project.aiMode,
      project.generatedCode,
      project.analysis ? JSON.stringify(project.analysis) : null,
      now,
      project.id
    );

    const upsert = db.prepare(`
      INSERT INTO project_fields(project_id, field_name, value_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(project_id, field_name)
      DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
    `);

    const keep = new Set(Object.keys(project.formData || {}));
    db.prepare("SELECT field_name FROM project_fields WHERE project_id = ?").all(project.id).forEach((row) => {
      if (!keep.has(row.field_name)) {
        db.prepare(
          "DELETE FROM project_fields WHERE project_id = ? AND field_name = ?"
        ).run(project.id, row.field_name);
      }
    });

    Object.entries(project.formData || {}).forEach(([key, value]) => {
      upsert.run(project.id, key, JSON.stringify(value), now);
    });
  });

  tx();
  queueSync(db, "project", project.id, "update", {
    status: project.status,
    generatedCode: project.generatedCode
  });
  return getProject(userDataPath, project.id);
}

function getProject(userDataPath, projectId) {
  const db = openDatabase(userDataPath);
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
  return hydrateProject(db, row);
}

function listProjects(userDataPath) {
  const db = openDatabase(userDataPath);
  return db.prepare(
    "SELECT * FROM projects ORDER BY updated_at DESC"
  ).all().map((row) => hydrateProject(db, row));
}

function copyUnique(sourcePath, destinationDir) {
  ensureDir(destinationDir);
  const original = safeName(path.basename(sourcePath));
  const ext = path.extname(original);
  const stem = path.basename(original, ext);
  let target = path.join(destinationDir, original);
  let n = 2;

  while (fs.existsSync(target)) {
    target = path.join(destinationDir, `${stem} (${n})${ext}`);
    n += 1;
  }

  fs.copyFileSync(sourcePath, target);
  return target;
}

function addAttachments(userDataPath, projectId, kind, paths, markerName) {
  const db = openDatabase(userDataPath);
  const project = getProject(userDataPath, projectId);
  if (!project) throw new Error("No se encontró el documento local.");

  const folder = kind === "evidence" ? "evidence" : kind === "data" ? "data" : "sources";
  const destination = path.join(projectDir(userDataPath, projectId), folder);
  const added = [];
  const insert = db.prepare(`
    INSERT INTO files(id, project_id, kind, marker_name, name, extension, size, local_path, sha256, integrity_checked_at, added_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    (paths || []).forEach((sourcePath) => {
      if (!sourcePath || !fs.existsSync(sourcePath)) return;
      const localPath = copyUnique(sourcePath, destination);
      const stat = fs.statSync(localPath);
      const item = {
        id: newId("file"),
        kind,
        markerName: markerName || "",
        name: path.basename(localPath),
        extension: path.extname(localPath).toLowerCase(),
        size: stat.size,
        localPath,
        sha256: sha256(localPath),
        integrityCheckedAt: new Date().toISOString(),
        addedAt: new Date().toISOString()
      };
      insert.run(
        item.id,
        projectId,
        item.kind,
        item.markerName,
        item.name,
        item.extension,
        item.size,
        item.localPath,
        item.sha256,
        item.integrityCheckedAt,
        item.addedAt
      );
      added.push(item);
      queueSync(db, "file", item.id, "create", {
        projectId,
        kind: item.kind,
        markerName: item.markerName,
        name: item.name
      });
    });

    db.prepare(
      "UPDATE projects SET analysis_json = NULL, status = 'draft', updated_at = ? WHERE id = ?"
    ).run(new Date().toISOString(), projectId);
  });

  tx();
  return { project: getProject(userDataPath, projectId), added };
}

function removeAttachment(userDataPath, projectId, attachmentId) {
  const db = openDatabase(userDataPath);
  const row = db.prepare(
    "SELECT * FROM files WHERE id = ? AND project_id = ?"
  ).get(attachmentId, projectId);

  if (row && row.local_path && fs.existsSync(row.local_path)) {
    try { fs.unlinkSync(row.local_path); } catch (_error) { /* ignore */ }
  }

  db.prepare("DELETE FROM files WHERE id = ? AND project_id = ?").run(attachmentId, projectId);
  db.prepare(
    "UPDATE projects SET analysis_json = NULL, status = 'draft', updated_at = ? WHERE id = ?"
  ).run(new Date().toISOString(), projectId);

  queueSync(db, "file", attachmentId, "delete", { projectId });
  return getProject(userDataPath, projectId);
}

function recordAnalysis(userDataPath, projectId, analysis, status) {
  const db = openDatabase(userDataPath);
  const now = new Date().toISOString();
  const id = newId("analysis");

  db.prepare(`
    INSERT INTO ai_analyses(id, project_id, provider, content_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    id,
    projectId,
    analysis && analysis.provider ? analysis.provider : "",
    JSON.stringify(analysis || {}),
    now
  );

  db.prepare(
    "UPDATE projects SET analysis_json = ?, status = ?, updated_at = ? WHERE id = ?"
  ).run(JSON.stringify(analysis || {}), status || "analyzed", now, projectId);

  queueSync(db, "analysis", id, "create", {
    projectId,
    provider: analysis && analysis.provider ? analysis.provider : ""
  });

  return getProject(userDataPath, projectId);
}

function nextDocumentVersion(userDataPath, projectId) {
  const db = openDatabase(userDataPath);
  const latest = db.prepare(
    "SELECT MAX(version) AS max_version FROM document_versions WHERE project_id = ?"
  ).get(projectId);
  return Number(latest && latest.max_version || 0) + 1;
}

function snapshotFiles(project) {
  return (project.attachments || []).map((item) => ({
    id: item.id,
    kind: item.kind,
    markerName: item.markerName || "",
    name: item.name,
    extension: item.extension || "",
    size: item.size || 0,
    sha256: item.sha256 || "",
    addedAt: item.addedAt || ""
  }));
}

function saveDocumentVersion(db, project, version, generationResult, now) {
  const id = newId("ver");
  db.prepare(`
    INSERT INTO document_versions
      (id, project_id, version, template_id, template_version, document_code, document_version,
       form_data_json, analysis_json, files_json, ai_mode, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    project.id,
    version,
    project.template && project.template.id ? project.template.id : null,
    project.template && project.template.version ? Number(project.template.version) : null,
    generationResult && generationResult.code ? generationResult.code : project.generatedCode || "",
    project.documentVersion || "1.0",
    JSON.stringify(project.formData || {}),
    project.analysis ? JSON.stringify(project.analysis) : null,
    JSON.stringify(snapshotFiles(project)),
    project.aiMode || "fallback",
    now
  );
  return id;
}

function addGeneration(userDataPath, projectId, generationResult) {
  const db = openDatabase(userDataPath);
  const project = getProject(userDataPath, projectId);
  if (!project) throw new Error("No se encontró el documento.");

  const version = Number(
    generationResult && generationResult.version || nextDocumentVersion(userDataPath, projectId)
  );
  const outputs = generationResult && Array.isArray(generationResult.outputs)
    ? generationResult.outputs
    : [];
  const pdf = outputs.find((item) => item.type === "pdf");
  const docx = outputs.find((item) => item.type === "docx");
  const now = new Date().toISOString();
  const generationId = newId("gen");

  const pdfHash = pdf && pdf.path && fs.existsSync(pdf.path) ? sha256(pdf.path) : null;
  const docxHash = docx && docx.path && fs.existsSync(docx.path) ? sha256(docx.path) : null;

  const tx = db.transaction(() => {
    const versionId = saveDocumentVersion(db, project, version, generationResult, now);

    // Los archivos generados son solo la salida actual. El historial vive en document_versions.
    db.prepare("DELETE FROM generations WHERE project_id = ?").run(projectId);

    db.prepare(`
      INSERT INTO generations
        (id, project_id, version, generated_code, pdf_path, docx_path, engine, pdf_sha256, docx_sha256, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      generationId,
      projectId,
      version,
      generationResult && generationResult.code ? generationResult.code : "",
      pdf && pdf.path ? pdf.path : null,
      docx && docx.path ? docx.path : null,
      generationResult && generationResult.engine ? generationResult.engine : "",
      pdfHash,
      docxHash,
      now
    );

    db.prepare(
      "UPDATE projects SET status = 'generated', generated_code = ?, updated_at = ? WHERE id = ?"
    ).run(
      generationResult && generationResult.code ? generationResult.code : "",
      now,
      projectId
    );

    queueSync(db, "document_version", versionId, "create", {
      projectId,
      version,
      generatedCode: generationResult && generationResult.code ? generationResult.code : ""
    });
  });

  tx();
  return getProject(userDataPath, projectId);
}

function listDocumentVersions(userDataPath, projectId) {
  const db = openDatabase(userDataPath);
  return db.prepare(`
    SELECT id, project_id, version, template_id, template_version, document_code,
           document_version, ai_mode, created_at, form_data_json, analysis_json, files_json
    FROM document_versions
    WHERE project_id = ?
    ORDER BY version DESC
  `).all(projectId).map((row) => {
    const formData = parseJson(row.form_data_json, {});
    const analysis = parseJson(row.analysis_json, null);
    const files = parseJson(row.files_json, []);
    return {
      id: row.id,
      projectId: row.project_id,
      version: row.version,
      templateId: row.template_id || "",
      templateVersion: row.template_version || null,
      documentCode: row.document_code || "",
      documentVersion: row.document_version || "1.0",
      aiMode: row.ai_mode || "fallback",
      createdAt: row.created_at,
      fieldCount: Object.keys(formData).length,
      fileCount: Array.isArray(files) ? files.length : 0,
      provider: analysis && analysis.provider ? analysis.provider : ""
    };
  });
}

function getDocumentVersion(userDataPath, projectId, version) {
  const db = openDatabase(userDataPath);
  const row = db.prepare(
    "SELECT * FROM document_versions WHERE project_id = ? AND version = ?"
  ).get(projectId, Number(version));
  if (!row) return null;

  return {
    id: row.id,
    projectId: row.project_id,
    version: row.version,
    templateId: row.template_id || "",
    templateVersion: row.template_version || null,
    documentCode: row.document_code || "",
    documentVersion: row.document_version || "1.0",
    formData: parseJson(row.form_data_json, {}),
    analysis: parseJson(row.analysis_json, null),
    files: parseJson(row.files_json, []),
    aiMode: row.ai_mode || "fallback",
    createdAt: row.created_at
  };
}

function restoreDocumentVersion(userDataPath, projectId, version) {
  const db = openDatabase(userDataPath);
  const snapshot = getDocumentVersion(userDataPath, projectId, version);
  if (!snapshot) throw new Error("No se encontró esa versión de información.");

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM project_fields WHERE project_id = ?").run(projectId);

    const insertField = db.prepare(`
      INSERT INTO project_fields(project_id, field_name, value_json, updated_at)
      VALUES (?, ?, ?, ?)
    `);
    Object.entries(snapshot.formData || {}).forEach(([key, value]) => {
      insertField.run(projectId, key, JSON.stringify(value), now);
    });

    db.prepare(`
      UPDATE projects SET
        template_id = ?,
        document_version = ?,
        ai_mode = ?,
        generated_code = ?,
        analysis_json = ?,
        status = 'draft',
        updated_at = ?
      WHERE id = ?
    `).run(
      snapshot.templateId || null,
      snapshot.documentVersion || "1.0",
      snapshot.aiMode || "fallback",
      snapshot.documentCode || "",
      snapshot.analysis ? JSON.stringify(snapshot.analysis) : null,
      now,
      projectId
    );
  });

  tx();
  queueSync(db, "project", projectId, "restore_version", { version: snapshot.version });
  return getProject(userDataPath, projectId);
}

module.exports = {
  root,
  projectDir,
  generatedDir,
  createProject,
  saveProject,
  getProject,
  listProjects,
  addAttachments,
  removeAttachment,
  recordAnalysis,
  nextDocumentVersion,
  addGeneration,
  listDocumentVersions,
  getDocumentVersion,
  restoreDocumentVersion,
  safeName,
  copyUnique
};
