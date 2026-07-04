/* =========================================================
Nombre completo: fin-eventos.js
Ruta o ubicación: src/pantallas/05-finanzas/fin-eventos.js
Función o funciones:
- Conectar eventos de la pantalla Finanzas.
- Guardar ingresos y gastos desde sus formularios.
- Cambiar el proyecto activo para revisar sus finanzas.
Con qué se conecta:
- fin-main.js
- srv-finanzas.js
- app-router.js
========================================================= */

import { guardarGasto, guardarIngreso } from "../../servicios/srv-finanzas.js";

export function conectarFinEventos(contenedor, acciones = {}){
  if(!contenedor){
    console.error("No se puede conectar eventos de Finanzas sin contenedor.");
    return;
  }

  const alActualizar = typeof acciones.alActualizar === "function" ? acciones.alActualizar : function(){};
  const cambiarProyecto = typeof acciones.cambiarProyecto === "function" ? acciones.cambiarProyecto : function(){};

  conectarSelectorProyecto(contenedor, cambiarProyecto);
  conectarFormularioIngreso(contenedor, alActualizar);
  conectarFormularioGasto(contenedor, alActualizar);
}

function conectarSelectorProyecto(contenedor, cambiarProyecto){
  const selector = contenedor.querySelector("#fin-selector-proyecto");

  if(!selector){
    return;
  }

  selector.addEventListener("change", function(){
    cambiarProyecto(selector.value);
  });
}

function conectarFormularioIngreso(contenedor, alActualizar){
  const formulario = contenedor.querySelector("#fin-form-ingreso");

  if(!formulario){
    return;
  }

  formulario.addEventListener("submit", function(evento){
    evento.preventDefault();

    const resultado = guardarIngreso(obtenerDatosFormulario(formulario));

    if(!resultado.ok){
      mostrarMensaje(formulario, "#fin-mensaje-ingreso", resultado.errores.join(" "), "error");
      return;
    }

    formulario.reset();
    mostrarMensaje(formulario, "#fin-mensaje-ingreso", "Ingreso guardado correctamente.", "ok");
    alActualizar(resultado.ingreso.proyectoId);
  });
}

function conectarFormularioGasto(contenedor, alActualizar){
  const formulario = contenedor.querySelector("#fin-form-gasto");

  if(!formulario){
    return;
  }

  formulario.addEventListener("submit", function(evento){
    evento.preventDefault();

    const resultado = guardarGasto(obtenerDatosFormulario(formulario));

    if(!resultado.ok){
      mostrarMensaje(formulario, "#fin-mensaje-gasto", resultado.errores.join(" "), "error");
      return;
    }

    formulario.reset();
    mostrarMensaje(formulario, "#fin-mensaje-gasto", "Gasto guardado correctamente.", "ok");
    alActualizar(resultado.gasto.proyectoId);
  });
}

function obtenerDatosFormulario(formulario){
  const formData = new FormData(formulario);

  return {
    proyectoId: String(formData.get("proyectoId") || "").trim(),
    concepto: String(formData.get("concepto") || "").trim(),
    monto: Number(formData.get("monto") || 0),
    categoria: String(formData.get("categoria") || "Otro").trim(),
    fecha: String(formData.get("fecha") || "").trim(),
    nota: String(formData.get("nota") || "").trim()
  };
}

function mostrarMensaje(formulario, selector, mensaje, tipo){
  const contenedorMensaje = formulario.querySelector(selector);

  if(!contenedorMensaje){
    return;
  }

  contenedorMensaje.textContent = mensaje;
  contenedorMensaje.className = `fin-mensaje ${tipo === "ok" ? "fin-mensaje-ok" : "fin-mensaje-error"}`;
}
