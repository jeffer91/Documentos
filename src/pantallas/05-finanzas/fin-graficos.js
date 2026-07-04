/* =========================================================
Nombre completo: fin-graficos.js
Ruta o ubicación: src/pantallas/05-finanzas/fin-graficos.js
Función o funciones:
- Renderizar gráficos simples sin librerías externas.
- Comparar ingresos, gastos y utilidad por proyecto.
- Mantener visualización financiera ligera y rápida.
Con qué se conecta:
- fin-main.js
- srv-finanzas.js
========================================================= */

export function renderizarFinGraficos(resumenGeneral){
  const resumenes = Array.isArray(resumenGeneral?.resumenes) ? resumenGeneral.resumenes : [];

  return `
    <article class="app-panel fin-panel-graficos">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Comparación</p>
          <h2>Proyectos por utilidad</h2>
        </div>
      </div>

      ${resumenes.length ? renderizarBarras(resumenes) : renderizarVacio()}
    </article>
  `;
}

function renderizarBarras(resumenes){
  const maximo = Math.max(
    1,
    ...resumenes.map(function(item){
      return Math.abs(Number(item.resumen.utilidad || 0));
    })
  );

  return `
    <div class="fin-grafico-lista">
      ${resumenes.map(function(item){
        const utilidad = Number(item.resumen.utilidad || 0);
        const ancho = Math.max(6, Math.round((Math.abs(utilidad) / maximo) * 100));
        const clase = utilidad >= 0 ? "fin-barra-positiva" : "fin-barra-negativa";

        return `
          <div class="fin-grafico-item">
            <div class="fin-grafico-header">
              <strong>${item.proyecto.nombre}</strong>
              <span>$${utilidad}</span>
            </div>
            <div class="fin-grafico-barra">
              <span class="${clase}" style="width: ${ancho}%"></span>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderizarVacio(){
  return `
    <div class="fin-lista-vacia">
      <p>No hay proyectos para comparar todavía.</p>
    </div>
  `;
}
