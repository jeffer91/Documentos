/* =========================================================
Nombre completo: pry-main.js
Ruta o ubicación: src/pantallas/02-proyectos/pry-main.js
Función o funciones:
- Renderizar la pantalla Crear y editar proyectos.
- Mostrar formulario de creación y lista de proyectos existentes.
- Mantener separada la pantalla Proyectos del router principal.
Con qué se conecta:
- pry-formulario.js
- pry-lista.js
- srv-proyectos.js
- app-router.js
========================================================= */

import { obtenerProyectos } from "../../servicios/srv-proyectos.js";
import { renderizarPryFormulario } from "./pry-formulario.js";
import { renderizarPryLista } from "./pry-lista.js";

export function renderizarPryMain(){
  const proyectos = obtenerProyectos();

  return `
    <section class="pry-grid">
      <article class="app-panel pry-panel-formulario">
        <div class="app-panel-header">
          <div>
            <p class="app-kicker">Nuevo proyecto</p>
            <h2>Crear proyecto rápido</h2>
          </div>
        </div>

        <p class="pry-ayuda">
          Llena solo lo esencial. La IA podrá ayudarte a mejorar el objetivo, el MVP y la siguiente acción más adelante.
        </p>

        ${renderizarPryFormulario()}
      </article>

      <article class="app-panel pry-panel-lista">
        <div class="app-panel-header">
          <div>
            <p class="app-kicker">Proyectos guardados</p>
            <h2>Lista actual</h2>
          </div>
          <button class="app-btn app-btn-secundario" type="button" data-ruta="inicio">
            Ir al inicio
          </button>
        </div>

        ${renderizarPryLista(proyectos)}
      </article>
    </section>
  `;
}
