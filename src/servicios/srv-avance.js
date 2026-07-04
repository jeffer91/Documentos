/* =========================================================
Nombre completo: srv-avance.js
Ruta o ubicación: src/servicios/srv-avance.js
Función o funciones:
- Calcular porcentaje de avance inteligente por proyecto.
- Evaluar MVP, estado, finanzas, horas, tareas y siguiente acción.
- Evitar que el avance dependa solo de un dato manual.
Con qué se conecta:
- srv-proyectos.js
- srv-finanzas.js
- srv-tareas.js
- srv-semaforo.js
- srv-prioridad.js
========================================================= */

export function calcularPorcentajeAvanceInteligente(proyecto, resumenFinanciero, resumenTareas){
  if(!proyecto){
    return 0;
  }

  const puntajeMvp = calcularPuntajeMvp(proyecto);
  const puntajeEstado = calcularPuntajeEstado(proyecto);
  const puntajeFinanciero = calcularPuntajeFinanciero(resumenFinanciero);
  const puntajeTiempo = calcularPuntajeTiempo(resumenFinanciero);
  const puntajeTareas = calcularPuntajeTareas(resumenTareas);
  const puntajeAccion = calcularPuntajeAccion(proyecto);

  const porcentaje =
    puntajeMvp * 0.2 +
    puntajeEstado * 0.2 +
    puntajeFinanciero * 0.2 +
    puntajeTiempo * 0.1 +
    puntajeTareas * 0.2 +
    puntajeAccion * 0.1;

  const porcentajeManual = Number(proyecto.porcentajeAvance || 0);
  const combinado = Math.max(porcentaje, porcentajeManual * 0.6);

  return limitarPorcentaje(combinado);
}

function calcularPuntajeMvp(proyecto){
  if(proyecto.mvp && proyecto.mvp.trim().length >= 20){
    return 100;
  }

  if(proyecto.mvp && proyecto.mvp.trim().length > 0){
    return 60;
  }

  return 10;
}

function calcularPuntajeEstado(proyecto){
  const mapa = {
    "Idea": 15,
    "Validación": 35,
    "MVP": 55,
    "Monetizando": 75,
    "Creciendo": 90,
    "Pausado": 25,
    "Cerrado": 100
  };

  return mapa[proyecto.estado] || 20;
}

function calcularPuntajeFinanciero(resumenFinanciero){
  const resumen = resumenFinanciero || {};

  if(Number(resumen.utilidad || 0) > 0){
    return 100;
  }

  if(Number(resumen.ingresosTotales || 0) > 0){
    return 75;
  }

  if(Number(resumen.gastosTotales || 0) > 0){
    return 35;
  }

  return 20;
}

function calcularPuntajeTiempo(resumenFinanciero){
  const horas = Number(resumenFinanciero?.horasTrabajadas || 0);

  if(horas >= 20){
    return 80;
  }

  if(horas >= 10){
    return 65;
  }

  if(horas > 0){
    return 45;
  }

  return 15;
}

function calcularPuntajeTareas(resumenTareas){
  const total = Number(resumenTareas?.total || 0);
  const completadas = Number(resumenTareas?.completadas || 0);
  const enProceso = Number(resumenTareas?.enProceso || 0);

  if(total <= 0){
    return 30;
  }

  return limitarPorcentaje((completadas / total) * 100 + enProceso * 8);
}

function calcularPuntajeAccion(proyecto){
  if(proyecto.siguienteAccion && proyecto.siguienteAccion.trim().length >= 15){
    return 100;
  }

  if(proyecto.siguienteAccion && proyecto.siguienteAccion.trim().length > 0){
    return 60;
  }

  return 10;
}

function limitarPorcentaje(valor){
  const numero = Number(valor || 0);
  return Math.max(0, Math.min(100, Math.round(numero)));
}
