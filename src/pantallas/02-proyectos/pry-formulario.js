/* =========================================================
Nombre completo: pry-formulario.js
Ruta o ubicación: src/pantallas/02-proyectos/pry-formulario.js
Función o funciones:
- Renderizar el formulario para crear proyectos.
- Mantener campos básicos del proyecto en una vista clara.
- Preparar datos para guardarlos desde pry-eventos.js.
Con qué se conecta:
- pry-main.js
- pry-eventos.js
- shared-validaciones.js
========================================================= */

import {
  ESTADOS_PROYECTO_PERMITIDOS,
  TIPOS_PROYECTO_PERMITIDOS
} from "../../shared/shared-validaciones.js";

export function renderizarPryFormulario(){
  return `
    <form id="pry-form-proyecto" class="pry-form" autocomplete="off">
      <div class="pry-form-grid">
        <label class="pry-campo">
          <span>Nombre del proyecto</span>
          <input
            id="pry-input-nombre"
            name="nombre"
            type="text"
            placeholder="Ejemplo: App de proyectos IA"
            required
          />
        </label>

        <label class="pry-campo">
          <span>Tipo de proyecto</span>
          <select id="pry-input-tipo" name="tipo" required>
            ${TIPOS_PROYECTO_PERMITIDOS.map(function(tipo){
              return `<option value="${tipo}">${tipo}</option>`;
            }).join("")}
          </select>
        </label>

        <label class="pry-campo">
          <span>Estado</span>
          <select id="pry-input-estado" name="estado" required>
            ${ESTADOS_PROYECTO_PERMITIDOS.map(function(estado){
              return `<option value="${estado}">${estado}</option>`;
            }).join("")}
          </select>
        </label>

        <label class="pry-campo">
          <span>Objetivo económico</span>
          <input
            id="pry-input-objetivo"
            name="objetivoEconomico"
            type="number"
            min="0"
            step="1"
            placeholder="Ejemplo: 500"
          />
        </label>
      </div>

      <label class="pry-campo">
        <span>Descripción corta</span>
        <textarea
          id="pry-input-descripcion"
          name="descripcion"
          rows="3"
          placeholder="Explica en pocas palabras de qué trata este proyecto."
        ></textarea>
      </label>

      <label class="pry-campo">
        <span>MVP o versión mínima</span>
        <textarea
          id="pry-input-mvp"
          name="mvp"
          rows="3"
          placeholder="¿Cuál sería la versión más pequeña que puede generar valor o dinero?"
        ></textarea>
      </label>

      <label class="pry-campo">
        <span>Siguiente acción</span>
        <input
          id="pry-input-siguiente-accion"
          name="siguienteAccion"
          type="text"
          placeholder="Ejemplo: terminar la pantalla principal"
        />
      </label>

      <div id="pry-form-mensaje" class="pry-form-mensaje" aria-live="polite"></div>

      <div class="pry-form-acciones">
        <button class="app-btn app-btn-primario" type="submit">
          Crear proyecto
        </button>
        <button class="app-btn app-btn-secundario" type="reset">
          Limpiar
        </button>
      </div>
    </form>
  `;
}
