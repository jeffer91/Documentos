function clean(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeSeverity(value) {
  const severity = clean(value).toLowerCase();
  if (["error", "high", "alto", "critical", "critico", "crítico"].includes(severity)) return "error";
  if (["info", "low", "bajo"].includes(severity)) return "info";
  return "warning";
}

function normalizeAlert(alert, context) {
  const input = alert && typeof alert === "object" ? alert : { message: alert };
  const ctx = context || {};
  return {
    type: clean(input.type || "notice"),
    severity: normalizeSeverity(input.severity),
    message: clean(input.message || input.detail || ""),
    blocking: input.blocking !== false,
    source: clean(ctx.source || input.source || "section"),
    sectionKey: clean(ctx.sectionKey || input.sectionKey || ""),
    sectionTitle: clean(ctx.sectionTitle || input.sectionTitle || ""),
    blockKey: clean(ctx.blockKey || input.blockKey || ""),
    blockType: clean(ctx.blockType || input.blockType || ""),
    origin: clean(input.origin || ""),
    createdAt: clean(input.createdAt || "")
  };
}

function sectionAlerts(section) {
  const items = [];
  (section && Array.isArray(section.alerts) ? section.alerts : []).forEach((alert) => {
    const normalized = normalizeAlert(alert, {
      source: "section",
      sectionKey: section.key,
      sectionTitle: section.title
    });
    if (normalized.message) items.push(normalized);
  });

  (section && Array.isArray(section.blocks) ? section.blocks : []).forEach((block) => {
    (Array.isArray(block.alerts) ? block.alerts : []).forEach((alert) => {
      const normalized = normalizeAlert(alert, {
        source: "block",
        sectionKey: section.key,
        sectionTitle: section.title,
        blockKey: block.key,
        blockType: block.type
      });
      if (normalized.message) items.push(normalized);
    });
  });
  return items;
}

function collect(instance) {
  return (instance && Array.isArray(instance.sections) ? instance.sections : [])
    .flatMap((section) => sectionAlerts(section));
}

function summarizeAlerts(items) {
  const rows = Array.isArray(items) ? items : [];
  const bySeverity = { error: 0, warning: 0, info: 0 };
  const byType = {};
  let legacyBlockingFlags = 0;
  let sectionAlerts = 0;
  let blockAlerts = 0;

  rows.forEach((item) => {
    const severity = normalizeSeverity(item.severity);
    bySeverity[severity] = Number(bySeverity[severity] || 0) + 1;
    const type = clean(item.type || "notice") || "notice";
    byType[type] = Number(byType[type] || 0) + 1;
    if (item.blocking !== false) legacyBlockingFlags += 1;
    if (item.source === "block") blockAlerts += 1;
    else sectionAlerts += 1;
  });

  return {
    total: rows.length,
    bySeverity,
    byType,
    sectionAlerts,
    blockAlerts,
    legacyBlockingFlags,
    finalizationPolicy: "trace_only"
  };
}

function trace(instance) {
  const items = collect(instance);
  return {
    summary: summarizeAlerts(items),
    items
  };
}

function draftAlertsForSection(section) {
  return sectionAlerts(section);
}

module.exports = {
  normalizeSeverity,
  normalizeAlert,
  sectionAlerts,
  collect,
  summarizeAlerts,
  trace,
  draftAlertsForSection
};
