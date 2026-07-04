/* =========================================================
Nombre completo: reg-manual.js
Ruta o ubicación: src/pantallas/04-registro-diario/reg-manual.js
Función o funciones:
- Renderizar el formulario manual de avance diario.
- Registrar proyecto, fecha, horas, descripción, bloqueo y siguiente acción.
- Mantener separada la entrada manual del registro diario.
Con qué se conecta:
- reg-main.js
- reg-eventos.js
========================================================= */

import { obtenerFechaCortaActual } from "../../shared/shared-fechas.js";

export function renderizarRegManual(proyectos, proyectoActivoId){
  return `
    <article class="app-panel reg-panel-manual">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Registro manual</p>
          <h2>Registrar avance</h2>
        </div>
      </div>

      <form id="reg-form-manual" class="reg-form" autocomplete="off">
        <div class="reg-form-grid">
          <label class="reg-campo">
            <span>Proyecto</span>
            <select name="proyectoId" required>
              ${renderizarOpcionesProyectos(proyectos, proyectoActivoId)}
            </select>
          </label>

          <label class="reg-campo">
            <span>Fecha</span>
            <input name="fecha" type="date" value="${obtenerFechaCortaActual()}" required />
          </label>

          <label class="reg-campo">
            <span>Horas trabajadas</span>
            <input name="horas" type="number" min="0" step="0.25" placeholder="Ejemplo: 2" required />
          </label>

          <label class="reg-campo">
            <span>Tipo de registro</span>
            <select name="tipoRegistro">
              <option value="manual">Manual</option>
              <option value="texto libre">Texto libre</option>
              <option value="cronómetro">Cronómetro</option>
            </select>
          </label>
        </div>

        <label class="reg-campo">
          <span>¿Qué avanzaste?</span>
          <textarea name="descripcion" rows="4" placeholder="Ejemplo: terminé la pantalla de finanzas y probé el guardado." required></textarea>
        </label>

        <label class="reg-campo">
          <span>Bloqueo o problema</span>
          <input name="bloqueo" type="text" placeholder="Ejemplo: falta validar el cálculo de horas" />
        </label>

        <label class="reg-campo">
          <span>Siguiente acción</span>
          <input name="siguienteAccion" type="text" placeholder="Ejemplo: crear pantalla de registro diario" />
        </label>

        <div id="reg-mensaje-manual" class="reg-mensaje" aria-live="polite"></div>

        <button class="app-btn app-btn-primario" type="submit">Guardar avance</button>
      </form>
    </article>
  `;
}

function renderizarOpcionesProyectos(proyectos, proyectoActivoId){
  return proyectos.map(function(proyecto){
    const seleccionado = proyecto.id === proyectoActivoId ? "selected" : "";
    return `<option value="${proyecto.id}" ${seleccionado}>${proyecto.nombre}</option>`;
  }).join("");
}
