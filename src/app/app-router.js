/* =========================================================
Nombre completo: app-router.js
Ruta o ubicación: src/app/app-router.js
Función o funciones:
- Manejar navegación básica entre vistas iniciales.
- Renderizar la estructura visual general de la app.
- Conectar botones de navegación con el estado de la app.
Con qué se conecta:
- app-state.js
- app-inicio.js
========================================================= */

import {
  cambiarPantallaActual,
  obtenerPantallaActual,
  obtenerProyectosDemo,
  seleccionarProyecto
} from "./app-state.js";

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

  conectarEventos(contenedor);
}

function crearBotonNav(ruta, texto, pantallaActual){
  const activo = ruta === pantallaActual ? "app-nav-btn activo" : "app-nav-btn";
  return `<button class="${activo}" type="button" data-ruta="${ruta}">${texto}</button>`;
}

function conectarEventos(contenedor){
  const botonesNav = contenedor.querySelectorAll("[data-ruta]");

  botonesNav.forEach(function(boton){
    boton.addEventListener("click", function(){
      navegarA(boton.dataset.ruta, contenedor);
    });
  });

  const botonesDetalle = contenedor.querySelectorAll("[data-proyecto-id]");

  botonesDetalle.forEach(function(boton){
    boton.addEventListener("click", function(){
      seleccionarProyecto(boton.dataset.proyectoId);
      cambiarPantallaActual("detalle");
      renderizarApp(contenedor);
    });
  });
}

function renderizarPantalla(pantallaActual){
  if(pantallaActual === "proyectos"){
    return renderizarProyectos();
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

  return renderizarInicio();
}

function renderizarInicio(){
  const proyectos = obtenerProyectosDemo();
  const top3 = proyectos.slice(0, 3);

  return `
    <section class="app-grid">
      <article class="app-panel app-panel-principal">
        <div class="app-panel-header">
          <div>
            <p class="app-kicker">Prioridad inteligente</p>
            <h2>Top 3 proyectos de hoy</h2>
          </div>
        </div>

        <div class="app-top3-lista">
          ${top3.map(renderizarTop3Item).join("")}
        </div>
      </article>

      <article class="app-panel">
        <div class="app-panel-header">
          <div>
            <p class="app-kicker">Vista rápida</p>
            <h2>Estado general</h2>
          </div>
        </div>

        <div class="app-metricas">
          <div class="app-metrica">
            <strong>${proyectos.length}</strong>
            <span>Proyectos</span>
          </div>
          <div class="app-metrica">
            <strong>$${calcularDineroTotal(proyectos)}</strong>
            <span>Generado</span>
          </div>
          <div class="app-metrica">
            <strong>${calcularAvancePromedio(proyectos)}%</strong>
            <span>Avance promedio</span>
          </div>
        </div>
      </article>
    </section>

    <section class="app-panel">
      <div class="app-panel-header">
        <div>
          <p class="app-kicker">Proyectos</p>
          <h2>Lista inicial</h2>
        </div>
        <button class="app-btn app-btn-primario" type="button" data-ruta="proyectos">Crear proyecto</button>
      </div>

      <div class="app-tarjetas">
        ${proyectos.map(renderizarTarjetaProyecto).join("")}
      </div>
    </section>
  `;
}

function renderizarProyectos(){
  return `
    <section class="app-panel app-panel-vacio">
      <p class="app-kicker">Bloque 1</p>
      <h2>Crear y editar proyectos</h2>
      <p>Esta vista quedará funcional en el Bloque 4. Por ahora la base técnica ya permite navegar sin romper la app.</p>
      <button class="app-btn app-btn-secundario" type="button" data-ruta="inicio">Volver al inicio</button>
    </section>
  `;
}

function renderizarDetalleDemo(){
  return `
    <section class="app-panel app-panel-vacio">
      <p class="app-kicker">Bloque 1</p>
      <h2>Detalle del proyecto</h2>
      <p>Esta vista se construirá en el Bloque 5. Aquí aparecerá el estado, semáforo, finanzas, diagnóstico y siguiente acción.</p>
      <button class="app-btn app-btn-secundario" type="button" data-ruta="inicio">Volver al inicio</button>
    </section>
  `;
}

function renderizarFinanzasDemo(){
  return `
    <section class="app-panel app-panel-vacio">
      <p class="app-kicker">Bloque 1</p>
      <h2>Finanzas</h2>
      <p>Esta vista se construirá en el Bloque 6. Aquí se calculará utilidad, dinero por hora y punto de equilibrio.</p>
      <button class="app-btn app-btn-secundario" type="button" data-ruta="inicio">Volver al inicio</button>
    </section>
  `;
}

function renderizarIaDemo(){
  return `
    <section class="app-panel app-panel-vacio">
      <p class="app-kicker">Bloque 1</p>
      <h2>IA / Diagnóstico</h2>
      <p>Esta vista se construirá en el Bloque 9. Aquí la IA dirá qué va bien, qué va mal y qué hacer ahora.</p>
      <button class="app-btn app-btn-secundario" type="button" data-ruta="inicio">Volver al inicio</button>
    </section>
  `;
}

function renderizarTop3Item(proyecto, index){
  return `
    <button class="app-top3-item" type="button" data-proyecto-id="${proyecto.id}">
      <span class="app-top3-posicion">${index + 1}</span>
      <span>
        <strong>${proyecto.nombre}</strong>
        <small>${proyecto.siguienteAccion}</small>
      </span>
    </button>
  `;
}

function renderizarTarjetaProyecto(proyecto){
  return `
    <article class="app-card app-card-${proyecto.semaforo}">
      <div class="app-card-header">
        <span class="app-semaforo app-semaforo-${proyecto.semaforo}"></span>
        <span class="app-estado">${proyecto.estado}</span>
      </div>
      <h3>${proyecto.nombre}</h3>
      <p>${proyecto.tipo}</p>
      <div class="app-barra" aria-label="Avance ${proyecto.porcentajeAvance}%">
        <span style="width: ${proyecto.porcentajeAvance}%"></span>
      </div>
      <div class="app-card-datos">
        <strong>${proyecto.porcentajeAvance}%</strong>
        <span>$${proyecto.dineroGenerado}</span>
      </div>
      <p class="app-card-accion">${proyecto.siguienteAccion}</p>
      <button class="app-btn app-btn-secundario" type="button" data-proyecto-id="${proyecto.id}">Ver proyecto</button>
    </article>
  `;
}

function calcularDineroTotal(proyectos){
  return proyectos.reduce(function(total, proyecto){
    return total + Number(proyecto.dineroGenerado || 0);
  }, 0);
}

function calcularAvancePromedio(proyectos){
  if(!proyectos.length){
    return 0;
  }

  const total = proyectos.reduce(function(suma, proyecto){
    return suma + Number(proyecto.porcentajeAvance || 0);
  }, 0);

  return Math.round(total / proyectos.length);
}
