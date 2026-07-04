/* =========================================================
Nombre completo: pry-lista.js
Ruta o ubicación: src/pantallas/02-proyectos/pry-lista.js
Función o funciones:
- Renderizar lista compacta de proyectos existentes.
- Mostrar datos clave para revisar lo creado.
- Permitir abrir un proyecto desde la pantalla Proyectos.
Con qué se conecta:
- pry-main.js
- pry-eventos.js
========================================================= */

export function renderizarPryLista(proyectos){
  if(!Array.isArray(proyectos) || !proyectos.length){
    return `
      <div class="pry-lista-vacia">
        <h3>No hay proyectos guardados</h3>
        <p>Crea el primer proyecto para verlo en esta lista.</p>
      </div>
    `;
  }

  return `
    <div class="pry-lista">
      ${proyectos.map(renderizarPryItem).join("")}
    </div>
  `;
}

function renderizarPryItem(proyecto){
  return `
    <article class="pry-item">
      <div class="pry-item-info">
        <div class="pry-item-titulo">
          <span class="pry-semaforo pry-semaforo-${proyecto.semaforo}"></span>
          <h3>${proyecto.nombre}</h3>
        </div>
        <p>${proyecto.tipo} · ${proyecto.estado}</p>
        <small>${proyecto.siguienteAccion}</small>
      </div>

      <div class="pry-item-datos">
        <strong>${Number(proyecto.porcentajeAvance || 0)}%</strong>
        <span>$${Number(proyecto.dineroGenerado || 0)}</span>
        <button class="app-btn app-btn-secundario" type="button" data-pry-proyecto-id="${proyecto.id}">
          Abrir
        </button>
      </div>
    </article>
  `;
}
