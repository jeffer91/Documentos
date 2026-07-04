/* =========================================================
Nombre completo: reg-cronometro.js
Ruta o ubicación: src/pantallas/04-registro-diario/reg-cronometro.js
Función o funciones:
- Renderizar una sección visual de cronómetro para trabajo futuro.
- Explicar que el cronómetro completo se activará después.
- Mantener separada la futura lógica de tiempo real.
Con qué se conecta:
- reg-main.js
- reg-eventos.js
========================================================= */

export function renderizarRegCronometro(){
  return `
    <article class="app-panel reg-panel-cronometro">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Cronómetro</p>
          <h2>Medición rápida</h2>
        </div>
      </div>

      <div class="reg-cronometro-box">
        <strong>00:00:00</strong>
        <p>El cronómetro real se activará en una mejora posterior. Por ahora registra tus horas manualmente o con texto libre.</p>
      </div>
    </article>
  `;
}
