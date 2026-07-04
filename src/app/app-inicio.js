/* =========================================================
Nombre completo: app-inicio.js
Ruta o ubicación: src/app/app-inicio.js
Función o funciones:
- Iniciar la app Proyectos IA.
- Validar que exista el contenedor raíz.
- Conectar el router inicial con la pantalla principal.
Con qué se conecta:
- index.html
- app-router.js
========================================================= */

import { iniciarRouter } from "./app-router.js";

function iniciarApp(){
  const contenedor = document.getElementById("app-raiz");

  if(!contenedor){
    console.error("No existe el contenedor #app-raiz. La app no puede iniciar.");
    return;
  }

  iniciarRouter(contenedor);
}

document.addEventListener("DOMContentLoaded", iniciarApp);
