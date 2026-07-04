/* =========================================================
Nombre completo: ia-normalizador.js
Ruta o ubicación: src/ia/ia-normalizador.js
Función o funciones:
- Analizar texto pegado de forma básica sin IA externa.
- Detectar resumen, tareas, riesgos e ideas importantes.
- Preparar una estructura útil para asociarla a proyectos.
Con qué se conecta:
- srv-archivos.js
- arc-analisis.js
========================================================= */

export function analizarTextoDocumento(texto){
  const contenido = typeof texto === "string" ? texto.trim() : "";

  if(!contenido){
    return {
      resumen: "No hay texto suficiente para analizar.",
      tareasDetectadas: [],
      riesgosDetectados: [],
      ideasDetectadas: []
    };
  }

  const oraciones = separarOraciones(contenido);

  return {
    resumen: crearResumenBasico(oraciones),
    tareasDetectadas: detectarTareas(oraciones),
    riesgosDetectados: detectarRiesgos(oraciones),
    ideasDetectadas: detectarIdeas(oraciones)
  };
}

function separarOraciones(texto){
  return texto
    .split(/\n|\.|;|-/)
    .map(function(item){
      return item.trim();
    })
    .filter(function(item){
      return item.length > 3;
    });
}

function crearResumenBasico(oraciones){
  if(!oraciones.length){
    return "No se pudo generar resumen.";
  }

  return oraciones.slice(0, 3).join(". ") + ".";
}

function detectarTareas(oraciones){
  const palabras = ["hacer", "crear", "corregir", "mejorar", "revisar", "terminar", "subir", "validar", "probar", "definir", "conectar"];
  return filtrarPorPalabras(oraciones, palabras).slice(0, 8);
}

function detectarRiesgos(oraciones){
  const palabras = ["riesgo", "problema", "error", "falla", "bloqueo", "no funciona", "falta", "caro", "gasto", "pérdida", "perdida"];
  return filtrarPorPalabras(oraciones, palabras).slice(0, 8);
}

function detectarIdeas(oraciones){
  const palabras = ["idea", "oportunidad", "podría", "podria", "conviene", "posible", "cliente", "venta", "ingreso", "ahorro"];
  return filtrarPorPalabras(oraciones, palabras).slice(0, 8);
}

function filtrarPorPalabras(oraciones, palabras){
  return oraciones.filter(function(oracion){
    const minuscula = oracion.toLowerCase();
    return palabras.some(function(palabra){
      return minuscula.includes(palabra);
    });
  });
}
