const fs = require("fs");
const path = require("path");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function root(userDataPath) {
  const dir = path.join(userDataPath, "documentos-workspace");
  ensureDir(dir);
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

function safeName(name) {
  return String(name || "archivo")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function newId(prefix) {
  return `${prefix || "item"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function projectJsonPath(userDataPath, projectId) {
  return path.join(projectDir(userDataPath, projectId), "project.json");
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
    codePattern: p.codePattern || "",
    structure: Array.isArray(p.structure) ? p.structure : [],
    mode: p.mode || "generate",
    formData: p.formData && typeof p.formData === "object" ? p.formData : {},
    aiMode: p.aiMode || "fallback",
    template: p.template || null,
    attachments: Array.isArray(p.attachments) ? p.attachments : [],
    analysis: p.analysis || null,
    outputs: Array.isArray(p.outputs) ? p.outputs : []
  };
}

function createProject(userDataPath, metadata) {
  const project = normalizeProject(metadata || {});
  projectDir(userDataPath, project.id);
  saveProject(userDataPath, project);
  return project;
}

function saveProject(userDataPath, input) {
  const project = normalizeProject(input);
  fs.writeFileSync(projectJsonPath(userDataPath, project.id), JSON.stringify(project, null, 2), "utf8");
  return project;
}

function getProject(userDataPath, projectId) {
  const file = projectJsonPath(userDataPath, projectId);
  if (!fs.existsSync(file)) return null;
  try {
    return normalizeProject(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch (_error) {
    return null;
  }
}

function listProjects(userDataPath) {
  const dir = projectsDir(userDataPath);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => getProject(userDataPath, entry.name))
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
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

function addAttachments(userDataPath, projectId, kind, paths) {
  const project = getProject(userDataPath, projectId);
  if (!project) throw new Error("No se encontró el documento local.");
  const folder = kind === "evidence" ? "evidence" : kind === "data" ? "data" : "sources";
  const destination = path.join(projectDir(userDataPath, projectId), folder);
  const added = [];

  (paths || []).forEach((sourcePath) => {
    if (!sourcePath || !fs.existsSync(sourcePath)) return;
    const localPath = copyUnique(sourcePath, destination);
    const stat = fs.statSync(localPath);
    const item = {
      id: newId("file"),
      kind,
      name: path.basename(localPath),
      extension: path.extname(localPath).toLowerCase(),
      size: stat.size,
      localPath,
      addedAt: new Date().toISOString()
    };
    project.attachments.push(item);
    added.push(item);
  });

  saveProject(userDataPath, project);
  return { project, added };
}

function removeAttachment(userDataPath, projectId, attachmentId) {
  const project = getProject(userDataPath, projectId);
  if (!project) throw new Error("No se encontró el documento local.");
  const item = project.attachments.find((attachment) => attachment.id === attachmentId);
  project.attachments = project.attachments.filter((attachment) => attachment.id !== attachmentId);
  if (item && item.localPath && fs.existsSync(item.localPath)) {
    try { fs.unlinkSync(item.localPath); } catch (_error) { /* ignore */ }
  }
  return saveProject(userDataPath, project);
}

function generatedDir(userDataPath, projectId) {
  return path.join(projectDir(userDataPath, projectId), "generated");
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
  safeName,
  copyUnique
};
