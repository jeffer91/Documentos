/* =========================================================
Nombre completo: cfg-eventos.js
Ruta o ubicación: src/pantallas/09-configuracion/cfg-eventos.js
Función o funciones:
- Conectar eventos de configuración, respaldo, restauración y limpieza.
- Guardar ajustes básicos de la app.
- Copiar, restaurar y limpiar datos locales con confirmación.
Con qué se conecta:
- cfg-main.js
- srv-configuracion.js
- srv-respaldo.js
- app-router.js
========================================================= */

import { guardarConfiguracion } from "../../servicios/srv-configuracion.js";
import { crearRespaldoJson, limpiarDatosLocales, restaurarRespaldoJson } from "../../servicios/srv-respaldo.js";

export function conectarCfgEventos(contenedor, acciones = {}){
  if(!contenedor){
    console.error("No se puede conectar eventos de Configuración sin contenedor.");
    return;
  }

  const alActualizar = typeof acciones.alActualizar === "function" ? acciones.alActualizar : function(){};

  conectarFormularioAjustes(contenedor, alActualizar);
  conectarBotonesRespaldo(contenedor, alActualizar);
}

function conectarFormularioAjustes(contenedor, alActualizar){
  const formulario = contenedor.querySelector("#cfg-form-ajustes");

  if(!formulario){
    return;
  }

  formulario.addEventListener("submit", function(evento){
    evento.preventDefault();

    const formData = new FormData(formulario);
    const resultado = guardarConfiguracion({
      nombreUsuario: String(formData.get("nombreUsuario") || "").trim(),
      moneda: String(formData.get("moneda") || "USD").trim(),
      modoIa: String(formData.get("modoIa") || "interna").trim(),
      mostrarDatosDemo: formData.get("mostrarDatosDemo") === "on"
    });

    mostrarMensaje(contenedor, "#cfg-mensaje-ajustes", resultado.ok ? "Configuración guardada." : resultado.errores.join(" "), resultado.ok ? "ok" : "error");
    alActualizar();
  });
}

function conectarBotonesRespaldo(contenedor, alActualizar){
  const area = contenedor.querySelector("#cfg-texto-respaldo");
  const botonGenerar = contenedor.querySelector("[data-cfg-generar-respaldo]");
  const botonCopiar = contenedor.querySelector("[data-cfg-copiar-respaldo]");
  const botonRestaurar = contenedor.querySelector("[data-cfg-restaurar-respaldo]");
  const botonLimpiar = contenedor.querySelector("[data-cfg-limpiar-datos]");

  if(botonGenerar && area){
    botonGenerar.addEventListener("click", function(){
      area.value = crearRespaldoJson();
      mostrarMensaje(contenedor, "#cfg-mensaje-respaldo", "Respaldo generado.", "ok");
    });
  }

  if(botonCopiar && area){
    botonCopiar.addEventListener("click", function(){
      copiarTexto(area.value, contenedor);
    });
  }

  if(botonRestaurar && area){
    botonRestaurar.addEventListener("click", function(){
      if(!window.confirm("¿Seguro que quieres restaurar este respaldo? Reemplazará los datos actuales.")){
        return;
      }

      const resultado = restaurarRespaldoJson(area.value);
      mostrarMensaje(contenedor, "#cfg-mensaje-respaldo", resultado.ok ? "Respaldo restaurado." : resultado.errores.join(" "), resultado.ok ? "ok" : "error");
      alActualizar();
    });
  }

  if(botonLimpiar){
    botonLimpiar.addEventListener("click", function(){
      if(!window.confirm("¿Seguro que quieres limpiar todos los datos locales? Esta acción no se puede deshacer si no tienes respaldo.")){
        return;
      }

      limpiarDatosLocales();
      mostrarMensaje(contenedor, "#cfg-mensaje-respaldo", "Datos locales limpiados. La app volverá a cargar datos base al refrescar.", "ok");
      alActualizar();
    });
  }
}

async function copiarTexto(valor, contenedor){
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(valor);
    }else{
      const temporal = document.createElement("textarea");
      temporal.value = valor;
      document.body.appendChild(temporal);
      temporal.select();
      document.execCommand("copy");
      document.body.removeChild(temporal);
    }

    mostrarMensaje(contenedor, "#cfg-mensaje-respaldo", "Respaldo copiado.", "ok");
  }catch(error){
    console.error("No se pudo copiar respaldo:", error);
    mostrarMensaje(contenedor, "#cfg-mensaje-respaldo", "No se pudo copiar. Selecciona y copia manualmente.", "error");
  }
}

function mostrarMensaje(contenedor, selector, mensaje, tipo){
  const elemento = contenedor.querySelector(selector);

  if(!elemento){
    return;
  }

  elemento.textContent = mensaje;
  elemento.className = `cfg-mensaje ${tipo === "ok" ? "cfg-mensaje-ok" : "cfg-mensaje-error"}`;
}
