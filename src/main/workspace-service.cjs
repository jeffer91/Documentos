const fs = require("fs");
const path = require("path");
const { workspaceRoot, openDatabase, queueSync } = require("./database-service.cjs");
const { sha256 } = require("./file-integrity-service.cjs");
const PizZip = require("pizzip");
const { enrichMarker, parseMarkerInner, validateMarkers } = require("./template-markers.cjs");

const BLOCK_TYPES = new Set(["DATOS", "TABLA", "IMAGEN", "IMAGENES", "GRAFICO", "GRAFICOS"]);
const USER_TYPES = new Set(["CAMPO", "TEXTO", "FECHA", "NUMERO", "LISTA", "BUSCAR", "DATOS", "TABLA", "IMAGEN", "IMAGENES"]);
const templateLocationCache = new Map();

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

function objectsDir(userDataPath) {
  const dir = path.join(root(userDataPath), "objects", "sha256");
  ensureDir(dir);
  return dir;
}

function objectPathForHash(userDataPath, hashValue) {
  const hash = String(hashValue || "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    throw new Error("Huella SHA-256 inválida.");
  }
  const dir = path.join(objectsDir(userDataPath), hash.slice(0, 2));
  ensureDir(dir);
  return path.join(dir, hash);
}

function ensureObjectCopy(userDataPath, sourcePath, hashValue) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new Error("No se encontró el archivo que debe preservarse.");
  }
  const hash = hashValue || sha256(sourcePath);
  const target = objectPathForHash(userDataPath, hash);
  if (!fs.existsSync(target)) {
    fs.copyFileSync(sourcePath, target);
  } else if (sha256(target) !== hash) {
    throw new Error("El almacén histórico contiene un archivo con huella inconsistente.");
  }
  return target;
}

function backfillObjectStore(userDataPath) {
  const db = openDatabase(userDataPath);
  const rows = db.prepare(
    "SELECT local_path, sha256 FROM files WHERE sha256 IS NOT NULL AND sha256 <> ''"
  ).all();
  let copied = 0;
  rows.forEach((row) => {
    if (!row.local_path || !fs.existsSync(row.local_path)) return;
    const target = objectPathForHash(userDataPath, row.sha256);
    if (!fs.existsSync(target)) {
      ensureObjectCopy(userDataPath, row.local_path, row.sha256);
      copied += 1;
    }
  });
  return copied;
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

function externalAnalysisOnly(value) {
  const analysis = parseJson(value, null);
  const external = analysis && analysis.externalGeneratedFields;
  if (!external || typeof external !== "object" || !Object.keys(external).length) return null;
  const fields = Object.assign({}, external);
  const sources = {};
  Object.keys(fields).forEach((name) => { sources[name] = ["IA externa"]; });
  return {
    provider: "IA externa",
    generatedAt: new Date().toISOString(),
    generatedFields: fields,
    externalGeneratedFields: fields,
    fieldSources: sources,
    keyFindings: [],
    missingData: [],
    tables: [],
    charts: [],
    sourceTrace: [],
    notes: "Contenido importado mediante ITSQMET-DOCUMENTO-V2."
  };
}

function invalidateAnalysisPreservingExternal(db, projectId, now) {
  const row = db.prepare("SELECT analysis_json FROM projects WHERE id = ?").get(projectId);
  const externalOnly = externalAnalysisOnly(row && row.analysis_json);
  db.prepare(
    "UPDATE projects SET analysis_json = ?, status = 'draft', updated_at = ? WHERE id = ?"
  ).run(externalOnly ? JSON.stringify(externalOnly) : null, now || new Date().toISOString(), projectId);
}

function decodeTemplateXml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function templatePlainText(xml) {
  return decodeTemplateXml(String(xml || "")
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function templatePartLocation(name) {
  if (/^word\/header\d+\.xml$/.test(name)) return "Encabezado";
  if (/^word\/footer\d+\.xml$/.test(name)) return "Pie de página";
  return "Cuerpo del documento";
}

function templateHeadingLevel(paragraph) {
  const match = String(paragraph || "").match(/<w:pStyle\b[^>]*w:val="([^"]+)"/i);
  if (!match) return 0;
  const normalized = decodeTemplateXml(match[1])
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toUpperCase();
  const heading = normalized.match(/^(?:HEADING|TITULO)([1-6])$/);
  return heading ? Number(heading[1]) : 0;
}

function collectTemplateMarkerOccurrences(text, location, context, byRaw) {
  const regex = /\{\{\s*([^{}]+?)\s*\}\}/g;
  let match;
  while ((match = regex.exec(String(text || "")))) {
    const parsed = parseMarkerInner(match[1]);
    if (!parsed) continue;
    const meta = byRaw.get(parsed.raw) || { count: 0, locations: new Set(), contexts: new Set() };
    meta.count += 1;
    meta.locations.add(location);
    if (context) meta.contexts.add(context);
    byRaw.set(parsed.raw, meta);
  }
}

function attachTemplateLocations(filePath, markers) {
  if (!filePath || !fs.existsSync(filePath) || !Array.isArray(markers) || !markers.length) return markers;

  const stat = fs.statSync(filePath);
  const cacheKey = path.resolve(filePath) + "|" + stat.size + "|" + Math.round(stat.mtimeMs);
  let cached = templateLocationCache.get(cacheKey);

  if (!cached) {
    const zip = new PizZip(fs.readFileSync(filePath));
    const byRaw = new Map();

    Object.keys(zip.files)
      .filter((name) => /^word\/(document|header\d+|footer\d+)\.xml$/.test(name))
      .forEach((name) => {
        const xml = zip.file(name).asText();
        const location = templatePartLocation(name);
        const paragraphs = xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];

        if (location !== "Cuerpo del documento") {
          paragraphs.forEach((paragraph) => {
            collectTemplateMarkerOccurrences(templatePlainText(paragraph), location, location, byRaw);
          });
          return;
        }

        const headings = {};
        paragraphs.forEach((paragraph) => {
          const paragraphText = templatePlainText(paragraph).trim();
          const level = templateHeadingLevel(paragraph);
          if (level && paragraphText) {
            headings[level] = paragraphText;
            for (let deeper = level + 1; deeper <= 6; deeper += 1) delete headings[deeper];
          }

          let context = "";
          for (let candidate = 6; candidate >= 1; candidate -= 1) {
            if (headings[candidate]) {
              context = headings[candidate];
              break;
            }
          }
          collectTemplateMarkerOccurrences(paragraphText, location, context || location, byRaw);
        });
      });

    cached = {};
    byRaw.forEach((meta, raw) => {
      cached[raw] = {
        count: meta.count,
        locations: Array.from(meta.locations),
        contexts: Array.from(meta.contexts)
      };
    });
    templateLocationCache.clear();
    templateLocationCache.set(cacheKey, cached);
  }

  markers.forEach((marker) => {
    const meta = cached[marker.raw];
    marker.occurrenceCount = meta ? meta.count : 0;
    marker.locations = meta ? meta.locations.slice() : [];
    marker.contexts = meta ? meta.contexts.slice() : [];
  });
  return markers;
}

function templateBlockLocationErrors(markers) {
  return (markers || [])
    .filter((marker) =>
      marker.valid &&
      marker.isBlock &&
      (marker.locations || []).some((location) => location !== "Cuerpo del documento")
    )
    .map((marker) =>
      `{{${marker.raw}}}: los bloques de tablas, datos, imágenes o gráficos deben estar en el cuerpo del documento; no se admiten en encabezados ni pies de página.`
    );
}

function markerFromRow(row) {
  return enrichMarker({
    raw: row.raw,
    token: row.raw,
    valid: Boolean(row.valid),
    type: row.type,
    name: row.name,
    label: row.label || row.name,
    required: Boolean(row.required),
    config: row.config || "",
    columns: parseJson(row.columns_json, [])
  });
}

function templateById(db, templateId) {
  if (!templateId) return null;
  const row = db.prepare("SELECT * FROM templates WHERE id = ?").get(templateId);
  if (!row) return null;

  let markers = db.prepare(
    "SELECT * FROM template_fields WHERE template_id = ? ORDER BY sort_order, id"
  ).all(templateId).map(markerFromRow);

  try {
    markers = attachTemplateLocations(row.local_path, markers);
  } catch (_error) {
    // La ubicación es informativa; no debe impedir abrir un proyecto.
  }

  const storedValidation = parseJson(row.validation_json, { errors: [], warnings: [], ok: true });
  const liveValidation = validateMarkers(markers);
  const validation = {
    errors: Array.from(new Set([].concat(
      storedValidation.errors || [],
      liveValidation.errors || [],
      templateBlockLocationErrors(markers)
    ))),
    warnings: Array.from(new Set([].concat(storedValidation.warnings || [], liveValidation.warnings || [])))
  };
  validation.ok = validation.errors.length === 0;

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
    fields: markers.filter((marker) => marker.valid && (marker.isUserInput || marker.type === "CALC")),
    aiFields: markers.filter((marker) => marker.valid && marker.isAi),
    systemFields: markers.filter((marker) => marker.valid && marker.isSystem),
    validation
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

function invalidateCalculatedFields(db, projectId) {
  const row = db.prepare("SELECT template_id FROM projects WHERE id = ?").get(projectId);
  if (!row || !row.template_id) return;

  const calculated = db.prepare(
    "SELECT name FROM template_fields WHERE template_id = ? AND type = 'CALC'"
  ).all(row.template_id);

  const remove = db.prepare(
    "DELETE FROM project_fields WHERE project_id = ? AND field_name = ?"
  );
  calculated.forEach((field) => remove.run(projectId, field.name));
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
    aiMode: p.aiMode || "external",
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
    aiMode: row.ai_mode || "external",
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
      const fileHash = sha256(localPath);
      ensureObjectCopy(userDataPath, localPath, fileHash);
      const item = {
        id: newId("file"),
        kind,
        markerName: markerName || "",
        name: path.basename(localPath),
        extension: path.extname(localPath).toLowerCase(),
        size: stat.size,
        localPath,
        sha256: fileHash,
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

    invalidateAnalysisPreservingExternal(db, projectId, new Date().toISOString());
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
  invalidateAnalysisPreservingExternal(db, projectId, new Date().toISOString());

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
    project.aiMode || "external",
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
      aiMode: row.ai_mode || "external",
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
    aiMode: row.ai_mode || "external",
    createdAt: row.created_at
  };
}

function restoreDocumentVersion(userDataPath, projectId, version) {
  const db = openDatabase(userDataPath);
  const snapshot = getDocumentVersion(userDataPath, projectId, version);
  if (!snapshot) throw new Error("No se encontró esa versión de información.");

  const historicalFiles = Array.isArray(snapshot.files) ? snapshot.files : [];
  const preparedFiles = historicalFiles.map((item) => {
    const hash = String(item.sha256 || "").toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(hash)) {
      throw new Error(`${item.name || "Archivo"}: esta versión antigua no tiene una huella recuperable.`);
    }

    const objectPath = objectPathForHash(userDataPath, hash);
    if (!fs.existsSync(objectPath) || sha256(objectPath) !== hash) {
      throw new Error(`${item.name || "Archivo"}: no se encontró la copia histórica necesaria para reconstruir la versión.`);
    }

    const folder = item.kind === "evidence" ? "evidence" : item.kind === "data" ? "data" : "sources";
    const destination = path.join(projectDir(userDataPath, projectId), folder);
    const preferred = safeName(item.name || `archivo${item.extension || ""}`);
    const ext = path.extname(preferred);
    const stem = path.basename(preferred, ext);
    let localPath = path.join(destination, preferred);
    let n = 2;
    while (fs.existsSync(localPath)) {
      localPath = path.join(destination, `${stem} (restaurado ${n})${ext}`);
      n += 1;
    }
    fs.copyFileSync(objectPath, localPath);

    return {
      id: newId("file"),
      kind: item.kind || "source",
      markerName: item.markerName || "",
      name: path.basename(localPath),
      extension: item.extension || path.extname(localPath).toLowerCase(),
      size: Number(item.size || fs.statSync(localPath).size),
      localPath,
      sha256: hash,
      integrityCheckedAt: new Date().toISOString(),
      addedAt: item.addedAt || new Date().toISOString()
    };
  });

  const previousFiles = db.prepare(
    "SELECT local_path FROM files WHERE project_id = ?"
  ).all(projectId).map((row) => row.local_path).filter(Boolean);

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM project_fields WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM files WHERE project_id = ?").run(projectId);

    const insertField = db.prepare(`
      INSERT INTO project_fields(project_id, field_name, value_json, updated_at)
      VALUES (?, ?, ?, ?)
    `);
    Object.entries(snapshot.formData || {}).forEach(([key, value]) => {
      insertField.run(projectId, key, JSON.stringify(value), now);
    });

    const insertFile = db.prepare(`
      INSERT INTO files
        (id, project_id, kind, marker_name, name, extension, size, local_path, sha256, integrity_checked_at, added_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    preparedFiles.forEach((item) => {
      insertFile.run(
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
      snapshot.aiMode || "external",
      snapshot.documentCode || "",
      snapshot.analysis ? JSON.stringify(snapshot.analysis) : null,
      now,
      projectId
    );
  });

  try {
    tx();
  } catch (error) {
    preparedFiles.forEach((item) => {
      try { if (fs.existsSync(item.localPath)) fs.unlinkSync(item.localPath); } catch (_error) { /* ignore */ }
    });
    throw error;
  }

  const restoredPaths = new Set(preparedFiles.map((item) => path.resolve(item.localPath)));
  previousFiles.forEach((filePath) => {
    try {
      if (filePath && fs.existsSync(filePath) && !restoredPaths.has(path.resolve(filePath))) {
        fs.unlinkSync(filePath);
      }
    } catch (_error) { /* ignore */ }
  });

  queueSync(db, "project", projectId, "restore_version", { version: snapshot.version });
  return getProject(userDataPath, projectId);
}

module.exports = {
  root,
  projectDir,
  generatedDir,
  objectsDir,
  objectPathForHash,
  ensureObjectCopy,
  backfillObjectStore,
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
