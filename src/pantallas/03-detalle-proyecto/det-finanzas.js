/* =========================================================
Nombre completo: det-finanzas.js
Ruta o ubicación: src/pantallas/03-detalle-proyecto/det-finanzas.js
Función o funciones:
- Renderizar resumen financiero del proyecto.
- Mostrar ingresos, gastos, utilidad, horas y dinero por hora.
- Dar una lectura simple sobre la situación financiera.
Con qué se conecta:
- det-main.js
- srv-finanzas.js
========================================================= */

export function renderizarDetFinanzas(resumenFinanciero){
  const resumen = resumenFinanciero || crearResumenVacio();

  return `
    <article class="app-panel det-panel-finanzas">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Finanzas</p>
          <h2>Resultado económico</h2>
        </div>
      </div>

      <div class="det-finanzas-grid">
        ${renderizarDatoFinanciero("Ingresos", `$${resumen.ingresosTotales}`)}
        ${renderizarDatoFinanciero("Gastos", `$${resumen.gastosTotales}`)}
        ${renderizarDatoFinanciero("Utilidad", `$${resumen.utilidad}`)}
        ${renderizarDatoFinanciero("Horas", resumen.horasTrabajadas)}
        ${renderizarDatoFinanciero("Dinero por hora", `$${resumen.dineroPorHora}/h`)}
      </div>

      <div class="det-alerta-financiera det-alerta-${obtenerTipoAlerta(resumen)}">
        <strong>${obtenerTituloAlerta(resumen)}</strong>
        <p>${obtenerTextoAlerta(resumen)}</p>
      </div>
    </article>
  `;
}

function renderizarDatoFinanciero(etiqueta, valor){
  return `
    <div class="det-dato-financiero">
      <span>${etiqueta}</span>
      <strong>${valor}</strong>
    </div>
  `;
}

function crearResumenVacio(){
  return {
    ingresosTotales: 0,
    gastosTotales: 0,
    utilidad: 0,
    horasTrabajadas: 0,
    dineroPorHora: 0
  };
}

function obtenerTipoAlerta(resumen){
  if(resumen.utilidad > 0){
    return "verde";
  }

  if(resumen.ingresosTotales === 0 && resumen.horasTrabajadas > 0){
    return "rojo";
  }

  return "amarillo";
}

function obtenerTituloAlerta(resumen){
  if(resumen.utilidad > 0){
    return "El proyecto ya genera utilidad.";
  }

  if(resumen.ingresosTotales === 0 && resumen.horasTrabajadas > 0){
    return "Hay trabajo invertido, pero todavía no hay ingresos.";
  }

  return "Falta información financiera para decidir mejor.";
}

function obtenerTextoAlerta(resumen){
  if(resumen.utilidad > 0){
    return "Conviene revisar cómo repetir o escalar lo que ya está generando dinero.";
  }

  if(resumen.ingresosTotales === 0 && resumen.horasTrabajadas > 0){
    return "Antes de seguir creciendo, define una acción cercana a venta, validación o ahorro de tiempo medible.";
  }

  return "Registra ingresos, gastos y horas para que la app pueda calcular si este proyecto conviene.";
}
