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

Para ejecutar:
npm install
npm start

Nota: ya se puede generar Word y PDF desde el selector inicial.
