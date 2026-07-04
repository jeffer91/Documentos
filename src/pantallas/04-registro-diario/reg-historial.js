/* =========================================================
Nombre completo: reg-historial.js
Ruta o ubicación: src/pantallas/04-registro-diario/reg-historial.js
Función o funciones:
- Renderizar el historial de avances por proyecto.
- Mostrar fecha, horas, descripción, bloqueo y siguiente acción.
- Mantener separada la vista de historial del registro diario.
Con qué se conecta:
- reg-main.js
- srv-avances.js
========================================================= */

export function renderizarRegHistorial(avances){
  if(!Array.isArray(avances) || !avances.length){
    return `
      <article class="app-panel reg-panel-historial">
        <div class="app-panel-header">
          <div>
            <p class="app-kicker">Historial</p>
            <h2>Avances registrados</h2>
          </div>
        </div>
        <div class="reg-lista-vacia">
          <p>Este proyecto todavía no tiene avances registrados.</p>
        </div>
      </article>
    `;
  }

  return `
    <article class="app-panel reg-panel-historial">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Historial</p>
          <h2>Avances registrados</h2>
        </div>
      </div>

      <div class="reg-historial-lista">
        ${avances.slice(0, 8).map(renderizarAvance).join("")}
      </div>
    </article>
  `;
}

function renderizarAvance(avance){
  return `
    <div class="reg-avance-item">
      <div class="reg-avance-header">
        <strong>${avance.fecha}</strong>
        <span>${Number(avance.horas || 0)} h</span>
      </div>
      <p>${avance.descripcion}</p>
      ${avance.bloqueo ? `<small><strong>Bloqueo:</strong> ${avance.bloqueo}</small>` : ""}
      ${avance.siguienteAccion ? `<small><strong>Siguiente:</strong> ${avance.siguienteAccion}</small>` : ""}
    </div>
  `;
}
