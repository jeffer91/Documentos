/* =========================================================
Nombre completo: data-proyectos.js
Ruta o ubicación: src/data/data-proyectos.js
Función o funciones:
- Definir la estructura base de un proyecto.
- Entregar proyectos iniciales de demostración.
- Crear nuevos proyectos con valores seguros por defecto.
Con qué se conecta:
- srv-proyectos.js
- app-state.js
- shared-fechas.js
- shared-validaciones.js
========================================================= */

import { obtenerFechaIsoActual } from "../shared/shared-fechas.js";
import {
  ESTADOS_PROYECTO_PERMITIDOS,
  TIPOS_PROYECTO_PERMITIDOS,
  normalizarNumero,
  normalizarTexto
} from "../shared/shared-validaciones.js";

export const proyectosIniciales = [
  {
    id: "proy_demo_001",
    nombre: "App Proyectos IA",
    tipo: "App / software",
    descripcion: "App para gestionar proyectos, priorizar acciones y aumentar ganancias.",
    objetivoEconomico: 500,
    moneda: "USD",
    mvp: "Crear versión mínima con proyectos, avance, finanzas y diagnóstico IA.",
    estado: "MVP",
    semaforo: "amarillo",
    porcentajeAvance: 25,
    potencial: "alto",
    riesgo: "medio",
    dineroGenerado: 0,
    siguienteAccion: "Construir el modelo de datos y almacenamiento local.",
    prioridad: 92,
    creadoEn: "2026-07-04T00:00:00.000Z",
    actualizadoEn: "2026-07-04T00:00:00.000Z"
  },
  {
    id: "proy_demo_002",
    nombre: "Curso corto rentable",
    tipo: "Curso",
    descripcion: "Curso piloto para validar una oferta pagada con bajo costo.",
    objetivoEconomico: 300,
    moneda: "USD",
    mvp: "Crear un taller corto pagado para validar demanda.",
    estado: "Validación",
    semaforo: "verde",
    porcentajeAvance: 40,
    potencial: "alto",
    riesgo: "bajo",
    dineroGenerado: 75,
    siguienteAccion: "Definir oferta mínima pagada.",
    prioridad: 85,
    creadoEn: "2026-07-04T00:00:00.000Z",
    actualizadoEn: "2026-07-04T00:00:00.000Z"
  },
  {
    id: "proy_demo_003",
    nombre: "Canal de contenido",
    tipo: "Canal de contenido",
    descripcion: "Proyecto de contenido con potencial de monetización futura.",
    objetivoEconomico: 200,
    moneda: "USD",
    mvp: "Crear una propuesta sencilla para patrocinadores.",
    estado: "Idea",
    semaforo: "rojo",
    porcentajeAvance: 10,
    potencial: "medio",
    riesgo: "alto",
    dineroGenerado: 0,
    siguienteAccion: "Definir estrategia de monetización.",
    prioridad: 68,
    creadoEn: "2026-07-04T00:00:00.000Z",
    actualizadoEn: "2026-07-04T00:00:00.000Z"
  }
];

export function crearProyectoBase(datos = {}){
  const ahora = obtenerFechaIsoActual();
  const tipo = TIPOS_PROYECTO_PERMITIDOS.includes(datos.tipo) ? datos.tipo : "Otro";
  const estado = ESTADOS_PROYECTO_PERMITIDOS.includes(datos.estado) ? datos.estado : "Idea";

  return {
    id: datos.id || crearIdProyecto(),
    nombre: normalizarTexto(datos.nombre, "Proyecto sin nombre"),
    tipo,
    descripcion: normalizarTexto(datos.descripcion),
    objetivoEconomico: normalizarNumero(datos.objetivoEconomico, 0),
    moneda: normalizarTexto(datos.moneda, "USD"),
    mvp: normalizarTexto(datos.mvp),
    estado,
    semaforo: datos.semaforo || "amarillo",
    porcentajeAvance: limitarPorcentaje(datos.porcentajeAvance),
    potencial: datos.potencial || "medio",
    riesgo: datos.riesgo || "medio",
    dineroGenerado: normalizarNumero(datos.dineroGenerado, 0),
    siguienteAccion: normalizarTexto(datos.siguienteAccion, "Definir siguiente acción."),
    prioridad: normalizarNumero(datos.prioridad, 50),
    creadoEn: datos.creadoEn || ahora,
    actualizadoEn: ahora
  };
}

export function crearIdProyecto(){
  return `proy_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function limitarPorcentaje(valor){
  const numero = normalizarNumero(valor, 0);
  return Math.max(0, Math.min(100, Math.round(numero)));
}
