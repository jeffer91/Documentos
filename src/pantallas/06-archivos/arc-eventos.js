/* =========================================================
Nombre completo: arc-eventos.js
Ruta o ubicación: src/pantallas/06-archivos/arc-eventos.js
Función o funciones:
- Conectar eventos de la pantalla Archivos.
- Guardar y analizar texto pegado por proyecto.
- Actualizar la pantalla después de guardar un registro documental.
Con qué se conecta:
- arc-main.js
- srv-archivos.js
- app-router.js
========================================================= */

import { guardarTextoAnalizado } from "../../servicios/srv-archivos.js";

export function conectarArcEventos(contenedor, acciones = {}){
  if(!contenedor){
    console.error("No se puede conectar eventos de Archivos sin contenedor.");
    return;
  }

  const alGuardar = typeof acciones.alGuardar === "function" ? acciones.alGuardar : function(){};

  const formulario = contenedor.querySelector("#arc-form-texto");

  if(!formulario){
    return;
  }

  formulario.addEventListener("submit", function(evento){
    evento.preventDefault();

    const resultado = guardarTextoAnalizado(obtenerDatosFormulario(formulario));

    if(!resultado.ok){
      mostrarMensaje(formulario, resultado.errores.join(" "), "error");
      return;
    }

    formulario.reset();
    mostrarMensaje(formulario, "Texto analizado y guardado correctamente.", "ok");
    alGuardar(resultado.archivo.proyectoId);
  });
}

function obtenerDatosFormulario(formulario){
  const formData = new FormData(formulario);

  return {
    proyectoId: String(formData.get("proyectoId") || "").trim(),
    nombre: String(formData.get("nombre") || "").trim(),
    texto: String(formData.get("texto") || "").trim()
  };
}

function mostrarMensaje(formulario, mensaje, tipo){
  const contenedorMensaje = formulario.querySelector("#arc-mensaje");

  if(!contenedorMensaje){
    return;
  }

  contenedorMensaje.textContent = mensaje;
  contenedorMensaje.className = `arc-mensaje ${tipo === "ok" ? "arc-mensaje-ok" : "arc-mensaje-error"}`;
}
