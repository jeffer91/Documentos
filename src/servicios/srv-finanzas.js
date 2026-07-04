/* =========================================================
Nombre completo: srv-finanzas.js
Ruta o ubicación: src/servicios/srv-finanzas.js
Función o funciones:
- Leer ingresos, gastos y avances desde almacenamiento local.
- Calcular utilidad, horas trabajadas y dinero por hora por proyecto.
- Entregar resumen financiero simple para la pantalla Detalle.
Con qué se conecta:
- shared-storage.js
- data-finanzas.js
- data-avances.js
- det-finanzas.js
========================================================= */

import { avancesIniciales } from "../data/data-avances.js";
import { gastosIniciales, ingresosIniciales } from "../data/data-finanzas.js";
import { STORAGE_KEYS, leerStorage } from "../shared/shared-storage.js";

export function obtenerIngresos(){
  const finanzas = leerStorage(STORAGE_KEYS.finanzas, {
    ingresos: ingresosIniciales,
    gastos: gastosIniciales
  });

  return Array.isArray(finanzas.ingresos) ? finanzas.ingresos : [];
}

export function obtenerGastos(){
  const finanzas = leerStorage(STORAGE_KEYS.finanzas, {
    ingresos: ingresosIniciales,
    gastos: gastosIniciales
  });

  return Array.isArray(finanzas.gastos) ? finanzas.gastos : [];
}

export function obtenerAvances(){
  return leerStorage(STORAGE_KEYS.avances, avancesIniciales);
}

export function obtenerResumenFinancieroProyecto(proyectoId){
  const ingresos = obtenerIngresos().filter(function(ingreso){
    return ingreso.proyectoId === proyectoId;
  });

  const gastos = obtenerGastos().filter(function(gasto){
    return gasto.proyectoId === proyectoId;
  });

  const avances = obtenerAvances().filter(function(avance){
    return avance.proyectoId === proyectoId;
  });

  const ingresosTotales = sumarMontos(ingresos);
  const gastosTotales = sumarMontos(gastos);
  const horasTrabajadas = sumarHoras(avances);
  const utilidad = ingresosTotales - gastosTotales;
  const dineroPorHora = horasTrabajadas > 0 ? utilidad / horasTrabajadas : 0;

  return {
    proyectoId,
    ingresosTotales,
    gastosTotales,
    utilidad,
    horasTrabajadas,
    dineroPorHora: redondearDinero(dineroPorHora),
    cantidadIngresos: ingresos.length,
    cantidadGastos: gastos.length,
    cantidadAvances: avances.length
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
