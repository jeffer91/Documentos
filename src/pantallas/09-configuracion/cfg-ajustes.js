/* =========================================================
Nombre completo: cfg-ajustes.js
Ruta o ubicación: src/pantallas/09-configuracion/cfg-ajustes.js
Función o funciones:
- Renderizar formulario de configuración básica.
- Permitir ajustar nombre, moneda y modo de IA.
- Mantener separados los ajustes visuales de Configuración.
Con qué se conecta:
- cfg-main.js
- cfg-eventos.js
- srv-configuracion.js
========================================================= */

export function renderizarCfgAjustes(configuracion){
  const cfg = configuracion || {};

  return `
    <article class="app-panel cfg-panel-ajustes">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Ajustes</p>
          <h2>Configuración básica</h2>
        </div>
      </div>

      <form id="cfg-form-ajustes" class="cfg-form" autocomplete="off">
        <label class="cfg-campo">
          <span>Nombre</span>
          <input name="nombreUsuario" type="text" value="${escaparAtributo(cfg.nombreUsuario || "Jeff")}" />
        </label>

        <label class="cfg-campo">
          <span>Moneda principal</span>
          <select name="moneda">
            ${renderizarOpcion("USD", cfg.moneda)}
            ${renderizarOpcion("EUR", cfg.moneda)}
            ${renderizarOpcion("COP", cfg.moneda)}
            ${renderizarOpcion("MXN", cfg.moneda)}
          </select>
        </label>

        <label class="cfg-campo">
          <span>Modo de IA</span>
          <select name="modoIa">
            ${renderizarOpcion("interna", cfg.modoIa, "IA interna básica")}
            ${renderizarOpcion("externa futura", cfg.modoIa, "IA externa futura")}
          </select>
        </label>

        <label class="cfg-check">
          <input name="mostrarDatosDemo" type="checkbox" ${cfg.mostrarDatosDemo ? "checked" : ""} />
          <span>Permitir datos demo en primera carga</span>
        </label>

        <div id="cfg-mensaje-ajustes" class="cfg-mensaje" aria-live="polite"></div>

        <button class="app-btn app-btn-primario" type="submit">Guardar configuración</button>
      </form>
    </article>
  `;
}

function renderizarOpcion(valor, actual, etiqueta = valor){
  const seleccionado = valor === actual ? "selected" : "";
  return `<option value="${escaparAtributo(valor)}" ${seleccionado}>${escaparHtml(etiqueta)}</option>`;
}

function escaparHtml(valor){
  return String(valor || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escaparAtributo(valor){
  return escaparHtml(valor);
}
