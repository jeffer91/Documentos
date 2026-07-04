/* =========================================================
Nombre completo: srv-configuracion.js
Ruta o ubicación: src/servicios/srv-configuracion.js
Función o funciones:
- Leer y guardar configuración básica de la app.
- Mantener preferencias generales como nombre, moneda y modo de IA.
- Entregar valores seguros por defecto si no existe configuración guardada.
Con qué se conecta:
- shared-storage.js
- cfg-ajustes.js
- cfg-eventos.js
========================================================= */

import { STORAGE_KEYS, guardarStorage, leerStorage } from "../shared/shared-storage.js";

export const CONFIGURACION_DEFECTO = {
  nombreUsuario: "Jeff",
  moneda: "USD",
  modoIa: "interna",
  mostrarDatosDemo: true,
  version: "1.0.0"
};

export function obtenerConfiguracion(){
  const configuracion = leerStorage(STORAGE_KEYS.configuracion, CONFIGURACION_DEFECTO);

  return {
    ...CONFIGURACION_DEFECTO,
    ...(configuracion || {})
  };
}

export function guardarConfiguracion(datos = {}){
  const configuracionActual = obtenerConfiguracion();
  const nuevaConfiguracion = {
    ...configuracionActual,
    nombreUsuario: normalizarTexto(datos.nombreUsuario, configuracionActual.nombreUsuario),
    moneda: normalizarTexto(datos.moneda, configuracionActual.moneda),
    modoIa: normalizarTexto(datos.modoIa, configuracionActual.modoIa),
    mostrarDatosDemo: Boolean(datos.mostrarDatosDemo),
    version: configuracionActual.version
  };

  const guardado = guardarStorage(STORAGE_KEYS.configuracion, nuevaConfiguracion);

  return {
    ok: guardado,
    configuracion: nuevaConfiguracion,
    errores: guardado ? [] : ["No se pudo guardar la configuración."]
  };
}

export function restablecerConfiguracion(){
  const guardado = guardarStorage(STORAGE_KEYS.configuracion, CONFIGURACION_DEFECTO);

  return {
    ok: guardado,
    configuracion: CONFIGURACION_DEFECTO,
    errores: guardado ? [] : ["No se pudo restablecer la configuración."]
  };
}

function normalizarTexto(valor, defecto){
  if(typeof valor !== "string"){
    return defecto;
  }

  const limpio = valor.trim();
  return limpio || defecto;
}
