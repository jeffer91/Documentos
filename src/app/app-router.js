/* =========================================================
Nombre completo: app-router.js
Ruta o ubicación: src/app/app-router.js
Función o funciones:
- Manejar navegación básica entre vistas iniciales.
- Renderizar la estructura general de la app.
- Delegar pantallas a sus propios módulos para evitar archivos gigantes.
Con qué se conecta:
- app-state.js
- app-inicio.js
- ini-main.js
- ini-eventos.js
- pry-main.js
- pry-eventos.js
========================================================= */

import {
  cambiarPantallaActual,
  obtenerPantallaActual,
  seleccionarProyecto
} from "./app-state.js";
import { renderizarIniMain } from "../pantallas/01-inicio/ini-main.js";
import { conectarIniEventos } from "../pantallas/01-inicio/ini-eventos.js";
import { renderizarPryMain } from "../pantallas/02-proyectos/pry-main.js";
import { conectarPryEventos } from "../pantallas/02-proyectos/pry-eventos.js";

const rutasPermitidas = ["inicio", "proyectos", "detalle", "finanzas", "ia"];

export function iniciarRouter(contenedor){
  if(!contenedor){
    console.error("No se encontró el contenedor principal de la app.");
    return;
  }

  renderizarApp(contenedor);
}

export function navegarA(nombrePantalla, contenedor){
  if(!rutasPermitidas.includes(nombrePantalla)){
    console.warn("Ruta no permitida:", nombrePantalla);
    cambiarPantallaActual("inicio");
  }else{
    cambiarPantallaActual(nombrePantalla);
  }

  renderizarApp(contenedor);
}

function renderizarApp(contenedor){
  const pantallaActual = obtenerPantallaActual();

  contenedor.innerHTML = `
    <header class="app-header">
      <div>
        <p class="app-kicker">Centro inteligente de proyectos</p>
        <h1>Proyectos IA</h1>
        <p class="app-subtitle">Decide qué proyecto avanzar para ganar más dinero, ahorrar tiempo y reducir riesgo.</p>
      </div>
      <nav class="app-nav" aria-label="Navegación principal">
        ${crearBotonNav("inicio", "Inicio", pantallaActual)}
        ${crearBotonNav("proyectos", "Proyectos", pantallaActual)}
        ${crearBotonNav("finanzas", "Finanzas", pantallaActual)}
        ${crearBotonNav("ia", "IA", pantallaActual)}
      </nav>
    </header>

    <main class="app-main">
      ${renderizarPantalla(pantallaActual)}
    </main>
  `;

  conectarEventosGenerales(contenedor);
  conectarEventosPantallaActual(contenedor, pantallaActual);
}

function crearBotonNav(ruta, texto, pantallaActual){
  const activo = ruta === pantallaActual ? "app-nav-btn activo" : "app-nav-btn";
  return `<button class="${activo}" type="button" data-ruta="${ruta}">${texto}</button>`;
}

function conectarEventosGenerales(contenedor){
  const botonesNav = contenedor.querySelectorAll("[data-ruta]");

  botonesNav.forEach(function(boton){
    boton.addEventListener("click", function(){
      navegarA(boton.dataset.ruta, contenedor);
    });
  });
}

function conectarEventosPantallaActual(contenedor, pantallaActual){
  if(pantallaActual === "inicio"){
    conectarIniEventos(contenedor, {
      abrirProyecto: function(proyectoId){
        abrirDetalleProyecto(proyectoId, contenedor);
      },
      crearProyecto: function(){
        cambiarPantallaActual("proyectos");
        renderizarApp(contenedor);
      }
    });
    return;
  }

  if(pantallaActual === "proyectos"){
    conectarPryEventos(contenedor, {
      alGuardar: function(){
        renderizarApp(contenedor);
      },
      abrirProyecto: function(proyectoId){
        abrirDetalleProyecto(proyectoId, contenedor);
      }
    });
  }
}

function abrirDetalleProyecto(proyectoId, contenedor){
  seleccionarProyecto(proyectoId);
  cambiarPantallaActual("detalle");
  renderizarApp(contenedor);
}

function renderizarPantalla(pantallaActual){
  if(pantallaActual === "proyectos"){
    return renderizarPryMain();
  }

  if(pantallaActual === "detalle"){
    return renderizarDetalleDemo();
  }

  if(pantallaActual === "finanzas"){
    return renderizarFinanzasDemo();
  }

  if(pantallaActual === "ia"){
    return renderizarIaDemo();
  }

  return renderizarIniMain();
}

function renderizarDetalleDemo(){
  return `
    <section class="app-panel app-panel-vacio">
      <p class="app-kicker">Bloque 5</p>
      <h2>Detalle del proyecto</h2>
      <p>Esta vista se construirá en el Bloque 5. Aquí aparecerá el estado, semáforo, finanzas, diagnóstico y siguiente acción.</p>
      <button class="app-btn app-btn-secundario" type="button" data-ruta="inicio">Volver al inicio</button>
    </section>
  `;
}

function renderizarFinanzasDemo(){
  return `
    <section class="app-panel app-panel-vacio">
      <p class="app-kicker">Bloque 6</p>
      <h2>Finanzas</h2>
      <p>Esta vista se construirá en el Bloque 6. Aquí se calculará utilidad, dinero por hora y punto de equilibrio.</p>
      <button class="app-btn app-btn-secundario" type="button" data-ruta="inicio">Volver al inicio</button>
    </section>
  `;
}

function renderizarIaDemo(){
  return `
    <section class="app-panel app-panel-vacio">
      <p class="app-kicker">Bloque 9</p>
      <h2>IA / Diagnóstico</h2>
      <p>Esta vista se construirá en el Bloque 9. Aquí la IA dirá qué va bien, qué va mal y qué hacer ahora.</p>
      <button class="app-btn app-btn-secundario" type="button" data-ruta="inicio">Volver al inicio</button>
    </section>
  `;
}
