/* =========================================================
Nombre completo: data-avances.js
Ruta o ubicación: src/data/data-avances.js
Función o funciones:
- Definir la estructura de los avances diarios.
- Crear registros de avance con horas, descripción y bloqueo.
- Mantener datos preparados para el registro diario.
Con qué se conecta:
- srv-proyectos.js
- shared-fechas.js
- futuras pantallas de registro diario
========================================================= */

import { obtenerFechaCortaActual, obtenerFechaIsoActual } from "../shared/shared-fechas.js";
import { normalizarNumero, normalizarTexto } from "../shared/shared-validaciones.js";

export const avancesIniciales = [
  {
    id: "ava_demo_001",
    proyectoId: "proy_demo_001",
    fecha: "2026-07-04",
    horas: 2,
    tipoRegistro: "manual",
    descripcion: "Se definió la documentación base y estructura inicial de la app.",
    bloqueo: "Falta implementar almacenamiento local.",
    siguienteAccion: "Crear servicios de datos.",
    creadoEn: "2026-07-04T00:00:00.000Z"
  }
];

export function crearAvanceBase(datos = {}){
  return {
    id: datos.id || crearIdAvance(),
    proyectoId: normalizarTexto(datos.proyectoId),
    fecha: normalizarTexto(datos.fecha, obtenerFechaCortaActual()),
    horas: normalizarNumero(datos.horas, 0),
    tipoRegistro: normalizarTexto(datos.tipoRegistro, "manual"),
    descripcion: normalizarTexto(datos.descripcion),
    bloqueo: normalizarTexto(datos.bloqueo),
    siguienteAccion: normalizarTexto(datos.siguienteAccion),
    creadoEn: datos.creadoEn || obtenerFechaIsoActual()
  };
}

export function crearIdAvance(){
  return `ava_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
