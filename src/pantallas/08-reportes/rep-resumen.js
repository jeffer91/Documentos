/* =========================================================
Nombre completo: rep-resumen.js
Ruta o ubicación: src/pantallas/08-reportes/rep-resumen.js
Función o funciones:
- Renderizar métricas principales del reporte general.
- Mostrar ingresos, gastos, utilidad, horas, dinero por hora y avance promedio.
- Mantener separada la sección resumen de reportes.
Con qué se conecta:
- rep-main.js
- srv-reportes.js
========================================================= */

export function renderizarRepResumen(reporte){
  const totales = reporte?.totales || crearTotalesVacios();

  return `
    <article class="app-panel rep-panel-resumen">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Resumen general</p>
          <h2>Estado económico y avance</h2>
        </div>
      </div>

      <div class="rep-metricas">
        ${renderizarMetrica("Ingresos", `$${totales.ingresos}`)}
        ${renderizarMetrica("Gastos", `$${totales.gastos}`)}
        ${renderizarMetrica("Utilidad", `$${totales.utilidad}`)}
        ${renderizarMetrica("Horas", totales.horas)}
        ${renderizarMetrica("Dinero por hora", `$${totales.dineroPorHora}/h`)}
        ${renderizarMetrica("Avance promedio", `${totales.avancePromedio}%`)}
      </div>
    </article>
  `;
}

function renderizarMetrica(titulo, valor){
  return `
    <div class="rep-metrica">
      <span>${titulo}</span>
      <strong>${valor}</strong>
    </div>
  `;
}

function crearTotalesVacios(){
  return {
    ingresos: 0,
    gastos: 0,
    utilidad: 0,
    horas: 0,
    dineroPorHora: 0,
    avancePromedio: 0
  };
}
