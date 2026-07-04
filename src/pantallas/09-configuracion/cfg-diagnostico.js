/* =========================================================
Nombre completo: cfg-diagnostico.js
Ruta o ubicación: src/pantallas/09-configuracion/cfg-diagnostico.js
Función o funciones:
- Renderizar diagnóstico técnico simple de la app.
- Mostrar estado de almacenamiento, proyectos, finanzas, avances y documentos.
- Ayudar a revisar si la app está lista para usarse.
Con qué se conecta:
- cfg-main.js
- srv-diagnostico.js
========================================================= */

export function renderizarCfgDiagnostico(diagnostico){
  const datos = diagnostico || { estadoGeneral: "Revisar", revisiones: [] };

  return `
    <article class="app-panel cfg-panel-diagnostico">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Diagnóstico</p>
          <h2>Estado técnico: ${datos.estadoGeneral}</h2>
        </div>
      </div>

      <div class="cfg-diagnostico-lista">
        ${datos.revisiones.map(renderizarRevision).join("")}
      </div>
    </article>
  `;
}

function renderizarRevision(item){
  const clase = item.ok ? "cfg-revision-ok" : "cfg-revision-error";

  return `
    <div class="cfg-revision ${clase}">
      <div>
        <strong>${escaparHtml(item.nombre)}</strong>
        <p>${escaparHtml(item.detalle)}</p>
      </div>
      <span>${escaparHtml(item.estado)}</span>
    </div>
  `;
}

function escaparHtml(valor){
  return String(valor || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
