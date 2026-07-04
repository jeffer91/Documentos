/* =========================================================
Nombre completo: srv-ia.js
Ruta o ubicación: src/servicios/srv-ia.js
Función o funciones:
- Unir los módulos internos de IA diagnóstica.
- Generar diagnóstico por proyecto y Top 3 estratégico.
- Preparar la app para una futura conexión con IA externa.
Con qué se conecta:
- srv-proyectos.js
- srv-finanzas.js
- ia-analista.js
- ia-financiera.js
- ia-estratega.js
- ia-dura.js
- iad-main.js
========================================================= */

import { obtenerProyectos, obtenerProyectoPorId } from "./srv-proyectos.js";
import { obtenerResumenFinancieroProyecto } from "./srv-finanzas.js";
import { analizarProyecto } from "../ia/ia-analista.js";
import { analizarFinanzasProyecto } from "../ia/ia-financiera.js";
import { generarTop3Estrategico, obtenerProyectoMasConveniente } from "../ia/ia-estratega.js";
import { generarRecomendacionDura } from "../ia/ia-dura.js";

export function obtenerDiagnosticoProyecto(proyectoId){
  const proyecto = proyectoId ? obtenerProyectoPorId(proyectoId) : obtenerProyectoMasConveniente(obtenerProyectos());

  if(!proyecto){
    return crearDiagnosticoVacio();
  }

  const resumenFinanciero = obtenerResumenFinancieroProyecto(proyecto.id);
  const diagnosticoGeneral = analizarProyecto(proyecto);
  const diagnosticoFinanciero = analizarFinanzasProyecto(resumenFinanciero);
  const recomendacionDura = generarRecomendacionDura(proyecto, resumenFinanciero);

  return {
    proyecto,
    resumenFinanciero,
    diagnosticoGeneral,
    diagnosticoFinanciero,
    recomendacionDura,
    generadoEn: new Date().toISOString()
  };
}

export function obtenerDiagnosticoEstrategico(){
  const proyectos = obtenerProyectos();
  const top3 = generarTop3Estrategico(proyectos);
  const mejorProyecto = obtenerProyectoMasConveniente(proyectos);

  return {
    proyectos,
    top3,
    mejorProyecto,
    mensaje: obtenerMensajeEstrategico(mejorProyecto)
  };
}

function obtenerMensajeEstrategico(mejorProyecto){
  if(!mejorProyecto){
    return "No hay proyectos suficientes para generar una recomendación estratégica.";
  }

  return `Hoy conviene revisar primero: ${mejorProyecto.nombre}. Prioridad calculada: ${Number(mejorProyecto.prioridad || 0)}/100.`;
}

function crearDiagnosticoVacio(){
  return {
    proyecto: null,
    resumenFinanciero: null,
    diagnosticoGeneral: {
      queVaBien: "No hay proyecto seleccionado.",
      queVaMal: "No se puede diagnosticar sin datos.",
      queHacerAhora: "Crea o selecciona un proyecto.",
      queMejorar: "Registra información básica del proyecto.",
      queEvitar: "Evita trabajar sin datos medibles.",
      nivelRiesgo: "alto"
    },
    diagnosticoFinanciero: {
      lectura: "No hay datos financieros.",
      alerta: "Sin proyecto no hay análisis financiero.",
      accion: "Crea un proyecto y registra ingresos, gastos u horas.",
      nivel: "observación"
    },
    recomendacionDura: "Selecciona un proyecto para obtener una recomendación directa.",
    generadoEn: new Date().toISOString()
  };
}
