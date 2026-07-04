/* =========================================================
Nombre completo: iad-resumen.js
Ruta o ubicación: src/pantallas/07-ia-diagnostico/iad-resumen.js
Función o funciones:
- Renderizar el resumen del diagnóstico IA del proyecto activo.
- Mostrar qué va bien, qué va mal y qué hacer ahora.
- Mantener separada la vista de diagnóstico general.
Con qué se conecta:
- iad-main.js
- srv-ia.js
========================================================= */

export function renderizarIadResumen(diagnostico){
  const general = diagnostico?.diagnosticoGeneral || {};
  const proyecto = diagnostico?.proyecto;

  return `
    <article class="app-panel iad-panel-resumen">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Diagnóstico IA</p>
          <h2>${proyecto ? proyecto.nombre : "Sin proyecto seleccionado"}</h2>
        </div>
      </div>

      <div class="iad-diagnostico-grid">
        ${renderizarBloque("Qué va bien", general.queVaBien)}
        ${renderizarBloque("Qué va mal", general.queVaMal)}
        ${renderizarBloque("Qué hacer ahora", general.queHacerAhora)}
        ${renderizarBloque("Qué mejorar", general.queMejorar)}
        ${renderizarBloque("Qué evitar", general.queEvitar)}
        ${renderizarBloque("Riesgo", general.nivelRiesgo)}
      </div>
    </article>
  `;
}

function renderizarBloque(titulo, texto){
  return `
    <div class="iad-bloque">
      <span>${titulo}</span>
      <p>${texto || "Sin información suficiente."}</p>
    </div>
  `;
}
