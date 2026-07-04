/* =========================================================
Nombre completo: iad-main.js
Ruta o ubicación: src/pantallas/07-ia-diagnostico/iad-main.js
Función o funciones:
- Renderizar la pantalla IA / Diagnóstico.
- Mostrar diagnóstico general, financiero, recomendación fuerte y Top 3 estratégico.
- Permitir seleccionar el proyecto que será diagnosticado.
Con qué se conecta:
- srv-proyectos.js
- srv-ia.js
- iad-resumen.js
- iad-recomendaciones.js
- iad-alertas.js
========================================================= */

import { obtenerProyectos } from "../../servicios/srv-proyectos.js";
import { obtenerDiagnosticoEstrategico, obtenerDiagnosticoProyecto } from "../../servicios/srv-ia.js";
import { renderizarIadResumen } from "./iad-resumen.js";
import { renderizarIadRecomendaciones } from "./iad-recomendaciones.js";
import { renderizarIadAlertas } from "./iad-alertas.js";

export function renderizarIadMain(proyectoActivoId = null){
  const proyectos = obtenerProyectos();

  if(!proyectos.length){
    return renderizarSinProyectos();
  }

  const proyectoActivo = obtenerProyectoActivo(proyectos, proyectoActivoId);
  const diagnostico = obtenerDiagnosticoProyecto(proyectoActivo.id);
  const estrategia = obtenerDiagnosticoEstrategico();

  return `
    <section class="iad-header app-panel">
      <div>
        <p class="app-kicker">IA de diagnóstico</p>
        <h2>Diagnóstico inteligente del proyecto</h2>
        <p>Esta IA interna revisa avance, dinero, horas, MVP, riesgo, prioridad y siguiente acción para ayudarte a decidir qué hacer.</p>
      </div>

      <label class="iad-selector">
        <span>Proyecto a diagnosticar</span>
        <select id="iad-selector-proyecto">
          ${renderizarOpcionesProyectos(proyectos, proyectoActivo.id)}
        </select>
      </label>
    </section>

    <section class="iad-grid-principal">
      ${renderizarIadResumen(diagnostico)}
      ${renderizarIadAlertas(diagnostico)}
    </section>

    <section class="iad-grid-secundario">
      ${renderizarIadRecomendaciones(diagnostico, estrategia)}
    </section>
  `;
}

function obtenerProyectoActivo(proyectos, proyectoActivoId){
  const encontrado = proyectos.find(function(proyecto){
    return proyecto.id === proyectoActivoId;
  });

  return encontrado || proyectos[0];
}

function renderizarOpcionesProyectos(proyectos, proyectoActivoId){
  return proyectos.map(function(proyecto){
    const seleccionado = proyecto.id === proyectoActivoId ? "selected" : "";
    return `<option value="${proyecto.id}" ${seleccionado}>${proyecto.nombre}</option>`;
  }).join("");
}

function renderizarSinProyectos(){
  return `
    <section class="app-panel iad-sin-proyectos">
      <p class="app-kicker">IA de diagnóstico</p>
      <h2>No hay proyectos todavía</h2>
      <p>Primero crea un proyecto para que la IA pueda analizarlo.</p>
      <button class="app-btn app-btn-primario" type="button" data-ruta="proyectos">
        Crear proyecto
      </button>
    </section>
  `;
}
