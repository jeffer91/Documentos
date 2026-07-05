/* =========================================================
Archivo: app.js
Ruta: /src/renderer/app.js
Funciones principales:
- Manejar la pantalla inicial.
- Actualizar la vista previa de la portada.
========================================================= */

(function () {
  "use strict";

  const tipos = {
    REG: ["Reglamento", "Reglamento de", "REG", true],
    POL: ["Política", "Política de", "POL", true],
    MP: ["Manual de Procesos", "Manual de Procesos", "MP", true],
    INS: ["Instructivo", "Instructivo para", "INS", true],
    INSO: ["Informe de Socialización", "Informe de Socialización de", "INSO", true],
    ACT: ["Acta de Reunión", "Acta de Reunión de", "ACT", true],
    INF: ["Informe de cualquier índole", "Informe de", "INF", true],
    PROG: ["Programa", "Programa de", "PROG", true],
    OFI: ["Oficio", "Oficio", "OFI", false],
    MEM: ["Memorando", "Memorando", "MEM", false],
    COM: ["Comunicado", "Comunicado", "COM", false],
    CERT: ["Certificado", "Certificado", "CERT", false],
    RGI: ["Formato / Registro", "Formato", "RGI", false]
  };

  const $ = function (id) {
    return document.getElementById(id);
  };

  const campos = [
    "documentType",
    "unitName",
    "unitCode",
    "documentTitle",
    "version",
    "documentNumber",
    "processNumber",
    "year",
    "month",
    "outputType"
  ];

  function limpiar(valor) {
    return String(valor || "").trim();
  }

  function dosDigitos(valor) {
    const texto = limpiar(valor);
    if (!texto) return "0X";
    if (/^\d$/.test(texto)) return "0" + texto;
    return texto;
  }

  function tipoActual() {
    const clave = $("documentType").value;
    return tipos[clave] || null;
  }

  function construirCodigo() {
    const tipo = tipoActual();
    if (!tipo) return "----";

    const sigla = limpiar($("unitCode").value) || "XXXX";
    const numero = dosDigitos($("documentNumber").value);
    const proceso = limpiar($("processNumber").value) || "0X";
    const anio = limpiar($("year").value) || "20XX";
    const mes = dosDigitos($("month").value);
    const codigoTipo = tipo[2];

    if (["REG", "POL", "MP", "INS"].includes(codigoTipo)) {
      return sigla + "-" + codigoTipo + "-" + numero;
    }

    if (["INF", "INSO", "ACT", "PROG", "RGI"].includes(codigoTipo)) {
      return sigla + "-" + codigoTipo + "-" + numero + "-PRO-" + proceso + "-" + anio + "-" + mes;
    }

    return codigoTipo + "-ITSQMET-" + sigla + "-" + anio + "-" + mes + "-" + numero;
  }

  function construirTitulo() {
    const tipo = tipoActual();
    const titulo = limpiar($("documentTitle").value);

    if (!tipo) return "Portada del documento";
    if (!titulo) return tipo[1] + " XXX";
    if (tipo[2] === "MP") return titulo;
    return tipo[1] + " " + titulo;
  }

  function actualizarVista() {
    const tipo = tipoActual();
    const unidad = limpiar($("unitName").value) || "Unidad / Coordinación";
    const titulo = construirTitulo();

    $("docBadge").textContent = tipo ? tipo[0] : "Sin seleccionar";
    $("previewUnit").textContent = unidad;
    $("previewHeaderTitle").textContent = titulo;
    $("previewCode").textContent = construirCodigo();
    $("previewVersion").textContent = limpiar($("version").value) || "1.0";
    $("previewMainTitle").textContent = titulo;

    if (!tipo) {
      $("noticeBox").textContent = "Selecciona un tipo de documento para preparar la portada.";
      return;
    }

    $("noticeBox").textContent = tipo[3]
      ? "Este documento usará portada formal con tabla superior y tabla inferior de firmas."
      : "Este documento usa formato administrativo, no portada clásica.";
  }

  function prepararPortada(event) {
    event.preventDefault();

    if (!tipoActual()) {
      $("noticeBox").textContent = "Primero selecciona el tipo de documento.";
      return;
    }

    $("noticeBox").textContent = "Portada preparada correctamente. En el siguiente bloque se generará el Word y el PDF.";
  }

  campos.forEach(function (id) {
    const campo = $(id);
    campo.addEventListener("input", actualizarVista);
    campo.addEventListener("change", actualizarVista);
  });

  $("documentForm").addEventListener("submit", prepararPortada);

  if (window.documentosApp && window.documentosApp.version) {
    $("appVersion").textContent = "v" + window.documentosApp.version;
  }

  actualizarVista();
})();
