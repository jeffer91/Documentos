/* =========================================================
Nombre completo: rep-eventos.js
Ruta o ubicación: src/pantallas/08-reportes/rep-eventos.js
Función o funciones:
- Conectar eventos de la pantalla Reportes.
- Copiar el reporte exportable al portapapeles.
- Mantener eventos de reportes separados del router principal.
Con qué se conecta:
- rep-main.js
- app-router.js
========================================================= */

export function conectarRepEventos(contenedor){
  if(!contenedor){
    console.error("No se puede conectar eventos de Reportes sin contenedor.");
    return;
  }

  const botonCopiar = contenedor.querySelector("[data-rep-copiar]");
  const texto = contenedor.querySelector("#rep-texto-exportable");
  const mensaje = contenedor.querySelector("#rep-mensaje-copiar");

  if(!botonCopiar || !texto){
    return;
  }

  botonCopiar.addEventListener("click", function(){
    copiarTexto(texto.value, mensaje);
  });
}

async function copiarTexto(valor, mensaje){
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(valor);
    }else{
      copiarConSeleccion(valor);
    }

    mostrarMensaje(mensaje, "Reporte copiado.", "ok");
  }catch(error){
    console.error("No se pudo copiar el reporte:", error);
    mostrarMensaje(mensaje, "No se pudo copiar. Selecciona el texto manualmente.", "error");
  }
}

function copiarConSeleccion(valor){
  const temporal = document.createElement("textarea");
  temporal.value = valor;
  document.body.appendChild(temporal);
  temporal.select();
  document.execCommand("copy");
  document.body.removeChild(temporal);
}

function mostrarMensaje(elemento, texto, tipo){
  if(!elemento){
    return;
  }

  elemento.textContent = texto;
  elemento.className = `rep-mensaje ${tipo === "ok" ? "rep-mensaje-ok" : "rep-mensaje-error"}`;
}
