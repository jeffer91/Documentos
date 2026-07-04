/* =========================================================
Nombre completo: data-tareas.js
Ruta o ubicación: src/data/data-tareas.js
Función o funciones:
- Definir la estructura base de tareas por proyecto.
- Crear tareas con estado, prioridad y fecha límite.
- Preparar datos para futuras pantallas de detalle y registro diario.
Con qué se conecta:
- srv-proyectos.js
- shared-fechas.js
- futuras pantallas de detalle del proyecto
========================================================= */

import { obtenerFechaIsoActual } from "../shared/shared-fechas.js";
import { normalizarTexto } from "../shared/shared-validaciones.js";

export const tareasIniciales = [
  {
    id: "tar_demo_001",
    proyectoId: "proy_demo_001",
    titulo: "Crear almacenamiento local",
    descripcion: "Guardar proyectos, avances, finanzas, tareas y archivos.",
    estado: "en_proceso",
    prioridad: "alta",
    fechaLimite: "2026-07-10",
    completadaEn: null,
    creadoEn: "2026-07-04T00:00:00.000Z"
  }
];

export function crearTareaBase(datos = {}){
  return {
    id: datos.id || crearIdTarea(),
    proyectoId: normalizarTexto(datos.proyectoId),
    titulo: normalizarTexto(datos.titulo, "Tarea sin título"),
    descripcion: normalizarTexto(datos.descripcion),
    estado: normalizarTexto(datos.estado, "pendiente"),
    prioridad: normalizarTexto(datos.prioridad, "media"),
    fechaLimite: datos.fechaLimite || null,
    completadaEn: datos.completadaEn || null,
    creadoEn: datos.creadoEn || obtenerFechaIsoActual()
  };
}

export function crearIdTarea(){
  return `tar_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
