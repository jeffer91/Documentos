/* =========================================================
Nombre completo: srv-respaldo.js
Ruta o ubicación: src/servicios/srv-respaldo.js
Función o funciones:
- Exportar todos los datos locales de la app en formato JSON.
- Restaurar datos desde un respaldo JSON válido.
- Limpiar datos locales cuando el usuario quiera reiniciar la app.
Con qué se conecta:
- shared-storage.js
- cfg-respaldo.js
- cfg-eventos.js
========================================================= */

import { STORAGE_KEYS, eliminarStorage, guardarStorage, leerStorage } from "../shared/shared-storage.js";

const RESPALDO_VERSION = "1.0.0";

export function crearRespaldoJson(){
  const respaldo = {
    app: "Proyectos IA",
    version: RESPALDO_VERSION,
    creadoEn: new Date().toISOString(),
    datos: leerTodosLosDatos()
  };

  return JSON.stringify(respaldo, null, 2);
}

export function restaurarRespaldoJson(textoJson){
  try{
    const respaldo = JSON.parse(textoJson);

    if(!respaldo || typeof respaldo !== "object" || !respaldo.datos){
      return {
        ok: false,
        errores: ["El respaldo no tiene una estructura válida."]
      };
    }

    Object.keys(STORAGE_KEYS).forEach(function(nombreClave){
      const claveStorage = STORAGE_KEYS[nombreClave];

      if(Object.prototype.hasOwnProperty.call(respaldo.datos, nombreClave)){
        guardarStorage(claveStorage, respaldo.datos[nombreClave]);
      }
    });

    return {
      ok: true,
      errores: []
    };
  }catch(error){
    console.error("Error restaurando respaldo:", error);
    return {
      ok: false,
      errores: ["No se pudo leer el respaldo. Revisa que sea JSON válido."]
    };
  }
}

export function limpiarDatosLocales(){
  Object.values(STORAGE_KEYS).forEach(function(clave){
    eliminarStorage(clave);
  });

  return {
    ok: true,
    errores: []
  };
}

export function leerTodosLosDatos(){
  return Object.keys(STORAGE_KEYS).reduce(function(acumulado, nombreClave){
    const claveStorage = STORAGE_KEYS[nombreClave];
    acumulado[nombreClave] = leerStorage(claveStorage, null);
    return acumulado;
  }, {});
}
