/* =========================================================
Nombre completo: det-eventos.js
Ruta o ubicación: src/pantallas/03-detalle-proyecto/det-eventos.js
Función o funciones:
- Conectar eventos de la pantalla Detalle del proyecto.
- Permitir volver al inicio o a la pantalla Proyectos.
- Mantener eventos del detalle separados del router.
Con qué se conecta:
- det-main.js
- app-router.js
========================================================= */

export function conectarDetEventos(contenedor, acciones = {}){
  if(!contenedor){
    console.error("No se puede conectar eventos de Detalle sin contenedor.");
    return;
  }

  const volverInicio = typeof acciones.volverInicio === "function" ? acciones.volverInicio : function(){};
  const irProyectos = typeof acciones.irProyectos === "function" ? acciones.irProyectos : function(){};

  const botonInicio = contenedor.querySelector("[data-det-volver-inicio]");
  const botonProyectos = contenedor.querySelector("[data-det-ir-proyectos]");

  if(botonInicio){
    botonInicio.addEventListener("click", volverInicio);
  }

  if(botonProyectos){
    botonProyectos.addEventListener("click", irProyectos);
  }
}
