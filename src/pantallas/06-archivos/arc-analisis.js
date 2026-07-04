/* =========================================================
Nombre completo: arc-analisis.js
Ruta o ubicación: src/pantallas/06-archivos/arc-analisis.js
Función o funciones:
- Renderizar resumen documental del proyecto activo.
- Mostrar tareas, alertas e ideas detectadas desde textos guardados.
- Mantener separada la vista de análisis documental.
Con qué se conecta:
- arc-main.js
- srv-archivos.js
========================================================= */

export function renderizarArcAnalisis(resumenDocumental){
  const resumen = resumenDocumental || crearResumenVacio();

  return `
    <article class="app-panel arc-panel-analisis">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Análisis documental</p>
          <h2>Lo detectado</h2>
        </div>
      </div>

      <div class="arc-metricas">
        <div class="arc-metrica">
          <strong>${resumen.total}</strong>
          <span>Registros</span>
        </div>
        <div class="arc-metrica">
          <strong>${resumen.tareas.length}</strong>
          <span>Tareas</span>
        </div>
        <div class="arc-metrica">
          <strong>${resumen.riesgos.length}</strong>
          <span>Alertas</span>
        </div>
      </div>

      ${renderizarLista("Tareas detectadas", resumen.tareas)}
      ${renderizarLista("Alertas detectadas", resumen.riesgos)}
      ${renderizarLista("Ideas detectadas", resumen.ideas)}
    </article>
  `;
}

function renderizarLista(titulo, items){
  const lista = Array.isArray(items) ? items : [];

  if(!lista.length){
    return `
      <div class="arc-bloque-lista">
        <h3>${escaparHtml(titulo)}</h3>
        <p>No hay elementos detectados todavía.</p>
      </div>
    `;
  }

  return `
    <div class="arc-bloque-lista">
      <h3>${escaparHtml(titulo)}</h3>
      <ul>
        ${lista.map(function(item){
          return `<li>${escaparHtml(item)}</li>`;
        }).join("")}
      </ul>
    </div>
  `;
}

function crearResumenVacio(){
  return {
    total: 0,
    tareas: [],
    riesgos: [],
    ideas: []
  };
}

function escaparHtml(valor){
  return String(valor || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
