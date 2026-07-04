/* =========================================================
Nombre completo: cfg-respaldo.js
Ruta o ubicación: src/pantallas/09-configuracion/cfg-respaldo.js
Función o funciones:
- Renderizar herramientas de respaldo, restauración y limpieza local.
- Mostrar un área para copiar o pegar JSON de respaldo.
- Separar las acciones sensibles de configuración general.
Con qué se conecta:
- cfg-main.js
- cfg-eventos.js
- srv-respaldo.js
========================================================= */

export function renderizarCfgRespaldo(textoRespaldo){
  return `
    <article class="app-panel cfg-panel-respaldo">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Respaldo</p>
          <h2>Guardar o restaurar datos</h2>
        </div>
      </div>

      <p class="cfg-ayuda">
        Copia este respaldo y guárdalo en un lugar seguro. Para restaurar, pega aquí un respaldo válido y usa el botón Restaurar.
      </p>

      <textarea id="cfg-texto-respaldo" class="cfg-textarea" spellcheck="false">${escaparTextarea(textoRespaldo)}</textarea>

      <div class="cfg-acciones">
        <button class="app-btn app-btn-primario" type="button" data-cfg-generar-respaldo>Generar respaldo</button>
        <button class="app-btn app-btn-secundario" type="button" data-cfg-copiar-respaldo>Copiar respaldo</button>
        <button class="app-btn app-btn-secundario" type="button" data-cfg-restaurar-respaldo>Restaurar respaldo</button>
        <button class="app-btn app-btn-peligro" type="button" data-cfg-limpiar-datos>Limpiar datos locales</button>
      </div>

      <div id="cfg-mensaje-respaldo" class="cfg-mensaje" aria-live="polite"></div>
    </article>
  `;
}

function escaparTextarea(valor){
  return String(valor || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
