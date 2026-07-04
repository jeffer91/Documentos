/* =========================================================
Nombre completo: fin-gastos.js
Ruta o ubicación: src/pantallas/05-finanzas/fin-gastos.js
Función o funciones:
- Renderizar formulario para registrar gastos.
- Mostrar lista corta de gastos del proyecto seleccionado.
- Mantener separada la sección de gastos.
Con qué se conecta:
- fin-main.js
- fin-eventos.js
========================================================= */

export function renderizarFinGastos(proyectos, proyectoActivoId, gastos){
  return `
    <article class="app-panel fin-panel-gastos">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Gastos</p>
          <h2>Registrar dinero que sale</h2>
        </div>
      </div>

      <form id="fin-form-gasto" class="fin-form" autocomplete="off">
        <label class="fin-campo">
          <span>Proyecto</span>
          <select name="proyectoId" required>
            ${renderizarOpcionesProyectos(proyectos, proyectoActivoId)}
          </select>
        </label>

        <div class="fin-form-grid">
          <label class="fin-campo">
            <span>Concepto</span>
            <input name="concepto" type="text" placeholder="Ejemplo: publicidad" required />
          </label>

          <label class="fin-campo">
            <span>Monto</span>
            <input name="monto" type="number" min="0" step="0.01" placeholder="20" required />
          </label>
        </div>

        <div class="fin-form-grid">
          <label class="fin-campo">
            <span>Categoría</span>
            <select name="categoria">
              <option value="Herramientas">Herramientas</option>
              <option value="Publicidad">Publicidad</option>
              <option value="Software">Software</option>
              <option value="Diseño">Diseño</option>
              <option value="Producción">Producción</option>
              <option value="Transporte">Transporte</option>
              <option value="Comisiones">Comisiones</option>
              <option value="Servicios externos">Servicios externos</option>
              <option value="Otro">Otro</option>
            </select>
          </label>

          <label class="fin-campo">
            <span>Fecha</span>
            <input name="fecha" type="date" />
          </label>
        </div>

        <label class="fin-campo">
          <span>Nota</span>
          <input name="nota" type="text" placeholder="Detalle opcional del gasto" />
        </label>

        <div id="fin-mensaje-gasto" class="fin-mensaje" aria-live="polite"></div>

        <button class="app-btn app-btn-primario" type="submit">Guardar gasto</button>
      </form>

      ${renderizarListaGastos(gastos)}
    </article>
  `;
}

function renderizarOpcionesProyectos(proyectos, proyectoActivoId){
  return proyectos.map(function(proyecto){
    const seleccionado = proyecto.id === proyectoActivoId ? "selected" : "";
    return `<option value="${proyecto.id}" ${seleccionado}>${proyecto.nombre}</option>`;
  }).join("");
}

function renderizarListaGastos(gastos){
  if(!Array.isArray(gastos) || !gastos.length){
    return `
      <div class="fin-lista-vacia">
        <p>No hay gastos registrados para este proyecto.</p>
      </div>
    `;
  }

  return `
    <div class="fin-lista">
      ${gastos.slice(0, 5).map(function(gasto){
        return `
          <div class="fin-item fin-item-gasto">
            <div>
              <strong>${gasto.concepto}</strong>
              <span>${gasto.categoria} · ${gasto.fecha}</span>
            </div>
            <strong>$${Number(gasto.monto || 0)}</strong>
          </div>
        `;
      }).join("")}
    </div>
  `;
}
