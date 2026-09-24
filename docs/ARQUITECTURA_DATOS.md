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


## Bloque 3 · Motor de datos Excel/CSV

La importación de datos se separa en cuatro capas:

```text
Excel/CSV original
  → perfil de hojas y columnas
  → mapeo canónico confirmado
  → consultas determinísticas
  → agregado seguro para IA
```

### Cálculo completo

El límite de filas existe únicamente para la **visualización** de resultados en la interfaz. Los cálculos de porcentajes, promedios, medianas, sumas, grupos y filtros se ejecutan sobre **todas las filas filtradas**.

Una consulta puede devolver, por ejemplo:

```text
total = 6001
returnedRows = 5000
truncated = true
```

sin que el resumen estadístico quede truncado. `summarize()` utiliza las 6001 filas.

### Mapeo canónico

Cada archivo puede mapear sus columnas reales a nombres estables que consumen los motores documentales:

```json
{
  "fields": {
    "student_id": "Cédula",
    "student_name": "Estudiante",
    "career": "Carrera",
    "campus": "Sede",
    "core": "Núcleo",
    "component": "Componente",
    "grade": "Nota"
  }
}
```

También se admiten mapeos específicos por hoja. El sistema puede **sugerir** equivalencias comunes, pero nunca las aplica automáticamente.

Si una consulta solicita un campo inexistente o no mapeado, la aplicación falla de forma explícita. No devuelve silenciosamente un conjunto vacío.

### Filtros

Las consultas admiten, entre otros:

- igualdad normalizada sin depender de mayúsculas o tildes;
- distinto;
- contiene;
- inicia/termina con;
- listas `in / not_in`;
- comparaciones numéricas;
- rangos;
- condiciones AND mediante `where`;
- condiciones OR mediante `anyOf`;
- selección de hojas o importaciones;
- alcance del expediente;
- eliminación opcional de duplicados mediante `distinctBy`.

Esto permite filtrar, por ejemplo:

```text
Carrera = Enfermería
Componente = Teórico
Núcleo = Núcleo 1
```

antes de entregar el resultado a la IA.

### Alcances

Un archivo puede pertenecer a:

- todo el expediente;
- una población;
- un segmento;
- un estudiante;
- otro alcance declarado por el motor.

La política `inclusive` permite que un documento específico consuma tanto datos generales del expediente como datos cargados exactamente para su ámbito.

### Prevención de duplicados

Si se intenta volver a importar el mismo archivo, con el mismo SHA-256 y el mismo alcance, la aplicación reutiliza la importación existente. Esto evita duplicar accidentalmente registros y alterar los resultados.

Archivos distintos pueden coexistir en el mismo expediente. Si contienen registros superpuestos, el motor documental puede declarar `distinctBy` con la clave apropiada, por ejemplo `student_id`.

### Agregados

El motor puede calcular:

- distribuciones y porcentajes por dimensión;
- mínimo;
- máximo;
- suma;
- promedio;
- mediana;
- agrupaciones por una o varias dimensiones;
- estadísticas numéricas dentro de cada grupo.

Estos resultados se calculan localmente antes de invocar IA.

### Privacidad y contrato con IA

Por defecto, la IA recibe **agregados**, no filas individuales.

El paquete enviado a IA contiene:

- filtros aplicados;
- firma de consulta;
- porcentajes;
- métricas numéricas;
- agrupaciones;
- trazabilidad de fuentes;
- umbral de privacidad.

Los conteos absolutos no se exponen por defecto. Los grupos menores al umbral configurado se suprimen.

Las filas crudas solo pueden salir cuando:

1. el motor las solicita explícitamente;
2. el modo es individual / por estudiante o se autoriza explícitamente;
3. existe una lista `select` de campos permitidos.

### Trazabilidad

Cada resultado conserva:

- ID de importación;
- nombre del archivo;
- SHA-256 del archivo;
- hash del mapeo utilizado;
- hoja;
- primera y última fila fuente involucrada;
- firma SHA-256 de la consulta.

La firma cambia si cambia el archivo, el mapeo o la consulta.

### Consultas como parte del motor

Las reglas de filtrado declaradas en `section.data.query` forman parte de la definición versionada del motor.

Por tanto, cambiar un filtro como:

```text
Enfermería + Teórico
```

por:

```text
Enfermería + Núcleo 1
```

modifica el hash del motor y activa el ciclo de migración/revisión correspondiente. Las consultas no quedan como lógica invisible fuera del motor.

### Adaptadores futuros

El motor está preparado para uno o varios Excel/CSV sin asumir todavía una estructura definitiva. Cuando se proporcionen los archivos reales de Complexivo, PVC, Formación, Capacitación, etc., se configurarán sus mapeos/adaptadores específicos sobre esta capa sin modificar el núcleo de cálculo.


## Bloque 4 · APA 7 y referencias

La bibliografía deja de tratarse como una cadena genérica y pasa a ser un sistema tipado por fuente.

### Tipos admitidos

El registro APA distingue:

- documento institucional;
- artículo científico;
- libro;
- capítulo de libro;
- tesis / trabajo académico;
- página web;
- informe;
- ley / norma legal;
- reglamento;
- resolución;
- política institucional;
- manual / guía;
- norma técnica;
- ponencia / congreso;
- conjunto de datos.

Cada tipo valida sus campos obligatorios antes de considerarse completo. Por ejemplo, un artículo exige autores y revista; una tesis exige institución y tipo de tesis; una página web exige URL; una resolución exige organismo emisor e identificador.

### Autores

Los autores personales pueden registrarse como:

```text
Pérez, J.; Gómez, A.; Ruiz, C.
```

Las citas parentéticas se transforman según APA:

```text
(Pérez, 2026)
(Pérez & Gómez, 2026)
(Pérez et al., 2026)
```

Los autores institucionales se mantienen como autor corporativo.

### DOI y URL

Los DOI se normalizan a:

```text
https://doi.org/...
```

La salida bibliográfica usa el DOI cuando existe y, en su defecto, la URL.

### Obras del mismo autor y año

Cuando el documento utiliza más de una obra del mismo autor o institución y año, el motor asigna sufijos determinísticos:

```text
2026a
2026b
2026c
```

Los mismos sufijos aparecen en las citas del cuerpo y en la bibliografía.

### Referencias realmente utilizadas

La sección Referencias ya no lista todas las fuentes cargadas en el expediente.

El flujo es:

```text
tokens [[CITE:...]] usados
  → resolver metadatos
  → validar APA
  → deduplicar obras equivalentes
  → ordenar bibliografía
  → renderizar solo referencias citadas
```

El escaneo incluye párrafos, listas, notas, tablas y otros bloques estructurados.

Dos claves distintas que apuntan a la misma obra —por DOI, URL, fuente o identidad bibliográfica— producen una sola entrada en Referencias.

### Integridad de la versión final

Al aprobar una versión final se congela también:

- claves de cita usadas;
- metadatos bibliográficos;
- referencias deduplicadas y ordenadas.

Por ello, editar posteriormente una referencia viva del expediente no modifica una final ya aprobada.

Las finales históricas creadas antes de este mecanismo conservan compatibilidad mediante un fallback identificado en auditoría.

### Fuentes retiradas

Si una fuente institucional se desactiva, su cita viva también se desactiva. Un borrador que todavía contenga su token quedará con una cita pendiente.

Una final congelada no se afecta porque conserva su snapshot bibliográfico.

### Render APA

Las referencias se generan con estructura específica por tipo de fuente y conservan elementos tipográficos como cursivas en títulos de obras, revistas y volúmenes donde corresponde.

La sección Referencias mantiene:

- doble espacio;
- sangría francesa;
- orden bibliográfico;
- cursivas semánticas;
- DOI/URL normalizado.

### Control de Word

Los scripts PowerShell usados para DOCX/PDF ahora se validan sintácticamente en CI antes de ejecutar el smoke test. Esto evita que un cambio de maquetación deje scripts de Word cortados o duplicados sin ser detectado.


## Bloque 1 nuevo · Independencia real de motores

La estructura documental ya no se construye desde perfiles genéricos compartidos como `report`, `planning` o `detection`.

Cada `engineId` tiene un **blueprint explícito propio**. Actualmente existen 33 motores y 33 blueprints registrados.

Ejemplo conceptual:

```text
tit.regular.informe-final
  → blueprint propio

tit.pvc.informe-final
  → blueprint propio
```

Aunque ambos puedan empezar hoy con una secuencia equivalente, ninguna de las dos secuencias depende de la otra.

### Biblioteca vs. blueprint

Existe una biblioteca de piezas reutilizables como:

```text
INTRODUCCION
BASE_LEGAL
METODOLOGIA
RESULTADOS
...
```

La biblioteca define una pieza base; **no define qué documento la usa ni en qué orden**.

La composición pertenece exclusivamente al blueprint de cada motor.

Si un documento necesita una variante particular de una pieza, su blueprint puede declarar una definición u override propio. No se debe modificar una pieza global para resolver una necesidad específica de un solo documento.

### Propiedad de definición

Cada motor y cada sección materializada registra:

```text
definitionOwner = engineId
definitionSource = engine_blueprint
independentDefinition = true
```

Esto permite verificar programáticamente quién es dueño de la estructura.

### Registro inmutable

El registro interno de motores queda congelado.

`getEngine()`, `allEngines()` y `enginesForDocument()` entregan copias profundas. Por tanto:

```text
mutar la copia de Regulares
≠
mutar el registro
≠
mutar PVC
```

También `blueprintForEngine()` entrega una copia y nunca la definición interna.

### Sin fallback genérico

Un motor sin blueprint explícito provoca error al cargar el registro.

No existe:

```text
si falta definición → usar report
```

Esta regla evita que un documento nuevo o mal configurado herede silenciosamente la estructura de otro.

### Compatibilidad histórica

El campo `profile` se conserva temporalmente como metadato de compatibilidad para no alterar innecesariamente los hashes de instancias existentes.

Ya no participa en la creación de `sections`.

La fuente estructural real es:

```text
ENGINE_BLUEPRINTS[engineId]
```

### Regla para la siguiente fase

Cuando se definan puntos y subpuntos documento por documento, cada cambio se hará únicamente en el blueprint del motor correspondiente.

Por ejemplo, agregar una sección a:

```text
tit.regular.informe-final
```

no modifica:

```text
tit.pvc.informe-final
form.informe
cap.informe-final
...
```


## Bloque 2 nuevo · Estructura propia por documento

Cada motor dispone de un árbol documental propio compilado y validado antes de crear instancias.

La estructura admite profundidad arbitraria:

```text
1. Sección
  1.1 Subpunto
    1.1.1 Sub-subpunto
      1.1.1.1 Nivel adicional
```

La numeración visible sigue siendo calculada por el motor editorial. Las `key` permanecen estables aunque se inserten o reordenen puntos.

### Estado de la estructura

Mientras no se haya definido con el usuario el detalle institucional completo de un documento, el motor se identifica como:

```text
outlineStatus = scaffold
```

Esto significa **estructura base funcional**, no estructura institucional definitiva.

Cuando el árbol de un documento sea confirmado punto por punto podrá pasar a:

```text
outlineStatus = confirmed
```

El estado es visible en la interfaz para no confundir una estructura provisional con una ya aprobada.

### Contrato por nodo

Cualquier punto o subpunto puede declarar un contrato propio:

```json
{
  "purpose": "Qué debe lograr esta sección",
  "contentMode": "analysis_ai",
  "sourcePolicy": "resultados_y_fuentes_institucionales",
  "evidenceRequired": true,
  "visualPolicy": "recommended",
  "dataNeeds": ["career", "core"],
  "promptInstructions": [
    "Interpretar los datos, no recalcularlos."
  ]
}
```

El contrato forma parte del esquema versionado cuando está definido. Cambiarlo activa el ciclo normal de migración/revisión de esa sección.

La IA escritora y la IA revisora reciben este contrato automáticamente.

### Validación previa

El compilador rechaza antes de crear la instancia:

- `key` duplicadas;
- secciones sin clave o título;
- dependencias `derivedFrom` hacia puntos inexistentes;
- dependencias circulares;
- `maxWords` inválido;
- herramientas visuales no registradas;
- contratos con tipos o políticas inválidas.

Así, una estructura incorrecta no llega silenciosamente a producción.

### Detección de Necesidades

Los motores:

```text
cap.deteccion
form.deteccion
```

incluyen formalmente:

```text
Resultados
→ Análisis de resultados
→ Necesidades priorizadas
```

`Análisis de resultados` permite, cuando aporten al caso:

- Ishikawa;
- FODA;
- CAME;
- árbol de problemas;
- árbol de objetivos;
- matriz de impacto;
- análisis de brechas;
- stakeholders;
- flujo de procesos;
- PESTEL;
- gráficos y tarjetas.

No se obliga a utilizar todas las herramientas. El contrato indica que deben seleccionarse solo las que ayuden al análisis.

### Dependencias corregidas

Las conclusiones de documentos de planificación ya no dependen de `RESULTADOS` o `ANALISIS_RESULTADOS`, porque esos puntos no existen en dichos documentos. Ahora derivan de:

```text
PLANIFICACION
CRONOGRAMA
SEGUIMIENTO
```

Los documentos curriculares utilizan sus propias dependencias:

```text
ANALISIS_CURRICULAR
ACUERDOS
→ CONCLUSIONES
→ RECOMENDACIONES
```

El compilador verifica que estas relaciones existan dentro del mismo motor.

### Carga futura de puntos reales

Al recibir la estructura real de cada documento se modifica únicamente su blueprint.

No es necesario cambiar:

- el motor editorial;
- la base de datos;
- APA 7;
- Excel/CSV;
- el orquestador de IA;
- otros motores documentales.

Por tanto, la siguiente configuración puede hacerse documento por documento sin volver a rediseñar la aplicación.
