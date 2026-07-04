/* =========================================================
Nombre completo: iad-alertas.js
Ruta o ubicación: src/pantallas/07-ia-diagnostico/iad-alertas.js
Función o funciones:
- Renderizar alertas fuertes del diagnóstico IA.
- Mostrar recomendación directa y alerta financiera.
- Resaltar riesgos que requieren decisión.
Con qué se conecta:
- iad-main.js
- srv-ia.js
========================================================= */

export function renderizarIadAlertas(diagnostico){
  const nivelFinanciero = diagnostico?.diagnosticoFinanciero?.nivel || "observación";

  return `
    <article class="app-panel iad-panel-alertas iad-alerta-${nivelFinanciero}">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">IA dura</p>
          <h2>Recomendación directa</h2>
        </div>
      </div>

      <div class="iad-alerta-fuerte">
        <strong>${diagnostico.recomendacionDura}</strong>
      </div>

      <div class="iad-alerta-financiera">
        <span>Alerta financiera</span>
        <p>${diagnostico.diagnosticoFinanciero.alerta}</p>
      </div>
    </article>
  `;
}
