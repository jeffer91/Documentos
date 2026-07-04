/* =========================================================
Nombre completo: arc-lista.js
Ruta o ubicación: src/pantallas/06-archivos/arc-lista.js
Función o funciones:
- Renderizar la lista de textos y notas guardadas por proyecto.
- Mostrar resumen, tareas y alertas de cada registro documental.
- Mantener separada la lista documental de la pantalla principal.
Con qué se conecta:
- arc-main.js
- srv-archivos.js
========================================================= */

export function renderizarArcLista(archivos){
  const lista = Array.isArray(archivos) ? archivos : [];

  if(!lista.length){
    return `
      <article class="app-panel arc-panel-lista">
        <div class="app-panel-header">
          <div>
            <p class="app-kicker">Historial documental</p>
            <h2>Registros guardados</h2>
          </div>
        </div>
        <div class="arc-lista-vacia">
          <p>Aún no hay textos, notas o resúmenes asociados a este proyecto.</p>
        </div>
      </article>
    `;
  }

  return `
    <article class="app-panel arc-panel-lista">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Historial documental</p>
          <h2>Registros guardados</h2>
        </div>
      </div>

      <div class="arc-lista">
        ${lista.map(renderizarArcItem).join("")}
      </div>
    </article>
  `;
}

function renderizarArcItem(archivo){
  return `
    <article class="arc-item">
      <div class="arc-item-header">
        <div>
          <h3>${escaparHtml(archivo.nombre)}</h3>
          <span>${escaparHtml(archivo.tipo)} · ${escaparHtml(archivo.origen)}</span>
        </div>
        <small>${formatearFecha(archivo.creadoEn)}</small>
      </div>

      <p>${escaparHtml(archivo.resumen || "Sin resumen disponible.")}</p>

      <div class="arc-item-pills">
        <span>${contar(archivo.tareasDetectadas)} tareas</span>
        <span>${contar(archivo.riesgosDetectados)} alertas</span>
        <span>${contar(archivo.ideasDetectadas)} ideas</span>
      </div>
    </article>
  `;
}

function contar(items){
  return Array.isArray(items) ? items.length : 0;
}

function formatearFecha(fecha){
  if(!fecha){
    return "Sin fecha";
  }

  const fechaObj = new Date(fecha);

  if(Number.isNaN(fechaObj.getTime())){
    return "Fecha inválida";
  }

  return fechaObj.toLocaleDateString("es-EC");
}

function escaparHtml(valor){
  return String(valor || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
