/* =========================================================
Nombre completo: reg-eventos.js
Ruta o ubicación: src/pantallas/04-registro-diario/reg-eventos.js
Función o funciones:
- Conectar eventos de la pantalla Registro diario.
- Guardar avances manuales y avances desde texto libre.
- Actualizar la pantalla después de registrar horas.
Con qué se conecta:
- reg-main.js
- srv-avances.js
- app-router.js
========================================================= */

import { guardarAvance, interpretarTextoLibreAvance } from "../../servicios/srv-avances.js";

export function conectarRegEventos(contenedor, acciones = {}){
  if(!contenedor){
    console.error("No se puede conectar eventos de Registro sin contenedor.");
    return;
  }

  const alGuardar = typeof acciones.alGuardar === "function" ? acciones.alGuardar : function(){};

  conectarFormularioManual(contenedor, alGuardar);
  conectarFormularioTextoLibre(contenedor, alGuardar);
}

function conectarFormularioManual(contenedor, alGuardar){
  const formulario = contenedor.querySelector("#reg-form-manual");

  if(!formulario){
    return;
  }

  formulario.addEventListener("submit", function(evento){
    evento.preventDefault();

    const resultado = guardarAvance(obtenerDatosManual(formulario));

    if(!resultado.ok){
      mostrarMensaje(formulario, "#reg-mensaje-manual", resultado.errores.join(" "), "error");
      return;
    }

    formulario.reset();
    mostrarMensaje(formulario, "#reg-mensaje-manual", "Avance guardado correctamente.", "ok");
    alGuardar(resultado.avance.proyectoId);
  });
}

function conectarFormularioTextoLibre(contenedor, alGuardar){
  const formulario = contenedor.querySelector("#reg-form-texto-libre");

  if(!formulario){
    return;
  }

  formulario.addEventListener("submit", function(evento){
    evento.preventDefault();

    const formData = new FormData(formulario);
    const proyectoId = String(formData.get("proyectoId") || "").trim();
    const textoLibre = String(formData.get("textoLibre") || "").trim();
    const interpretado = interpretarTextoLibreAvance(textoLibre);

    const resultado = guardarAvance({
      proyectoId,
      fecha: new Date().toISOString().slice(0, 10),
      horas: interpretado.horas,
      tipoRegistro: "texto libre",
      descripcion: interpretado.descripcion,
      bloqueo: interpretado.bloqueo,
      siguienteAccion: interpretado.siguienteAccion
    });

    if(!resultado.ok){
      mostrarMensaje(formulario, "#reg-mensaje-texto", resultado.errores.join(" "), "error");
      return;
    }

    formulario.reset();
    mostrarMensaje(formulario, "#reg-mensaje-texto", "Texto libre guardado como avance.", "ok");
    alGuardar(resultado.avance.proyectoId);
  });
}

function obtenerDatosManual(formulario){
  const formData = new FormData(formulario);

  return {
    proyectoId: String(formData.get("proyectoId") || "").trim(),
    fecha: String(formData.get("fecha") || "").trim(),
    horas: Number(formData.get("horas") || 0),
    tipoRegistro: String(formData.get("tipoRegistro") || "manual").trim(),
    descripcion: String(formData.get("descripcion") || "").trim(),
    bloqueo: String(formData.get("bloqueo") || "").trim(),
    siguienteAccion: String(formData.get("siguienteAccion") || "").trim()
  };
}

function mostrarMensaje(formulario, selector, mensaje, tipo){
  const contenedorMensaje = formulario.querySelector(selector);

  if(!contenedorMensaje){
    return;
  }

  contenedorMensaje.textContent = mensaje;
  contenedorMensaje.className = `reg-mensaje ${tipo === "ok" ? "reg-mensaje-ok" : "reg-mensaje-error"}`;
}
