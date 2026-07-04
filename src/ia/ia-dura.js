/* =========================================================
Nombre completo: ia-dura.js
Ruta o ubicación: src/ia/ia-dura.js
Función o funciones:
- Generar una recomendación directa cuando el proyecto tiene señales débiles.
- Detectar proyectos con muchas horas, poco dinero o sin MVP claro.
- Evitar mensajes motivacionales vacíos.
Con qué se conecta:
- srv-ia.js
- ia-analista.js
========================================================= */

export function generarRecomendacionDura(proyecto, resumenFinanciero){
  if(!proyecto){
    return "No puedo dar una recomendación fuerte sin un proyecto seleccionado.";
  }

  const resumen = resumenFinanciero || {};
  const horas = Number(resumen.horasTrabajadas || 0);
  const ingresos = Number(resumen.ingresosTotales || 0);
  const utilidad = Number(resumen.utilidad || 0);

  if(!proyecto.mvp){
    return "Antes de seguir trabajando, define un MVP pequeño. Si no haces eso, el proyecto puede crecer mucho y no producir nada.";
  }

  if(horas >= 10 && ingresos <= 0){
    return "Este proyecto ya consumió varias horas y todavía no tiene ingresos. Define una venta, prueba pagada o ahorro medible antes de seguir agregando funciones.";
  }

  if(utilidad < 0){
    return "Este proyecto está perdiendo dinero. No aumentes gastos hasta tener una acción clara para recuperar o validar ingresos.";
  }

  if(proyecto.semaforo === "rojo"){
    return "Este proyecto no debería crecer más hasta corregir la causa del semáforo rojo.";
  }

  if(Number(proyecto.prioridad || 0) < 50){
    return "Este proyecto no es prioridad alta por ahora. Avánzalo solo si una acción pequeña puede aclarar dinero, MVP o validación.";
  }

  return "El proyecto puede avanzar, pero no agregues complejidad: ejecuta una acción pequeña, mide resultado y vuelve a decidir.";
}
