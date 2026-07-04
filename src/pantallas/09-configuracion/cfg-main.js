/* =========================================================
Nombre completo: cfg-main.js
Ruta o ubicación: src/pantallas/09-configuracion/cfg-main.js
Función o funciones:
- Renderizar la pantalla Configuración.
- Mostrar ajustes, respaldo, restauración, limpieza y diagnóstico técnico.
- Cerrar la primera versión funcional de Proyectos IA.
Con qué se conecta:
- srv-configuracion.js
- srv-respaldo.js
- srv-diagnostico.js
- cfg-ajustes.js
- cfg-respaldo.js
- cfg-diagnostico.js
========================================================= */

import { obtenerConfiguracion } from "../../servicios/srv-configuracion.js";
import { crearRespaldoJson } from "../../servicios/srv-respaldo.js";
import { crearDiagnosticoTecnico } from "../../servicios/srv-diagnostico.js";
import { renderizarCfgAjustes } from "./cfg-ajustes.js";
import { renderizarCfgRespaldo } from "./cfg-respaldo.js";
import { renderizarCfgDiagnostico } from "./cfg-diagnostico.js";

export function renderizarCfgMain(){
  const configuracion = obtenerConfiguracion();
  const respaldo = crearRespaldoJson();
  const diagnostico = crearDiagnosticoTecnico();

  return `
    <section class="cfg-header app-panel">
      <div>
        <p class="app-kicker">Configuración</p>
        <h2>Ajustes, respaldo y diagnóstico</h2>
        <p>Desde aquí puedes ajustar la app, guardar un respaldo de tus datos, restaurar información y revisar si los módulos principales están funcionando.</p>
      </div>
    </section>

    <section class="cfg-grid-principal">
      ${renderizarCfgAjustes(configuracion)}
      ${renderizarCfgDiagnostico(diagnostico)}
    </section>

    <section class="cfg-grid-secundario">
      ${renderizarCfgRespaldo(respaldo)}
    </section>
  `;
}
