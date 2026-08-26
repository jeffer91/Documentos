# Documentos ITSQMET

Aplicación Electron local para generar documentación institucional de **UTET** y **UGPA** a partir de plantillas Word.

## Flujo principal

La plantilla manda:

```text
Word con marcadores
        ↓
La app detecta los campos
        ↓
Pide solo lo necesario
        ↓
Completa campos de IA
        ↓
Inserta datos, tablas, gráficos e imágenes
        ↓
PDF final
```

La plantilla se carga una sola vez y queda asociada al documento. Cuando se vuelve a crear ese documento, la app genera automáticamente su formulario usando los marcadores detectados.

## Catálogo

- 2 unidades.
- 19 procesos.
- 59 documentos.
- El catálogo solo define dónde está cada documento.
- Los campos y la estructura de captura ya no están programados en el catálogo.

## Marcadores Word

Todos los marcadores usan llaves dobles.

### Datos escritos por el usuario

```text
{{CAMPO:PERIODO|Período}}
{{TEXTO:OBJETIVO|Objetivo}}
{{FECHA:FECHA_INICIO|Fecha de inicio}}
{{NUMERO:TOTAL|Total}}
```

Un campo obligatorio lleva `!`:

```text
{{CAMPO!:PERIODO|Período}}
```

También se admite el formato corto `{{PERIODO}}`, que se interpreta como un campo de texto.

### Campos automáticos

```text
{{SISTEMA:UNIDAD}}
{{SISTEMA:PROCESO}}
{{SISTEMA:CODIGO}}
{{SISTEMA:FECHA_ACTUAL}}
{{SISTEMA:ELABORADO_POR}}
{{SISTEMA:REVISADO_POR}}
{{SISTEMA:APROBADO_POR}}
```

Estos campos no aparecen en el formulario.

### IA

```text
{{IA:INTRODUCCION|Introducción}}
{{IA:BASE_LEGAL|Base legal}}
{{IA:ANALISIS_RESULTADOS|Análisis de resultados}}
{{IA:RESUMEN_EJECUTIVO|Resumen ejecutivo}}
{{IA:CONCLUSIONES|Conclusiones}}
{{IA:RECOMENDACIONES|Recomendaciones}}
```

Los campos IA tampoco se muestran para escribir manualmente. Se generan usando los datos ingresados y las fuentes adjuntas. La base legal tiene una regla específica: no puede inventar normas o artículos.

### Excel / CSV

```text
{{DATOS:RESULTADOS|Resultados}}
```

La app muestra un botón para subir Excel o CSV. Los datos se analizan y pueden insertarse como tablas.

### Tabla editable

```text
{{TABLA:CRONOGRAMA|Cronograma|Actividad,Responsable,Fecha}}
```

La app crea una tabla editable con esas columnas.

### Imágenes

```text
{{IMAGEN:FIRMA|Firma}}
{{IMAGENES:EVIDENCIAS|Evidencias}}
```

### Gráficos

```text
{{GRAFICO:RESULTADOS|Resultados}}
{{GRAFICOS:RESULTADOS|Resultados}}
```

Los gráficos se generan únicamente a partir de datos numéricos reales.

## Regla para tablas, gráficos e imágenes

Los marcadores de bloques deben estar solos en su propio párrafo de Word. Ejemplo:

```text
EVIDENCIAS

{{IMAGENES:EVIDENCIAS|Evidencias}}
```

## Plantillas

Al importar una plantilla la app intenta identificar automáticamente:

- unidad;
- proceso;
- documento.

Si no está segura, la plantilla queda como **Sin asignar** y se puede asociar desde la pantalla Plantillas.

Cuando se sube una nueva plantilla para el mismo documento, la anterior se conserva como versión histórica y la nueva queda activa.

## Salida

La salida principal es siempre:

```text
PDF
```

La app conserva un Word generado únicamente como respaldo editable.

Para conservar exactamente el formato del Word y poder insertar tablas, gráficos e imágenes, en Windows la app usa **Microsoft Word** para completar la plantilla y exportarla a PDF. Para plantillas que solo contienen texto, también puede usar LibreOffice como conversor de respaldo.

## Datos locales

Plantillas, borradores, fuentes, evidencias y resultados se guardan dentro de la carpeta local `userData` de Electron.

En esta versión no existe conexión con Firebase, SISACAD ni SharePoint.

## Ejecutar

```bash
npm install
npm start
```

## Diagnóstico

```bash
npm run check
```

El diagnóstico valida estructura, sintaxis, catálogo y parser de marcadores.
