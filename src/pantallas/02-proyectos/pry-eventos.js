/* =========================================================
Nombre completo: pry-eventos.js
Ruta o ubicación: src/pantallas/02-proyectos/pry-eventos.js
Función o funciones:
- Conectar eventos de la pantalla Proyectos.
- Guardar proyectos nuevos desde el formulario.
- Abrir proyectos existentes desde la lista.
Con qué se conecta:
- pry-main.js
- srv-proyectos.js
- app-router.js
========================================================= */

import { guardarProyecto } from "../../servicios/srv-proyectos.js";

export function conectarPryEventos(contenedor, acciones = {}){
  if(!contenedor){
    console.error("No se puede conectar eventos de Proyectos sin contenedor.");
    return;
  }

  const alGuardar = typeof acciones.alGuardar === "function" ? acciones.alGuardar : function(){};
  const abrirProyecto = typeof acciones.abrirProyecto === "function" ? acciones.abrirProyecto : function(){};

  conectarFormularioProyecto(contenedor, alGuardar);
  conectarListaProyectos(contenedor, abrirProyecto);
}

function conectarFormularioProyecto(contenedor, alGuardar){
  const formulario = contenedor.querySelector("#pry-form-proyecto");

  if(!formulario){
    return;
  }

  formulario.addEventListener("submit", function(evento){
    evento.preventDefault();

    const datos = obtenerDatosFormulario(formulario);
    const resultado = guardarProyecto(datos);

    if(!resultado.ok){
      mostrarMensajeFormulario(formulario, resultado.errores.join(" "), "error");
      return;
    }

    formulario.reset();
    mostrarMensajeFormulario(formulario, "Proyecto creado correctamente.", "ok");
    alGuardar(resultado.proyecto);
  });
}

function conectarListaProyectos(contenedor, abrirProyecto){
  const botones = contenedor.querySelectorAll("[data-pry-proyecto-id]");

  botones.forEach(function(boton){
    boton.addEventListener("click", function(){
      abrirProyecto(boton.dataset.pryProyectoId);
    });
  });
}

function obtenerDatosFormulario(formulario){
  const formData = new FormData(formulario);

  return {
    nombre: String(formData.get("nombre") || "").trim(),
    tipo: String(formData.get("tipo") || "Otro").trim(),
    estado: String(formData.get("estado") || "Idea").trim(),
    objetivoEconomico: Number(formData.get("objetivoEconomico") || 0),
    descripcion: String(formData.get("descripcion") || "").trim(),
    mvp: String(formData.get("mvp") || "").trim(),
    siguienteAccion: String(formData.get("siguienteAccion") || "Definir siguiente acción.").trim(),
    porcentajeAvance: 0,
    dineroGenerado: 0,
    semaforo: "amarillo",
    prioridad: 50,
    potencial: "medio",
    riesgo: "medio"
  };
}

function mostrarMensajeFormulario(formulario, mensaje, tipo){
  const contenedorMensaje = formulario.querySelector("#pry-form-mensaje");

  if(!contenedorMensaje){
    return;
  }

  contenedorMensaje.textContent = mensaje;
  contenedorMensaje.className = `pry-form-mensaje ${tipo === "ok" ? "pry-form-mensaje-ok" : "pry-form-mensaje-error"}`;
}
