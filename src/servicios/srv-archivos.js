/* =========================================================
Nombre completo: srv-archivos.js
Ruta o ubicación: src/servicios/srv-archivos.js
Función o funciones:
- Guardar textos, notas e información documental asociada a proyectos.
- Analizar texto pegado para detectar resumen, tareas, riesgos e ideas.
- Leer registros documentales por proyecto.
Con qué se conecta:
- data-archivos.js
- shared-storage.js
- ia-normalizador.js
- arc-eventos.js
- arc-lista.js
========================================================= */

import { archivosIniciales, crearArchivoBase } from "../data/data-archivos.js";
import { STORAGE_KEYS, guardarStorage, leerStorage } from "../shared/shared-storage.js";
import { analizarTextoDocumento } from "../ia/ia-normalizador.js";

export function obtenerArchivos(){
  const archivos = leerStorage(STORAGE_KEYS.archivos, archivosIniciales);
  return Array.isArray(archivos) ? archivos : [];
}

export function obtenerArchivosPorProyecto(proyectoId){
  if(!proyectoId){
    return [];
  }

  return obtenerArchivos()
    .filter(function(archivo){
      return archivo.proyectoId === proyectoId;
    })
    .sort(function(a, b){
      return String(b.creadoEn || "").localeCompare(String(a.creadoEn || ""));
    });
}

export function guardarTextoAnalizado(datos){
  const proyectoId = String(datos?.proyectoId || "").trim();
  const texto = String(datos?.texto || "").trim();
  const nombre = String(datos?.nombre || "Nota sin título").trim();

  if(!proyectoId){
    return {
      ok: false,
      archivo: null,
      errores: ["Selecciona un proyecto para guardar el texto."]
    };
  }

  if(texto.length < 10){
    return {
      ok: false,
      archivo: null,
      errores: ["Pega un texto un poco más largo para poder analizarlo."]
    };
  }

  const analisis = analizarTextoDocumento(texto);
  const archivo = crearArchivoBase({
    proyectoId,
    nombre,
    tipo: "texto",
    origen: "texto pegado",
    resumen: analisis.resumen,
    tareasDetectadas: analisis.tareasDetectadas,
    riesgosDetectados: analisis.riesgosDetectados,
    ideasDetectadas: analisis.ideasDetectadas,
    contenido: texto
  });

  const archivos = obtenerArchivos();
  const guardado = guardarStorage(STORAGE_KEYS.archivos, [archivo, ...archivos]);

  return {
    ok: guardado,
    archivo,
    errores: guardado ? [] : ["No se pudo guardar el análisis documental."]
  };
}

export function obtenerResumenDocumentalProyecto(proyectoId){
  const archivos = obtenerArchivosPorProyecto(proyectoId);

  return {
    total: archivos.length,
    tareas: unirListas(archivos, "tareasDetectadas"),
    riesgos: unirListas(archivos, "riesgosDetectados"),
    ideas: unirListas(archivos, "ideasDetectadas"),
    archivos
  };
}

function unirListas(archivos, campo){
  return archivos.flatMap(function(archivo){
    return Array.isArray(archivo[campo]) ? archivo[campo] : [];
  }).slice(0, 12);
}
