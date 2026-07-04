/* =========================================================
Nombre completo: reg-main.js
Ruta o ubicación: src/pantallas/04-registro-diario/reg-main.js
Función o funciones:
- Renderizar la pantalla Registro diario.
- Mostrar formulario manual, texto libre, cronómetro visual e historial.
- Conectar proyectos y avances guardados.
Con qué se conecta:
- srv-proyectos.js
- srv-avances.js
- reg-manual.js
- reg-texto-libre.js
- reg-cronometro.js
- reg-historial.js
========================================================= */

import { obtenerProyectos } from "../../servicios/srv-proyectos.js";
import { obtenerAvancesPorProyecto } from "../../servicios/srv-avances.js";
import { renderizarRegManual } from "./reg-manual.js";
import { renderizarRegTextoLibre } from "./reg-texto-libre.js";
import { renderizarRegCronometro } from "./reg-cronometro.js";
import { renderizarRegHistorial } from "./reg-historial.js";

export function renderizarRegMain(proyectoActivoId = null){
  const proyectos = obtenerProyectos();

  if(!proyectos.length){
    return renderizarSinProyectos();
  }

  const proyectoActivo = obtenerProyectoActivo(proyectos, proyectoActivoId);
  const avances = obtenerAvancesPorProyecto(proyectoActivo.id);

  return `
    <section class="reg-header app-panel">
      <div>
        <p class="app-kicker">Registro diario</p>
        <h2>Avances y horas trabajadas</h2>
        <p>Registra qué hiciste, cuántas horas trabajaste, qué bloqueo apareció y cuál será la siguiente acción.</p>
      </div>

      <div class="reg-proyecto-activo">
        <span>Proyecto activo</span>
        <strong>${proyectoActivo.nombre}</strong>
      </div>
    </section>

    <section class="reg-grid-principal">
      ${renderizarRegManual(proyectos, proyectoActivo.id)}
      ${renderizarRegTextoLibre(proyectos, proyectoActivo.id)}
    </section>

    <section class="reg-grid-secundario">
      ${renderizarRegCronometro()}
      ${renderizarRegHistorial(avances)}
    </section>
  `;
}

function obtenerProyectoActivo(proyectos, proyectoActivoId){
  const encontrado = proyectos.find(function(proyecto){
    return proyecto.id === proyectoActivoId;
  });

  return encontrado || proyectos[0];
}

function renderizarSinProyectos(){
  return `
    <section class="app-panel reg-sin-proyectos">
      <p class="app-kicker">Registro diario</p>
      <h2>No hay proyectos todavía</h2>
      <p>Primero crea un proyecto para poder registrar avances y horas trabajadas.</p>
      <button class="app-btn app-btn-primario" type="button" data-ruta="proyectos">
        Crear proyecto
      </button>
    </section>
  `;
}
