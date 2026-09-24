# Arquitectura de datos

## Decisión

La aplicación trabaja con un modelo **local-first**:

1. SQLite es la fuente local de verdad.
2. Word es la plantilla.
3. PDF es el resultado principal.
4. Los archivos pesados permanecen en disco.
5. La base externa se añadirá después mediante sincronización.

## SQLite · esquema v6

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


## Limpieza de IA interna

Desde la versión 2.8.1 la generación funciona exclusivamente con IA externa. La migración de esquema v6 normaliza los modos históricos a `external` y elimina la antigua tabla de proveedores internos, incluida cualquier credencial que hubiera quedado almacenada allí.


# Arquitectura v3 · Períodos, expedientes y motores

## Capas

La arquitectura v3 no elimina `projects → project_fields`; la mantiene para compatibilidad con las plantillas existentes. Añade una capa superior:

```text
periods_v3
  └── dossiers_v3
       ├── dossier_segments_v3
       ├── master_data_v3
       ├── data_imports_v3 → data_sheets_v3
       ├── knowledge_sources_v3
       └── document_instances_v3
            ├── document_sections_v3
            └── ai_jobs_v3
```

La auditoría se guarda en `audit_events_v3`.

## Período

Representa el marco temporal. Los datos de un período nunca se mezclan automáticamente con otro.

## Expediente

Un expediente representa un proceso dentro de un período. Ejemplos:

- Formación docente.
- Capacitación docente.
- Titulación · Regulares.
- Titulación · PVC.
- Construcción Curricular Continua.
- Plan individual.

PVC y Regulares tienen expedientes separados.

## Datos maestros

`master_data_v3` contiene información que varios documentos reutilizan, como carreras, sedes, responsables, reglas o cronogramas. Cada modificación incrementa su revisión y conserva el valor anterior en `master_data_history_v3`.

Un cambio de dato maestro marca los borradores relacionados como desactualizados. Las versiones finales congeladas no se modifican.

## Cardinalidad

Cada motor declara su cardinalidad:

- `period`
- `period_population`
- `period_segment`
- `student`
- `career`
- `career_level`
- `career_session`
- `activity`
- `person`

Esto permite convivir, por ejemplo, con un cronograma de Superiores y otro de Universitarios en el mismo período, o con un reporte de antiplagio por estudiante.

## Motores independientes

`document-engine-registry.cjs` define cada motor con:

- documento asociado;
- versión;
- familia;
- población;
- cardinalidad;
- dependencias;
- reglas;
- puntos y subpuntos/secciones.

Compartir datos no implica compartir reglas de construcción.

## Secciones

Cada sección tiene estado independiente:

- `pending`
- `generated`
- `reviewed`
- `edited`
- `approved`

Una sección aprobada queda bloqueada frente a regeneraciones automáticas. La edición humana prevalece.

## Dependencias

Los motores declaran dependencias. Cuando cambia una sección de un documento fuente o se aprueba una nueva versión final, solo los documentos dependientes no congelados quedan marcados como desactualizados.

## Importación universal

`data-ingestion-service.cjs` acepta Excel/CSV sin exigir todavía una plantilla de columnas. Conserva el archivo original y SHA-256, detecta hojas, columnas, tipos y filas y permite consultas determinísticas.

Los cálculos y filtros se ejecutan en la aplicación; la IA recibe únicamente un subconjunto preparado.

## Privacidad

Los resúmenes enviados a IA:

- omiten conteos absolutos por defecto;
- priorizan porcentajes;
- suprimen grupos menores al umbral de privacidad;
- no incluyen filas individuales salvo que un motor lo solicite explícitamente.

## Fuentes institucionales

`knowledge-source-service.cjs` conserva fuentes institucionales por expediente. Base Legal y Alineación Institucional recuperan contexto desde estas fuentes antes de redactar.

## IA

`ai-provider-service.cjs` admite:

- OpenAI-compatible;
- Anthropic.

Las claves se cifran con `safeStorage` de Electron o pueden leerse desde variables de entorno.

`ai-orchestrator.cjs`:

1. elige una IA redactora;
2. intenta una alternativa si falla;
3. genera una sección;
4. ejecuta revisión;
5. incorpora correcciones y alertas;
6. guarda trazabilidad;
7. continúa con la siguiente sección.

Una sola IA puede actuar como redactora y revisora. IAs adicionales pueden funcionar como revisores.

## Versiones finales

Al aprobar una versión final se guarda un snapshot con:

- versión del motor;
- ámbito;
- datos maestros;
- secciones;
- trazabilidad;
- fecha.

Los cambios posteriores no alteran el snapshot final.

## Exportaciones

`draft-export-service.cjs` genera borradores por sección, selección o documento completo. Los borradores incluyen alertas. La versión final no las muestra.

En Windows se utiliza Microsoft Word mediante PowerShell para producir DOCX/PDF. Si Word no está disponible, HTML queda como salida segura y LibreOffice puede actuar como conversor cuando esté instalado.

## Reutilización entre períodos

Un expediente puede copiar su estructura y datos maestros al período siguiente. Los valores copiados quedan marcados como heredados y no verificados para evitar que información histórica se tome automáticamente como vigente.


# Arquitectura v4 · Motor editorial

## Extensión compatible del esquema

V4 conserva las tablas v3 y amplía `document_sections_v3` con:

- `parent_key`
- `section_level`
- `sort_path`
- `numbering`
- `page_break_before`
- `keep_with_next`
- `layout_json`

Los bloques estructurados se almacenan en:

```text
document_instances_v3
  └── document_sections_v3
       └── document_blocks_v4
```

Una migración aditiva crea las columnas faltantes sin eliminar información histórica.

## Bloques editoriales

`document_blocks_v4` admite texto, listas, tablas, figuras, imágenes, herramientas visuales, citas destacadas, llamados y listas de referencias.

Una edición humana de bloques conserva tablas y visuales ya generados; la aplicación mantiene el texto plano de la sección sincronizado para compatibilidad.

## Validación editorial

Antes de congelar una versión final se valida:

1. integridad de la jerarquía;
2. secciones obligatorias;
3. tablas con título/datos;
4. contexto previo a tablas/figuras/visuales;
5. análisis posterior;
6. herramientas visuales permitidas por motor;
7. citas APA usadas y metadatos completos;
8. alertas bloqueantes.

## Visuales

`visual-renderer-service.cjs` recibe datos estructurados y produce SVG/PNG con renderers versionados. La IA no dibuja libremente.

## APA 7 y Word

`apa7-service.cjs` compone HTML estructurado. `export-draft.ps1` postprocesa Word para aplicar:

- márgenes de una pulgada;
- Arial 11;
- doble espacio;
- controles `KeepWithNext`, `KeepTogether` y `WidowControl`;
- `PageBreakBefore` en encabezados de primer nivel;
- sangría francesa en referencias;
- formato ligero de tablas;
- control de tamaño y alineación de figuras.

El uso de propiedades de párrafo evita insertar saltos manuales que puedan crear páginas vacías.

## Citas

`citation-service.cjs` vincula fuentes del expediente con metadatos bibliográficos. Los textos generados pueden referenciar únicamente claves disponibles mediante:

```text
[[CITE:clave]]
```

El renderer sustituye el token por la cita en texto y construye la lista de referencias. Las claves inexistentes o incompletas impiden aprobar una versión final.


## Ciclo de vida de motores y migraciones

Los borradores documentales ya no sobrescriben silenciosamente su estructura cuando cambia un motor.

Cada instancia conserva:

- versión del motor aplicada;
- hash determinístico de la definición del motor;
- revisión de migración;
- fecha de la última migración;
- secciones activas y secciones archivadas.

Al abrir, generar o exportar un borrador, la aplicación compara la definición guardada con el motor vigente. La migración se ejecuta de forma transaccional:

1. agrega secciones nuevas;
2. actualiza metadatos estructurales de secciones existentes sin borrar su contenido;
3. reactiva una sección archivada si vuelve a existir;
4. archiva las secciones retiradas del motor en lugar de eliminarlas;
5. actualiza la versión y el hash del motor;
6. marca el borrador para revisión cuando el cambio puede afectar contenido;
7. registra el antes/después y las acciones en `engine_migrations_v4` y en la auditoría.

Las secciones archivadas mantienen su contenido y sus bloques, pero quedan fuera del documento activo, de la generación IA y de la exportación.

### Versiones finales

Una instancia con `final_frozen_at` nunca se migra automáticamente. Si el motor evoluciona, la final se identifica como versión histórica y conserva su estructura, versión y snapshot originales.

Para continuar trabajando desde una final histórica se crea una nueva copia de trabajo basada en el motor vigente. Solo se copian automáticamente las secciones que siguen existiendo; las secciones antiguas permanecen preservadas en la versión final de origen.

### Detección de cambios

El hash del motor contempla estructura, reglas, cardinalidad, población, dependencias y configuración relevante. Por ello, un cambio estructural puede detectarse aunque accidentalmente no se haya incrementado el número de versión.


## Reglas jerárquicas y de paginación

La estructura documental usa claves estables por sección y numeración calculada por árbol:

```text
1
1.1
1.1.1
1.1.1.1
...
```

Reglas obligatorias:

- cada sección y subpunto debe tener una `key` única y estable;
- solo las secciones de nivel 1 usan salto de página automático;
- los niveles 2 o superiores continúan en la página disponible;
- todo título usa `keepWithNext` para evitar títulos huérfanos;
- la relación padre/hijo debe respetar niveles consecutivos;
- la numeración y la ruta de orden se derivan del árbol, no se escriben manualmente;
- los niveles profundos conservan numeración aunque visualmente reutilicen el estilo editorial de nivel profundo.

Las tablas, figuras, imágenes y herramientas visuales usadas en el cuerpo del documento deben estar precedidas por contexto y seguidas por análisis o interpretación. Los anexos quedan exceptuados de esta obligación narrativa.

En Word se aplican controles de viudas/huérfanas, repetición del encabezado de tablas, filas no partidas y reglas para mantener juntos el número, título y objeto de tablas/figuras. No se insertan saltos de página manuales entre subniveles.
