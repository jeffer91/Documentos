/* =========================================================
Nombre completo: arc-subir.js
Ruta o ubicación: src/pantallas/06-archivos/arc-subir.js
Función o funciones:
- Renderizar formulario para pegar texto, notas o ideas de un proyecto.
- Permitir asociar información documental a un proyecto.
- Preparar datos para análisis básico y guardado local.
Con qué se conecta:
- arc-main.js
- arc-eventos.js
========================================================= */

export function renderizarArcSubir(proyectos, proyectoActivoId){
  return `
    <article class="app-panel arc-panel-subir">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Nuevo documento</p>
          <h2>Pegar texto o nota</h2>
        </div>
      </div>

      <form id="arc-form-texto" class="arc-form" autocomplete="off">
        <label class="arc-campo">
          <span>Proyecto</span>
          <select name="proyectoId" required>
            ${renderizarOpcionesProyectos(proyectos, proyectoActivoId)}
          </select>
        </label>

        <label class="arc-campo">
          <span>Nombre del registro</span>
          <input name="nombre" type="text" placeholder="Ejemplo: Ideas para monetizar" required />
        </label>

        <label class="arc-campo">
          <span>Texto, nota o resumen</span>
          <textarea
            name="texto"
            rows="9"
            placeholder="Pega aquí ideas, resumen de un documento, notas de reunión, tareas, problemas o decisiones importantes."
            required
          ></textarea>
        </label>

        <div id="arc-mensaje" class="arc-mensaje" aria-live="polite"></div>

        <button class="app-btn app-btn-primario" type="submit">
          Analizar y guardar
        </button>
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
