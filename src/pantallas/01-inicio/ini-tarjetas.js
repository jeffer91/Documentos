/* =========================================================
Nombre completo: ini-tarjetas.js
Ruta o ubicación: src/pantallas/01-inicio/ini-tarjetas.js
Función o funciones:
- Renderizar tarjetas de proyectos para la pantalla Inicio.
- Mostrar nombre, semáforo, avance, dinero generado y siguiente acción.
- Mantener separada la lógica visual de tarjetas.
Con qué se conecta:
- ini-main.js
- ini-eventos.js
========================================================= */

export function renderizarIniTarjetas(proyectos){
  if(!Array.isArray(proyectos) || !proyectos.length){
    return `
      <div class="ini-lista-vacia">
        <h3>No tienes proyectos todavía</h3>
        <p>Crea tu primer proyecto para empezar a medir avance, dinero y prioridad.</p>
      </div>
    `;
  }

  return `
    <div class="ini-tarjetas">
      ${proyectos.map(renderizarIniTarjetaProyecto).join("")}
    </div>
  `;
}

function renderizarIniTarjetaProyecto(proyecto){
  const porcentaje = Number(proyecto.porcentajeAvance || 0);

  return `
    <article class="ini-card ini-card-${proyecto.semaforo}">
      <div class="ini-card-header">
        <span class="ini-semaforo ini-semaforo-${proyecto.semaforo}" aria-label="Semáforo ${proyecto.semaforo}"></span>
        <span class="ini-estado">${proyecto.estado}</span>
      </div>

      <h3>${proyecto.nombre}</h3>
      <p class="ini-card-tipo">${proyecto.tipo}</p>

      <div class="ini-barra" aria-label="Avance ${porcentaje}%">
        <span style="width: ${porcentaje}%"></span>
      </div>

      <div class="ini-card-datos">
        <strong>${porcentaje}%</strong>
        <span>$${Number(proyecto.dineroGenerado || 0)}</span>
      </div>

      <p class="ini-card-accion">${proyecto.siguienteAccion}</p>

      <button class="app-btn app-btn-secundario" type="button" data-ini-proyecto-id="${proyecto.id}">
        Ver proyecto
      </button>
    </article>
  `;
}
