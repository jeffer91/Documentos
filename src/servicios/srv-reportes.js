/* =========================================================
Nombre completo: srv-reportes.js
Ruta o ubicación: src/servicios/srv-reportes.js
Función o funciones:
- Crear reportes generales de proyectos.
- Calcular utilidad, ingresos, gastos, horas, avance y prioridad acumulada.
- Preparar datos para gráficos, tablas y resumen exportable.
Con qué se conecta:
- srv-proyectos.js
- srv-finanzas.js
- srv-avances.js
- rep-main.js
- rep-graficos.js
- rep-tabla.js
========================================================= */

import { obtenerProyectos } from "./srv-proyectos.js";
import { obtenerResumenFinancieroProyecto } from "./srv-finanzas.js";
import { obtenerAvancesPorProyecto } from "./srv-avances.js";

export function obtenerReporteGeneral(){
  const proyectos = obtenerProyectos();
  const filas = proyectos.map(crearFilaReporte);

  const totales = filas.reduce(function(acumulado, fila){
    return {
      ingresos: acumulado.ingresos + fila.ingresos,
      gastos: acumulado.gastos + fila.gastos,
      utilidad: acumulado.utilidad + fila.utilidad,
      horas: acumulado.horas + fila.horas
    };
  }, {
    ingresos: 0,
    gastos: 0,
    utilidad: 0,
    horas: 0
  });

  const avancePromedio = filas.length
    ? Math.round(filas.reduce(function(total, fila){ return total + fila.avance; }, 0) / filas.length)
    : 0;

  return {
    totales: {
      ingresos: redondear(totales.ingresos),
      gastos: redondear(totales.gastos),
      utilidad: redondear(totales.utilidad),
      horas: redondear(totales.horas),
      dineroPorHora: totales.horas > 0 ? redondear(totales.utilidad / totales.horas) : 0,
      avancePromedio
    },
    filas,
    convenientes: filas.filter(function(fila){ return fila.utilidad > 0 || fila.prioridad >= 75; }).slice(0, 5),
    revisar: filas.filter(function(fila){ return fila.semaforo === "rojo" || fila.utilidad < 0; }).slice(0, 5)
  };
}

export function crearTextoReporteGeneral(){
  const reporte = obtenerReporteGeneral();

  const lineas = [
    "REPORTE GENERAL - PROYECTOS IA",
    "",
    `Ingresos totales: $${reporte.totales.ingresos}`,
    `Gastos totales: $${reporte.totales.gastos}`,
    `Utilidad total: $${reporte.totales.utilidad}`,
    `Horas totales: ${reporte.totales.horas}`,
    `Dinero por hora: $${reporte.totales.dineroPorHora}/h`,
    `Avance promedio: ${reporte.totales.avancePromedio}%`,
    "",
    "PROYECTOS",
    ...reporte.filas.map(function(fila){
      return `${fila.nombre} | ${fila.estado} | ${fila.semaforo} | utilidad $${fila.utilidad} | prioridad ${fila.prioridad}`;
    })
  ];

  return lineas.join("\n");
}

function crearFilaReporte(proyecto){
  const resumen = obtenerResumenFinancieroProyecto(proyecto.id);
  const avances = obtenerAvancesPorProyecto(proyecto.id);

  return {
    id: proyecto.id,
    nombre: proyecto.nombre,
    tipo: proyecto.tipo,
    estado: proyecto.estado,
    semaforo: proyecto.semaforo,
    avance: Number(proyecto.porcentajeAvance || 0),
    prioridad: Number(proyecto.prioridad || 0),
    ingresos: Number(resumen.ingresosTotales || 0),
    gastos: Number(resumen.gastosTotales || 0),
    utilidad: Number(resumen.utilidad || 0),
    horas: Number(resumen.horasTrabajadas || 0),
    dineroPorHora: Number(resumen.dineroPorHora || 0),
    avancesRegistrados: avances.length,
    siguienteAccion: proyecto.siguienteAccion || "Definir siguiente acción."
  };
}

function redondear(valor){
  return Math.round(Number(valor || 0) * 100) / 100;
}
