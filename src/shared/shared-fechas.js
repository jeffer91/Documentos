/* =========================================================
Nombre completo: shared-fechas.js
Ruta o ubicación: src/shared/shared-fechas.js
Función o funciones:
- Crear fechas ISO para registros internos.
- Formatear fechas simples para mostrar al usuario.
- Centralizar utilidades de fecha usadas por varias pantallas.
Con qué se conecta:
- data-proyectos.js
- data-avances.js
- data-finanzas.js
- srv-proyectos.js
========================================================= */

export function obtenerFechaIsoActual(){
  return new Date().toISOString();
}

export function obtenerFechaCortaActual(){
  return new Date().toISOString().slice(0, 10);
}

export function formatearFechaCorta(fecha){
  if(!fecha){
    return "Sin fecha";
  }

  const fechaObj = new Date(fecha);

  if(Number.isNaN(fechaObj.getTime())){
    return "Fecha inválida";
  }

  return fechaObj.toLocaleDateString("es-EC", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

export function crearMarcaActualizacion(){
  return {
    creadoEn: obtenerFechaIsoActual(),
    actualizadoEn: obtenerFechaIsoActual()
  };
}
