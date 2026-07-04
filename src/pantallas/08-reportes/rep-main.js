/* =========================================================
Nombre completo: rep-main.js
Ruta o ubicación: src/pantallas/08-reportes/rep-main.js
Función o funciones:
- Renderizar la pantalla Gráficos y reportes.
- Mostrar resumen, gráficos, tabla comparativa y texto exportable.
- Ayudar a decidir qué proyectos convienen y cuáles revisar.
Con qué se conecta:
- srv-reportes.js
- rep-resumen.js
- rep-graficos.js
- rep-tabla.js
- rep-exportar.js
========================================================= */

import { crearTextoReporteGeneral, obtenerReporteGeneral } from "../../servicios/srv-reportes.js";
import { renderizarRepResumen } from "./rep-resumen.js";
import { renderizarRepGraficos } from "./rep-graficos.js";
import { renderizarRepTabla } from "./rep-tabla.js";
import { renderizarRepExportar } from "./rep-exportar.js";

export function renderizarRepMain(){
  const reporte = obtenerReporteGeneral();
  const textoReporte = crearTextoReporteGeneral();

  return `
    <section class="rep-header app-panel">
      <div>
        <p class="app-kicker">Reportes</p>
        <h2>Gráficos y resumen general</h2>
        <p>Revisa utilidad, horas, avance, prioridad y proyectos que conviene avanzar o revisar.</p>
      </div>
    </section>

    <section class="rep-grid-principal">
      ${renderizarRepResumen(reporte)}
      ${renderizarRepGraficos(reporte)}
    </section>

    <section class="rep-grid-secundario">
      ${renderizarPanelDecision("Proyectos convenientes", reporte.convenientes, "Estos proyectos tienen utilidad positiva o prioridad alta.")}
      ${renderizarPanelDecision("Proyectos para revisar", reporte.revisar, "Estos proyectos tienen semáforo rojo o utilidad negativa.")}
    </section>

    ${renderizarRepTabla(reporte)}
    ${renderizarRepExportar(textoReporte)}
  `;
}

function renderizarPanelDecision(titulo, filas, textoVacio){
  const lista = Array.isArray(filas) ? filas : [];

  return `
    <article class="app-panel rep-panel-decision">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Decisión</p>
          <h2>${titulo}</h2>
        </div>
      </div>

      ${lista.length ? renderizarListaDecision(lista) : `<div class="rep-vacio"><p>${textoVacio}</p></div>`}
    </article>
  `;
}

function renderizarListaDecision(filas){
  return `
    <div class="rep-decision-lista">
      ${filas.map(function(fila){
        return `
          <div class="rep-decision-item">
            <strong>${escaparHtml(fila.nombre)}</strong>
            <span>Utilidad $${fila.utilidad} · Prioridad ${fila.prioridad}/100</span>
            <p>${escaparHtml(fila.siguienteAccion)}</p>
          </div>
        `;
      }).join("")}
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
