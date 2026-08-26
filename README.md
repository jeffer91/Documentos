# Documentos ITSQMET

Aplicación Electron local para organizar, analizar y generar documentación institucional de **UTET** y **UGPA**.

## Versión 2.0

La app deja de ser un generador de portadas y pasa a ser un gestor documental por **Unidad → Proceso → Documento**.

Incluye:

- 2 unidades: UTET y UGPA.
- 19 procesos institucionales.
- 59 documentos organizados por proceso.
- Pantalla específica para cada documento, con pocos campos y estructura propia.
- Borradores guardados localmente.
- Carga local de Word, PDF, Excel, CSV e imágenes.
- Biblioteca de plantillas Word `.docx`.
- Detección de marcadores `{{CAMPO}}` dentro de las plantillas.
- Análisis de Word, PDF y hojas de cálculo.
- Tablas y propuestas de gráficos a partir de Excel/CSV.
- Evidencias fotográficas insertadas en el Word completo.
- Generación Word institucional completa.
- Generación adicional de una copia de la plantilla cargada cuando tiene marcadores.
- Trazabilidad de fuentes.
- Proveedores de IA configurables y ordenados por prioridad.
- Fallback automático si una IA falla.
- Modo profundo que consulta varias IAs y consolida el análisis mejor puntuado.
- Modo local seguro cuando no existe ninguna API configurada.
- Claves de IA cifradas con `safeStorage` de Electron cuando el sistema lo permite.

## Marcadores Word

Una plantilla puede incluir campos como:

```text
{{PERIODO}}
{{FECHA}}
{{UNIDAD}}
{{PROCESO}}
{{CODIGO}}
{{TITULO}}
{{OBJETIVO}}
{{METODOLOGIA}}
{{RESULTADOS}}
{{RESUMEN_EJECUTIVO}}
{{CONCLUSIONES}}
{{RECOMENDACIONES}}
```

La app detecta estos marcadores al importar la plantilla y genera una copia llenada. El documento completo generado por la app puede incluir además tablas, gráficos y evidencias.

## Datos locales

Los borradores, plantillas, fuentes y archivos generados se guardan dentro de la carpeta `userData` de Electron. No se conecta a Firebase, SISACAD ni SharePoint en esta versión.

## Ejecutar

```bash
npm install
npm start
```

## Diagnóstico

```bash
npm run check
```

El diagnóstico verifica archivos principales, sintaxis, IDs del catálogo y que existan exactamente 2 unidades, 19 procesos y 59 documentos.
