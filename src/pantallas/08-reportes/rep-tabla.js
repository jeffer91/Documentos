/* =========================================================
Nombre completo: rep-tabla.js
Ruta o ubicación: src/pantallas/08-reportes/rep-tabla.js
Función o funciones:
- Renderizar tabla general de proyectos.
- Mostrar avance, utilidad, horas, prioridad, semáforo y siguiente acción.
- Facilitar revisión rápida de qué proyecto conviene avanzar.
Con qué se conecta:
- rep-main.js
- srv-reportes.js
========================================================= */

export function renderizarRepTabla(reporte){
  const filas = Array.isArray(reporte?.filas) ? reporte.filas : [];

  if(!filas.length){
    return `
      <article class="app-panel rep-panel-tabla">
        <div class="app-panel-header">
          <div>
            <p class="app-kicker">Tabla</p>
            <h2>Proyectos</h2>
          </div>
        </div>
        <div class="rep-vacio">
          <p>No hay proyectos para mostrar.</p>
        </div>
      </article>
    `;
  }

  return `
    <article class="app-panel rep-panel-tabla">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Tabla</p>
          <h2>Proyectos comparados</h2>
        </div>
      </div>

      <div class="rep-tabla-wrap">
        <table class="rep-tabla">
          <thead>
            <tr>
              <th>Proyecto</th>
              <th>Estado</th>
              <th>Semáforo</th>
              <th>Avance</th>
              <th>Utilidad</th>
              <th>Horas</th>
              <th>Prioridad</th>
              <th>Siguiente acción</th>
            </tr>
          </thead>
          <tbody>
            ${filas.map(renderizarFila).join("")}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function renderizarFila(fila){
  return `
    <tr>
      <td><strong>${escaparHtml(fila.nombre)}</strong><small>${escaparHtml(fila.tipo)}</small></td>
      <td>${escaparHtml(fila.estado)}</td>
      <td><span class="rep-semaforo rep-semaforo-${fila.semaforo}"></span>${escaparHtml(fila.semaforo)}</td>
      <td>${fila.avance}%</td>
      <td>$${fila.utilidad}</td>
      <td>${fila.horas}</td>
      <td>${fila.prioridad}/100</td>
      <td>${escaparHtml(fila.siguienteAccion)}</td>
    </tr>
  `;
}

function escaparHtml(valor){
  return String(valor || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
