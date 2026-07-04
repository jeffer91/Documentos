/* =========================================================
Nombre completo: ia-analista.js
Ruta o ubicación: src/ia/ia-analista.js
Función o funciones:
- Analizar el estado general de un proyecto.
- Evaluar avance, MVP, semáforo, prioridad y siguiente acción.
- Entregar diagnóstico breve y accionable sin usar IA externa todavía.
Con qué se conecta:
- srv-ia.js
- ia-dura.js
========================================================= */

export function analizarProyecto(proyecto){
  if(!proyecto){
    return {
      queVaBien: "No hay proyecto seleccionado.",
      queVaMal: "No se puede analizar sin datos.",
      queHacerAhora: "Selecciona un proyecto para generar diagnóstico.",
      queMejorar: "Crea o selecciona un proyecto válido.",
      queEvitar: "Evita trabajar sin registrar datos.",
      nivelRiesgo: "alto"
    };
  }

  return {
    queVaBien: obtenerQueVaBien(proyecto),
    queVaMal: obtenerQueVaMal(proyecto),
    queHacerAhora: proyecto.siguienteAccion || "Define una siguiente acción pequeña y medible.",
    queMejorar: obtenerQueMejorar(proyecto),
    queEvitar: obtenerQueEvitar(proyecto),
    nivelRiesgo: proyecto.riesgo || "medio"
  };
}

function obtenerQueVaBien(proyecto){
  if(proyecto.semaforo === "verde"){
    return "El proyecto tiene buenas señales: avance, claridad y una situación económica o estratégica favorable.";
  }

  if(Number(proyecto.porcentajeAvance || 0) >= 40){
    return "El proyecto ya tiene un avance importante. Conviene convertir ese avance en validación o dinero.";
  }

  if(proyecto.mvp){
    return "El proyecto tiene un MVP definido, eso ayuda a evitar que crezca sin dirección.";
  }

  return "El proyecto ya está registrado y puede empezar a medirse.";
}

function obtenerQueVaMal(proyecto){
  if(!proyecto.mvp){
    return "El MVP no está claro. Sin una versión mínima, el proyecto puede crecer demasiado sin generar resultados.";
  }

  if(proyecto.semaforo === "rojo"){
    return proyecto.razonSemaforo || "El proyecto tiene señales de riesgo que deben revisarse.";
  }

  if(Number(proyecto.porcentajeAvance || 0) < 25){
    return "El avance todavía es bajo. Necesita una acción concreta y pequeña para moverse.";
  }

  return "Faltan más datos para saber si el proyecto está avanzando bien o solo acumulando trabajo.";
}

function obtenerQueMejorar(proyecto){
  if(!proyecto.siguienteAccion){
    return "Define una siguiente acción clara, corta y ejecutable hoy.";
  }

  if(Number(proyecto.prioridad || 0) < 60){
    return "Mejora la claridad económica del proyecto: cómo gana dinero, ahorra tiempo o consigue validación.";
  }

  return "Registra más avances, ingresos, gastos y tareas para que el diagnóstico sea más exacto.";
}

function obtenerQueEvitar(proyecto){
  if(proyecto.semaforo === "rojo"){
    return "Evita seguir invirtiendo muchas horas sin resolver el problema principal del proyecto.";
  }

  return "Evita agregar funciones nuevas antes de validar si el MVP realmente sirve o puede generar dinero.";
}
