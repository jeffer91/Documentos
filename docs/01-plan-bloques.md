# Plan de construcción por bloques

Este documento organiza la construcción de la app de gestión inteligente de proyectos.

## Objetivo principal

Crear una app minimalista e inteligente para gestionar proyectos, medir avance, analizar rentabilidad y priorizar acciones con el objetivo de aumentar ganancias.

## Enfoque de trabajo

La app se construirá por bloques pequeños, revisables y subidos a GitHub.

Cada bloque debe quedar funcional, ordenado y probado antes de avanzar.

---

# Bloques propuestos

## Bloque 0: Documentación y reglas base

Objetivo: dejar el repositorio ordenado antes de programar.

Incluye:

- README del proyecto.
- Reglas de desarrollo.
- Plan general de construcción.
- Estructura inicial recomendada.
- MVP de la app.

Estado esperado:

- Repositorio entendible.
- Reglas claras.
- Base lista para iniciar código.

---

## Bloque 1: Base técnica de la app

Objetivo: crear la estructura mínima para que la app abra y tenga navegación base.

Incluye:

- package.json.
- index.html.
- estilos globales.
- arranque principal.
- router simple.
- estado global.
- estructura de carpetas.

Estado esperado:

- La app abre.
- Se ve una pantalla inicial.
- No hay lógica pesada todavía.

---

## Bloque 2: Modelo de datos y almacenamiento local

Objetivo: definir cómo se guardan los proyectos, avances, tareas, finanzas y archivos.

Incluye:

- Modelo de proyecto.
- Modelo de avance.
- Modelo de tarea.
- Modelo financiero.
- Servicio de almacenamiento local.
- Datos de ejemplo.

Estado esperado:

- La app puede guardar y leer proyectos localmente.

---

## Bloque 3: Pantalla Inicio / Proyectos

Objetivo: crear la pantalla principal minimalista.

Incluye:

- Lista de proyectos.
- Tarjetas con nombre, semáforo, porcentaje, dinero generado y siguiente acción.
- Top 3 proyectos recomendados.
- Botón para crear proyecto.

Estado esperado:

- El usuario ve sus proyectos ordenados.
- La pantalla principal ya sirve como centro de control.

---

## Bloque 4: Crear y editar proyectos

Objetivo: permitir crear proyectos rápidamente y completar información básica.

Incluye:

- Formulario rápido.
- Tipo de proyecto.
- Objetivo económico.
- MVP.
- Estado.
- Siguiente acción.

Estado esperado:

- Se pueden crear, editar y guardar proyectos.

---

## Bloque 5: Detalle del proyecto

Objetivo: crear el panel individual de cada proyecto.

Incluye:

- Resumen del proyecto.
- Estado.
- Avance.
- Semáforo.
- Horas.
- Ingresos.
- Gastos.
- Utilidad.
- Siguiente acción.

Estado esperado:

- Al abrir un proyecto, se entiende qué pasa y qué falta.

---

## Bloque 6: Finanzas y punto de equilibrio

Objetivo: calcular si un proyecto conviene económicamente.

Incluye:

- Registro de ingresos.
- Registro de gastos.
- Utilidad.
- Dinero por hora.
- Punto de equilibrio.
- Alertas básicas.

Estado esperado:

- La app muestra si el proyecto está generando o perdiendo dinero.

---

## Bloque 7: Registro diario y horas trabajadas

Objetivo: registrar avances de forma rápida.

Incluye:

- Registro manual.
- Texto libre.
- Cronómetro.
- Historial de avances.
- Actualización automática de horas.

Estado esperado:

- El usuario puede registrar qué hizo y cuánto tiempo trabajó.

---

## Bloque 8: Semáforo, avance y prioridad inteligente

Objetivo: calcular indicadores importantes.

Incluye:

- Porcentaje de avance.
- Semáforo.
- Prioridad.
- Riesgo.
- Potencial.
- Top 3 proyectos del día.

Estado esperado:

- La app recomienda qué avanzar primero.

---

## Bloque 9: IA de diagnóstico

Objetivo: integrar la lógica de IA para analizar proyectos.

Incluye:

- Prompts base.
- Diagnóstico por proyecto.
- Qué va bien.
- Qué va mal.
- Qué hacer ahora.
- Qué mejorar.
- Qué evitar.

Estado esperado:

- La app empieza a comportarse como asesor inteligente.

---

## Bloque 10: Archivos y análisis documental

Objetivo: permitir subir texto, Excel, PDF e imágenes para alimentar proyectos.

Incluye:

- Subida de archivos.
- Texto pegado.
- Registro de archivos por proyecto.
- Extracción inicial de información.
- Actualización de tareas, costos, fechas y riesgos.

Estado esperado:

- Los archivos ayudan a mejorar el análisis del proyecto.

---

## Bloque 11: Gráficos y reportes

Objetivo: mostrar avance, dinero, horas y prioridad de forma visual.

Incluye:

- Gráfico de avance.
- Gráfico de dinero.
- Gráfico de horas.
- Gráfico de prioridad.
- Resumen mensual.

Estado esperado:

- El usuario puede ver rápidamente qué proyecto funciona mejor.

---

## Bloque 12: Configuración, respaldo y limpieza final

Objetivo: dejar la app lista para uso real.

Incluye:

- Configuración básica.
- Preferencias.
- Exportar datos.
- Importar respaldo.
- Revisión de errores.
- Limpieza visual.
- Checklist final.

Estado esperado:

- Primera versión estable y usable.

---

# Resumen

La app se construirá en 12 bloques principales más el Bloque 0 de documentación.

Total recomendado:

```text
13 bloques de trabajo
```

Orden:

```text
Bloque 0: Documentación y reglas base
Bloque 1: Base técnica
Bloque 2: Datos y almacenamiento
Bloque 3: Inicio / Proyectos
Bloque 4: Crear y editar proyectos
Bloque 5: Detalle del proyecto
Bloque 6: Finanzas
Bloque 7: Registro diario
Bloque 8: Indicadores inteligentes
Bloque 9: IA
Bloque 10: Archivos
Bloque 11: Reportes
Bloque 12: Configuración y cierre
```
