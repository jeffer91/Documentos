# MVP de Proyectos IA

Este documento define el mínimo viable de la app.

El objetivo del MVP es construir una primera versión útil, simple y funcional, sin cargar la app con funciones innecesarias desde el inicio.

---

# Objetivo del MVP

La primera versión debe permitir responder:

```text
¿Qué proyecto debo avanzar hoy y por qué?
```

También debe permitir saber:

```text
Cuánto he avanzado.
Cuánto dinero he generado.
Cuántas horas he trabajado.
Qué proyecto tiene mejor dinero por hora.
Qué proyecto está en riesgo.
Qué acción debo hacer ahora.
```

---

# Funciones obligatorias del MVP

## 1. Crear proyectos rápido

La app debe permitir crear un proyecto sin llenar demasiados campos.

Campos mínimos:

```text
Nombre
Tipo
Objetivo económico
MVP
Estado
Siguiente acción
```

La IA podrá completar o sugerir mejoras después.

---

## 2. Lista de proyectos

La pantalla principal debe mostrar los proyectos en tarjetas simples.

Cada tarjeta debe mostrar:

```text
Nombre del proyecto
Semáforo
Porcentaje de avance
Dinero generado
Siguiente acción recomendada
```

---

## 3. Top 3 proyectos del día

La app debe mostrar los tres proyectos más importantes para avanzar hoy.

El Top 3 debe calcularse con:

```text
Dinero actual
Dinero por hora
Potencial futuro
Urgencia
Riesgo
Avance
Energía necesaria
```

---

## 4. Detalle del proyecto

Al entrar a un proyecto, debe verse un panel individual con:

```text
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
Siguiente acción
```

---

## 5. Registro de avances

La app debe permitir registrar avances de forma sencilla.

Formas iniciales:

```text
Manual
Texto libre
```

Después se agregará:

```text
Cronómetro
Archivos
```

---

## 6. Finanzas básicas

La app debe calcular:

```text
Ingresos
Gastos
Utilidad
Dinero por hora
Punto de equilibrio básico
```

Fórmulas iniciales:

```text
Utilidad = Ingresos - Gastos
Dinero por hora = Utilidad / Horas trabajadas
Punto de equilibrio = Gastos totales / Ganancia por venta
```

---

## 7. Semáforo inteligente

La app debe mostrar un color por proyecto:

```text
Verde
Amarillo
Rojo
```

El color debe depender de:

```text
Dinero
Avance
Horas
Riesgo
Potencial
Claridad del MVP
Siguiente acción
```

---

## 8. Diagnóstico IA básico

La IA debe entregar un diagnóstico corto y accionable.

Formato:

```text
Qué va bien
Qué va mal
Qué hacer ahora
Qué mejorar
Qué evitar
```

La IA debe ser directa, pero clara.

---

# Funciones que NO van en el MVP inicial

Estas funciones son importantes, pero no deben entrar en la primera versión para evitar que el proyecto crezca demasiado rápido:

```text
Calendario avanzado
Conexión con Gmail
Conexión con Google Calendar
Conexión con WhatsApp
Conexión con Telegram
Reportes avanzados
Automatizaciones complejas
Usuarios múltiples
Sincronización en nube
App móvil
```

Se pueden agregar después, cuando la base esté estable.

---

# MVP por fases internas

## MVP 1: App abre y muestra proyectos

Incluye:

```text
Base técnica
Pantalla Inicio
Datos de ejemplo
Tarjetas de proyectos
```

## MVP 2: Crear y guardar proyectos

Incluye:

```text
Formulario de proyecto
Guardado local
Lista actualizable
```

## MVP 3: Finanzas y horas

Incluye:

```text
Ingresos
Gastos
Horas
Utilidad
Dinero por hora
```

## MVP 4: Indicadores inteligentes

Incluye:

```text
Avance
Semáforo
Prioridad
Top 3
```

## MVP 5: Diagnóstico IA

Incluye:

```text
Análisis del proyecto
Recomendaciones
Acción de hoy
Alerta de riesgo
```

---

# Regla del MVP

No se debe agregar una función nueva si antes no se responde:

```text
¿Esta función ayuda a ganar dinero, ahorrar tiempo o decidir mejor?
```

Si la respuesta es no, la función se deja para después.
