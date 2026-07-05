/* =========================================================
Archivo: app.js
Ruta: /src/renderer/app.js
Funciones principales:
- Manejar la pantalla inicial.
- Actualizar la vista previa de la portada.
- Enviar los datos a Electron para generar Word o PDF.
- Mostrar historial reciente, abrir archivos, guardar ajustes y validar datos.
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

  let currentSettings = {
    unitName: "Titulación y Eficiencia Terminal",
    unitCode: "UTET",
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

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
  }

  function getSigners() {
    return currentSettings.signers;
  }

  function mostrarAviso(message) {
    if ($("noticeBox")) {
      $("noticeBox").textContent = message;
    }
  }

  function actualizarFirmasVista() {
    const signers = getSigners();
    setText("previewElaboradoNombre", signers.elaboradoPor.nombre);
    setText("previewElaboradoCargo", signers.elaboradoPor.cargo);
    setText("previewRevisadoNombre", signers.revisadoPor.nombre);
    setText("previewRevisadoCargo", signers.revisadoPor.cargo);
    setText("previewAprobadoNombre", signers.aprobadoPor.nombre);
    setText("previewAprobadoCargo", signers.aprobadoPor.cargo);
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
    actualizarFirmasVista();

    if ($("previewTotalPages")) {
      $("previewTotalPages").textContent = String(totalPaginas());
    }

    if (!tipo) {
      mostrarAviso("Selecciona un tipo de documento para preparar la portada.");
      return;
    }

    mostrarAviso(
      tipo[3]
        ? "Este documento usará portada formal. Salida seleccionada: " + textoSalida() + "."
        : "Este documento usa formato administrativo. Salida seleccionada: " + textoSalida() + "."
    );
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
      signers: getSigners()
    };
  }

  function validarDatosPortada() {
    const errores = [];
    const signers = getSigners();

    if (!tipoActual()) errores.push("Selecciona el tipo de documento.");
    if (!limpiar($("documentTitle").value)) errores.push("Escribe el nombre del documento.");
    if (!limpiar($("unitName").value)) errores.push("Escribe la unidad o coordinación.");
    if (!limpiar($("unitCode").value)) errores.push("Escribe la sigla de la unidad.");
    if (!limpiar($("version").value)) errores.push("Escribe la versión.");
    if (!limpiar($("documentNumber").value)) errores.push("Escribe el número del documento.");
    if (!/^\d{4}$/.test(limpiar($("year").value))) errores.push("El año debe tener 4 números.");
    if (!limpiar($("month").value)) errores.push("Escribe el mes.");
    if (totalPaginas() < 1) errores.push("El total de páginas debe ser mínimo 1.");
    if (!signers.elaboradoPor.nombre || !signers.revisadoPor.nombre || !signers.aprobadoPor.nombre) errores.push("Completa los nombres de los tres firmantes en Ajustes rápidos.");
    if (!signers.elaboradoPor.cargo || !signers.revisadoPor.cargo || !signers.aprobadoPor.cargo) errores.push("Completa los cargos de los tres firmantes en Ajustes rápidos.");

    return errores;
  }

  function formatDateTime(value) {
    if (!value) return "Fecha no registrada";
    try {
      return new Date(value).toLocaleString();
    } catch (_error) {
      return value;
    }
  }

  function renderHistory(items) {
    const list = $("historyList");
    const empty = $("historyEmpty");
    if (!list || !empty) return;

    list.innerHTML = "";
    const safeItems = Array.isArray(items) ? items.slice(0, 5) : [];
    empty.style.display = safeItems.length ? "none" : "block";

    safeItems.forEach(function (item) {
      const card = document.createElement("div");
      card.className = "history-item";

      const title = document.createElement("div");
      title.className = "history-title";
      title.textContent = item.title || "Documento sin título";

      const meta = document.createElement("div");
      meta.className = "history-meta";
      meta.textContent = (item.code || "Sin código") + " | " + (item.outputType || "docx").toUpperCase() + " | " + formatDateTime(item.createdAt);

      const actions = document.createElement("div");
      actions.className = "history-actions";

      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.className = "small-button";
      openButton.textContent = "Abrir";
      openButton.addEventListener("click", function () {
        openGeneratedFile(item.filePath);
      });

      actions.appendChild(openButton);
      card.appendChild(title);
      card.appendChild(meta);
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  async function loadHistory() {
    if (!window.documentosApp || !window.documentosApp.getHistory) return;
    const response = await window.documentosApp.getHistory();
    if (response && response.ok) {
      renderHistory(response.items || []);
    }
  }

  async function openGeneratedFile(filePath) {
    if (!window.documentosApp || !window.documentosApp.openFile) return;
    const response = await window.documentosApp.openFile(filePath);
    if (!response || !response.ok) {
      mostrarAviso("No se pudo abrir el archivo.");
    }
  }

  function fillSettingsForm(settings) {
    if (!settings) return;
    currentSettings = settings;

    if ($("settingsUnitName")) $("settingsUnitName").value = settings.unitName || "";
    if ($("settingsUnitCode")) $("settingsUnitCode").value = settings.unitCode || "";
    if ($("settingsElaboradoNombre")) $("settingsElaboradoNombre").value = settings.signers.elaboradoPor.nombre || "";
    if ($("settingsElaboradoCargo")) $("settingsElaboradoCargo").value = settings.signers.elaboradoPor.cargo || "";
    if ($("settingsRevisadoNombre")) $("settingsRevisadoNombre").value = settings.signers.revisadoPor.nombre || "";
    if ($("settingsRevisadoCargo")) $("settingsRevisadoCargo").value = settings.signers.revisadoPor.cargo || "";
    if ($("settingsAprobadoNombre")) $("settingsAprobadoNombre").value = settings.signers.aprobadoPor.nombre || "";
    if ($("settingsAprobadoCargo")) $("settingsAprobadoCargo").value = settings.signers.aprobadoPor.cargo || "";

    if ($("unitName")) $("unitName").value = settings.unitName || "";
    if ($("unitCode")) $("unitCode").value = settings.unitCode || "";
    actualizarVista();
  }

  function settingsFromForm() {
    return {
      unitName: limpiar($("settingsUnitName").value),
      unitCode: limpiar($("settingsUnitCode").value),
      signers: {
        elaboradoPor: {
          nombre: limpiar($("settingsElaboradoNombre").value),
          cargo: limpiar($("settingsElaboradoCargo").value)
        },
        revisadoPor: {
          nombre: limpiar($("settingsRevisadoNombre").value),
          cargo: limpiar($("settingsRevisadoCargo").value)
        },
        aprobadoPor: {
          nombre: limpiar($("settingsAprobadoNombre").value),
          cargo: limpiar($("settingsAprobadoCargo").value)
        }
      }
    };
  }

  async function loadSettings() {
    if (!window.documentosApp || !window.documentosApp.getSettings) return;
    const response = await window.documentosApp.getSettings();
    if (response && response.ok) {
      fillSettingsForm(response.settings);
    }
  }

  async function saveSettings() {
    if (!window.documentosApp || !window.documentosApp.saveSettings) return;
    const response = await window.documentosApp.saveSettings(settingsFromForm());

    if (!response || !response.ok) {
      if ($("settingsNotice")) $("settingsNotice").textContent = "No se pudieron guardar los ajustes.";
      return;
    }

    fillSettingsForm(response.settings);
    if ($("settingsNotice")) $("settingsNotice").textContent = "Ajustes guardados correctamente.";
  }

  async function prepararPortada(event) {
    event.preventDefault();

    const errores = validarDatosPortada();
    if (errores.length) {
      mostrarAviso("Revisa esto: " + errores[0]);
      return;
    }

    if (!window.documentosApp || !window.documentosApp.generateCover) {
      mostrarAviso("No se encontró la conexión con Electron.");
      return;
    }

    mostrarAviso("Generando archivo " + textoSalida() + "...");

    const respuesta = await window.documentosApp.generateCover(datosPortada());

    if (respuesta && respuesta.canceled) {
      mostrarAviso("Guardado cancelado.");
      return;
    }

    if (!respuesta || !respuesta.ok) {
      mostrarAviso("No se pudo generar la portada: " + (respuesta && respuesta.error ? respuesta.error : "error desconocido"));
      return;
    }

    mostrarAviso("Portada " + textoSalida() + " generada correctamente: " + respuesta.path);
    await loadHistory();
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

  if ($("refreshHistoryButton")) {
    $("refreshHistoryButton").addEventListener("click", loadHistory);
  }

  if ($("saveSettingsButton")) {
    $("saveSettingsButton").addEventListener("click", saveSettings);
  }

  if (window.documentosApp && window.documentosApp.version) {
    $("appVersion").textContent = "v" + window.documentosApp.version;
  }

  actualizarVista();
  loadSettings();
  loadHistory();
})();
