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


## Arquitectura documental v3.0.0

La app incorpora una capa de procesos por encima de los proyectos tradicionales:

```text
Período
  ↓
Expediente / proceso
  ↓
Datos maestros + fuentes institucionales + Excel/CSV
  ↓
Motor independiente del documento
  ↓
Secciones y subsecciones
  ↓
IA automática por bloques
  ↓
Revisión automática
  ↓
Borrador con alertas
  ↓
Versión final congelada y limpia
```

### Principios

- Los datos se comparten; los motores documentales no.
- Cada versión final es una fotografía inmutable de sus datos y fuentes.
- Los cambios en datos o documentos fuente marcan como desactualizados los documentos dependientes.
- Una sola IA puede redactar y revisar. Si existen varias, pueden actuar como revisores y respaldo.
- La app filtra y calcula antes de enviar contexto a la IA.
- Los resultados institucionales priorizan porcentajes y protegen grupos pequeños.
- Regulares y PVC son flujos separados, con motores independientes para sus informes finales.
- Los documentos pueden ser uno por período, población, segmento, carrera, nivel, actividad, persona o estudiante.

### Catálogo activo

La interfaz v3 muestra 32 tipos documentales seleccionados. El informe final de titulación tiene dos motores independientes:

- Informe Final del Proceso de Titulación · Regulares.
- Informe Final del Proceso de Titulación · PVC.

Por esta razón existen 33 motores activos para 32 tipos documentales.

### Excel y CSV

El importador v3 no fija todavía un formato institucional único. Puede recibir uno o varios Excel/CSV, conserva el original, registra SHA-256, perfila hojas y columnas y almacena una copia normalizada. Los adaptadores específicos de Complexivo, PVC, Formación, Capacitación u otros pueden definirse después sin cambiar el núcleo.

### Fuentes institucionales

Cada expediente puede incorporar reglamentos, manuales, políticas, normativa u otras fuentes. Se conserva:

- archivo original;
- SHA-256;
- texto extraído;
- fecha de incorporación;
- etiquetas;
- trazabilidad de uso.

Base Legal y Alineación Institucional pueden recuperar fragmentos pertinentes de estas fuentes.

### Generación automática

El apartado **Procesos** permite crear períodos y expedientes, cargar datos, configurar IAs y ejecutar motores por documento. Los documentos largos se procesan sección por sección; las secciones ya revisadas se conservan y la generación puede reanudarse después de un fallo.

### Borrador y final

El borrador puede exportarse por:

- sección;
- conjunto de secciones;
- documento completo.

Las alertas aparecen en el borrador. La versión final se congela y se exporta sin alertas visibles, manteniendo internamente la trazabilidad.
