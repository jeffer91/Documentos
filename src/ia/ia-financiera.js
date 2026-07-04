/* =========================================================
Nombre completo: ia-financiera.js
Ruta o ubicación: src/ia/ia-financiera.js
Función o funciones:
- Analizar ingresos, gastos, utilidad, horas y dinero por hora.
- Detectar si un proyecto consume mucho tiempo o dinero.
- Entregar recomendaciones financieras simples.
Con qué se conecta:
- srv-ia.js
- srv-finanzas.js
========================================================= */

export function analizarFinanzasProyecto(resumenFinanciero){
  const resumen = resumenFinanciero || crearResumenVacio();

  return {
    lectura: obtenerLecturaFinanciera(resumen),
    alerta: obtenerAlertaFinanciera(resumen),
    accion: obtenerAccionFinanciera(resumen),
    nivel: obtenerNivelFinanciero(resumen)
  };
}

function obtenerLecturaFinanciera(resumen){
  if(resumen.utilidad > 0){
    return "El proyecto ya tiene utilidad positiva. Hay una señal económica real que conviene repetir o escalar.";
  }

  if(resumen.ingresosTotales > 0 && resumen.gastosTotales > resumen.ingresosTotales){
    return "El proyecto tiene ingresos, pero los gastos están superando lo que entra.";
  }

  if(resumen.horasTrabajadas >= 10 && resumen.ingresosTotales <= 0){
    return "El proyecto tiene muchas horas invertidas y todavía no registra ingresos.";
  }

  return "Todavía faltan datos financieros para saber si este proyecto conviene económicamente.";
}

function obtenerAlertaFinanciera(resumen){
  if(resumen.utilidad < 0){
    return "La utilidad es negativa. Revisa gastos y define una acción cercana a ingreso.";
  }

  if(resumen.dineroPorHora > 0 && resumen.dineroPorHora < 5){
    return "El dinero por hora es bajo. Puede estar consumiendo más tiempo del que conviene.";
  }

  if(resumen.ingresosTotales <= 0){
    return "No hay ingresos registrados. Sin ingresos o ahorro medible, la prioridad debe revisarse.";
  }

  return "No hay alerta financiera grave por ahora.";
}

function obtenerAccionFinanciera(resumen){
  if(resumen.utilidad > 0){
    return "Identifica qué generó ese ingreso y repítelo antes de crear nuevas funciones.";
  }

  if(resumen.gastosTotales > resumen.ingresosTotales){
    return "Reduce gastos y define una venta, prueba pagada o ahorro concreto.";
  }

  return "Registra una hipótesis de ingreso: venta, servicio, curso, ahorro de tiempo o validación pagada.";
}

function obtenerNivelFinanciero(resumen){
  if(resumen.utilidad > 0){
    return "bueno";
  }

  if(resumen.utilidad < 0 || resumen.horasTrabajadas >= 10){
    return "riesgo";
  }

  return "observación";
}

function crearResumenVacio(){
  return {
    ingresosTotales: 0,
    gastosTotales: 0,
    utilidad: 0,
    horasTrabajadas: 0,
    dineroPorHora: 0
  };
}
