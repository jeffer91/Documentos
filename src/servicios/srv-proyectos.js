/* =========================================================
Nombre completo: srv-proyectos.js
Ruta o ubicación: src/servicios/srv-proyectos.js
Función o funciones:
- Leer, inicializar, crear y actualizar proyectos.
- Conectar modelos de datos con almacenamiento local.
- Entregar proyectos ordenados con avance, semáforo y prioridad inteligente.
Con qué se conecta:
- data-proyectos.js
- shared-storage.js
- shared-validaciones.js
- srv-indicadores.js
- app-state.js
========================================================= */

import { proyectosIniciales, crearProyectoBase } from "../data/data-proyectos.js";
import { avancesIniciales } from "../data/data-avances.js";
import { gastosIniciales, ingresosIniciales } from "../data/data-finanzas.js";
import { tareasIniciales } from "../data/data-tareas.js";
import { archivosIniciales } from "../data/data-archivos.js";
import { STORAGE_KEYS, guardarStorage, leerStorage } from "../shared/shared-storage.js";
import { obtenerFechaIsoActual } from "../shared/shared-fechas.js";
import { validarProyectoBasico } from "../shared/shared-validaciones.js";
import { enriquecerProyectosConIndicadores } from "./srv-indicadores.js";

export function inicializarDatosLocales(){
  inicializarColeccionSiNoExiste(STORAGE_KEYS.proyectos, proyectosIniciales);
  inicializarColeccionSiNoExiste(STORAGE_KEYS.avances, avancesIniciales);
  inicializarColeccionSiNoExiste(STORAGE_KEYS.finanzas, {
    ingresos: ingresosIniciales,
    gastos: gastosIniciales
  });
  inicializarColeccionSiNoExiste(STORAGE_KEYS.tareas, tareasIniciales);
  inicializarColeccionSiNoExiste(STORAGE_KEYS.archivos, archivosIniciales);
}

export function obtenerProyectos(){
  inicializarDatosLocales();
  const proyectos = leerStorage(STORAGE_KEYS.proyectos, proyectosIniciales);
  const proyectosBase = proyectos.map(function(proyecto){
    return crearProyectoBase(proyecto);
  });

  return enriquecerProyectosConIndicadores(proyectosBase);
}

export function obtenerProyectosBase(){
  inicializarDatosLocales();
  const proyectos = leerStorage(STORAGE_KEYS.proyectos, proyectosIniciales);

  return proyectos.map(function(proyecto){
    return crearProyectoBase(proyecto);
  });
}

export function obtenerProyectoPorId(proyectoId){
  if(!proyectoId){
    return null;
  }

  return obtenerProyectos().find(function(proyecto){
    return proyecto.id === proyectoId;
  }) || null;
}

export function guardarProyecto(datosProyecto){
  const proyecto = crearProyectoBase(datosProyecto);
  const validacion = validarProyectoBasico(proyecto);

  if(!validacion.valido){
    return {
      ok: false,
      proyecto: null,
      errores: validacion.errores
    };
  }

  const proyectos = obtenerProyectosBase();
  const existe = proyectos.some(function(item){
    return item.id === proyecto.id;
  });

  const proyectosActualizados = existe
    ? proyectos.map(function(item){
        if(item.id !== proyecto.id){
          return item;
        }

        return {
          ...item,
          ...proyecto,
          actualizadoEn: obtenerFechaIsoActual()
        };
      })
    : [
        {
          ...proyecto,
          creadoEn: proyecto.creadoEn || obtenerFechaIsoActual(),
          actualizadoEn: obtenerFechaIsoActual()
        },
        ...proyectos
      ];

  const guardado = guardarStorage(STORAGE_KEYS.proyectos, proyectosActualizados);

  return {
    ok: guardado,
    proyecto,
    errores: guardado ? [] : ["No se pudo guardar el proyecto."]
  };
}

export function eliminarProyecto(proyectoId){
  if(!proyectoId){
    return false;
  }

  const proyectos = obtenerProyectosBase();
  const proyectosFiltrados = proyectos.filter(function(proyecto){
    return proyecto.id !== proyectoId;
  });

  return guardarStorage(STORAGE_KEYS.proyectos, proyectosFiltrados);
}

export function calcularResumenProyectos(){
  const proyectos = obtenerProyectos();

  const dineroTotal = proyectos.reduce(function(total, proyecto){
    return total + Number(proyecto.resumenFinanciero?.ingresosTotales || proyecto.dineroGenerado || 0);
  }, 0);

  const avancePromedio = proyectos.length
    ? Math.round(proyectos.reduce(function(total, proyecto){
        return total + Number(proyecto.porcentajeAvance || 0);
      }, 0) / proyectos.length)
    : 0;

  return {
    cantidad: proyectos.length,
    dineroTotal,
    avancePromedio
  };
}

function inicializarColeccionSiNoExiste(clave, valorInicial){
  const valorActual = leerStorage(clave, null);

  if(valorActual === null){
    guardarStorage(clave, valorInicial);
  }
}
