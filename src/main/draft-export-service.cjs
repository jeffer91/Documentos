const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");
const hub = require("./process-hub-service.cjs");
const { workspaceRoot } = require("./database-service.cjs");

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphs(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length > 1 && lines.every((line) => /^[-•*]\s+/.test(line))) {
        return `<ul>${lines.map((line) => `<li>${escapeHtml(line.replace(/^[-•*]\s+/, ""))}</li>`).join("")}</ul>`;
      }
      return `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");
}

function alertHtml(alerts) {
  if (!alerts || !alerts.length) return "";
  return `
    <div class="alerts">
      <h4>Alertas del borrador</h4>
      ${alerts.map((alert) => `<div class="alert"><b>${escapeHtml(alert.severity || "aviso")}</b> · ${escapeHtml(alert.message || "")}</div>`).join("")}
    </div>
  `;
}

function buildHtml(instance, options) {
  const includeAlerts = options && options.includeAlerts !== false;
  const final = options && options.final === true;
  const wanted = options && Array.isArray(options.sectionKeys) && options.sectionKeys.length
    ? new Set(options.sectionKeys)
    : null;
  const sections = instance.sections.filter((section) => !wanted || wanted.has(section.key));
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapeHtml(instance.label)}</title>
<style>
  body{font-family:Arial,sans-serif;margin:2.5cm;color:#111;line-height:1.5;font-size:11pt}
  h1{font-size:18pt;text-align:center;margin-bottom:24px}
  h2{font-size:14pt;margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:5px}
  p{margin:0 0 10px;text-align:justify}
  .meta{font-size:9pt;color:#555;margin-bottom:24px}
  .alerts{border:1px solid #d97706;background:#fffbeb;padding:10px 12px;margin:10px 0 18px}
  .alerts h4{margin:0 0 7px;color:#92400e}
  .alert{font-size:9pt;color:#78350f;margin:4px 0}
  .status{font-size:8pt;color:#666}
  ul{margin:0 0 10px 22px}
</style>
</head>
<body>
<h1>${escapeHtml(instance.label)}</h1>
<div class="meta">Motor: ${escapeHtml(instance.engineId)} · versión ${escapeHtml(instance.engineVersion)} · ${final ? "VERSIÓN FINAL" : "BORRADOR"}</div>
${sections.map((section, index) => `
  <section>
    <h2>${index + 1}. ${escapeHtml(section.title)}</h2>
    ${!final && includeAlerts ? alertHtml(section.alerts) : ""}
    ${paragraphs(section.content)}
    ${!final ? `<div class="status">Estado interno: ${escapeHtml(section.status)}</div>` : ""}
  </section>
`).join("\n")}
</body>
</html>`;
}

function commandExists(command) {
  try {
    const probe = process.platform === "win32" ? "where" : "which";
    childProcess.execFileSync(probe, [command], { stdio: "ignore" });
    return true;
  } catch (_error) {
    return false;
  }
}

function convertWithWord(htmlPath, outputBase, rootDir, formats) {
  const script = path.join(rootDir, "scripts", "export-draft.ps1");
  const args = [
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", script,
    "-InputHtml", htmlPath,
    "-OutputBase", outputBase,
    "-Formats", formats.join(",")
  ];
  childProcess.execFileSync("powershell.exe", args, { windowsHide: true, stdio: "pipe", timeout: 120000 });
}

function convertWithLibreOffice(htmlPath, outputDir, formats) {
  const binary = commandExists("soffice") ? "soffice" : commandExists("libreoffice") ? "libreoffice" : "";
  if (!binary) return;
  formats.forEach((format) => {
    const target = format === "docx" ? "docx" : format === "pdf" ? "pdf" : "";
    if (!target) return;
    childProcess.execFileSync(binary, ["--headless", "--convert-to", target, "--outdir", outputDir, htmlPath], {
      stdio: "pipe",
      timeout: 120000
    });
  });
}

function exportInstance(userDataPath, instanceId, options, appRoot) {
  const instance = hub.getDocumentInstance(userDataPath, instanceId);
  if (!instance) throw new Error("Documento no válido.");
  const final = options && options.final === true;
  if (final && !instance.finalFrozenAt) throw new Error("Primero aprueba y congela la versión final.");
  const html = buildHtml(instance, options || {});
  const root = path.join(workspaceRoot(userDataPath), "dossiers", instance.dossierId, "exports", instance.id);
  fs.mkdirSync(root, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const suffix = final ? "final" : "borrador";
  const base = path.join(root, `${suffix}-${stamp}`);
  const htmlPath = `${base}.html`;
  fs.writeFileSync(htmlPath, html, "utf8");

  const requested = options && Array.isArray(options.formats) && options.formats.length
    ? options.formats
    : ["docx", "pdf"];
  const outputs = [{ type: "html", path: htmlPath }];

  try {
    if (process.platform === "win32" && commandExists("powershell.exe")) {
      convertWithWord(htmlPath, base, appRoot, requested);
    } else {
      convertWithLibreOffice(htmlPath, root, requested);
    }
  } catch (_error) {
    // HTML permanece como salida segura aunque Word/LibreOffice no esté disponible.
  }

  requested.forEach((format) => {
    const candidate = format === "docx" ? `${base}.docx` : format === "pdf" ? `${base}.pdf` : "";
    if (candidate && fs.existsSync(candidate)) outputs.push({ type: format, path: candidate });
  });

  hub.audit(hub.dbFor(userDataPath), {
    dossierId: instance.dossierId,
    instanceId,
    entityType: "document_export",
    entityId: instanceId,
    action: final ? "export_final" : "export_draft",
    detail: { sectionKeys: options && options.sectionKeys || [], outputs: outputs.map((item) => item.type) }
  });

  return { instanceId, final, outputs };
}

module.exports = { buildHtml, exportInstance };
