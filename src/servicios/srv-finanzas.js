/* =========================================================
Nombre completo: srv-finanzas.js
Ruta o ubicación: src/servicios/srv-finanzas.js
Función o funciones:
- Leer ingresos, gastos y avances desde almacenamiento local.
- Guardar ingresos y gastos nuevos.
- Calcular utilidad, horas trabajadas, dinero por hora y punto de equilibrio.
Con qué se conecta:
- shared-storage.js
- data-finanzas.js
- data-avances.js
- det-finanzas.js
- fin-main.js
- fin-eventos.js
========================================================= */

import { avancesIniciales } from "../data/data-avances.js";
import {
  crearGastoBase,
  crearIngresoBase,
  gastosIniciales,
  ingresosIniciales
} from "../data/data-finanzas.js";
import { STORAGE_KEYS, guardarStorage, leerStorage } from "../shared/shared-storage.js";

export function obtenerFinanzas(){
  const finanzas = leerStorage(STORAGE_KEYS.finanzas, {
    ingresos: ingresosIniciales,
    gastos: gastosIniciales
  });

  return {
    ingresos: Array.isArray(finanzas.ingresos) ? finanzas.ingresos : [],
    gastos: Array.isArray(finanzas.gastos) ? finanzas.gastos : []
  };
}

export function obtenerIngresos(){
  return obtenerFinanzas().ingresos;
}

export function obtenerGastos(){
  return obtenerFinanzas().gastos;
}

export function obtenerAvances(){
  const avances = leerStorage(STORAGE_KEYS.avances, avancesIniciales);
  return Array.isArray(avances) ? avances : [];
}

export function guardarIngreso(datosIngreso){
  const ingreso = crearIngresoBase(datosIngreso);

  if(!ingreso.proyectoId){
    return {
      ok: false,
      ingreso: null,
      errores: ["Selecciona un proyecto para registrar el ingreso."]
    };
  }

  if(ingreso.monto <= 0){
    return {
      ok: false,
      ingreso: null,
      errores: ["El ingreso debe tener un monto mayor a cero."]
    };
  }

  const finanzas = obtenerFinanzas();
  const finanzasActualizadas = {
    ...finanzas,
    ingresos: [ingreso, ...finanzas.ingresos]
  };

  const guardado = guardarStorage(STORAGE_KEYS.finanzas, finanzasActualizadas);

  return {
    ok: guardado,
    ingreso,
    errores: guardado ? [] : ["No se pudo guardar el ingreso."]
  };
}

export function guardarGasto(datosGasto){
  const gasto = crearGastoBase(datosGasto);

  if(!gasto.proyectoId){
    return {
      ok: false,
      gasto: null,
      errores: ["Selecciona un proyecto para registrar el gasto."]
    };
  }

  if(gasto.monto <= 0){
    return {
      ok: false,
      gasto: null,
      errores: ["El gasto debe tener un monto mayor a cero."]
    };
  }

  const finanzas = obtenerFinanzas();
  const finanzasActualizadas = {
    ...finanzas,
    gastos: [gasto, ...finanzas.gastos]
  };

  const guardado = guardarStorage(STORAGE_KEYS.finanzas, finanzasActualizadas);

  return {
    ok: guardado,
    gasto,
    errores: guardado ? [] : ["No se pudo guardar el gasto."]
  };
}

export function obtenerResumenFinancieroProyecto(proyectoId){
  const ingresos = obtenerIngresosPorProyecto(proyectoId);
  const gastos = obtenerGastosPorProyecto(proyectoId);
  const avances = obtenerAvancesPorProyecto(proyectoId);

  const ingresosTotales = sumarMontos(ingresos);
  const gastosTotales = sumarMontos(gastos);
  const horasTrabajadas = sumarHoras(avances);
  const utilidad = ingresosTotales - gastosTotales;
  const dineroPorHora = horasTrabajadas > 0 ? utilidad / horasTrabajadas : 0;
  const gananciaPromedio = ingresos.length > 0 ? ingresosTotales / ingresos.length : 0;
  const puntoEquilibrio = gananciaPromedio > 0 ? gastosTotales / gananciaPromedio : 0;

  return {
    proyectoId,
    ingresosTotales: redondearDinero(ingresosTotales),
    gastosTotales: redondearDinero(gastosTotales),
    utilidad: redondearDinero(utilidad),
    horasTrabajadas: redondearDinero(horasTrabajadas),
    dineroPorHora: redondearDinero(dineroPorHora),
    puntoEquilibrio: redondearDinero(puntoEquilibrio),
    gananciaPromedio: redondearDinero(gananciaPromedio),
    cantidadIngresos: ingresos.length,
    cantidadGastos: gastos.length,
    cantidadAvances: avances.length,
    ingresos,
    gastos,
    avances
  };
}

export function obtenerIngresosPorProyecto(proyectoId){
  return obtenerIngresos().filter(function(ingreso){
    return ingreso.proyectoId === proyectoId;
  });
}

export function obtenerGastosPorProyecto(proyectoId){
  return obtenerGastos().filter(function(gasto){
    return gasto.proyectoId === proyectoId;
  });
}

export function obtenerAvancesPorProyecto(proyectoId){
  return obtenerAvances().filter(function(avance){
    return avance.proyectoId === proyectoId;
  });
}

export function obtenerResumenFinancieroGeneral(proyectos){
  const listaProyectos = Array.isArray(proyectos) ? proyectos : [];
  const resumenes = listaProyectos.map(function(proyecto){
    return {
      proyecto,
      resumen: obtenerResumenFinancieroProyecto(proyecto.id)
    };
  });

  const ingresosTotales = resumenes.reduce(function(total, item){
    return total + Number(item.resumen.ingresosTotales || 0);
  }, 0);

  const gastosTotales = resumenes.reduce(function(total, item){
    return total + Number(item.resumen.gastosTotales || 0);
  }, 0);

  const utilidadTotal = ingresosTotales - gastosTotales;

  return {
    ingresosTotales: redondearDinero(ingresosTotales),
    gastosTotales: redondearDinero(gastosTotales),
    utilidadTotal: redondearDinero(utilidadTotal),
    resumenes
  };
}

function sumarMontos(items){
  return items.reduce(function(total, item){
    return total + Number(item.monto || 0);
  }, 0);
}

function sumarHoras(avances){
  return avances.reduce(function(total, avance){
    return total + Number(avance.horas || 0);
  }, 0);
}

function redondearDinero(valor){
  return Math.round(Number(valor || 0) * 100) / 100;
}
