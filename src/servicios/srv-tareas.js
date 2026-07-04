/* =========================================================
Nombre completo: srv-tareas.js
Ruta o ubicación: src/servicios/srv-tareas.js
Función o funciones:
- Leer tareas desde almacenamiento local.
- Filtrar tareas por proyecto.
- Entregar conteos simples para la pantalla Detalle.
Con qué se conecta:
- shared-storage.js
- data-tareas.js
- det-tareas.js
========================================================= */

import { tareasIniciales } from "../data/data-tareas.js";
import { STORAGE_KEYS, leerStorage } from "../shared/shared-storage.js";

export function obtenerTareas(){
  const tareas = leerStorage(STORAGE_KEYS.tareas, tareasIniciales);
  return Array.isArray(tareas) ? tareas : [];
}

export function obtenerTareasPorProyecto(proyectoId){
  if(!proyectoId){
    return [];
  }

  return obtenerTareas().filter(function(tarea){
    return tarea.proyectoId === proyectoId;
  });
}

export function obtenerResumenTareasProyecto(proyectoId){
  const tareas = obtenerTareasPorProyecto(proyectoId);

  return {
    total: tareas.length,
    pendientes: contarPorEstado(tareas, "pendiente"),
    enProceso: contarPorEstado(tareas, "en_proceso"),
    completadas: contarPorEstado(tareas, "completada"),
    tareas
  };
}

function contarPorEstado(tareas, estado){
  return tareas.filter(function(tarea){
    return tarea.estado === estado;
  }).length;
}
