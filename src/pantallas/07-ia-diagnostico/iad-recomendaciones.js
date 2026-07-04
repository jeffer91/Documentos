/* =========================================================
Nombre completo: iad-recomendaciones.js
Ruta o ubicación: src/pantallas/07-ia-diagnostico/iad-recomendaciones.js
Función o funciones:
- Renderizar recomendación financiera y estratégica.
- Mostrar Top 3 de proyectos recomendados.
- Entregar acciones concretas para avanzar.
Con qué se conecta:
- iad-main.js
- srv-ia.js
========================================================= */

export function renderizarIadRecomendaciones(diagnostico, estrategia){
  return `
    <article class="app-panel iad-panel-recomendaciones">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Recomendaciones</p>
          <h2>Qué conviene hacer</h2>
        </div>
      </div>

      <div class="iad-recomendacion-principal">
        <strong>Lectura financiera</strong>
        <p>${diagnostico.diagnosticoFinanciero.lectura}</p>
      </div>

      <div class="iad-recomendacion-principal">
        <strong>Acción financiera</strong>
        <p>${diagnostico.diagnosticoFinanciero.accion}</p>
      </div>

      <div class="iad-top3">
        <h3>Top 3 estratégico</h3>
        ${renderizarTop3(estrategia.top3)}
      </div>
    </article>
  `;
}

function renderizarTop3(top3){
  if(!Array.isArray(top3) || !top3.length){
    return `
      <div class="iad-vacio">
        <p>No hay proyectos suficientes para calcular un Top 3.</p>
      </div>
    `;
  }

  return `
    <div class="iad-top3-lista">
      ${top3.map(function(item){
        return `
          <div class="iad-top3-item">
            <span>${item.posicion}</span>
            <div>
              <strong>${item.nombre}</strong>
              <p>${item.razon}</p>
              <small>${item.accionHoy}</small>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}
