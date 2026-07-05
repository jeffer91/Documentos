# Documentos

App Electron para generar documentos institucionales ITSQMET.

Bloque 1:
- Base de Electron.
- Pantalla inicial.
- Selector de tipo de documento.
- Vista previa lógica de portada.
- Firmantes institucionales configurados.

Bloque 2:
- Dependencia docx agregada.
- Generador de portada Word creado.
- Botón de la pantalla conectado con Electron.
- Guardado de archivo .docx mediante ventana de guardar.

Bloque 3:
- Reglas documentales separadas por tipo de documento.
- Fecha automática en la portada.
- Mejor proporción de tabla superior, título central y firmas.
- Control temporal para impedir PDF hasta activar exportación.

Bloque 4:
- Generador PDF agregado.
- Selector Word/PDF conectado.
- Guardado con extensión .docx o .pdf según selección.
- PDF generado desde una ventana oculta de Electron.

Bloque 5:
- Pantalla visual mejorada con estilos internos.
- Campo editable de fecha de portada.
- Campo editable de total de páginas.
- Word y PDF usan el total de páginas indicado.

Bloque 6:
- Historial local de documentos generados.
- Lista visual de últimos documentos.
- Botón para actualizar historial.
- Botón para abrir archivos generados.

Bloque 7:
- Ajustes locales de unidad y sigla por defecto.
- Ajustes locales de los tres firmantes.
- Botón para guardar ajustes.
- Las nuevas portadas usan automáticamente los datos guardados.

Bloque 8:
- Validaciones antes de generar portada.
- Diagnóstico del proyecto con npm run check.
- Archivo .gitignore agregado.
- Versión del proyecto actualizada.

Para ejecutar:
npm install
npm start

Para revisar diagnóstico:
npm run check

Nota: ya se puede generar Word y PDF desde el selector inicial, con fecha, páginas editables, historial local, ajustes guardados y validaciones básicas.
