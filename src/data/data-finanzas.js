/* =========================================================
Nombre completo: data-finanzas.js
Ruta o ubicación: src/data/data-finanzas.js
Función o funciones:
- Definir la estructura de ingresos y gastos.
- Crear registros financieros base.
- Preparar datos para cálculos de utilidad y dinero por hora.
Con qué se conecta:
- srv-proyectos.js
- shared-fechas.js
- futuras pantallas de finanzas
========================================================= */

import { obtenerFechaCortaActual } from "../shared/shared-fechas.js";
import { normalizarNumero, normalizarTexto } from "../shared/shared-validaciones.js";

export const ingresosIniciales = [
  {
    id: "ing_demo_001",
    proyectoId: "proy_demo_002",
    concepto: "Venta piloto",
    monto: 75,
    fecha: "2026-07-04",
    categoria: "Curso",
    nota: "Ingreso demo para probar rentabilidad."
  }
];

export const gastosIniciales = [
  {
    id: "gas_demo_001",
    proyectoId: "proy_demo_002",
    concepto: "Herramienta de diseño",
    monto: 10,
    fecha: "2026-07-04",
    categoria: "Herramientas",
    nota: "Gasto demo para probar utilidad."
  }
];

export function crearIngresoBase(datos = {}){
  return {
    id: datos.id || crearIdIngreso(),
    proyectoId: normalizarTexto(datos.proyectoId),
    concepto: normalizarTexto(datos.concepto, "Ingreso sin concepto"),
    monto: normalizarNumero(datos.monto, 0),
    fecha: normalizarTexto(datos.fecha, obtenerFechaCortaActual()),
    categoria: normalizarTexto(datos.categoria, "Otro"),
    nota: normalizarTexto(datos.nota)
  };
}

export function crearGastoBase(datos = {}){
  return {
    id: datos.id || crearIdGasto(),
    proyectoId: normalizarTexto(datos.proyectoId),
    concepto: normalizarTexto(datos.concepto, "Gasto sin concepto"),
    monto: normalizarNumero(datos.monto, 0),
    fecha: normalizarTexto(datos.fecha, obtenerFechaCortaActual()),
    categoria: normalizarTexto(datos.categoria, "Otro"),
    nota: normalizarTexto(datos.nota)
  };
}

export function crearIdIngreso(){
  return `ing_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function crearIdGasto(){
  return `gas_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
