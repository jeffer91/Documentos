/* =========================================================
Nombre completo: reg-texto-libre.js
Ruta o ubicación: src/pantallas/04-registro-diario/reg-texto-libre.js
Función o funciones:
- Renderizar entrada de texto libre para registrar avances.
- Permitir escribir un avance natural con horas y siguiente acción.
- Preparar el texto para interpretación básica desde el servicio de avances.
Con qué se conecta:
- reg-main.js
- reg-eventos.js
- srv-avances.js
========================================================= */

export function renderizarRegTextoLibre(proyectos, proyectoActivoId){
  return `
    <article class="app-panel reg-panel-texto">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Texto libre</p>
          <h2>Escribe como hablas</h2>
        </div>
      </div>

      <form id="reg-form-texto-libre" class="reg-form" autocomplete="off">
        <label class="reg-campo">
          <span>Proyecto</span>
          <select name="proyectoId" required>
            ${renderizarOpcionesProyectos(proyectos, proyectoActivoId)}
          </select>
        </label>

        <label class="reg-campo">
          <span>Avance en texto libre</span>
          <textarea
            name="textoLibre"
            rows="6"
            placeholder="Ejemplo: Hoy trabajé 2 horas en la app. Terminé la pantalla de finanzas y falta conectar el registro diario."
            required
          ></textarea>
        </label>

        <div id="reg-mensaje-texto" class="reg-mensaje" aria-live="polite"></div>

        <button class="app-btn app-btn-primario" type="submit">Interpretar y guardar</button>
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
