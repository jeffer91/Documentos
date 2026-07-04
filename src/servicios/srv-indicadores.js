/* =========================================================
Nombre completo: srv-indicadores.js
Ruta o ubicación: src/servicios/srv-indicadores.js
Función o funciones:
- Enriquecer proyectos con avance, semáforo y prioridad calculados.
- Unir datos financieros, tareas y reglas inteligentes.
- Centralizar el cálculo de indicadores para toda la app.
Con qué se conecta:
- srv-proyectos.js
- srv-avance.js
- srv-semaforo.js
- srv-prioridad.js
- srv-finanzas.js
- srv-tareas.js
========================================================= */

import { obtenerResumenFinancieroProyecto } from "./srv-finanzas.js";
import { obtenerResumenTareasProyecto } from "./srv-tareas.js";
import { calcularPorcentajeAvanceInteligente } from "./srv-avance.js";
import { calcularSemaforoProyecto, evaluarSemaforoProyecto } from "./srv-semaforo.js";
import { calcularPrioridadProyecto } from "./srv-prioridad.js";

export function enriquecerProyectoConIndicadores(proyecto){
  if(!proyecto){
    return null;
  }

  const resumenFinanciero = obtenerResumenFinancieroProyecto(proyecto.id);
  const resumenTareas = obtenerResumenTareasProyecto(proyecto.id);
  const porcentajeAvance = calcularPorcentajeAvanceInteligente(proyecto, resumenFinanciero, resumenTareas);
  const semaforo = calcularSemaforoProyecto(proyecto, resumenFinanciero, porcentajeAvance);
  const evaluacionSemaforo = evaluarSemaforoProyecto(proyecto, resumenFinanciero, porcentajeAvance);
  const prioridad = calcularPrioridadProyecto(proyecto, resumenFinanciero, porcentajeAvance, semaforo);

  return {
    ...proyecto,
    porcentajeAvance,
    semaforo,
    prioridad,
    razonSemaforo: evaluacionSemaforo.razon,
    resumenFinanciero,
    resumenTareas
  };
}

export function enriquecerProyectosConIndicadores(proyectos){
  const lista = Array.isArray(proyectos) ? proyectos : [];

  return lista
    .map(enriquecerProyectoConIndicadores)
    .filter(Boolean)
    .sort(function(a, b){
      return Number(b.prioridad || 0) - Number(a.prioridad || 0);
    });
}
