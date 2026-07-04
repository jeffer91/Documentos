/* =========================================================
Nombre completo: app-inicio.js
Ruta o ubicación: src/app/app-inicio.js
Función o funciones:
- Iniciar la app Proyectos IA.
- Validar que exista el contenedor raíz.
- Inicializar datos locales y conectar el router inicial.
Con qué se conecta:
- index.html
- app-router.js
- app-state.js
========================================================= */

import { iniciarRouter } from "./app-router.js";
import { inicializarEstadoApp } from "./app-state.js";

function iniciarApp(){
  const contenedor = document.getElementById("app-raiz");

  if(!contenedor){
    console.error("No existe el contenedor #app-raiz. La app no puede iniciar.");
    return;
  }

  inicializarEstadoApp();
  iniciarRouter(contenedor);
}

document.addEventListener("DOMContentLoaded", iniciarApp);
