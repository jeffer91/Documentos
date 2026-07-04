/* =========================================================
Nombre completo: ini-top3.js
Ruta o ubicación: src/pantallas/01-inicio/ini-top3.js
Función o funciones:
- Renderizar el bloque Top 3 proyectos de hoy.
- Mostrar la razón visual de prioridad según los datos actuales.
- Mantener separada la lógica visual del Top 3.
Con qué se conecta:
- ini-main.js
- ini-eventos.js
========================================================= */

export function renderizarIniTop3(proyectos){
  const top3 = Array.isArray(proyectos) ? proyectos.slice(0, 3) : [];

  if(!top3.length){
    return `
      <div class="ini-top3-vacio">
        <p>No hay proyectos todavía. Crea tu primer proyecto para calcular prioridades.</p>
      </div>
    `;
  }

  return `
    <div class="ini-top3-lista">
      ${top3.map(renderizarIniTop3Item).join("")}
    </div>
  `;
}

function renderizarIniTop3Item(proyecto, index){
  return `
    <button class="ini-top3-item" type="button" data-ini-proyecto-id="${proyecto.id}">
      <span class="ini-top3-posicion">${index + 1}</span>
      <span class="ini-top3-contenido">
        <strong>${proyecto.nombre}</strong>
        <small>${obtenerTextoPrioridad(proyecto)}</small>
        <em>${proyecto.siguienteAccion}</em>
      </span>
    </button>
  `;
}

function obtenerTextoPrioridad(proyecto){
  const prioridad = Number(proyecto.prioridad || 0);

  if(prioridad >= 85){
    return "Alta prioridad: conviene avanzar pronto.";
  }

  if(prioridad >= 65){
    return "Prioridad media: revisar avance y monetización.";
  }

  return "Prioridad baja: necesita claridad antes de crecer.";
}
