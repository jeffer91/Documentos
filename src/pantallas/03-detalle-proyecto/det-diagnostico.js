/* =========================================================
Nombre completo: det-diagnostico.js
Ruta o ubicación: src/pantallas/03-detalle-proyecto/det-diagnostico.js
Función o funciones:
- Renderizar diagnóstico básico del proyecto sin llamar aún a una IA externa.
- Evaluar avance, dinero, MVP, riesgo y siguiente acción.
- Entregar recomendaciones simples y accionables.
Con qué se conecta:
- det-main.js
- det-finanzas.js
========================================================= */

export function renderizarDetDiagnostico(proyecto, resumenFinanciero){
  const diagnostico = crearDiagnosticoBasico(proyecto, resumenFinanciero);

  return `
    <article class="app-panel det-panel-diagnostico">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Diagnóstico básico</p>
          <h2>Qué hacer ahora</h2>
        </div>
      </div>

      <div class="det-diagnostico-lista">
        ${renderizarItemDiagnostico("Qué va bien", diagnostico.queVaBien)}
        ${renderizarItemDiagnostico("Qué va mal", diagnostico.queVaMal)}
        ${renderizarItemDiagnostico("Qué hacer ahora", diagnostico.queHacerAhora)}
        ${renderizarItemDiagnostico("Qué evitar", diagnostico.queEvitar)}
      </div>

      <div class="det-recomendacion-fuerte">
        <strong>Recomendación directa</strong>
        <p>${diagnostico.recomendacionFuerte}</p>
      </div>
    </article>
  `;
}

function renderizarItemDiagnostico(titulo, texto){
  return `
    <div class="det-diagnostico-item">
      <span>${titulo}</span>
      <p>${texto}</p>
    </div>
  `;
}

function crearDiagnosticoBasico(proyecto, resumenFinanciero){
  if(!proyecto){
    return {
      queVaBien: "No hay proyecto seleccionado.",
      queVaMal: "No se puede analizar sin datos.",
      queHacerAhora: "Vuelve al inicio y selecciona un proyecto.",
      queEvitar: "Evita trabajar sin registrar datos.",
      recomendacionFuerte: "Selecciona un proyecto válido para poder analizarlo."
    };
  }

  const avance = Number(proyecto.porcentajeAvance || 0);
  const utilidad = Number(resumenFinanciero?.utilidad || 0);
  const horas = Number(resumenFinanciero?.horasTrabajadas || 0);
  const tieneMvp = Boolean(proyecto.mvp && proyecto.mvp.trim().length > 0);
  const tieneAccion = Boolean(proyecto.siguienteAccion && proyecto.siguienteAccion.trim().length > 0);

  return {
    queVaBien: obtenerQueVaBien(avance, utilidad, tieneMvp),
    queVaMal: obtenerQueVaMal(avance, utilidad, horas, tieneMvp),
    queHacerAhora: tieneAccion ? proyecto.siguienteAccion : "Define una siguiente acción pequeña y medible.",
    queEvitar: "Evita agregar funciones nuevas si todavía no hay validación, venta o avance concreto.",
    recomendacionFuerte: obtenerRecomendacionFuerte(proyecto, resumenFinanciero)
  };
}

function obtenerQueVaBien(avance, utilidad, tieneMvp){
  if(utilidad > 0){
    return "Ya existe utilidad positiva. Eso significa que el proyecto tiene una señal económica real.";
  }

  if(avance >= 40 && tieneMvp){
    return "El proyecto tiene avance y un MVP definido. Está en una buena base para validar.";
  }

  if(tieneMvp){
    return "Ya tiene una versión mínima definida. Eso ayuda a no perderse agregando funciones.";
  }

  return "El proyecto ya está registrado y puede empezar a medirse.";
}

function obtenerQueVaMal(avance, utilidad, horas, tieneMvp){
  if(horas > 0 && utilidad <= 0){
    return "Hay tiempo invertido, pero todavía no se registra utilidad positiva.";
  }

  if(!tieneMvp){
    return "El MVP no está claro. Sin MVP es fácil trabajar mucho y avanzar poco.";
  }

  if(avance < 20){
    return "El avance todavía es bajo. Necesita una acción concreta para moverse.";
  }

  return "Faltan más datos de ingresos, gastos y avances para evaluar mejor.";
}

function obtenerRecomendacionFuerte(proyecto, resumenFinanciero){
  const utilidad = Number(resumenFinanciero?.utilidad || 0);
  const horas = Number(resumenFinanciero?.horasTrabajadas || 0);

  if(horas >= 10 && utilidad <= 0){
    return "No sigas invirtiendo muchas horas sin definir cómo este proyecto va a generar dinero o ahorrar tiempo medible.";
  }

  if(!proyecto.mvp){
    return "Antes de seguir, define un MVP pequeño que puedas terminar y probar rápido.";
  }

  if(proyecto.semaforo === "rojo"){
    return "Este proyecto necesita una decisión: simplificarlo, buscar monetización o pausarlo temporalmente.";
  }

  return "Avanza una acción pequeña hoy y registra el resultado para mejorar la prioridad del proyecto.";
}
