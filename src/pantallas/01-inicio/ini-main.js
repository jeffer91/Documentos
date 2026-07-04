/* =========================================================
Nombre completo: ini-main.js
Ruta o ubicación: src/pantallas/01-inicio/ini-main.js
Función o funciones:
- Renderizar la pantalla Inicio / Proyectos.
- Mostrar Top 3, resumen general y tarjetas de proyectos.
- Conectar datos de proyectos con componentes visuales de Inicio.
Con qué se conecta:
- ini-top3.js
- ini-tarjetas.js
- srv-proyectos.js
- app-router.js
========================================================= */

import { calcularResumenProyectos, obtenerProyectos } from "../../servicios/srv-proyectos.js";
import { renderizarIniTop3 } from "./ini-top3.js";
import { renderizarIniTarjetas } from "./ini-tarjetas.js";

export function renderizarIniMain(){
  const proyectos = obtenerProyectos();
  const resumen = calcularResumenProyectos();

  return `
    <section class="ini-grid">
      <article class="app-panel ini-panel-principal">
        <div class="app-panel-header">
          <div>
            <p class="app-kicker">Prioridad inteligente</p>
            <h2>Top 3 proyectos de hoy</h2>
          </div>
        </div>

        ${renderizarIniTop3(proyectos)}
      </article>

      <article class="app-panel ini-panel-resumen">
        <div class="app-panel-header">
          <div>
            <p class="app-kicker">Vista rápida</p>
            <h2>Estado general</h2>
          </div>
        </div>

        <div class="ini-metricas">
          <div class="ini-metrica">
            <strong>${resumen.cantidad}</strong>
            <span>Proyectos</span>
          </div>
          <div class="ini-metrica">
            <strong>$${resumen.dineroTotal}</strong>
            <span>Generado</span>
          </div>
          <div class="ini-metrica">
            <strong>${resumen.avancePromedio}%</strong>
            <span>Avance promedio</span>
          </div>
        </div>
      </article>
    </section>

    <section class="app-panel ini-panel-lista">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Proyectos</p>
          <h2>Lista principal</h2>
        </div>
        <button class="app-btn app-btn-primario" type="button" data-ini-crear-proyecto>
          Crear proyecto
        </button>
      </div>

      ${renderizarIniTarjetas(proyectos)}
    </section>
  `;
}
