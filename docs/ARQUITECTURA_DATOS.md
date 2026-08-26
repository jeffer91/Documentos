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

### IA

`projects → ai_analyses`

Se conserva historial de análisis, proveedor y contenido estructurado.

### Generaciones

`projects → generations`

Cada generación tiene versión, código, ruta PDF, ruta DOCX, motor y fecha.

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
