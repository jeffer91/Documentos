# Modelo de datos

Este documento define los datos principales que debe manejar **Proyectos IA**.

La app debe guardar información suficiente para analizar avance, rentabilidad, horas, riesgo, potencial y prioridad.

---

# 1. Proyecto

Cada proyecto debe tener como mínimo:

```js
{
  id: "proy_001",
  nombre: "App de proyectos IA",
  tipo: "App / software",
  descripcion: "App para gestionar proyectos y aumentar ganancias.",
  objetivoEconomico: 500,
  moneda: "USD",
  mvp: "Crear versión mínima con proyectos, avance, finanzas y diagnóstico IA.",
  estado: "MVP",
  semaforo: "amarillo",
  porcentajeAvance: 35,
  potencial: "alto",
  riesgo: "medio",
  siguienteAccion: "Terminar pantalla Inicio / Proyectos.",
  creadoEn: "2026-07-04T00:00:00.000Z",
  actualizadoEn: "2026-07-04T00:00:00.000Z"
}
```

---

# 2. Tipos de proyecto

Tipos iniciales:

```text
App / software
Curso
Negocio físico
Canal de contenido
Servicio profesional
Consultoría
Automatización
Producto digital
Inversión
Idea futura
Proyecto académico
Otro
```

---

# 3. Estados del proyecto

Estados aprobados:

```text
Idea
Validación
MVP
Monetizando
Creciendo
Pausado
Cerrado
```

---

# 4. Finanzas del proyecto

Cada proyecto debe poder tener ingresos y gastos.

## Ingreso

```js
{
  id: "ing_001",
  proyectoId: "proy_001",
  concepto: "Venta de curso piloto",
  monto: 75,
  fecha: "2026-07-04",
  nota: "Primer pago recibido."
}
```

## Gasto

```js
{
  id: "gas_001",
  proyectoId: "proy_001",
  concepto: "Publicidad",
  monto: 20,
  fecha: "2026-07-04",
  categoria: "Marketing",
  nota: "Prueba de anuncios."
}
```

## Resumen financiero calculado

```js
{
  proyectoId: "proy_001",
  ingresosTotales: 75,
  gastosTotales: 20,
  utilidad: 55,
  horasTrabajadas: 5,
  dineroPorHora: 11,
  puntoEquilibrio: 4
}
```

---

# 5. Avances

Cada registro de avance debe guardar qué se hizo y cuánto tiempo tomó.

```js
{
  id: "ava_001",
  proyectoId: "proy_001",
  fecha: "2026-07-04",
  horas: 2,
  tipoRegistro: "texto libre",
  descripcion: "Terminé la pantalla principal y corregí las tarjetas.",
  bloqueo: "Falta definir el cálculo de prioridad.",
  siguienteAccion: "Crear servicio de prioridad.",
  creadoEn: "2026-07-04T00:00:00.000Z"
}
```

---

# 6. Tareas

Cada proyecto puede tener tareas.

```js
{
  id: "tar_001",
  proyectoId: "proy_001",
  titulo: "Crear pantalla Inicio",
  descripcion: "Mostrar tarjetas de proyectos y Top 3.",
  estado: "pendiente",
  prioridad: "alta",
  fechaLimite: "2026-07-10",
  completadaEn: null
}
```

Estados de tarea:

```text
pendiente
en_proceso
completada
pausada
cancelada
```

---

# 7. Diagnóstico IA

La IA debe guardar diagnósticos por proyecto.

```js
{
  id: "dia_001",
  proyectoId: "proy_001",
  fecha: "2026-07-04",
  queVaBien: "El proyecto tiene un objetivo claro y está cerca del MVP.",
  queVaMal: "Aún no tiene validación con usuarios reales.",
  queHacerAhora: "Crear una versión mínima usable esta semana.",
  queMejorar: "Definir mejor cómo generará dinero.",
  queEvitar: "Agregar funciones avanzadas antes de probar el MVP.",
  nivelRiesgo: "medio",
  recomendacionFuerte: "No sigas agregando pantallas si todavía no puedes probar el flujo principal."
}
```

---

# 8. Archivos

La app podrá asociar archivos a proyectos.

```js
{
  id: "arc_001",
  proyectoId: "proy_001",
  nombre: "ideas-proyecto.pdf",
  tipo: "pdf",
  origen: "subido",
  resumen: "Documento con ideas del proyecto y posibles funciones.",
  tareasDetectadas: [
    "Definir MVP",
    "Crear pantalla principal",
    "Diseñar modelo financiero"
  ],
  riesgosDetectados: [
    "Demasiadas funciones para la primera versión"
  ],
  creadoEn: "2026-07-04T00:00:00.000Z"
}
```

---

# 9. Configuración

Configuración básica de la app:

```js
{
  moneda: "USD",
  tema: "claro",
  proveedorIA: "pendiente",
  mostrarTop3: true,
  modoIADura: true,
  guardarHistorialDiagnosticos: true
}
```

---

# 10. Cálculos principales

## Utilidad

```text
Utilidad = Ingresos totales - Gastos totales
```

## Dinero por hora

```text
Dinero por hora = Utilidad / Horas trabajadas
```

Si las horas son 0:

```text
Dinero por hora = 0
```

## Punto de equilibrio básico

```text
Punto de equilibrio = Gastos totales / Ganancia por venta
```

Este cálculo puede cambiar según el tipo de proyecto.

---

# 11. Criterios del semáforo

## Verde

```text
Tiene avance real.
Tiene MVP claro.
Genera dinero o está cerca de generar.
Buen dinero por hora.
Riesgo controlado.
```

## Amarillo

```text
Tiene potencial.
Le falta MVP, ventas o validación.
Avanza, pero lento.
Necesita una acción concreta.
```

## Rojo

```text
Muchas horas y poco avance.
No tiene MVP claro.
No hay camino para ganar dinero.
Está abandonado.
Gasta más de lo que conviene.
No tiene siguiente acción clara.
```

---

# 12. Prioridad inteligente

La prioridad debe considerar:

```text
Dinero actual
Dinero por hora
Potencial futuro
Urgencia
Riesgo
Avance
Energía necesaria
```

El objetivo no es solo ordenar por dinero actual, sino por conveniencia real.
