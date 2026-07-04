/* =========================================================
Nombre completo: ia-estratega.js
Ruta o ubicación: src/ia/ia-estratega.js
Función o funciones:
- Recomendar qué proyecto conviene avanzar primero.
- Generar lectura estratégica del Top 3.
- Explicar razones simples de prioridad.
Con qué se conecta:
- srv-ia.js
- srv-prioridad.js
========================================================= */

export function generarTop3Estrategico(proyectos){
  const lista = Array.isArray(proyectos) ? proyectos.slice(0, 3) : [];

  return lista.map(function(proyecto, index){
    return {
      posicion: index + 1,
      proyectoId: proyecto.id,
      nombre: proyecto.nombre,
      prioridad: Number(proyecto.prioridad || 0),
      razon: obtenerRazonEstrategica(proyecto),
      accionHoy: proyecto.siguienteAccion || "Define una acción concreta para hoy."
    };
  });
}

export function obtenerProyectoMasConveniente(proyectos){
  const lista = Array.isArray(proyectos) ? proyectos : [];

  if(!lista.length){
    return null;
  }

  return [...lista].sort(function(a, b){
    return Number(b.prioridad || 0) - Number(a.prioridad || 0);
  })[0];
}

function obtenerRazonEstrategica(proyecto){
  if(proyecto.semaforo === "verde" && Number(proyecto.prioridad || 0) >= 75){
    return "Conviene avanzar porque tiene buena prioridad, señales positivas y acción clara.";
  }

  if(Number(proyecto.resumenFinanciero?.utilidad || 0) > 0){
    return "Conviene avanzar porque ya tiene utilidad positiva y puede repetirse lo que funcionó.";
  }

  if(Number(proyecto.porcentajeAvance || 0) >= 50){
    return "Conviene avanzar porque ya tiene bastante avance y puede acercarse a validación o monetización.";
  }

  if(proyecto.potencial === "alto"){
    return "Conviene revisarlo porque tiene potencial alto, pero necesita una acción concreta.";
  }

  return "Puede avanzar, pero primero necesita más claridad de MVP, dinero o siguiente acción.";
}
