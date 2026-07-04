/* =========================================================
Nombre completo: det-main.js
Ruta o ubicación: src/pantallas/03-detalle-proyecto/det-main.js
Función o funciones:
- Renderizar la pantalla Detalle del proyecto.
- Unir resumen, finanzas, diagnóstico básico y tareas.
- Mostrar una vista clara para decidir qué hacer con el proyecto.
Con qué se conecta:
- srv-proyectos.js
- srv-finanzas.js
- srv-tareas.js
- det-resumen.js
- det-finanzas.js
- det-diagnostico.js
- det-tareas.js
========================================================= */

import { obtenerProyectoPorId } from "../../servicios/srv-proyectos.js";
import { obtenerResumenFinancieroProyecto } from "../../servicios/srv-finanzas.js";
import { obtenerResumenTareasProyecto } from "../../servicios/srv-tareas.js";
import { renderizarDetResumen } from "./det-resumen.js";
import { renderizarDetFinanzas } from "./det-finanzas.js";
import { renderizarDetDiagnostico } from "./det-diagnostico.js";
import { renderizarDetTareas } from "./det-tareas.js";

export function renderizarDetMain(proyectoId){
  const proyecto = obtenerProyectoPorId(proyectoId);

  if(!proyecto){
    return renderizarProyectoNoEncontrado();
  }

  const resumenFinanciero = obtenerResumenFinancieroProyecto(proyecto.id);
  const resumenTareas = obtenerResumenTareasProyecto(proyecto.id);

  return `
    <section class="det-acciones-superiores">
      <button class="app-btn app-btn-secundario" type="button" data-det-volver-inicio>
        Volver al inicio
      </button>
      <button class="app-btn app-btn-secundario" type="button" data-det-ir-proyectos>
        Ir a proyectos
      </button>
    </section>

    <section class="det-grid-principal">
      ${renderizarDetResumen(proyecto)}
      ${renderizarDetFinanzas(resumenFinanciero)}
    </section>

    <section class="det-grid-secundario">
      ${renderizarDetDiagnostico(proyecto, resumenFinanciero)}
      ${renderizarDetTareas(resumenTareas)}
    </section>
  `;
}

function renderizarProyectoNoEncontrado(){
  return `
    <section class="app-panel det-no-encontrado">
      <p class="app-kicker">Detalle del proyecto</p>
      <h2>No se encontró el proyecto</h2>
      <p>Puede que el proyecto ya no exista o que no se haya seleccionado correctamente.</p>
      <div class="det-acciones-superiores">
        <button class="app-btn app-btn-secundario" type="button" data-det-volver-inicio>
          Volver al inicio
        </button>
        <button class="app-btn app-btn-primario" type="button" data-det-ir-proyectos>
          Ir a proyectos
        </button>
      </div>
    </section>
  `;
}
