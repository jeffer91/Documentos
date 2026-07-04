/* =========================================================
Nombre completo: rep-exportar.js
Ruta o ubicación: src/pantallas/08-reportes/rep-exportar.js
Función o funciones:
- Renderizar sección de reporte exportable.
- Mostrar texto listo para copiar con resumen general.
- Preparar la base para futuras descargas en TXT, CSV o PDF.
Con qué se conecta:
- rep-main.js
- srv-reportes.js
========================================================= */

export function renderizarRepExportar(textoReporte){
  return `
    <article class="app-panel rep-panel-exportar">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Exportar</p>
          <h2>Resumen listo para copiar</h2>
        </div>
      </div>

      <textarea id="rep-texto-exportable" class="rep-exportable" readonly>${escaparTextarea(textoReporte)}</textarea>

      <div class="rep-exportar-acciones">
        <button class="app-btn app-btn-primario" type="button" data-rep-copiar>
          Copiar reporte
        </button>
        <span id="rep-mensaje-copiar" class="rep-mensaje" aria-live="polite"></span>
      </div>
    </article>
  `;
}

function escaparTextarea(valor){
  return String(valor || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
