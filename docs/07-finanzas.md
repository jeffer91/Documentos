# Finanzas de la app

Este documento define cómo debe manejarse el análisis financiero dentro de **Proyectos IA**.

La app debe ayudar a saber si un proyecto está generando dinero, perdiendo dinero o acercándose a generar dinero.

---

# Objetivo financiero principal

La app debe responder:

```text
¿Este proyecto me está acercando a ganar dinero?
```

También debe responder:

```text
¿Cuánto dinero genera?
¿Cuánto cuesta?
¿Cuánto tiempo consume?
¿Cuánto gano por hora?
¿Cuánto falta para llegar al punto de equilibrio?
¿Conviene seguir, corregir o pausar?
```

---

# Datos financieros mínimos

Cada proyecto debe manejar:

```text
Ingresos
Gastos
Horas trabajadas
Utilidad
Dinero por hora
Punto de equilibrio
Potencial financiero
Riesgo financiero
```

---

# Ingresos

Un ingreso representa dinero que entra por un proyecto.

Ejemplo:

```js
{
  id: "ing_001",
  proyectoId: "proy_001",
  concepto: "Venta de taller piloto",
  monto: 75,
  fecha: "2026-07-04",
  nota: "Primer ingreso del proyecto."
}
```

Categorías sugeridas:

```text
Venta
Servicio
Suscripción
Publicidad
Patrocinio
Consultoría
Curso
Ahorro convertido en dinero
Otro
```

---

# Gastos

Un gasto representa dinero invertido o consumido por un proyecto.

Ejemplo:

```js
{
  id: "gas_001",
  proyectoId: "proy_001",
  concepto: "Herramienta de diseño",
  monto: 12,
  fecha: "2026-07-04",
  categoria: "Herramientas",
  nota: "Pago mensual."
}
```

Categorías sugeridas:

```text
Herramientas
Publicidad
Software
Diseño
Producción
Transporte
Comisiones
Servicios externos
Otro
```

---

# Horas trabajadas

Las horas son importantes porque permiten calcular dinero por hora.

Ejemplo:

```js
{
  proyectoId: "proy_001",
  fecha: "2026-07-04",
  horas: 2,
  descripcion: "Diseño de pantalla principal."
}
```

---

# Cálculos principales

## 1. Ingresos totales

```text
Ingresos totales = suma de todos los ingresos del proyecto
```

## 2. Gastos totales

```text
Gastos totales = suma de todos los gastos del proyecto
```

## 3. Utilidad

```text
Utilidad = Ingresos totales - Gastos totales
```

Ejemplo:

```text
Ingresos: $100
Gastos: $30
Utilidad: $70
```

## 4. Dinero por hora

```text
Dinero por hora = Utilidad / Horas trabajadas
```

Ejemplo:

```text
Utilidad: $70
Horas: 5
Dinero por hora: $14/h
```

Si las horas trabajadas son 0:

```text
Dinero por hora = 0
```

## 5. Punto de equilibrio básico

```text
Punto de equilibrio = Gastos totales / Ganancia por venta
```

Ejemplo:

```text
Gastos: $100
Ganancia por venta: $20
Punto de equilibrio: 5 ventas
```

---

# Punto de equilibrio por tipo de proyecto

Cada tipo de proyecto puede necesitar datos diferentes.

## App / software

Datos sugeridos:

```text
Costo de desarrollo
Costo de hosting
Costo de herramientas
Precio de suscripción
Usuarios necesarios
Clientes pagos necesarios
```

## Curso

Datos sugeridos:

```text
Horas de preparación
Costo de publicidad
Precio por estudiante
Número de estudiantes necesarios
Costo de plataforma
```

## Canal de contenido

Datos sugeridos:

```text
Horas de producción
Costo de edición
Ingresos por publicidad
Ingresos por patrocinio
Vistas necesarias
Sponsors necesarios
```

## Servicio profesional

Datos sugeridos:

```text
Horas invertidas
Precio por servicio
Costo de herramientas
Costo de adquisición de cliente
Clientes necesarios
```

## Negocio físico

Datos sugeridos:

```text
Inversión inicial
Costos fijos
Costos variables
Precio de venta
Margen por venta
Ventas necesarias
```

---

# Ahorro de tiempo convertido en dinero

Algunos proyectos no generan dinero directo, pero ahorran tiempo.

Ejemplo:

```text
Una automatización ahorra 5 horas al mes.
Cada hora se valora en $10.
Ahorro mensual = $50.
```

Fórmula:

```text
Ahorro convertido en dinero = horas ahorradas * valor por hora
```

Este valor puede contarse como beneficio financiero indirecto.

---

# Indicadores financieros

## Verde

```text
Genera utilidad positiva.
Tiene buen dinero por hora.
Está cerca o ya pasó el punto de equilibrio.
Tiene gastos controlados.
```

## Amarillo

```text
Todavía no genera dinero, pero tiene potencial.
Tiene gastos bajos.
Tiene MVP claro.
Está cerca de validar venta o cliente.
```

## Rojo

```text
Gasta más de lo que genera.
Consume muchas horas sin retorno.
No tiene modelo claro de ingreso.
No tiene punto de equilibrio definido.
No tiene siguiente acción económica.
```

---

# Alertas financieras

La app debe alertar cuando:

```text
El proyecto tiene utilidad negativa.
El proyecto tiene muchas horas y cero ingresos.
El dinero por hora es muy bajo.
Los gastos crecen sin avance.
No existe modelo de monetización.
El punto de equilibrio es demasiado alto.
```

Ejemplos de alerta:

```text
Este proyecto tiene 20 horas trabajadas y todavía no tiene una acción clara para generar dinero.
```

```text
Los gastos de este proyecto están creciendo, pero no hay ingresos ni validación.
```

```text
El dinero por hora de este proyecto es bajo. Revisa si conviene seguir igual o cambiar la estrategia.
```

---

# Relación con prioridad

La prioridad de un proyecto debe subir cuando:

```text
Genera más dinero por hora.
Está cerca de una venta.
Tiene alto potencial y bajo costo.
Está cerca del MVP.
Puede recuperar inversión pronto.
```

La prioridad debe bajar cuando:

```text
Consume muchas horas sin avance.
No tiene modelo de ingreso.
Tiene costos altos.
No tiene MVP claro.
No tiene siguiente acción.
```

---

# Regla financiera central

Todo proyecto debe tener una respuesta clara a esta pregunta:

```text
¿Cómo puede generar dinero o ahorrar tiempo convertido en dinero?
```

Si no tiene respuesta, la app debe marcarlo como:

```text
Sin modelo claro
En observación
Necesita MVP económico
Recomendado para pausar
```
