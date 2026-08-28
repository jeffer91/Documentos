# Documentos ITSQMET

Aplicación Electron local para generar documentación institucional de **UTET** y **UGPA** a partir de plantillas Word y entregar el resultado principal en PDF.

## Flujo principal

```text
Plantilla Word
      ↓
Marcadores {{...}}
      ↓
Mapa de requisitos
      ↓
Datos / evidencias + IA externa
      ↓
Validación + CALC + SYS
      ↓
Word completado
      ↓
PDF final
```

## Datos: arquitectura v2.8.1

La app utiliza **SQLite como base local principal**.

La base se crea en:

```text
Electron userData/
└── documentos-workspace/
    └── documentos.db
```

Los archivos grandes no se guardan dentro de SQLite. Se mantienen en carpetas y la base registra su ruta y metadatos.

```text
documentos-workspace/
├── documentos.db
├── templates/
└── projects/
    └── <project-id>/
        ├── sources/
        ├── data/
        ├── evidence/
        └── generated/
```

### Tablas principales

- `units`
- `processes`
- `documents`
- `templates`
- `template_fields`
- `projects`
- `project_fields`
- `files`
- `ai_analyses`
- `generations`
- `settings`

### Preparación para base externa

La subida a una base externa **queda pendiente**. La arquitectura ya incluye:

- `external_sync_config`
- `sync_queue`

La sincronización está desactivada por defecto. Cuando se defina la base externa, se podrá añadir un adaptador de sincronización sin cambiar la interfaz ni el modelo local.

El primer enlace externo deberá realizar una **sincronización inicial completa** de SQLite y luego utilizar la cola de cambios para sincronización incremental.

## Migración

Si existe información de versiones anteriores basada en JSON, la app la migra automáticamente a SQLite en el primer arranque y conserva los archivos anteriores como respaldo.

## Catálogo

- 2 unidades
- 19 procesos
- 59 documentos

El catálogo se siembra también en SQLite al iniciar la aplicación.

## Marcadores Word

### Datos manuales

```text
{{CAMPO:PERIODO|Período}}
{{TEXTO:OBJETIVO|Objetivo}}
{{FECHA:FECHA_INICIO|Fecha de inicio}}
{{NUMERO:TOTAL|Total}}
```

Campo obligatorio:

```text
{{CAMPO!:PERIODO|Período}}
```

### Sistema

```text
{{SISTEMA:UNIDAD}}
{{SISTEMA:PROCESO}}
{{SISTEMA:CODIGO}}
{{SISTEMA:FECHA_ACTUAL}}
{{SISTEMA:ELABORADO_POR}}
{{SISTEMA:REVISADO_POR}}
{{SISTEMA:APROBADO_POR}}
```

### Redacción mediante IA externa

```text
{{IA:INTRODUCCION|Introducción}}
{{IA:BASE_LEGAL|Base legal}}
{{IA:ANALISIS_RESULTADOS|Análisis de resultados}}
{{IA:RESUMEN_EJECUTIVO|Resumen ejecutivo}}
{{IA:CONCLUSIONES|Conclusiones}}
{{IA:RECOMENDACIONES|Recomendaciones}}
```

### Datos, tablas, imágenes y gráficos

```text
{{DATOS:RESULTADOS|Resultados}}
{{TABLA:CRONOGRAMA|Cronograma|Actividad,Responsable,Fecha}}
{{IMAGEN:FIRMA|Firma}}
{{IMAGENES:EVIDENCIAS|Evidencias}}
{{GRAFICO:RESULTADOS|Resultados}}
{{GRAFICOS:RESULTADOS|Resultados}}
```

Los marcadores de tablas, imágenes y gráficos deben estar solos en su propio párrafo de Word.

## Salida

La salida principal es siempre **PDF**. La app conserva además el Word completado como respaldo editable.

En Windows, Microsoft Word es el motor principal para conservar el formato institucional y exportar a PDF. LibreOffice puede actuar como respaldo en plantillas simples.

## Ejecutar

```bash
npm install
npm start
```

## Diagnóstico

```bash
npm run check
```


## Versiones de información

La app no conserva una copia física distinta del PDF/Word por cada generación.

Cada vez que se genera un documento se guarda en SQLite una versión de información con:

- campos ingresados;
- análisis de IA;
- plantilla y versión de plantilla;
- código y versión documental;
- metadatos de fuentes, datos y evidencias;
- proveedor/mode de IA;
- fecha de generación.

Los archivos físicos generados se mantienen únicamente como salida actual en:

```text
projects/<project-id>/generated/current/
```

El historial vive en la tabla `document_versions` y puede cargarse nuevamente como borrador desde la app.

## Visualizador de errores

La navegación incluye **Sistema**.

La app registra errores de:

- proceso principal de Electron;
- interfaz;
- generación PDF;
- plantillas;
- archivos;
- análisis;
- respaldo/restauración.

Los registros viven en SQLite (`app_errors`) y pueden marcarse como resueltos desde la interfaz.

## Inicio en Electron

```bash
npm install
npm start
```

`npm start` ejecuta `electron .` y abre la aplicación de escritorio.


## Almacén histórico por huella

Las versiones guardan información en SQLite y referencian archivos por su huella SHA-256.

Los archivos necesarios para reconstruir una versión se conservan una sola vez en:

```text
documentos-workspace/
└── objects/
    └── sha256/
        └── <prefijo>/
            └── <hash>
```

Al restaurar una versión, la app recupera sus fuentes, datos y evidencias desde este almacén sin guardar un PDF histórico por cada versión.

## Generación segura

El PDF nuevo se crea primero en una carpeta temporal. La salida `generated/current/` solo se reemplaza cuando Word/PDF terminó correctamente. Si la nueva generación falla, el último PDF válido permanece disponible.

## Instalación reproducible

El repositorio incluye `package-lock.json`.

```bash
npm ci
npm start
```

`npm start` continúa siendo el comando normal para abrir la app en Electron.


## Campos calculados y alias

La app distingue el **tipo** del campo y su **origen**. Además de campos manuales, soporta `LISTA`, `BUSCAR` y `CALC`.

Ejemplo:

```text
{{NUM:APROBADOS|Aprobados}}
{{NUM:REPROBADOS|Reprobados}}
{{CAL:TOTAL|Total|SUM(APROBADOS,REPROBADOS)}}
{{CAL:APROBACION|% aprobación|PERCENT(APROBADOS,TOTAL)}}
{{AI:ANALISIS|Análisis}}
```

La app no llama a una IA interna. Los marcadores `IA/AI` representan campos de redacción que se completan mediante el flujo de IA externa. Los cálculos siguen siendo determinísticos y nunca se delegan a la IA.

La referencia completa de tipos y alias está en `docs/ALIAS_CAMPOS.md`.


## Requisitos de plantilla

Al abrir un documento, la app muestra un mapa de todos los marcadores únicos de la plantilla, incluyendo el marcador literal, su origen, estado, ubicación general en Word y número de apariciones.

Ejemplo:

```text
{{SYS:CODIGO}}
Ubicación: Encabezado
Fuente: Catálogo + número de documento

{{DAT!:BASE_DIAGNOSTICO|Base consolidada}}
Fuente: Excel / CSV

{{AI:CONCLUSIONES|Conclusiones}}
Fuente: IA externa
```

Los marcadores obligatorios y las dependencias necesarias bloquean la generación hasta quedar resueltos.

## IA externa · protocolo V2

La app genera un único prompt para ChatGPT, Claude, Gemini u otra IA externa. La respuesta se importa usando:

```text
//FORMATO:ITSQMET-DOCUMENTO-V2//
```

El protocolo admite campos/redacciones y tablas estructuradas. `SYS`, `CALC`, archivos `DATOS`, imágenes y gráficos permanecen bajo control de la aplicación.

Las respuestas antiguas `ITSQMET-CAMPOS-V1` se pueden leer por compatibilidad, pero las tablas requieren V2.
