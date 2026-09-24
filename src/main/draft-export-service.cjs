const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");
const hub = require("./process-hub-service.cjs");
const apa7 = require("./apa7-service.cjs");
const citations = require("./citation-service.cjs");
const editorial = require("./editorial-structure-service.cjs");
const alertPolicy = require("./alert-policy-service.cjs");
const exportQuality = require("./export-quality-service.cjs");
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

function compactError(error) {
  if (!error) return "";
  const stderr = error.stderr ? String(error.stderr) : "";
  const stdout = error.stdout ? String(error.stdout) : "";
  return String(error.message || stderr || stdout || error)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
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

function libreOfficeBinary() {
  if (commandExists("soffice")) return "soffice";
  if (commandExists("libreoffice")) return "libreoffice";
  return "";
}

function convertWithLibreOffice(htmlPath, outputDir, formats, binary) {
  const executable = binary || libreOfficeBinary();
  if (!executable) throw new Error("LibreOffice no está disponible.");
  formats.forEach((format) => {
    const target = format === "docx" ? "docx" : format === "pdf" ? "pdf" : "";
    if (!target) return;
    childProcess.execFileSync(executable, ["--headless", "--convert-to", target, "--outdir", outputDir, htmlPath], {
      stdio: "pipe",
      timeout: 180000
    });
  });
}

function converterStatus(formats) {
  const requested = (formats || []).filter((item) => item === "docx" || item === "pdf");
  if (!requested.length) {
    return {
      required: false,
      available: true,
      attempted: false,
      name: "none",
      formats: [],
      error: ""
    };
  }

  if (process.platform === "win32" && commandExists("powershell.exe")) {
    return {
      required: true,
      available: true,
      attempted: false,
      name: "microsoft_word",
      formats: requested,
      error: ""
    };
  }

  const binary = libreOfficeBinary();
  if (binary) {
    return {
      required: true,
      available: true,
      attempted: false,
      name: "libreoffice",
      binary,
      formats: requested,
      error: ""
    };
  }

  return {
    required: true,
    available: false,
    attempted: false,
    name: "none",
    formats: requested,
    error: "No hay Microsoft Word ni LibreOffice disponible para convertir el HTML."
  };
}

function buildHtml(instance, options, assetDir, citationRows, referenceRows) {
  return apa7.buildDocumentHtml(instance, Object.assign({}, options || {}, {
    assetDir,
    citations: citationRows || [],
    references: referenceRows || citationRows || []
  }));
}

function readJsonFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_error) {
    return null;
  }
}

function layoutReportStatus(report) {
  if (!report) return { available: false, healthy: true, issues: [] };
  const issues = [];
  if (Number(report.orphanHeadingCount || 0) > 0) {
    issues.push(`Word detectó ${Number(report.orphanHeadingCount)} título(s) huérfano(s).`);
  }
  if (Number(report.tableHeaderRepeatFailures || 0) > 0) {
    issues.push(`Word detectó ${Number(report.tableHeaderRepeatFailures)} tabla(s) sin encabezado repetido.`);
  }
  if (Number(report.tableRowSplitFailures || 0) > 0) {
    issues.push(`Word detectó ${Number(report.tableRowSplitFailures)} tabla(s) que podrían partir filas entre páginas.`);
  }
  if (Number(report.oversizedFigureCount || 0) > 0) {
    issues.push(`Word detectó ${Number(report.oversizedFigureCount)} figura(s) sobredimensionada(s).`);
  }
  return { available: true, healthy: issues.length === 0, issues };
}

function healthyOutputs(assessment) {
  return (assessment.files || [])
    .filter((item) => item.healthy)
    .map((item) => ({ type: item.type, path: item.path, size: item.size }));
}

function exportInstance(userDataPath, instanceId, options, appRoot) {
  const input = options || {};
  const instance = hub.ensureCurrentDocumentInstance(userDataPath, instanceId);
  if (!instance) throw new Error("Documento no válido.");
  const final = input.final === true;
  if (final && !instance.finalFrozenAt) throw new Error("Primero aprueba y congela la versión final.");

  const validation = editorial.validateDocumentInstance(instance);
  const alertTrace = instance.alertTrace && instance.alertTrace.summary
    ? instance.alertTrace
    : alertPolicy.trace(instance);
  const alertsVisible = !final && input.includeAlerts !== false;
  if (final && !validation.ok) {
    throw new Error(`No se puede exportar la versión final: ${validation.errors.slice(0, 4).join(" | ")}`);
  }

  const requested = exportQuality.normalizeFormats(input.formats);
  const root = path.join(workspaceRoot(userDataPath), "dossiers", instance.dossierId, "exports", instance.id);
  fs.mkdirSync(root, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const suffix = final ? "final" : "borrador";
  const base = path.join(root, `${suffix}-${stamp}`);
  const htmlPath = `${base}.html`;
  const manifestPath = `${base}.manifest.json`;
  const assetDir = `${base}-assets`;
  fs.mkdirSync(assetDir, { recursive: true });

  let citationSet = null;
  let citationSnapshotMode = "live";
  const frozenCitationSnapshot = final && instance.frozenSnapshot && instance.frozenSnapshot.citationSnapshot;
  if (frozenCitationSnapshot && Array.isArray(frozenCitationSnapshot.citations)) {
    citationSnapshotMode = "frozen";
    const selectedKeys = citations.citationTokensFromInstance(instance, input.sectionKeys);
    const selected = frozenCitationSnapshot.citations.filter((item) => selectedKeys.includes(item.citationKey));
    citationSet = citations.prepareCitationSet(selected);
  } else {
    citationSet = citations.resolveInstanceCitations(userDataPath, instance, {
      sectionKeys: input.sectionKeys
    });
    if (final) citationSnapshotMode = "live_legacy_fallback";
  }

  if (final && citationSet.ok === false) {
    const pending = [].concat(citationSet.missing || [], citationSet.incomplete || []);
    throw new Error(`Hay citas APA incompletas o no registradas: ${pending.slice(0, 8).join(", ")}.`);
  }

  const rendered = buildHtml(instance, input, assetDir, citationSet.citations || [], citationSet.references || []);
  if (final && rendered.missingCitations.length) {
    throw new Error(
      `Hay citas APA incompletas o no registradas: ${rendered.missingCitations.slice(0, 8).join(", ")}.`
    );
  }
  fs.writeFileSync(htmlPath, rendered.html, "utf8");

  const missingAssets = Array.isArray(rendered.missingAssets) ? rendered.missingAssets : [];
  const conversionFormats = requested.filter((format) => format !== "html");
  const converter = converterStatus(conversionFormats);
  const issues = [];

  if (final && missingAssets.length) {
    issues.push(`La versión final tiene ${missingAssets.length} recurso(s) visual(es) pendiente(s).`);
  } else if (conversionFormats.length && converter.available) {
    converter.attempted = true;
    try {
      if (converter.name === "microsoft_word") {
        convertWithWord(htmlPath, base, appRoot, conversionFormats);
      } else if (converter.name === "libreoffice") {
        convertWithLibreOffice(htmlPath, root, conversionFormats, converter.binary);
      }
    } catch (error) {
      converter.error = compactError(error);
      issues.push(`Falló la conversión con ${converter.name}: ${converter.error}`);
    }
  } else if (conversionFormats.length && !converter.available) {
    issues.push(converter.error);
  }

  const assessment = exportQuality.assessOutputs(base, htmlPath, requested);
  assessment.missingFormats.forEach((format) => {
    issues.push(`No se generó un archivo ${format.toUpperCase()} válido.`);
  });

  const wordReportPath = `${base}.word-report.json`;
  const wordReport = readJsonFile(wordReportPath);
  const layoutStatus = layoutReportStatus(wordReport);
  issues.push(...layoutStatus.issues);

  const complete =
    assessment.complete &&
    !(final && missingAssets.length) &&
    layoutStatus.healthy;
  const outputs = healthyOutputs(assessment);
  const status = complete ? "complete" : "incomplete";

  const manifest = {
    instanceId,
    engineId: instance.engineId,
    engineVersion: instance.engineVersion,
    final,
    createdAt: new Date().toISOString(),
    status,
    complete,
    requestedFormats: assessment.requestedFormats,
    generatedFormats: assessment.generatedFormats,
    missingFormats: assessment.missingFormats,
    files: assessment.files,
    converter: {
      required: converter.required,
      available: converter.available,
      attempted: converter.attempted,
      name: converter.name,
      formats: converter.formats,
      error: converter.error
    },
    missingAssets,
    wordLayoutReport: wordReport,
    wordLayoutStatus: layoutStatus,
    missingCitations: rendered.missingCitations,
    issues,
    citationSnapshotMode,
    alertSummary: alertTrace.summary,
    alertsVisible
  };
  exportQuality.writeManifest(manifestPath, manifest);

  hub.audit(hub.dbFor(userDataPath), {
    dossierId: instance.dossierId,
    instanceId,
    entityType: "document_export",
    entityId: instanceId,
    action: final ? "export_final" : "export_draft",
    detail: {
      apaProfile: apa7.PROFILE.name,
      sectionKeys: input.sectionKeys || [],
      status,
      complete,
      requestedFormats: assessment.requestedFormats,
      generatedFormats: assessment.generatedFormats,
      missingFormats: assessment.missingFormats,
      outputs: outputs.map((item) => item.type),
      converter: manifest.converter,
      manifestPath,
      wordLayoutReport: wordReport,
      wordLayoutStatus: layoutStatus,
      missingAssets,
      missingCitations: rendered.missingCitations,
      citationSnapshotMode,
      usedCitationKeys: (citationSet.citations || []).map((item) => item.citationKey),
      referenceCount: (citationSet.references || []).length,
      editorialWarnings: validation.warnings,
      alertSummary: alertTrace.summary,
      alertsVisible
    }
  });

  return {
    instanceId,
    final,
    status,
    complete,
    apaProfile: apa7.PROFILE,
    requestedFormats: assessment.requestedFormats,
    generatedFormats: assessment.generatedFormats,
    missingFormats: assessment.missingFormats,
    outputs,
    files: assessment.files,
    converter: manifest.converter,
    manifestPath,
    wordLayoutReport: wordReport,
    wordLayoutStatus: layoutStatus,
    diagnosticHtmlPath: assessment.htmlHealthy ? htmlPath : "",
    issues,
    missingAssets,
    editorialValidation: validation,
    missingCitations: rendered.missingCitations,
    citationSnapshotMode,
    usedCitationKeys: (citationSet.citations || []).map((item) => item.citationKey),
    referenceCount: (citationSet.references || []).length,
    alertSummary: alertTrace.summary,
    alertsVisible
  };
}

module.exports = {
  commandExists,
  converterStatus,
  buildHtml,
  exportInstance
};
