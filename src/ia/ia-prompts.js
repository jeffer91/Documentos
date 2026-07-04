/* =========================================================
Nombre completo: ia-prompts.js
Ruta o ubicación: src/ia/ia-prompts.js
Función o funciones:
- Guardar prompts base para una futura conexión con IA externa.
- Definir el formato estándar del diagnóstico.
- Mantener las instrucciones de IA separadas de las pantallas.
Con qué se conecta:
- srv-ia.js
- ia-analista.js
- ia-financiera.js
- ia-estratega.js
========================================================= */

export const IA_FORMATO_DIAGNOSTICO = [
  "Qué va bien",
  "Qué va mal",
  "Qué hacer ahora",
  "Qué mejorar",
  "Qué evitar",
  "Recomendación fuerte"
];

export function obtenerPromptDiagnosticoProyecto(){
  return `Analiza este proyecto con enfoque en aumentar ganancias. Devuelve qué va bien, qué va mal, qué hacer ahora, qué mejorar, qué evitar y una recomendación fuerte.`;
}

export function obtenerPromptFinanciero(){
  return `Analiza ingresos, gastos, utilidad, horas trabajadas y dinero por hora. Indica si el proyecto conviene económicamente y qué acción debe tomarse.`;
}

export function obtenerPromptEstrategico(){
  return `Compara los proyectos y recomienda cuál avanzar primero según dinero, dinero por hora, avance, potencial, riesgo y siguiente acción.`;
}
