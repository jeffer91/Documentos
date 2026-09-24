const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");
const hub = require("./process-hub-service.cjs");
const apa7 = require("./apa7-service.cjs");
const citations = require("./citation-service.cjs");
const editorial = require("./editorial-structure-service.cjs");
const { workspaceRoot } = require("./database-service.cjs");

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
  childProcess.execFileSync("powershell.exe", args, {
    windowsHide: true,
    stdio: "pipe",
    timeout: 180000
  });
}

function convertWithLibreOffice(htmlPath, outputDir, formats) {
  const binary = commandExists("soffice") ? "soffice" : commandExists("libreoffice") ? "libreoffice" : "";
  if (!binary) return;
  formats.forEach((format) => {
    const target = format === "docx" ? "docx" : format === "pdf" ? "pdf" : "";
    if (!target) return;
    childProcess.execFileSync(binary, ["--headless", "--convert-to", target, "--outdir", outputDir, htmlPath], {
      stdio: "pipe",
      timeout: 180000
    });
  });
}

function buildHtml(instance, options, assetDir, citationRows) {
  return apa7.buildDocumentHtml(instance, Object.assign({}, options || {}, {
    assetDir,
    citations: citationRows || []
  }));
}

function exportInstance(userDataPath, instanceId, options, appRoot) {
  const instance = hub.getDocumentInstance(userDataPath, instanceId);
  if (!instance) throw new Error("Documento no válido.");
  const final = options && options.final === true;
  if (final && !instance.finalFrozenAt) throw new Error("Primero aprueba y congela la versión final.");

  const validation = editorial.validateDocumentInstance(instance);
  if (final && !validation.ok) {
    throw new Error(`No se puede exportar la versión final: ${validation.errors.slice(0, 4).join(" | ")}`);
  }

  const root = path.join(workspaceRoot(userDataPath), "dossiers", instance.dossierId, "exports", instance.id);
  fs.mkdirSync(root, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const suffix = final ? "final" : "borrador";
  const base = path.join(root, `${suffix}-${stamp}`);
  const htmlPath = `${base}.html`;
  const assetDir = `${base}-assets`;
  fs.mkdirSync(assetDir, { recursive: true });

  const citationRows = citations.listCitations(userDataPath, instance.dossierId);
  const rendered = buildHtml(instance, options || {}, assetDir, citationRows);
  if (final && rendered.missingCitations.length) {
    throw new Error(
      `Hay citas APA incompletas o no registradas: ${rendered.missingCitations.slice(0, 8).join(", ")}.`
    );
  }
  fs.writeFileSync(htmlPath, rendered.html, "utf8");

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
    // HTML APA queda disponible aunque el convertidor local no exista.
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
    detail: {
      apaProfile: apa7.PROFILE.name,
      sectionKeys: options && options.sectionKeys || [],
      outputs: outputs.map((item) => item.type),
      missingCitations: rendered.missingCitations,
      editorialWarnings: validation.warnings
    }
  });

  return {
    instanceId,
    final,
    apaProfile: apa7.PROFILE,
    outputs,
    editorialValidation: validation,
    missingCitations: rendered.missingCitations
  };
}

module.exports = { buildHtml, exportInstance };
