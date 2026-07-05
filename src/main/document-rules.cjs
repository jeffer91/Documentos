/* =========================================================
Archivo: document-rules.cjs
Ruta: /src/main/document-rules.cjs
Funciones principales:
- Centralizar reglas por tipo documental.
- Definir etiquetas de fecha y comportamiento de portada.
========================================================= */

const FORMAL_COVER_TYPES = ["REG", "POL", "MP", "INS", "INSO", "ACT", "INF", "PROG"];

const DOCUMENT_RULES = {
  REG: { label: "Reglamento", dateLabel: "Fecha de Elaboración:", needsFormalCover: true },
  POL: { label: "Política", dateLabel: "Fecha de Elaboración:", needsFormalCover: true },
  MP: { label: "Manual de Procesos", dateLabel: "Fecha de Elaboración:", needsFormalCover: true },
  INS: { label: "Instructivo", dateLabel: "Fecha de Elaboración:", needsFormalCover: true },
  INSO: { label: "Informe de Socialización", dateLabel: "Fecha de Socialización:", needsFormalCover: true },
  ACT: { label: "Acta de Reunión", dateLabel: "Fecha de Reunión:", needsFormalCover: true },
  INF: { label: "Informe", dateLabel: "Fecha de Elaboración:", needsFormalCover: true },
  PROG: { label: "Programa", dateLabel: "Fecha de Elaboración:", needsFormalCover: true },
  RGI: { label: "Formato / Registro", dateLabel: "Fecha de Elaboración:", needsFormalCover: false },
  OFI: { label: "Oficio", dateLabel: "Fecha:", needsFormalCover: false },
  MEM: { label: "Memorando", dateLabel: "Fecha:", needsFormalCover: false },
  COM: { label: "Comunicado", dateLabel: "Fecha:", needsFormalCover: false },
  CERT: { label: "Certificado", dateLabel: "Fecha:", needsFormalCover: false }
};

function getDocumentRule(typeKey) {
  return DOCUMENT_RULES[typeKey] || {
    label: "Documento",
    dateLabel: "Fecha de Elaboración:",
    needsFormalCover: true
  };
}

function hasFormalCover(typeKey) {
  return FORMAL_COVER_TYPES.includes(typeKey);
}

module.exports = {
  DOCUMENT_RULES,
  FORMAL_COVER_TYPES,
  getDocumentRule,
  hasFormalCover
};
