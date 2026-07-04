/* =========================================================
Nombre completo: srv-avances.js
Ruta o ubicación: src/servicios/srv-avances.js
Función o funciones:
- Leer y guardar avances diarios por proyecto.
- Registrar horas trabajadas, bloqueos y siguiente acción.
- Actualizar el proyecto con la siguiente acción registrada.
Con qué se conecta:
- data-avances.js
- shared-storage.js
- srv-proyectos.js
- reg-eventos.js
- reg-historial.js
========================================================= */

import { crearAvanceBase, avancesIniciales } from "../data/data-avances.js";
import { STORAGE_KEYS, guardarStorage, leerStorage } from "../shared/shared-storage.js";
import { obtenerProyectoPorId, guardarProyecto } from "./srv-proyectos.js";

export function obtenerAvances(){
  const avances = leerStorage(STORAGE_KEYS.avances, avancesIniciales);
  return Array.isArray(avances) ? avances : [];
}

export function obtenerAvancesPorProyecto(proyectoId){
  if(!proyectoId){
    return [];
  }

  return obtenerAvances()
    .filter(function(avance){
      return avance.proyectoId === proyectoId;
    })
    .sort(function(a, b){
      return String(b.fecha || "").localeCompare(String(a.fecha || ""));
    });
}

export function guardarAvance(datosAvance){
  const avance = crearAvanceBase(datosAvance);

  if(!avance.proyectoId){
    return {
      ok: false,
      avance: null,
      errores: ["Selecciona un proyecto para registrar el avance."]
    };
  }

  if(!avance.descripcion){
    return {
      ok: false,
      avance: null,
      errores: ["Escribe qué avanzaste hoy."]
    };
  }

  if(Number(avance.horas || 0) <= 0){
    return {
      ok: false,
      avance: null,
      errores: ["Registra al menos una cantidad de horas mayor a cero."]
    };
  }

  const avances = obtenerAvances();
  const avancesActualizados = [avance, ...avances];
  const guardado = guardarStorage(STORAGE_KEYS.avances, avancesActualizados);

  if(guardado && avance.siguienteAccion){
    actualizarSiguienteAccionProyecto(avance.proyectoId, avance.siguienteAccion);
  }

  return {
    ok: guardado,
    avance,
    errores: guardado ? [] : ["No se pudo guardar el avance."]
  };
}

export function interpretarTextoLibreAvance(texto){
  const contenido = typeof texto === "string" ? texto.trim() : "";
  const horas = detectarHoras(contenido);

  return {
    descripcion: contenido,
    horas,
    bloqueo: detectarBloqueo(contenido),
    siguienteAccion: detectarSiguienteAccion(contenido)
  };
}

function actualizarSiguienteAccionProyecto(proyectoId, siguienteAccion){
  const proyecto = obtenerProyectoPorId(proyectoId);

  if(!proyecto){
    return;
  }

  guardarProyecto({
    ...proyecto,
    siguienteAccion
  });
}

function detectarHoras(texto){
  const coincidencia = texto.match(/(\d+(?:[.,]\d+)?)\s*(h|hora|horas)/i);

  if(!coincidencia){
    return 0;
  }

  return Number(coincidencia[1].replace(",", "."));
}

function detectarBloqueo(texto){
  const patrones = ["falta", "bloqueo", "problema", "pendiente", "no pude"];
  const textoMinuscula = texto.toLowerCase();

  const encontrado = patrones.find(function(patron){
    return textoMinuscula.includes(patron);
  });

  if(!encontrado){
    return "";
  }

  return texto;
}

function detectarSiguienteAccion(texto){
  const patrones = ["siguiente", "mañana", "luego", "después", "falta"];
  const textoMinuscula = texto.toLowerCase();

  const tienePista = patrones.some(function(patron){
    return textoMinuscula.includes(patron);
  });

  if(!tienePista){
    return "Revisar el avance registrado y definir la próxima acción.";
  }

  return texto;
}
