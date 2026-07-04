# Pantallas de la app

Este documento define las pantallas principales de **Proyectos IA**.

La app debe ser minimalista, clara y enfocada en tomar decisiones para ganar dinero.

---

# Pantallas del MVP inicial

## 1. Inicio / Proyectos

Esta será la pantalla principal.

Objetivo:

```text
Mostrar rápidamente qué proyectos existen, cómo van y cuál conviene avanzar hoy.
```

Debe mostrar:

```text
Top 3 proyectos de hoy
Lista de proyectos
Semáforo por proyecto
Porcentaje de avance
Dinero generado
Siguiente acción
Botón para crear proyecto
```

Ejemplo de tarjeta:

```text
App de edición de video
🟢 72%
Generado: $120
Siguiente acción: Terminar exportación final
```

Archivos sugeridos:

```text
src/pantallas/01-inicio/ini-main.js
src/pantallas/01-inicio/ini.css
src/pantallas/01-inicio/ini-tarjetas.js
src/pantallas/01-inicio/ini-top3.js
src/pantallas/01-inicio/ini-eventos.js
```

---

## 2. Proyectos / Crear y editar

Esta pantalla o vista sirve para crear y editar proyectos.

Objetivo:

```text
Permitir crear proyectos rápido y completar la información mínima.
```

Debe pedir:

```text
Nombre
Tipo
Descripción
Objetivo económico
MVP
Estado
Siguiente acción
```

La creación debe ser rápida. La IA podrá pedir más datos después.

Archivos sugeridos:

```text
src/pantallas/02-proyectos/pry-main.js
src/pantallas/02-proyectos/pry.css
src/pantallas/02-proyectos/pry-formulario.js
src/pantallas/02-proyectos/pry-lista.js
src/pantallas/02-proyectos/pry-eventos.js
```

---

## 3. Detalle del proyecto

Esta pantalla muestra el panel individual de un proyecto.

Objetivo:

```text
Entender qué pasa con un proyecto y qué hacer ahora.
```

Debe mostrar:

```text
Nombre del proyecto
Tipo
Estado
Semáforo
Avance
Ingresos
Gastos
Utilidad
Horas trabajadas
Dinero por hora
Riesgo
Potencial
MVP
Siguiente acción
Diagnóstico IA
Tareas principales
Historial de avances
```

Archivos sugeridos:

```text
src/pantallas/03-detalle-proyecto/det-main.js
src/pantallas/03-detalle-proyecto/det.css
src/pantallas/03-detalle-proyecto/det-resumen.js
src/pantallas/03-detalle-proyecto/det-diagnostico.js
src/pantallas/03-detalle-proyecto/det-finanzas.js
src/pantallas/03-detalle-proyecto/det-tareas.js
src/pantallas/03-detalle-proyecto/det-eventos.js
```

---

## 4. Registro diario

Esta pantalla sirve para registrar trabajo realizado.

Objetivo:

```text
Registrar avances, horas trabajadas, bloqueos y acciones realizadas.
```

Formas de registro:

```text
Manual
Texto libre
Cronómetro
```

Ejemplo de texto libre:

```text
Hoy trabajé 2 horas en la app de proyectos. Terminé la pantalla principal y corregí el semáforo.
```

La app debe interpretar:

```text
Proyecto: App de proyectos
Horas: 2
Avance: pantalla principal terminada
Siguiente acción sugerida: diseñar detalle del proyecto
```

Archivos sugeridos:

```text
src/pantallas/04-registro-diario/reg-main.js
src/pantallas/04-registro-diario/reg.css
src/pantallas/04-registro-diario/reg-texto-libre.js
src/pantallas/04-registro-diario/reg-cronometro.js
src/pantallas/04-registro-diario/reg-manual.js
src/pantallas/04-registro-diario/reg-eventos.js
```

---

## 5. Finanzas

Esta pantalla muestra el análisis financiero.

Objetivo:

```text
Saber si un proyecto está generando dinero, perdiendo dinero o acercándose al punto de equilibrio.
```

Debe mostrar:

```text
Ingresos
Gastos
Utilidad
Horas trabajadas
Dinero por hora
Punto de equilibrio
Alertas financieras
```

Archivos sugeridos:

```text
src/pantallas/05-finanzas/fin-main.js
src/pantallas/05-finanzas/fin.css
src/pantallas/05-finanzas/fin-ingresos.js
src/pantallas/05-finanzas/fin-gastos.js
src/pantallas/05-finanzas/fin-equilibrio.js
src/pantallas/05-finanzas/fin-graficos.js
```

---

# Pantallas posteriores

## 6. Archivos

Objetivo:

```text
Subir Excel, PDF, imágenes o texto para alimentar los proyectos.
```

La IA debe extraer:

```text
Tareas
Costos
Fechas
Riesgos
Ideas
Avances
```

---

## 7. IA / Diagnóstico

Objetivo:

```text
Mostrar análisis inteligente de proyectos.
```

Debe responder:

```text
Qué va bien
Qué va mal
Qué hacer ahora
Qué mejorar
Qué evitar
```

---

## 8. Reportes

Objetivo:

```text
Mostrar gráficos de avance, dinero, horas y prioridad.
```

Gráficos principales:

```text
Avance por proyecto
Dinero por proyecto
Horas por proyecto
Prioridad por proyecto
```

---

## 9. Configuración

Objetivo:

```text
Configurar preferencias, IA, respaldo y datos.
```

Debe permitir:

```text
Configurar proveedor de IA
Exportar datos
Importar respaldo
Limpiar datos de prueba
Cambiar preferencias visuales
```

---

# Orden recomendado de construcción

```text
1. Inicio / Proyectos
2. Crear y editar proyectos
3. Detalle del proyecto
4. Finanzas
5. Registro diario
6. Indicadores inteligentes
7. IA
8. Archivos
9. Reportes
10. Configuración
```

---

# Regla visual

La pantalla principal debe ser minimalista.

No debe llenarse de gráficos desde el inicio.

Primero debe responder:

```text
Qué proyecto avanzar.
Por qué.
Qué hacer ahora.
```
