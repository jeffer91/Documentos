/* =========================================================
Nombre completo: app-state.js
Ruta o ubicación: src/app/app-state.js
Función o funciones:
- Mantener el estado general de la app.
- Guardar la pantalla activa, el proyecto seleccionado y el proyecto activo en Finanzas.
- Obtener proyectos desde el servicio de datos locales.
Con qué se conecta:
- app-router.js
- app-inicio.js
- srv-proyectos.js
========================================================= */

import {
  inicializarDatosLocales,
  obtenerProyectoPorId,
  obtenerProyectos
} from "../servicios/srv-proyectos.js";

const appState = {
  pantallaActual: "inicio",
  proyectoSeleccionadoId: null,
  proyectoFinanzasId: null,
  cargando: false,
  mensaje: ""
};

export function inicializarEstadoApp(){
  inicializarDatosLocales();
  return appState;
}

export function obtenerAppState(){
  return appState;
}

export function obtenerPantallaActual(){
  return appState.pantallaActual;
}

export function cambiarPantallaActual(nombrePantalla){
  if(!nombrePantalla || typeof nombrePantalla !== "string"){
    console.warn("Pantalla inválida:", nombrePantalla);
    return appState.pantallaActual;
  }

  appState.pantallaActual = nombrePantalla;
  return appState.pantallaActual;
}

export function obtenerProyectosDemo(){
  return obtenerProyectos();
}

export function obtenerProyectosApp(){
  return obtenerProyectos();
}

export function seleccionarProyecto(proyectoId){
  appState.proyectoSeleccionadoId = proyectoId || null;
  appState.proyectoFinanzasId = proyectoId || appState.proyectoFinanzasId;
  return appState.proyectoSeleccionadoId;
}

export function seleccionarProyectoFinanzas(proyectoId){
  appState.proyectoFinanzasId = proyectoId || null;
  return appState.proyectoFinanzasId;
}

export function obtenerProyectoFinanzasId(){
  return appState.proyectoFinanzasId || appState.proyectoSeleccionadoId;
}

export function obtenerProyectoSeleccionado(){
  if(!appState.proyectoSeleccionadoId){
    return null;
  }

  return obtenerProyectoPorId(appState.proyectoSeleccionadoId);
}
