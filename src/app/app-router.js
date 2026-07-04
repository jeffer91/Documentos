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
- det-main.js
- det-eventos.js
- reg-main.js
- reg-eventos.js
- fin-main.js
- fin-eventos.js
- arc-main.js
- arc-eventos.js
- iad-main.js
- iad-eventos.js
========================================================= */

import {
  cambiarPantallaActual,
  obtenerPantallaActual,
  obtenerProyectoFinanzasId,
  obtenerProyectoSeleccionado,
  seleccionarProyecto,
  seleccionarProyectoFinanzas
} from "./app-state.js";
import { renderizarIniMain } from "../pantallas/01-inicio/ini-main.js";
import { conectarIniEventos } from "../pantallas/01-inicio/ini-eventos.js";
import { renderizarPryMain } from "../pantallas/02-proyectos/pry-main.js";
import { conectarPryEventos } from "../pantallas/02-proyectos/pry-eventos.js";
import { renderizarDetMain } from "../pantallas/03-detalle-proyecto/det-main.js";
import { conectarDetEventos } from "../pantallas/03-detalle-proyecto/det-eventos.js";
import { renderizarRegMain } from "../pantallas/04-registro-diario/reg-main.js";
import { conectarRegEventos } from "../pantallas/04-registro-diario/reg-eventos.js";
import { renderizarFinMain } from "../pantallas/05-finanzas/fin-main.js";
import { conectarFinEventos } from "../pantallas/05-finanzas/fin-eventos.js";
import { renderizarArcMain } from "../pantallas/06-archivos/arc-main.js";
import { conectarArcEventos } from "../pantallas/06-archivos/arc-eventos.js";
import { renderizarIadMain } from "../pantallas/07-ia-diagnostico/iad-main.js";
import { conectarIadEventos } from "../pantallas/07-ia-diagnostico/iad-eventos.js";

const rutasPermitidas = ["inicio", "proyectos", "detalle", "registro", "finanzas", "documentos", "ia"];

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
        ${crearBotonNav("registro", "Registro", pantallaActual)}
        ${crearBotonNav("finanzas", "Finanzas", pantallaActual)}
        ${crearBotonNav("documentos", "Documentos", pantallaActual)}
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
      abrirProyecto: function(proyectoId){ abrirDetalleProyecto(proyectoId, contenedor); },
      crearProyecto: function(){ cambiarPantallaActual("proyectos"); renderizarApp(contenedor); }
    });
    return;
  }

  if(pantallaActual === "proyectos"){
    conectarPryEventos(contenedor, {
      alGuardar: function(){ renderizarApp(contenedor); },
      abrirProyecto: function(proyectoId){ abrirDetalleProyecto(proyectoId, contenedor); }
    });
    return;
  }

  if(pantallaActual === "detalle"){
    conectarDetEventos(contenedor, {
      volverInicio: function(){ cambiarPantallaActual("inicio"); renderizarApp(contenedor); },
      irProyectos: function(){ cambiarPantallaActual("proyectos"); renderizarApp(contenedor); }
    });
    return;
  }

  if(pantallaActual === "registro"){
    conectarRegEventos(contenedor, {
      alGuardar: function(proyectoId){ seleccionarProyecto(proyectoId); renderizarApp(contenedor); }
    });
    return;
  }

  if(pantallaActual === "finanzas"){
    conectarFinEventos(contenedor, {
      cambiarProyecto: function(proyectoId){ seleccionarProyectoFinanzas(proyectoId); renderizarApp(contenedor); },
      alActualizar: function(proyectoId){ seleccionarProyectoFinanzas(proyectoId); renderizarApp(contenedor); }
    });
    return;
  }

  if(pantallaActual === "documentos"){
    conectarArcEventos(contenedor, {
      alGuardar: function(proyectoId){ seleccionarProyecto(proyectoId); renderizarApp(contenedor); }
    });
    return;
  }

  if(pantallaActual === "ia"){
    conectarIadEventos(contenedor, {
      cambiarProyecto: function(proyectoId){ seleccionarProyecto(proyectoId); renderizarApp(contenedor); }
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
    const proyecto = obtenerProyectoSeleccionado();
    return renderizarDetMain(proyecto?.id || null);
  }

  if(pantallaActual === "registro"){
    const proyecto = obtenerProyectoSeleccionado();
    return renderizarRegMain(proyecto?.id || null);
  }

  if(pantallaActual === "finanzas"){
    return renderizarFinMain(obtenerProyectoFinanzasId());
  }

  if(pantallaActual === "documentos"){
    const proyecto = obtenerProyectoSeleccionado();
    return renderizarArcMain(proyecto?.id || null);
  }

  if(pantallaActual === "ia"){
    const proyecto = obtenerProyectoSeleccionado();
    return renderizarIadMain(proyecto?.id || null);
  }

  return renderizarIniMain();
}
