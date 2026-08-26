# Documentos ITSQMET

Aplicación Electron local para generar documentación institucional de **UTET** y **UGPA** a partir de plantillas Word y entregar el resultado principal en PDF.

## Flujo principal

```text
Plantilla Word
      ↓
Marcadores {{...}}
      ↓
Formulario automático
      ↓
IA / datos / evidencias
      ↓
Word completado
      ↓
PDF final
```

## Datos: arquitectura v2.2

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
- `ai_providers`

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

### IA

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
