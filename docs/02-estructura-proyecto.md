# Estructura del proyecto

Este documento define la estructura recomendada para la app **Proyectos IA**.

La estructura busca que el proyecto sea fácil de revisar, corregir y ampliar.

---

# Estructura completa esperada

```text
Proyectos/
│
├── README.md
├── REGLAS_DESARROLLO.md
├── package.json
├── .gitignore
│
├── docs/
│   ├── 01-plan-bloques.md
│   ├── 02-estructura-proyecto.md
│   ├── 03-mvp.md
│   ├── 04-pantallas.md
│   ├── 05-modelo-datos.md
│   ├── 06-ia.md
│   ├── 07-finanzas.md
│   └── 08-roadmap.md
│
├── src/
│   │
│   ├── app/
│   │   ├── app-inicio.js
│   │   ├── app-router.js
│   │   ├── app-state.js
│   │   └── app-config.js
│   │
│   ├── shared/
│   │   ├── shared-dom.js
│   │   ├── shared-formatos.js
│   │   ├── shared-validaciones.js
│   │   ├── shared-storage.js
│   │   ├── shared-fechas.js
│   │   └── shared-mensajes.js
│   │
│   ├── data/
│   │   ├── data-proyectos.js
│   │   ├── data-avances.js
│   │   ├── data-finanzas.js
│   │   ├── data-tareas.js
│   │   └── data-archivos.js
│   │
│   ├── servicios/
│   │   ├── srv-proyectos.js
│   │   ├── srv-finanzas.js
│   │   ├── srv-avance.js
│   │   ├── srv-semaforo.js
│   │   ├── srv-prioridad.js
│   │   ├── srv-archivos.js
│   │   └── srv-ia.js
│   │
│   ├── ia/
│   │   ├── ia-analista.js
│   │   ├── ia-financiera.js
│   │   ├── ia-estratega.js
│   │   ├── ia-dura.js
│   │   ├── ia-prompts.js
│   │   └── ia-normalizador.js
│   │
│   ├── pantallas/
│   │   │
│   │   ├── 01-inicio/
│   │   │   ├── ini-main.js
│   │   │   ├── ini.css
│   │   │   ├── ini-top3.js
│   │   │   ├── ini-tarjetas.js
│   │   │   └── ini-eventos.js
│   │   │
│   │   ├── 02-proyectos/
│   │   │   ├── pry-main.js
│   │   │   ├── pry.css
│   │   │   ├── pry-lista.js
│   │   │   ├── pry-formulario.js
│   │   │   └── pry-eventos.js
│   │   │
│   │   ├── 03-detalle-proyecto/
│   │   │   ├── det-main.js
│   │   │   ├── det.css
│   │   │   ├── det-resumen.js
│   │   │   ├── det-diagnostico.js
│   │   │   ├── det-tareas.js
│   │   │   ├── det-finanzas.js
│   │   │   └── det-eventos.js
│   │   │
│   │   ├── 04-registro-diario/
│   │   │   ├── reg-main.js
│   │   │   ├── reg.css
│   │   │   ├── reg-texto-libre.js
│   │   │   ├── reg-cronometro.js
│   │   │   ├── reg-manual.js
│   │   │   └── reg-eventos.js
│   │   │
│   │   ├── 05-finanzas/
│   │   │   ├── fin-main.js
│   │   │   ├── fin.css
│   │   │   ├── fin-ingresos.js
│   │   │   ├── fin-gastos.js
│   │   │   ├── fin-equilibrio.js
│   │   │   └── fin-graficos.js
│   │   │
│   │   ├── 06-archivos/
│   │   │   ├── arc-main.js
│   │   │   ├── arc.css
│   │   │   ├── arc-subir.js
│   │   │   ├── arc-lector.js
│   │   │   └── arc-analisis.js
│   │   │
│   │   ├── 07-ia-diagnostico/
│   │   │   ├── iad-main.js
│   │   │   ├── iad.css
│   │   │   ├── iad-resumen.js
│   │   │   ├── iad-recomendaciones.js
│   │   │   └── iad-alertas.js
│   │   │
│   │   ├── 08-reportes/
│   │   │   ├── rep-main.js
│   │   │   ├── rep.css
│   │   │   ├── rep-rentabilidad.js
│   │   │   ├── rep-horas.js
│   │   │   ├── rep-avance.js
│   │   │   └── rep-exportar.js
│   │   │
│   │   └── 09-configuracion/
│   │       ├── cfg-main.js
│   │       ├── cfg.css
│   │       ├── cfg-ia.js
│   │       ├── cfg-datos.js
│   │       └── cfg-preferencias.js
│   │
│   └── estilos/
│       ├── global.css
│       ├── layout.css
│       ├── botones.css
│       ├── tarjetas.css
│       └── variables.css
│
├── assets/
│   ├── iconos/
│   ├── imagenes/
│   └── ejemplos/
│
└── tests/
    ├── test-proyectos.md
    ├── test-finanzas.md
    ├── test-ia.md
    └── test-pantallas.md
```

---

# Estructura mínima para iniciar

Para la primera versión no se crearán todos los archivos de golpe.

Se iniciará con esta estructura mínima:

```text
Proyectos/
│
├── README.md
├── REGLAS_DESARROLLO.md
├── package.json
├── .gitignore
│
├── docs/
│   ├── 01-plan-bloques.md
│   ├── 02-estructura-proyecto.md
│   ├── 03-mvp.md
│   ├── 04-pantallas.md
│   └── 05-modelo-datos.md
│
└── src/
    ├── app/
    │   ├── app-inicio.js
    │   ├── app-router.js
    │   └── app-state.js
    │
    ├── shared/
    │   ├── shared-dom.js
    │   ├── shared-storage.js
    │   └── shared-mensajes.js
    │
    ├── servicios/
    │   ├── srv-proyectos.js
    │   ├── srv-finanzas.js
    │   ├── srv-semaforo.js
    │   └── srv-prioridad.js
    │
    ├── ia/
    │   ├── ia-prompts.js
    │   ├── ia-analista.js
    │   └── ia-financiera.js
    │
    ├── pantallas/
    │   ├── 01-inicio/
    │   │   ├── ini-main.js
    │   │   ├── ini.css
    │   │   ├── ini-tarjetas.js
    │   │   └── ini-top3.js
    │   │
    │   ├── 02-proyectos/
    │   │   ├── pry-main.js
    │   │   ├── pry.css
    │   │   ├── pry-formulario.js
    │   │   └── pry-lista.js
    │   │
    │   └── 03-detalle-proyecto/
    │       ├── det-main.js
    │       ├── det.css
    │       ├── det-resumen.js
    │       ├── det-diagnostico.js
    │       └── det-finanzas.js
    │
    └── estilos/
        ├── global.css
        ├── variables.css
        └── layout.css
```

---

# Prefijos aprobados

```text
ini  -> Inicio / Proyectos
pry  -> Crear y editar proyectos
det  -> Detalle del proyecto
reg  -> Registro diario
fin  -> Finanzas
arc  -> Archivos
iad  -> IA / Diagnóstico
rep  -> Reportes
cfg  -> Configuración
```

---

# Criterio principal

La estructura debe ayudar a que cualquier error se encuentre rápido.

Por eso se evitarán nombres genéricos como:

```text
main.js
style.css
script.js
helpers.js
funciones.js
```

Y se usarán nombres claros como:

```text
ini-tarjetas.js
det-finanzas.js
srv-semaforo.js
ia-financiera.js
fin-equilibrio.js
```
