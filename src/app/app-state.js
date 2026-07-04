/* =========================================================
Nombre completo: app-state.js
Ruta o ubicación: src/app/app-state.js
Función o funciones:
- Mantener el estado inicial de la app.
- Guardar la pantalla activa y el proyecto seleccionado.
- Entregar datos temporales de demostración para el Bloque 1.
Con qué se conecta:
- app-router.js
- app-inicio.js
========================================================= */

const appState = {
  pantallaActual: "inicio",
  proyectoSeleccionadoId: null,
  cargando: false,
  mensaje: "",
  proyectosDemo: [
    {
      id: "proy_demo_001",
      nombre: "App Proyectos IA",
      tipo: "App / software",
      estado: "MVP",
      semaforo: "amarillo",
      porcentajeAvance: 25,
      dineroGenerado: 0,
      siguienteAccion: "Construir la base técnica de la app.",
      prioridad: 92
    },
    {
      id: "proy_demo_002",
      nombre: "Curso corto rentable",
      tipo: "Curso",
      estado: "Validación",
      semaforo: "verde",
      porcentajeAvance: 40,
      dineroGenerado: 75,
      siguienteAccion: "Definir oferta mínima pagada.",
      prioridad: 85
    },
    {
      id: "proy_demo_003",
      nombre: "Canal de contenido",
      tipo: "Canal de contenido",
      estado: "Idea",
      semaforo: "rojo",
      porcentajeAvance: 10,
      dineroGenerado: 0,
      siguienteAccion: "Definir estrategia de monetización.",
      prioridad: 68
    }
  ]
};

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
  return [...appState.proyectosDemo].sort(function(a, b){
    return b.prioridad - a.prioridad;
  });
}

export function seleccionarProyecto(proyectoId){
  appState.proyectoSeleccionadoId = proyectoId || null;
  return appState.proyectoSeleccionadoId;
}

export function obtenerProyectoSeleccionado(){
  if(!appState.proyectoSeleccionadoId){
    return null;
  }

  return appState.proyectosDemo.find(function(proyecto){
    return proyecto.id === appState.proyectoSeleccionadoId;
  }) || null;
}
