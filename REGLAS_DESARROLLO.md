# REGLAS DE DESARROLLO DE LA APP

Este archivo define las reglas obligatorias para desarrollar, corregir, dividir y mantener la app **Proyectos IA**.

Estas reglas deben respetarse en todos los archivos nuevos y en todas las correcciones futuras.

---

## 1. Regla de nombres únicos

Dos archivos no pueden tener el mismo nombre dentro del proyecto.

Ejemplo incorrecto:

```text
src/pantallas/01-inicio/main.js
src/pantallas/02-proyectos/main.js
```

Ejemplo correcto:

```text
src/pantallas/01-inicio/ini-main.js
src/pantallas/02-proyectos/pry-main.js
```

Cada archivo debe tener un nombre único y relacionado con su pantalla o función.

---

## 2. Regla de prefijo por pantalla

Cada pantalla debe tener un prefijo propio.

Ejemplo:

```text
01-inicio             -> ini
02-proyectos          -> pry
03-detalle-proyecto   -> det
04-registro-diario    -> reg
05-finanzas           -> fin
06-archivos           -> arc
07-ia-diagnostico     -> iad
08-reportes           -> rep
09-configuracion      -> cfg
```

Todos los archivos de esa pantalla deben iniciar con ese prefijo.

Ejemplo correcto:

```text
ini-main.js
ini.css
ini-tarjetas.js
ini-top3.js
ini-eventos.js
```

Ejemplo incorrecto:

```text
main.js
styles.css
script.js
helpers.js
```

---

## 3. Regla de no hacer crecer demasiado ningún archivo

Ningún archivo del proyecto debe crecer demasiado.

Si un archivo tiene más de 700 líneas de código, se debe dividir en uno o más archivos nuevos.

La división debe hacerse por funciones o responsabilidades.

Ejemplo correcto:

```text
det-main.js            -> Conecta la pantalla Detalle del Proyecto.
det-resumen.js         -> Muestra datos generales del proyecto.
det-diagnostico.js     -> Muestra diagnóstico de IA.
det-finanzas.js        -> Muestra ingresos, gastos y utilidad.
det-tareas.js          -> Maneja tareas del proyecto.
```

Ejemplo incorrecto:

```text
det-main.js -> Tiene resumen, diagnóstico, finanzas, tareas, eventos, cálculos, gráficos y validaciones.
```

---

## 4. Regla de modularidad por pantalla

Cada pantalla debe tener su propia carpeta.

Ejemplo:

```text
src/pantallas/03-detalle-proyecto/
  det-main.js
  det.css
  det-resumen.js
  det-diagnostico.js
  det-finanzas.js
  det-tareas.js
  det-eventos.js
```

La lógica de una pantalla no debe estar mezclada con la lógica de otra pantalla.

---

## 5. Regla de una función principal por archivo

Cada archivo debe tener una responsabilidad clara.

Ejemplo correcto:

```text
srv-semaforo.js       -> Calcula el semáforo del proyecto.
srv-prioridad.js      -> Calcula prioridad y Top 3.
srv-finanzas.js       -> Calcula utilidad, dinero por hora y punto de equilibrio.
ia-analista.js        -> Genera diagnóstico general del proyecto.
ia-financiera.js      -> Analiza dinero, gastos y rentabilidad.
```

Ejemplo incorrecto:

```text
servicios.js -> Tiene semáforo, prioridad, finanzas, IA, archivos y almacenamiento.
```

---

## 6. Regla de encabezado obligatorio en cada archivo

Todo archivo completo debe iniciar con un encabezado en comentario.

Ejemplo para JavaScript:

```js
/* =========================================================
Nombre completo: srv-semaforo.js
Ruta o ubicación: src/servicios/srv-semaforo.js
Función o funciones:
- Calcular el semáforo de cada proyecto.
- Evaluar avance, dinero, horas, riesgo, potencial y claridad del MVP.
- Devolver estado verde, amarillo o rojo.
Con qué se conecta:
- srv-prioridad.js
- data-proyectos.js
- ini-tarjetas.js
========================================================= */
```

Ejemplo para CSS:

```css
/* =========================================================
Nombre completo: ini.css
Ruta o ubicación: src/pantallas/01-inicio/ini.css
Función o funciones:
- Definir el diseño visual de la pantalla Inicio.
- Estilizar tarjetas de proyectos.
- Estilizar el bloque Top 3.
Con qué se conecta:
- ini-main.js
- index.html
========================================================= */
```

---

## 7. Regla de pantallas independientes

Cada pantalla debe poder entenderse por separado.

Una pantalla no debe depender directamente de archivos internos de otra pantalla.

Ejemplo incorrecto:

```js
import "../01-inicio/ini-tarjetas.js";
```

Ejemplo correcto:

```js
import "../../shared/shared-dom.js";
import "../../servicios/srv-proyectos.js";
```

Si varias pantallas necesitan una misma función, esa función debe ir en una carpeta global, compartida o de servicios.

---

## 8. Regla de carpeta compartida solo para funciones compartidas

La carpeta `shared` solo debe tener funciones usadas por varias pantallas.

Ejemplo:

```text
src/shared/
  shared-dom.js
  shared-fechas.js
  shared-formatos.js
  shared-mensajes.js
  shared-storage.js
  shared-validaciones.js
```

No se debe poner dentro de `shared` una función que solo usa una pantalla.

---

## 9. Regla de nombres claros

Los nombres de archivos, funciones, variables y clases deben ser claros.

Ejemplo correcto:

```js
calcularDineroPorHora()
mostrarTarjetaProyecto()
guardarProyectoActualizado()
obtenerTop3ProyectosDelDia()
```

Ejemplo incorrecto:

```js
hacerCosa()
procesar()
data1()
x()
```

---

## 10. Regla de no duplicar código

Si una función se repite en varios archivos, debe moverse a un archivo compartido o de servicio.

Ejemplo:

```text
src/shared/shared-formatos.js
src/servicios/srv-finanzas.js
```

Esto evita errores y hace más fácil mantener la app.

---

## 11. Regla de estado centralizado

Cada pantalla debe tener un estado claro.

Ejemplo:

```js
const detState = {
  proyectoId: null,
  proyecto: null,
  cargando: false,
  editando: false
};
```

No se deben crear variables sueltas por todos los archivos si pertenecen a la misma pantalla.

---

## 12. Regla de botones y acciones

Los botones deben tener una acción clara.

Cada botón debe:

- Tener un texto entendible.
- Estar conectado a una función específica.
- Mostrar cuando está cargando.
- Bloquearse si la acción todavía no se puede ejecutar.

Ejemplo:

```text
Crear proyecto
Guardar cambios
Registrar avance
Agregar ingreso
Agregar gasto
Analizar con IA
```

---

## 13. Regla de mensajes claros para el usuario

La app debe mostrar mensajes simples y entendibles.

Ejemplo correcto:

```text
Proyecto creado correctamente.
Registra al menos un nombre para continuar.
No se pudo guardar el avance. Intenta nuevamente.
```

Ejemplo incorrecto:

```text
Error undefined.
Falló proceso interno.
NaN.
```

---

## 14. Regla de no mostrar mensajes técnicos al usuario final

Los errores técnicos deben quedar en consola, diagnóstico o log.

El usuario debe ver un mensaje simple.

Ejemplo:

```js
console.error("Error técnico:", error);
mostrarMensaje("No se pudo guardar el proyecto. Intenta nuevamente.");
```

---

## 15. Regla de diseño limpio

Cada pantalla debe tener un diseño claro, ordenado y fácil de usar.

Se debe evitar:

- Demasiados botones juntos.
- Doble scroll innecesario.
- Popups innecesarios.
- Textos largos sin orden.
- Pantallas cargadas visualmente.

---

## 16. Regla de reemplazo de pantalla cuando sea más lógico

Si una acción cambia completamente el flujo, puede reemplazar el contenido de la pantalla en lugar de abrir un popup.

Ejemplo:

Cuando el usuario crea un proyecto, la pantalla puede cambiar de:

```text
Lista de proyectos
```

a:

```text
Detalle del proyecto creado
```

Esto es mejor que abrir ventanas emergentes innecesarias.

---

## 17. Regla de carga rápida

Cada pantalla debe cargar lo más rápido posible.

Se debe evitar:

- Cargar todos los procesos al inicio.
- Analizar archivos pesados antes de que el usuario los seleccione.
- Ejecutar funciones innecesarias al abrir la pantalla.
- Consultar IA si el usuario no lo pidió o si no hay datos suficientes.

La carga debe hacerse solo cuando sea necesaria.

---

## 18. Regla de validación antes de avanzar

Antes de pasar a la siguiente pantalla o proceso, la app debe validar que exista la información necesaria.

Ejemplo:

```text
No se puede calcular dinero por hora si no existen horas registradas.
No se puede calcular utilidad si no existen ingresos o gastos.
No se puede generar diagnóstico si el proyecto no tiene descripción ni objetivo.
```

---

## 19. Regla de conservar datos originales

La app no debe destruir ni sobrescribir información original importante.

Cuando se actualice un proyecto, debe conservarse historial de avances, cambios importantes y registros financieros.

---

## 20. Regla de guardado claro

Cuando el usuario guarde información, debe saber exactamente qué está guardando.

Ejemplo correcto:

```text
Guardar proyecto
Guardar avance diario
Guardar ingreso
Guardar gasto
Guardar diagnóstico
```

Ejemplo incorrecto:

```text
Guardar
Aceptar
Procesar
```

---

## 21. Regla de pruebas por pantalla

Cada pantalla debe probarse antes de avanzar a la siguiente.

Checklist mínimo:

```text
- Abre correctamente.
- No muestra errores en consola.
- Los botones funcionan.
- No se rompe al volver.
- No se duplican eventos.
- No se pierden datos guardados.
- No aparecen mensajes innecesarios.
```

---

## 22. Regla de no duplicar eventos

No se deben registrar varias veces los mismos eventos.

Ejemplo incorrecto:

```js
boton.addEventListener("click", guardarProyecto);
boton.addEventListener("click", guardarProyecto);
```

Esto puede causar que una acción se ejecute dos o más veces.

---

## 23. Regla de limpieza visual por pantalla

Cada pantalla debe limpiar sus mensajes temporales cuando ya no sean necesarios.

Ejemplo:

```text
Cargando...
Analizando...
Guardando...
```

Estos mensajes no deben quedarse pegados si el proceso ya terminó.

---

## 24. Regla de compatibilidad con Electron y navegador

La app debe poder iniciar de forma simple.

Si se usa Electron, el acceso al sistema de archivos debe hacerse mediante funciones permitidas por Electron.

Si se usa navegador, el almacenamiento local debe estar controlado y respaldable.

---

## 25. Regla de seguridad básica

No se debe ejecutar código peligroso ni abrir rutas externas sin validación.

Se debe validar:

- Archivos seleccionados.
- Extensiones permitidas.
- Tamaño de archivos.
- Datos antes de guardarlos.
- Errores de lectura o escritura.

---

## 26. Regla de resumen al final de cada bloque de trabajo

Cuando se entreguen varios archivos, al final se debe indicar el avance.

Ejemplo:

```text
Archivos creados en este bloque:
1. ini-main.js
2. ini.css
3. ini-tarjetas.js

Avance de pantalla Inicio:
3 / 5 archivos entregados
```

---

## 27. Regla de trabajo por bloques

Cuando una pantalla tenga muchos archivos, se debe trabajar por bloques.

Ejemplo:

```text
Bloque 1: estructura principal
Bloque 2: datos y almacenamiento
Bloque 3: pantalla Inicio
Bloque 4: formulario de proyectos
Bloque 5: detalle del proyecto
```

Esto evita errores y permite revisar mejor cada parte.

---

## 28. Regla de no mezclar estilos

Cada pantalla debe tener su propio archivo CSS.

Ejemplo:

```text
ini.css
pry.css
det.css
fin.css
```

Los estilos globales solo deben ir en archivos globales si afectan a toda la app.

---

## 29. Regla de IDs únicos en HTML

Los IDs usados en HTML deben ser únicos.

Ejemplo correcto:

```html
<button id="ini-btn-crear-proyecto">Crear proyecto</button>
<button id="det-btn-registrar-avance">Registrar avance</button>
```

Ejemplo incorrecto:

```html
<button id="btnGuardar">Guardar</button>
<button id="btnGuardar">Guardar otro</button>
```

---

## 30. Regla de clases CSS con prefijo

Las clases CSS de cada pantalla deben iniciar con el prefijo de la pantalla.

Ejemplo correcto:

```css
.ini-panel {}
.ini-proyecto-card {}
.ini-btn-primary {}
```

Ejemplo incorrecto:

```css
.panel {}
.card {}
.btn {}
```

---

## 31. Regla de diagnóstico sin molestar al usuario

La app puede tener diagnóstico técnico, pero no debe aparecer encima de la pantalla normal si el usuario no lo necesita.

El diagnóstico debe estar en consola, archivo de log o pantalla específica.

---

## 32. Regla de navegación clara

Cada pantalla debe tener claro cómo avanzar, volver o guardar.

No debe existir una pantalla donde el usuario no sepa qué hacer.

---

## 33. Regla de errores recuperables

Si algo falla, la app no debe quedarse bloqueada.

Debe permitir:

- Volver a intentar.
- Corregir datos.
- Cancelar el proceso.
- Volver a la pantalla anterior.

---

## 34. Regla de compatibilidad visual

La app debe verse bien en pantallas normales de laptop o escritorio.

No debe depender de tamaños exactos.

Se debe usar diseño flexible cuando sea posible.

---

## 35. Regla de gráficos claros

Los gráficos deben ayudar a tomar decisiones.

Los gráficos principales serán:

```text
Avance
Dinero
Horas
Prioridad
```

No se deben agregar gráficos decorativos que no ayuden a decidir.

---

## 36. Regla de aprobación antes de avanzar

Cuando una pantalla o función quede bien, debe marcarse como aprobada antes de pasar a la siguiente.

No se debe cambiar una parte aprobada sin razón clara.

---

## 37. Regla de estructura fácil de revisar

El proyecto debe estar organizado para que cualquier pantalla se pueda revisar rápidamente.

Ejemplo correcto:

```text
src/pantallas/01-inicio/
  ini-main.js
  ini.css
  ini-tarjetas.js
  ini-top3.js
  ini-eventos.js
```

Ejemplo incorrecto:

```text
src/pantallas/01-inicio/
  main.js
  funciones.js
  cosas.js
  prueba.js
  nuevo.js
```

---

## 38. Regla de enfoque económico

Toda función importante debe ayudar directa o indirectamente a responder:

```text
¿Cómo me acerca este proyecto a ganar dinero?
```

Si una función no ayuda a decidir, medir, priorizar o avanzar, debe revisarse antes de incluirla.

---

## 39. Regla de IA útil y accionable

La IA no debe dar textos largos sin acción.

Toda respuesta de IA debe intentar entregar:

```text
Qué va bien
Qué va mal
Qué hacer ahora
Qué mejorar
Qué evitar
```

---

## 40. Regla de IA fuerte pero clara

La IA puede ser directa cuando un proyecto no conviene, pero debe explicar la razón.

Ejemplo correcto:

```text
Este proyecto tiene bajo avance y no tiene un modelo claro de ingreso. Antes de seguir agregando funciones, define cómo va a generar dinero.
```

Ejemplo incorrecto:

```text
Este proyecto está mal.
```

---

# Resumen de reglas principales

Las reglas más importantes son:

```text
1. No repetir nombres de archivos.
2. Usar prefijo por pantalla.
3. No hacer crecer demasiado ningún archivo.
4. Si un archivo pasa de 700 líneas, dividirlo por funciones.
5. Separar funciones por archivos.
6. Entregar archivos completos.
7. Mantener encabezado obligatorio.
8. Validar antes de avanzar.
9. Evitar doble scroll y popups innecesarios.
10. Probar pantalla por pantalla.
11. Mantener enfoque económico.
12. Hacer que la IA entregue acciones concretas.
```
