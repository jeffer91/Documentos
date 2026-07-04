/* =========================================================
Nombre completo: rep-graficos.js
Ruta o ubicación: src/pantallas/08-reportes/rep-graficos.js
Función o funciones:
- Renderizar gráficos simples sin librerías externas.
- Comparar utilidad, horas y avance por proyecto.
- Mantener visualización ligera para cargar rápido.
Con qué se conecta:
- rep-main.js
- srv-reportes.js
========================================================= */

export function renderizarRepGraficos(reporte){
  const filas = Array.isArray(reporte?.filas) ? reporte.filas : [];

  return `
    <article class="app-panel rep-panel-graficos">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Gráficos</p>
          <h2>Comparación por proyecto</h2>
        </div>
      </div>

      ${filas.length ? renderizarBarras("Utilidad", filas, "utilidad", "$") : renderizarVacio()}
      ${filas.length ? renderizarBarras("Horas trabajadas", filas, "horas", "") : ""}
      ${filas.length ? renderizarBarras("Avance", filas, "avance", "", "%") : ""}
    </article>
  `;
}

function renderizarBarras(titulo, filas, campo, prefijo = "", sufijo = ""){
  const maximo = Math.max(1, ...filas.map(function(fila){
    return Math.abs(Number(fila[campo] || 0));
  }));

  return `
    <section class="rep-grafico-bloque">
      <h3>${titulo}</h3>
      <div class="rep-grafico-lista">
        ${filas.map(function(fila){
          const valor = Number(fila[campo] || 0);
          const ancho = Math.max(5, Math.round((Math.abs(valor) / maximo) * 100));
          const clase = valor >= 0 ? "rep-barra-positiva" : "rep-barra-negativa";

          return `
            <div class="rep-grafico-item">
              <div class="rep-grafico-header">
                <strong>${escaparHtml(fila.nombre)}</strong>
                <span>${prefijo}${valor}${sufijo}</span>
              </div>
              <div class="rep-grafico-barra">
                <span class="${clase}" style="width: ${ancho}%"></span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderizarVacio(){
  return `
    <div class="rep-vacio">
      <p>No hay proyectos para graficar todavía.</p>
    </div>
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
