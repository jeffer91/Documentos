/* =========================================================
Nombre completo: srv-semaforo.js
Ruta o ubicación: src/servicios/srv-semaforo.js
Función o funciones:
- Calcular el semáforo inteligente de cada proyecto.
- Evaluar dinero, avance, horas, MVP, riesgo y siguiente acción.
- Devolver verde, amarillo o rojo con una razón simple.
Con qué se conecta:
- srv-proyectos.js
- srv-prioridad.js
- ini-tarjetas.js
- det-resumen.js
========================================================= */

export function calcularSemaforoProyecto(proyecto, resumenFinanciero, porcentajeAvance){
  const evaluacion = evaluarSemaforoProyecto(proyecto, resumenFinanciero, porcentajeAvance);
  return evaluacion.color;
}

export function evaluarSemaforoProyecto(proyecto, resumenFinanciero, porcentajeAvance){
  if(!proyecto){
    return {
      color: "rojo",
      razon: "No hay datos suficientes del proyecto."
    };
  }

  const resumen = resumenFinanciero || {};
  const utilidad = Number(resumen.utilidad || 0);
  const ingresos = Number(resumen.ingresosTotales || 0);
  const gastos = Number(resumen.gastosTotales || 0);
  const horas = Number(resumen.horasTrabajadas || 0);
  const avance = Number(porcentajeAvance || proyecto.porcentajeAvance || 0);
  const tieneMvp = Boolean(proyecto.mvp && proyecto.mvp.trim().length > 0);
  const tieneAccion = Boolean(proyecto.siguienteAccion && proyecto.siguienteAccion.trim().length > 0);

  if(utilidad > 0 && avance >= 45 && tieneMvp && tieneAccion){
    return {
      color: "verde",
      razon: "Tiene utilidad, avance real, MVP y siguiente acción."
    };
  }

  if(ingresos > 0 && gastos <= ingresos && tieneAccion){
    return {
      color: "verde",
      razon: "Tiene ingresos y gastos controlados."
    };
  }

  if(horas >= 10 && ingresos <= 0){
    return {
      color: "rojo",
      razon: "Hay muchas horas invertidas y todavía no hay ingresos."
    };
  }

  if(!tieneMvp){
    return {
      color: "rojo",
      razon: "No tiene MVP claro."
    };
  }

  if(!tieneAccion){
    return {
      color: "rojo",
      razon: "No tiene siguiente acción clara."
    };
  }

  if(gastos > ingresos && gastos > 0){
    return {
      color: "amarillo",
      razon: "Tiene gastos mayores que ingresos, pero todavía puede corregirse."
    };
  }

  if(avance >= 30 && tieneMvp && tieneAccion){
    return {
      color: "amarillo",
      razon: "Tiene base para avanzar, pero falta señal económica más fuerte."
    };
  }

  return {
    color: "amarillo",
    razon: "Necesita más datos, avance o validación económica."
  };
}
