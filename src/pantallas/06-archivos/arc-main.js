/* =========================================================
Nombre completo: arc-main.js
Ruta o ubicación: src/pantallas/06-archivos/arc-main.js
Función o funciones:
- Renderizar la pantalla Archivos y análisis documental.
- Permitir pegar texto, guardarlo y analizarlo por proyecto.
- Mostrar resumen documental, lista de registros, tareas, alertas e ideas.
Con qué se conecta:
- srv-proyectos.js
- srv-archivos.js
- arc-subir.js
- arc-analisis.js
- arc-lista.js
========================================================= */

import { obtenerProyectos } from "../../servicios/srv-proyectos.js";
import { obtenerArchivosPorProyecto, obtenerResumenDocumentalProyecto } from "../../servicios/srv-archivos.js";
import { renderizarArcSubir } from "./arc-subir.js";
import { renderizarArcAnalisis } from "./arc-analisis.js";
import { renderizarArcLista } from "./arc-lista.js";

export function renderizarArcMain(proyectoActivoId = null){
  const proyectos = obtenerProyectos();

  if(!proyectos.length){
    return renderizarSinProyectos();
  }

  const proyectoActivo = obtenerProyectoActivo(proyectos, proyectoActivoId);
  const archivos = obtenerArchivosPorProyecto(proyectoActivo.id);
  const resumenDocumental = obtenerResumenDocumentalProyecto(proyectoActivo.id);

  return `
    <section class="arc-header app-panel">
      <div>
        <p class="app-kicker">Archivos</p>
        <h2>Textos, notas e ideas del proyecto</h2>
        <p>Pega información importante del proyecto para guardar resumen, tareas, alertas e ideas detectadas.</p>
      </div>

      <div class="arc-proyecto-activo">
        <span>Proyecto activo</span>
        <strong>${proyectoActivo.nombre}</strong>
      </div>
    </section>

    <section class="arc-grid-principal">
      ${renderizarArcSubir(proyectos, proyectoActivo.id)}
      ${renderizarArcAnalisis(resumenDocumental)}
    </section>

    <section class="arc-grid-secundario">
      ${renderizarArcLista(archivos)}
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
    <section class="app-panel arc-sin-proyectos">
      <p class="app-kicker">Archivos</p>
      <h2>No hay proyectos todavía</h2>
      <p>Primero crea un proyecto para poder asociar textos, notas o documentos.</p>
      <button class="app-btn app-btn-primario" type="button" data-ruta="proyectos">
        Crear proyecto
      </button>
    </section>
  `;
}
