# Alias de campos Word

Esta guía define los tipos de campo que la app entiende y sus alias cortos. Se puede usar el nombre completo o el alias dentro de `{{...}}`.

| Tipo completo | Alias | Uso |
|---|---|---|
| `CAMPO` | `CAM` | Texto corto ingresado por el usuario |
| `TEXTO` | `TXT` | Texto largo |
| `FECHA` | `FEC` | Fecha |
| `NUMERO` | `NUM` | Número |
| `LISTA` | `LST` | Selección entre opciones |
| `CALC` | `CAL` | Valor calculado a partir de otros campos/datos |
| `BUSCAR` | `BUS` | Valor asociado a una fuente de búsqueda |
| `SISTEMA` | `SYS` | Valor automático del sistema |
| `IA` | `AI` | Texto generado por IA |
| `DATOS` | `DAT` | Excel/CSV |
| `TABLA` | `TAB` | Tabla manual editable |
| `IMAGEN` | `IMG` | Una imagen |
| `IMAGENES` | `IMGS` | Varias imágenes |
| `GRAFICO` | `GRA` | Un gráfico |
| `GRAFICOS` | `GRAS` | Varios gráficos |

## Estructura general

```text
{{TIPO:NOMBRE|Etiqueta|Configuración}}
```

El signo `!` vuelve obligatorio el campo:

```text
{{NUM!:APROBADOS|Aprobados}}
```

## Ejemplos directos

```text
{{CAM:PERIODO|Período}}
{{TXT:OBJETIVO|Objetivo}}
{{FEC:FECHA_INICIO|Fecha de inicio}}
{{NUM:APROBADOS|Aprobados}}
{{LST:MODALIDAD|Modalidad|Presencial,En línea,Híbrida}}
{{BUS:DOCENTE|Docente responsable|DOCENTES}}
```

`BUSCAR` ya conserva el alias/fuente indicada. Mientras no exista el adaptador de base externa, la interfaz permite escribir el valor; después podrá convertirse en búsqueda/selección automática sin cambiar la plantilla.

## Tablas con tipos de columna

```text
{{TAB:CRONOGRAMA|Cronograma|Actividad:TEXTO,Responsable:CAMPO,Fecha:FECHA,Cumplimiento:NUMERO}}
```

Si no se indica tipo, la columna se trata como `CAMPO`.

## Campos calculados

```text
{{CAL:TOTAL|Total|SUM(APROBADOS,REPROBADOS,RETIRADOS)}}
{{CAL:APROBACION|% aprobación|PERCENT(APROBADOS,TOTAL)}}
{{CAL:ESTADO|Estado|IF(APROBACION>=80,"Cumplido","No cumplido")}}
```

También se puede calcular desde una tabla manual:

```text
{{CAL:TOTAL_PLANIFICADO|Total planificado|SUM(ACTIVIDADES.Planificado)}}
```

O desde un Excel/CSV asociado a `DATOS:RESULTADOS`:

```text
{{CAL:TOTAL_EVALUADOS|Total evaluados|SUM(RESULTADOS.Evaluados)}}
{{CAL:TOTAL_APROBADOS|Total aprobados|SUM(RESULTADOS.Aprobados)}}
```

Si un Excel tiene varias hojas, se puede indicar la hoja:

```text
{{CAL:TOTAL|Total|SUM(RESULTADOS.Hoja1.Evaluados)}}
```

## Funciones permitidas

```text
SUM()
AVG()
MIN()
MAX()
COUNT()
ROUND()
PERCENT()
ABS()
IF()
```

Operadores permitidos:

```text
+  -  *  /
>  <  >=  <=  =  ==  !=
```

La app no usa `eval()`. Las fórmulas se procesan con un motor controlado.

## Regla de cálculo

```text
Datos directos
      ↓
Tablas / Excel
      ↓
CALC
      ↓
Gráficos
      ↓
IA interpreta
      ↓
Word
      ↓
PDF
```

La IA no debe recalcular cifras determinísticas. Los resultados de `CALC` se incorporan a los datos que recibe la IA.

## Errores bloqueantes

La app bloquea la generación cuando detecta, entre otros:

- referencia a un campo inexistente;
- división para cero;
- fórmula inválida;
- dependencia circular entre campos calculados;
- valor no numérico utilizado en una operación matemática.

Los errores se registran también en **Sistema**.
