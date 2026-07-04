/* =========================================================
Nombre completo: fin-ingresos.js
Ruta o ubicación: src/pantallas/05-finanzas/fin-ingresos.js
Función o funciones:
- Renderizar formulario para registrar ingresos.
- Mostrar lista corta de ingresos del proyecto seleccionado.
- Mantener separada la sección de ingresos.
Con qué se conecta:
- fin-main.js
- fin-eventos.js
========================================================= */

export function renderizarFinIngresos(proyectos, proyectoActivoId, ingresos){
  return `
    <article class="app-panel fin-panel-ingresos">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Ingresos</p>
          <h2>Registrar dinero que entra</h2>
        </div>
      </div>

      <form id="fin-form-ingreso" class="fin-form" autocomplete="off">
        <label class="fin-campo">
          <span>Proyecto</span>
          <select name="proyectoId" required>
            ${renderizarOpcionesProyectos(proyectos, proyectoActivoId)}
          </select>
        </label>

        <div class="fin-form-grid">
          <label class="fin-campo">
            <span>Concepto</span>
            <input name="concepto" type="text" placeholder="Ejemplo: venta piloto" required />
          </label>

          <label class="fin-campo">
            <span>Monto</span>
            <input name="monto" type="number" min="0" step="0.01" placeholder="75" required />
          </label>
        </div>

        <div class="fin-form-grid">
          <label class="fin-campo">
            <span>Categoría</span>
            <select name="categoria">
              <option value="Venta">Venta</option>
              <option value="Servicio">Servicio</option>
              <option value="Suscripción">Suscripción</option>
              <option value="Publicidad">Publicidad</option>
              <option value="Patrocinio">Patrocinio</option>
              <option value="Consultoría">Consultoría</option>
              <option value="Curso">Curso</option>
              <option value="Ahorro convertido en dinero">Ahorro convertido en dinero</option>
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
          <input name="nota" type="text" placeholder="Detalle opcional del ingreso" />
        </label>

        <div id="fin-mensaje-ingreso" class="fin-mensaje" aria-live="polite"></div>

        <button class="app-btn app-btn-primario" type="submit">Guardar ingreso</button>
      </form>

      ${renderizarListaIngresos(ingresos)}
    </article>
  `;
}

function renderizarOpcionesProyectos(proyectos, proyectoActivoId){
  return proyectos.map(function(proyecto){
    const seleccionado = proyecto.id === proyectoActivoId ? "selected" : "";
    return `<option value="${proyecto.id}" ${seleccionado}>${proyecto.nombre}</option>`;
  }).join("");
}

function renderizarListaIngresos(ingresos){
  if(!Array.isArray(ingresos) || !ingresos.length){
    return `
      <div class="fin-lista-vacia">
        <p>No hay ingresos registrados para este proyecto.</p>
      </div>
    `;
  }

  return `
    <div class="fin-lista">
      ${ingresos.slice(0, 5).map(function(ingreso){
        return `
          <div class="fin-item fin-item-ingreso">
            <div>
              <strong>${ingreso.concepto}</strong>
              <span>${ingreso.categoria} · ${ingreso.fecha}</span>
            </div>
            <strong>$${Number(ingreso.monto || 0)}</strong>
          </div>
        `;
      }).join("")}
    </div>
  `;
}
