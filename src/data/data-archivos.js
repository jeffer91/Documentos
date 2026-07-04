/* =========================================================
Nombre completo: data-archivos.js
Ruta o ubicación: src/data/data-archivos.js
Función o funciones:
- Definir la estructura base de archivos asociados a proyectos.
- Preparar registros para PDF, Excel, imagen y texto pegado.
- Guardar resumen, tareas detectadas y riesgos detectados.
Con qué se conecta:
- srv-proyectos.js
- futuras pantallas de archivos
- futura IA de análisis documental
========================================================= */

import { obtenerFechaIsoActual } from "../shared/shared-fechas.js";
import { normalizarTexto } from "../shared/shared-validaciones.js";

export const archivosIniciales = [];

export function crearArchivoBase(datos = {}){
  return {
    id: datos.id || crearIdArchivo(),
    proyectoId: normalizarTexto(datos.proyectoId),
    nombre: normalizarTexto(datos.nombre, "Archivo sin nombre"),
    tipo: normalizarTexto(datos.tipo, "otro"),
    origen: normalizarTexto(datos.origen, "subido"),
    resumen: normalizarTexto(datos.resumen),
    tareasDetectadas: Array.isArray(datos.tareasDetectadas) ? datos.tareasDetectadas : [],
    riesgosDetectados: Array.isArray(datos.riesgosDetectados) ? datos.riesgosDetectados : [],
    creadoEn: datos.creadoEn || obtenerFechaIsoActual()
  };
}

export function crearIdArchivo(){
  return `arc_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
