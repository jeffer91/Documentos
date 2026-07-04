/* =========================================================
Nombre completo: det-tareas.js
Ruta o ubicación: src/pantallas/03-detalle-proyecto/det-tareas.js
Función o funciones:
- Renderizar tareas principales del proyecto.
- Mostrar estado, prioridad y descripción de cada tarea.
- Mantener separada la sección de tareas del detalle.
Con qué se conecta:
- det-main.js
- srv-tareas.js
========================================================= */

export function renderizarDetTareas(resumenTareas){
  const tareas = resumenTareas?.tareas || [];

  return `
    <article class="app-panel det-panel-tareas">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Tareas</p>
          <h2>Acciones del proyecto</h2>
        </div>
      </div>

      <div class="det-tareas-resumen">
        <span>Total: <strong>${resumenTareas?.total || 0}</strong></span>
        <span>En proceso: <strong>${resumenTareas?.enProceso || 0}</strong></span>
        <span>Completadas: <strong>${resumenTareas?.completadas || 0}</strong></span>
      </div>

      ${tareas.length ? renderizarListaTareas(tareas) : renderizarTareasVacias()}
    </article>
  `;
}

function renderizarListaTareas(tareas){
  return `
    <div class="det-tareas-lista">
      ${tareas.map(renderizarTarea).join("")}
    </div>
  `;
}

function renderizarTarea(tarea){
  return `
    <div class="det-tarea">
      <div>
        <strong>${tarea.titulo}</strong>
        <p>${tarea.descripcion || "Sin descripción."}</p>
      </div>
      <div class="det-tarea-meta">
        <span>${formatearEstado(tarea.estado)}</span>
        <small>${tarea.prioridad}</small>
      </div>
    </div>
  `;
}

function renderizarTareasVacias(){
  return `
    <div class="det-tareas-vacio">
      <p>Este proyecto todavía no tiene tareas registradas.</p>
    </div>
  `;
}

function formatearEstado(estado){
  if(estado === "en_proceso"){
    return "En proceso";
  }

  if(estado === "completada"){
    return "Completada";
  }

  if(estado === "pausada"){
    return "Pausada";
  }

  if(estado === "cancelada"){
    return "Cancelada";
  }

  return "Pendiente";
}
