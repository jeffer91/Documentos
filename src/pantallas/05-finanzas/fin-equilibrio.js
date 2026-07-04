/* =========================================================
Nombre completo: fin-equilibrio.js
Ruta o ubicación: src/pantallas/05-finanzas/fin-equilibrio.js
Función o funciones:
- Renderizar utilidad, dinero por hora y punto de equilibrio.
- Explicar de forma simple si el proyecto conviene financieramente.
- Mostrar alertas financieras accionables.
Con qué se conecta:
- fin-main.js
- srv-finanzas.js
========================================================= */

export function renderizarFinEquilibrio(proyecto, resumen){
  const nombreProyecto = proyecto?.nombre || "Proyecto no seleccionado";
  const tipo = obtenerTipoAlerta(resumen);

  return `
    <article class="app-panel fin-panel-equilibrio">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Punto de equilibrio</p>
          <h2>${nombreProyecto}</h2>
        </div>
      </div>

      <div class="fin-metricas">
        ${renderizarMetrica("Ingresos", `$${resumen.ingresosTotales}`)}
        ${renderizarMetrica("Gastos", `$${resumen.gastosTotales}`)}
        ${renderizarMetrica("Utilidad", `$${resumen.utilidad}`)}
        ${renderizarMetrica("Horas", resumen.horasTrabajadas)}
        ${renderizarMetrica("Dinero por hora", `$${resumen.dineroPorHora}/h`)}
        ${renderizarMetrica("Equilibrio estimado", `${resumen.puntoEquilibrio} ventas`)}
      </div>

      <div class="fin-alerta fin-alerta-${tipo}">
        <strong>${obtenerTituloAlerta(resumen)}</strong>
        <p>${obtenerTextoAlerta(resumen)}</p>
      </div>
    </article>
  `;
}

function renderizarMetrica(titulo, valor){
  return `
    <div class="fin-metrica">
      <span>${titulo}</span>
      <strong>${valor}</strong>
    </div>
  `;
}

function obtenerTipoAlerta(resumen){
  if(resumen.utilidad > 0){
    return "verde";
  }

  if(resumen.gastosTotales > resumen.ingresosTotales){
    return "rojo";
  }

  return "amarillo";
}

function obtenerTituloAlerta(resumen){
  if(resumen.utilidad > 0){
    return "El proyecto está dejando utilidad.";
  }

  if(resumen.gastosTotales > resumen.ingresosTotales){
    return "El proyecto está gastando más de lo que genera.";
  }

  return "Todavía falta información para decidir bien.";
}

function obtenerTextoAlerta(resumen){
  if(resumen.utilidad > 0){
    return "Analiza qué acción generó dinero y repítela antes de agregar funciones nuevas.";
  }

  if(resumen.gastosTotales > resumen.ingresosTotales){
    return "Reduce gastos o define una acción cercana a venta antes de invertir más tiempo y dinero.";
  }

  return "Registra ingresos, gastos y horas para calcular mejor si este proyecto conviene.";
}
