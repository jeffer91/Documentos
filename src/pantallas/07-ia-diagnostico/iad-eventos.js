/* =========================================================
Nombre completo: iad-eventos.js
Ruta o ubicación: src/pantallas/07-ia-diagnostico/iad-eventos.js
Función o funciones:
- Conectar eventos de la pantalla IA / Diagnóstico.
- Cambiar el proyecto diagnosticado desde el selector.
- Mantener eventos de IA separados del router principal.
Con qué se conecta:
- iad-main.js
- app-router.js
========================================================= */

export function conectarIadEventos(contenedor, acciones = {}){
  if(!contenedor){
    console.error("No se puede conectar eventos de IA sin contenedor.");
    return;
  }

  const cambiarProyecto = typeof acciones.cambiarProyecto === "function" ? acciones.cambiarProyecto : function(){};

  const selector = contenedor.querySelector("#iad-selector-proyecto");

  if(selector){
    selector.addEventListener("change", function(){
      cambiarProyecto(selector.value);
    });
  }
}
