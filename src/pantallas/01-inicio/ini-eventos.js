/* =========================================================
Nombre completo: ini-eventos.js
Ruta o ubicación: src/pantallas/01-inicio/ini-eventos.js
Función o funciones:
- Conectar eventos de la pantalla Inicio.
- Abrir detalle de proyecto desde tarjetas y Top 3.
- Enviar al usuario a la vista de creación de proyecto.
Con qué se conecta:
- ini-main.js
- app-router.js
========================================================= */

export function conectarIniEventos(contenedor, acciones = {}){
  if(!contenedor){
    console.error("No se puede conectar eventos de Inicio sin contenedor.");
    return;
  }

  const abrirProyecto = typeof acciones.abrirProyecto === "function"
    ? acciones.abrirProyecto
    : function(){};

  const crearProyecto = typeof acciones.crearProyecto === "function"
    ? acciones.crearProyecto
    : function(){};

  conectarEventosAbrirProyecto(contenedor, abrirProyecto);
  conectarEventoCrearProyecto(contenedor, crearProyecto);
}

function conectarEventosAbrirProyecto(contenedor, abrirProyecto){
  const botonesProyecto = contenedor.querySelectorAll("[data-ini-proyecto-id]");

  botonesProyecto.forEach(function(boton){
    boton.addEventListener("click", function(){
      abrirProyecto(boton.dataset.iniProyectoId);
    });
  });
}

function conectarEventoCrearProyecto(contenedor, crearProyecto){
  const botonCrear = contenedor.querySelector("[data-ini-crear-proyecto]");

  if(!botonCrear){
    return;
  }

  botonCrear.addEventListener("click", function(){
    crearProyecto();
  });
}
