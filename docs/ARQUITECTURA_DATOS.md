# Arquitectura de datos

## Decisión

La aplicación trabaja con un modelo **local-first**:

1. SQLite es la fuente local de verdad.
2. Word es la plantilla.
3. PDF es el resultado principal.
4. Los archivos pesados permanecen en disco.
5. La base externa se añadirá después mediante sincronización.

## SQLite

Archivo:

```text
documentos-workspace/documentos.db
```

Se usa modo WAL, claves foráneas y tiempo de espera para evitar bloqueos breves.

### Catálogo

`units → processes → documents`

### Plantillas

`templates → template_fields`

Una plantilla puede tener varias versiones. Solo una versión queda activa por documento.

### Trabajo documental

`projects → project_fields`

Cada documento en elaboración es un proyecto. Los valores de los marcadores se guardan por campo.

### Archivos

`projects → files`

La tabla registra metadatos y rutas. Los binarios permanecen en:

- `sources/`
- `data/`
- `evidence/`
- `generated/`

### Redacción externa y análisis local

`projects → ai_analyses`

La app no llama a proveedores de IA internos durante la generación. Esta tabla conserva el contenido estructurado importado desde IA externa y el análisis determinístico local de archivos, tablas y gráficos.

### Versiones documentales como información

`projects → document_versions`

Cada generación exitosa crea un snapshot informativo en SQLite. No se crea un PDF/Word histórico por cada versión.

El snapshot conserva campos, análisis, plantilla utilizada, código, versión documental, referencias de archivos y fecha.

### Salida física actual

`projects → generations`

`generations` mantiene únicamente la salida física actual (PDF y Word de respaldo). Al generar nuevamente, se reemplaza la salida física y se conserva el historial en `document_versions`.

### Errores

`app_errors`

Registra errores técnicos y funcionales para el visualizador **Sistema**.

## Base externa pendiente

Las tablas `external_sync_config` y `sync_queue` reservan el contrato de sincronización.

Mientras no exista una base externa:

```text
enabled = false
state = pending_external_database
```

Cuando se defina el backend externo:

1. Configurar proveedor y endpoint.
2. Realizar subida inicial completa de entidades locales.
3. Marcar la fecha de sincronización.
4. Activar cola incremental.
5. Resolver conflictos por entidad y versión/fecha.

No se debe reemplazar SQLite. La base externa será una capa de sincronización sobre el modelo local.


## Almacén de objetos

Las fuentes, datos y evidencias que forman parte de una versión se preservan por contenido mediante SHA-256.

```text
documentos-workspace/
├── documentos.db
├── objects/sha256/
├── templates/
└── projects/
```

`document_versions.files_json` conserva la huella y metadatos. El archivo físico histórico se mantiene una sola vez en `objects/sha256/`.

Esto permite reconstruir versiones anteriores sin duplicar PDFs o Word generados.

## Salida actual segura

La generación usa una carpeta de staging. Solo después de producir correctamente Word/PDF se sustituye `generated/current/`. Un error de generación no elimina el último resultado válido.


## Motor de campos calculados

Los marcadores `CALC` se resuelven de forma determinística antes de ejecutar IA.

El motor puede usar:

- campos escalares;
- otros campos calculados;
- columnas de tablas manuales;
- columnas de Excel/CSV asociadas a un marcador `DATOS`.

No se utiliza `eval()`. El parser admite un conjunto controlado de funciones y operadores y detecta referencias inválidas, división para cero y dependencias circulares.

Los valores calculados se guardan en `project_fields`, por lo que también forman parte de los snapshots de `document_versions`.

## Requisitos de plantilla

Cada plantilla se interpreta como un conjunto completo de requisitos, no solo como campos de formulario. La app distingue datos directos, redacción externa, sistema, cálculos, tablas, archivos, evidencias y gráficos. Para cada marcador puede mostrar el literal `{{...}}`, su estado, su ubicación general en Word y el número de apariciones.

## Protocolo de IA externa

El protocolo vigente es `ITSQMET-DOCUMENTO-V2`. Permite importar campos/redacciones y tablas. Los valores `SYS`, `CALC`, archivos `DATOS`, evidencias y gráficos permanecen bajo control local.
