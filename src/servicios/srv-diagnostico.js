/* =========================================================
Nombre completo: srv-diagnostico.js
Ruta o ubicación: src/servicios/srv-diagnostico.js
Función o funciones:
- Crear un diagnóstico técnico simple de la app.
- Revisar almacenamiento local, datos mínimos y estado de módulos principales.
- Entregar resultados claros sin mostrar errores técnicos al usuario final.
Con qué se conecta:
- shared-storage.js
- srv-proyectos.js
- srv-finanzas.js
- srv-avances.js
- srv-archivos.js
- cfg-diagnostico.js
========================================================= */

import { almacenamientoDisponible } from "../shared/shared-storage.js";
import { obtenerProyectos } from "./srv-proyectos.js";
import { obtenerFinanzas } from "./srv-finanzas.js";
import { obtenerAvances } from "./srv-avances.js";
import { obtenerArchivos } from "./srv-archivos.js";

export function crearDiagnosticoTecnico(){
  const proyectos = obtenerProyectos();
  const finanzas = obtenerFinanzas();
  const avances = obtenerAvances();
  const archivos = obtenerArchivos();

  const revisiones = [
    crearRevision("Almacenamiento local", almacenamientoDisponible(), "El navegador permite guardar datos locales."),
    crearRevision("Proyectos", Array.isArray(proyectos), `${proyectos.length} proyectos cargados.`),
    crearRevision("Finanzas", Array.isArray(finanzas.ingresos) && Array.isArray(finanzas.gastos), `${finanzas.ingresos.length} ingresos y ${finanzas.gastos.length} gastos.`),
    crearRevision("Avances", Array.isArray(avances), `${avances.length} avances registrados.`),
    crearRevision("Documentos", Array.isArray(archivos), `${archivos.length} registros documentales.`),
    crearRevision("Módulos principales", true, "Inicio, Proyectos, Detalle, Registro, Finanzas, Documentos, IA, Reportes y Configuración preparados.")
  ];

  return {
    generadoEn: new Date().toISOString(),
    estadoGeneral: revisiones.every(function(item){ return item.ok; }) ? "Correcto" : "Revisar",
    revisiones
  };
}

function crearRevision(nombre, ok, detalle){
  return {
    nombre,
    ok: Boolean(ok),
    detalle,
    estado: ok ? "Correcto" : "Revisar"
  };
}
