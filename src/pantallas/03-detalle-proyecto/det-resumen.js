/* =========================================================
Nombre completo: det-resumen.js
Ruta o ubicación: src/pantallas/03-detalle-proyecto/det-resumen.js
Función o funciones:
- Renderizar el resumen principal de un proyecto.
- Mostrar estado, semáforo, avance, MVP y siguiente acción.
- Mantener separada la vista resumen del detalle.
Con qué se conecta:
- det-main.js
========================================================= */

export function renderizarDetResumen(proyecto){
  if(!proyecto){
    return renderizarResumenVacio();
  }

  return `
    <article class="app-panel det-panel-resumen">
      <div class="det-resumen-header">
        <div>
          <p class="app-kicker">Resumen del proyecto</p>
          <h2>${proyecto.nombre}</h2>
          <p>${proyecto.descripcion || "Sin descripción registrada."}</p>
        </div>
        <div class="det-estado det-estado-${proyecto.semaforo}">
          <span class="det-semaforo det-semaforo-${proyecto.semaforo}"></span>
          <strong>${proyecto.estado}</strong>
        </div>
      </div>

      <div class="det-resumen-grid">
        <div class="det-dato">
          <span>Tipo</span>
          <strong>${proyecto.tipo}</strong>
        </div>
        <div class="det-dato">
          <span>Avance</span>
          <strong>${Number(proyecto.porcentajeAvance || 0)}%</strong>
        </div>
        <div class="det-dato">
          <span>Potencial</span>
          <strong>${proyecto.potencial}</strong>
        </div>
        <div class="det-dato">
          <span>Riesgo</span>
          <strong>${proyecto.riesgo}</strong>
        </div>
      </div>

      <div class="det-barra" aria-label="Avance ${Number(proyecto.porcentajeAvance || 0)}%">
        <span style="width: ${Number(proyecto.porcentajeAvance || 0)}%"></span>
      </div>

      <div class="det-bloque-texto">
        <h3>MVP o versión mínima</h3>
        <p>${proyecto.mvp || "Todavía no se ha definido el MVP."}</p>
      </div>

      <div class="det-siguiente-accion">
        <span>Siguiente acción recomendada</span>
        <strong>${proyecto.siguienteAccion || "Definir siguiente acción."}</strong>
      </div>
    </article>
  `;
}

function renderizarResumenVacio(){
  return `
    <article class="app-panel det-panel-resumen">
      <p class="app-kicker">Sin proyecto</p>
      <h2>No se encontró el proyecto</h2>
      <p>Vuelve al inicio y selecciona un proyecto existente.</p>
    </article>
  `;
}
