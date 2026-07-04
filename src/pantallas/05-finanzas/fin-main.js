/* =========================================================
Nombre completo: fin-main.js
Ruta o ubicación: src/pantallas/05-finanzas/fin-main.js
Función o funciones:
- Renderizar la pantalla Finanzas.
- Mostrar ingresos, gastos, utilidad, dinero por hora y punto de equilibrio.
- Unir formularios, resumen financiero y gráficos simples.
Con qué se conecta:
- srv-proyectos.js
- srv-finanzas.js
- fin-ingresos.js
- fin-gastos.js
- fin-equilibrio.js
- fin-graficos.js
========================================================= */

import { obtenerProyectos } from "../../servicios/srv-proyectos.js";
import {
  obtenerGastosPorProyecto,
  obtenerIngresosPorProyecto,
  obtenerResumenFinancieroGeneral,
  obtenerResumenFinancieroProyecto
} from "../../servicios/srv-finanzas.js";
import { renderizarFinIngresos } from "./fin-ingresos.js";
import { renderizarFinGastos } from "./fin-gastos.js";
import { renderizarFinEquilibrio } from "./fin-equilibrio.js";
import { renderizarFinGraficos } from "./fin-graficos.js";

export function renderizarFinMain(proyectoActivoId = null){
  const proyectos = obtenerProyectos();
  const proyectoActivo = obtenerProyectoActivo(proyectos, proyectoActivoId);

  if(!proyectos.length){
    return renderizarSinProyectos();
  }

  const resumen = obtenerResumenFinancieroProyecto(proyectoActivo.id);
  const ingresos = obtenerIngresosPorProyecto(proyectoActivo.id);
  const gastos = obtenerGastosPorProyecto(proyectoActivo.id);
  const resumenGeneral = obtenerResumenFinancieroGeneral(proyectos);

  return `
    <section class="fin-header-panel app-panel">
      <div>
        <p class="app-kicker">Finanzas</p>
        <h2>Control financiero de proyectos</h2>
        <p>Registra ingresos y gastos para saber qué proyecto genera utilidad, cuál consume dinero y cuál necesita una acción económica.</p>
      </div>

      <label class="fin-selector">
        <span>Proyecto activo</span>
        <select id="fin-selector-proyecto">
          ${renderizarOpcionesProyectos(proyectos, proyectoActivo.id)}
        </select>
      </label>
    </section>

    <section class="fin-grid-principal">
      ${renderizarFinEquilibrio(proyectoActivo, resumen)}
      ${renderizarFinGraficos(resumenGeneral)}
    </section>

    <section class="fin-grid-formularios">
      ${renderizarFinIngresos(proyectos, proyectoActivo.id, ingresos)}
      ${renderizarFinGastos(proyectos, proyectoActivo.id, gastos)}
    </section>
  `;
}

function obtenerProyectoActivo(proyectos, proyectoActivoId){
  const encontrado = proyectos.find(function(proyecto){
    return proyecto.id === proyectoActivoId;
  });

  return encontrado || proyectos[0];
}

function renderizarOpcionesProyectos(proyectos, proyectoActivoId){
  return proyectos.map(function(proyecto){
    const seleccionado = proyecto.id === proyectoActivoId ? "selected" : "";
    return `<option value="${proyecto.id}" ${seleccionado}>${proyecto.nombre}</option>`;
  }).join("");
}

function renderizarSinProyectos(){
  return `
    <section class="app-panel fin-sin-proyectos">
      <p class="app-kicker">Finanzas</p>
      <h2>No hay proyectos todavía</h2>
      <p>Primero crea un proyecto para poder registrar ingresos, gastos y calcular utilidad.</p>
      <button class="app-btn app-btn-primario" type="button" data-ruta="proyectos">
        Crear proyecto
      </button>
    </section>
  `;
}
