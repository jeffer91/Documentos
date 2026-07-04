/* =========================================================
Nombre completo: srv-prioridad.js
Ruta o ubicación: src/servicios/srv-prioridad.js
Función o funciones:
- Calcular prioridad inteligente de cada proyecto.
- Evaluar dinero, dinero por hora, avance, riesgo, potencial y acción disponible.
- Ordenar proyectos para el Top 3 del día.
Con qué se conecta:
- srv-proyectos.js
- srv-semaforo.js
- ini-top3.js
========================================================= */

export function calcularPrioridadProyecto(proyecto, resumenFinanciero, porcentajeAvance, semaforo){
  if(!proyecto){
    return 0;
  }

  const puntajeDinero = calcularPuntajeDinero(resumenFinanciero);
  const puntajeDineroHora = calcularPuntajeDineroHora(resumenFinanciero);
  const puntajeAvance = Number(porcentajeAvance || 0);
  const puntajePotencial = calcularPuntajePotencial(proyecto.potencial);
  const puntajeRiesgo = calcularPuntajeRiesgo(proyecto.riesgo);
  const puntajeAccion = calcularPuntajeAccion(proyecto);
  const puntajeSemaforo = calcularPuntajeSemaforo(semaforo);

  const prioridad =
    puntajeDinero * 0.22 +
    puntajeDineroHora * 0.18 +
    puntajeAvance * 0.16 +
    puntajePotencial * 0.16 +
    puntajeRiesgo * 0.1 +
    puntajeAccion * 0.1 +
    puntajeSemaforo * 0.08;

  return limitarPuntaje(prioridad);
}

export function ordenarProyectosPorPrioridad(proyectos){
  const lista = Array.isArray(proyectos) ? proyectos : [];

  return [...lista].sort(function(a, b){
    return Number(b.prioridad || 0) - Number(a.prioridad || 0);
  });
}

export function obtenerTop3Proyectos(proyectos){
  return ordenarProyectosPorPrioridad(proyectos).slice(0, 3);
}

function calcularPuntajeDinero(resumenFinanciero){
  const utilidad = Number(resumenFinanciero?.utilidad || 0);
  const ingresos = Number(resumenFinanciero?.ingresosTotales || 0);

  if(utilidad > 0){
    return 100;
  }

  if(ingresos > 0){
    return 75;
  }

  return 35;
}

function calcularPuntajeDineroHora(resumenFinanciero){
  const dineroPorHora = Number(resumenFinanciero?.dineroPorHora || 0);

  if(dineroPorHora >= 20){
    return 100;
  }

  if(dineroPorHora >= 10){
    return 80;
  }

  if(dineroPorHora > 0){
    return 60;
  }

  if(dineroPorHora < 0){
    return 20;
  }

  return 35;
}

function calcularPuntajePotencial(potencial){
  if(potencial === "alto"){
    return 100;
  }

  if(potencial === "medio"){
    return 65;
  }

  if(potencial === "bajo"){
    return 35;
  }

  return 55;
}

function calcularPuntajeRiesgo(riesgo){
  if(riesgo === "bajo"){
    return 100;
  }

  if(riesgo === "medio"){
    return 65;
  }

  if(riesgo === "alto"){
    return 30;
  }

  return 55;
}

function calcularPuntajeAccion(proyecto){
  if(proyecto.siguienteAccion && proyecto.siguienteAccion.trim().length >= 15){
    return 100;
  }

  if(proyecto.siguienteAccion && proyecto.siguienteAccion.trim().length > 0){
    return 60;
  }

  return 15;
}

function calcularPuntajeSemaforo(semaforo){
  if(semaforo === "verde"){
    return 100;
  }

  if(semaforo === "amarillo"){
    return 60;
  }

  return 25;
}

function limitarPuntaje(valor){
  const numero = Number(valor || 0);
  return Math.max(0, Math.min(100, Math.round(numero)));
}
