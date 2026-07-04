/* =========================================================
Nombre completo: shared-validaciones.js
Ruta o ubicación: src/shared/shared-validaciones.js
Función o funciones:
- Validar textos, números, estados y tipos de proyecto.
- Evitar guardar información incompleta o inválida.
- Entregar mensajes simples para el usuario.
Con qué se conecta:
- srv-proyectos.js
- data-proyectos.js
- futuras pantallas de formularios
========================================================= */

export const TIPOS_PROYECTO_PERMITIDOS = [
  "App / software",
  "Curso",
  "Negocio físico",
  "Canal de contenido",
  "Servicio profesional",
  "Consultoría",
  "Automatización",
  "Producto digital",
  "Inversión",
  "Idea futura",
  "Proyecto académico",
  "Otro"
];

export const ESTADOS_PROYECTO_PERMITIDOS = [
  "Idea",
  "Validación",
  "MVP",
  "Monetizando",
  "Creciendo",
  "Pausado",
  "Cerrado"
];

export function textoTieneContenido(valor){
  return typeof valor === "string" && valor.trim().length > 0;
}

export function numeroValido(valor){
  return typeof valor === "number" && Number.isFinite(valor);
}

export function normalizarTexto(valor, textoDefecto = ""){
  if(typeof valor !== "string"){
    return textoDefecto;
  }

  return valor.trim();
}

export function normalizarNumero(valor, numeroDefecto = 0){
  const numero = Number(valor);

  if(!Number.isFinite(numero)){
    return numeroDefecto;
  }

  return numero;
}

export function validarProyectoBasico(proyecto){
  const errores = [];

  if(!proyecto || typeof proyecto !== "object"){
    return {
      valido: false,
      errores: ["El proyecto no tiene datos válidos."]
    };
  }

  if(!textoTieneContenido(proyecto.nombre)){
    errores.push("El proyecto necesita un nombre.");
  }

  if(!TIPOS_PROYECTO_PERMITIDOS.includes(proyecto.tipo)){
    errores.push("Selecciona un tipo de proyecto válido.");
  }

  if(!ESTADOS_PROYECTO_PERMITIDOS.includes(proyecto.estado)){
    errores.push("Selecciona un estado de proyecto válido.");
  }

  return {
    valido: errores.length === 0,
    errores
  };
}
