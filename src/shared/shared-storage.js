/* =========================================================
Nombre completo: shared-storage.js
Ruta o ubicación: src/shared/shared-storage.js
Función o funciones:
- Guardar datos de la app en localStorage.
- Leer datos guardados de forma segura.
- Centralizar claves de almacenamiento local.
Con qué se conecta:
- srv-proyectos.js
- data-proyectos.js
- data-avances.js
- data-finanzas.js
========================================================= */

const STORAGE_PREFIX = "proyectos_ia";

export const STORAGE_KEYS = {
  proyectos: `${STORAGE_PREFIX}_proyectos`,
  avances: `${STORAGE_PREFIX}_avances`,
  finanzas: `${STORAGE_PREFIX}_finanzas`,
  tareas: `${STORAGE_PREFIX}_tareas`,
  archivos: `${STORAGE_PREFIX}_archivos`,
  configuracion: `${STORAGE_PREFIX}_configuracion`
};

export function almacenamientoDisponible(){
  try{
    const clavePrueba = `${STORAGE_PREFIX}_prueba`;
    window.localStorage.setItem(clavePrueba, "ok");
    window.localStorage.removeItem(clavePrueba);
    return true;
  }catch(error){
    console.error("localStorage no disponible:", error);
    return false;
  }
}

export function leerStorage(clave, valorDefecto = null){
  if(!clave){
    console.warn("No se puede leer storage sin clave.");
    return valorDefecto;
  }

  if(!almacenamientoDisponible()){
    return valorDefecto;
  }

  try{
    const valor = window.localStorage.getItem(clave);

    if(valor === null){
      return valorDefecto;
    }

    return JSON.parse(valor);
  }catch(error){
    console.error("Error leyendo storage:", error);
    return valorDefecto;
  }
}

export function guardarStorage(clave, valor){
  if(!clave){
    console.warn("No se puede guardar storage sin clave.");
    return false;
  }

  if(!almacenamientoDisponible()){
    return false;
  }

  try{
    window.localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  }catch(error){
    console.error("Error guardando storage:", error);
    return false;
  }
}

export function eliminarStorage(clave){
  if(!clave){
    return false;
  }

  if(!almacenamientoDisponible()){
    return false;
  }

  try{
    window.localStorage.removeItem(clave);
    return true;
  }catch(error){
    console.error("Error eliminando storage:", error);
    return false;
  }
}
