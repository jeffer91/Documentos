/* =========================================================
Archivo: app.js
Ruta: /src/renderer/app.js
Funciones principales:
- Manejar la pantalla inicial.
- Actualizar la vista previa de la portada.
- Enviar los datos a Electron para generar Word o PDF.
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
    "outputType",
    "documentDate",
    "totalPages"
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

  function fechaIsoActual() {
    const hoy = new Date();
    const dia = String(hoy.getDate()).padStart(2, "0");
    const mes = String(hoy.getMonth() + 1).padStart(2, "0");
    const anio = String(hoy.getFullYear());
    return anio + "-" + mes + "-" + dia;
  }

  function fechaActual() {
    return convertirFechaIso(limpiar($("documentDate").value) || fechaIsoActual());
  }

  function convertirFechaIso(valor) {
    const partes = limpiar(valor).split("-");
    if (partes.length !== 3) return valor || "día/mes/año";
    return partes[2] + "/" + partes[1] + "/" + partes[0];
  }

  function totalPaginas() {
    const numero = Number(limpiar($("totalPages").value));
    if (!Number.isFinite(numero) || numero < 1) return 1;
    return Math.floor(numero);
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

  function textoSalida() {
    return $("outputType").value === "pdf" ? "PDF" : "Word";
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

    if ($("previewTotalPages")) {
      $("previewTotalPages").textContent = String(totalPaginas());
    }

    if (!tipo) {
      $("noticeBox").textContent = "Selecciona un tipo de documento para preparar la portada.";
      return;
    }

    $("noticeBox").textContent = tipo[3]
      ? "Este documento usará portada formal. Salida seleccionada: " + textoSalida() + "."
      : "Este documento usa formato administrativo. Salida seleccionada: " + textoSalida() + ".";
  }

  function datosPortada() {
    const tipo = tipoActual();

    return {
      typeKey: $("documentType").value,
      typeLabel: tipo ? tipo[0] : "",
      code: construirCodigo(),
      unitName: limpiar($("unitName").value),
      unitCode: limpiar($("unitCode").value),
      title: construirTitulo(),
      rawTitle: limpiar($("documentTitle").value),
      version: limpiar($("version").value) || "1.0",
      number: dosDigitos($("documentNumber").value),
      processNumber: limpiar($("processNumber").value),
      year: limpiar($("year").value),
      month: dosDigitos($("month").value),
      outputType: $("outputType").value,
      date: fechaActual(),
      totalPages: totalPaginas(),
      signers: {
        elaboradoPor: {
          nombre: "Mgs. Jefferson Villarreal",
          cargo: "Coordinador de Titulación y Eficiencia Terminal"
        },
        revisadoPor: {
          nombre: "Mgs Martha Tomalá",
          cargo: "Coordinadora General de Carreras"
        },
        aprobadoPor: {
          nombre: "Dr. Alex León",
          cargo: "Vicerrector"
        }
      }
    };
  }

  async function prepararPortada(event) {
    event.preventDefault();

    if (!tipoActual()) {
      $("noticeBox").textContent = "Primero selecciona el tipo de documento.";
      return;
    }

    if (!window.documentosApp || !window.documentosApp.generateCover) {
      $("noticeBox").textContent = "No se encontró la conexión con Electron.";
      return;
    }

    $("noticeBox").textContent = "Generando archivo " + textoSalida() + "...";

    const respuesta = await window.documentosApp.generateCover(datosPortada());

    if (respuesta && respuesta.canceled) {
      $("noticeBox").textContent = "Guardado cancelado.";
      return;
    }

    if (!respuesta || !respuesta.ok) {
      $("noticeBox").textContent = "No se pudo generar la portada: " + (respuesta && respuesta.error ? respuesta.error : "error desconocido");
      return;
    }

    $("noticeBox").textContent = "Portada " + textoSalida() + " generada correctamente: " + respuesta.path;
  }

  if ($("documentDate") && !$("documentDate").value) {
    $("documentDate").value = fechaIsoActual();
  }

  campos.forEach(function (id) {
    const campo = $(id);
    if (!campo) return;
    campo.addEventListener("input", actualizarVista);
    campo.addEventListener("change", actualizarVista);
  });

  $("documentForm").addEventListener("submit", prepararPortada);

  if (window.documentosApp && window.documentosApp.version) {
    $("appVersion").textContent = "v" + window.documentosApp.version;
  }

  actualizarVista();
})();
