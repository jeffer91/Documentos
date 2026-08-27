function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_.-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function tokenize(source) {
  const text = String(source || "");
  const tokens = [];
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      let value = "";
      i += 1;
      let closed = false;
      while (i < text.length) {
        if (text[i] === "\\" && i + 1 < text.length) {
          value += text[i + 1];
          i += 2;
          continue;
        }
        if (text[i] === quote) {
          closed = true;
          i += 1;
          break;
        }
        value += text[i];
        i += 1;
      }
      if (!closed) throw new Error("Cadena de texto sin cerrar.");
      tokens.push({ type: "string", value });
      continue;
    }

    if (/\d/.test(ch) || (ch === "." && /\d/.test(text[i + 1] || ""))) {
      let value = "";
      while (i < text.length && /[0-9.]/.test(text[i])) {
        value += text[i];
        i += 1;
      }
      if (!/^\d*\.?\d+$/.test(value)) throw new Error(`Número inválido: ${value}`);
      tokens.push({ type: "number", value: Number(value) });
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let value = "";
      while (i < text.length && /[A-Za-z0-9_.-]/.test(text[i])) {
        value += text[i];
        i += 1;
      }
      tokens.push({ type: "identifier", value });
      continue;
    }

    const pair = text.slice(i, i + 2);
    if ([">=", "<=", "==", "!=", "<>"].includes(pair)) {
      tokens.push({ type: "operator", value: pair === "<>" ? "!=" : pair });
      i += 2;
      continue;
    }

    if (["+", "-", "*", "/", ">", "<", "=", "(", ")", ","].includes(ch)) {
      const type = ["(", ")", ","].includes(ch) ? "punct" : "operator";
      tokens.push({ type, value: ch });
      i += 1;
      continue;
    }

    throw new Error(`Símbolo no permitido en fórmula: ${ch}`);
  }

  tokens.push({ type: "eof", value: "" });
  return tokens;
}

function parseFormula(source) {
  const tokens = tokenize(source);
  let index = 0;

  function current() {
    return tokens[index];
  }

  function take(type, value) {
    const token = current();
    if (type && token.type !== type) return null;
    if (value && token.value !== value) return null;
    index += 1;
    return token;
  }

  function expect(type, value) {
    const token = take(type, value);
    if (!token) {
      const found = current();
      throw new Error(`Se esperaba ${value || type} y se encontró ${found.value || found.type}.`);
    }
    return token;
  }

  function primary() {
    const token = current();
    if (take("number")) return { type: "literal", value: token.value };
    if (take("string")) return { type: "literal", value: token.value };

    if (take("identifier")) {
      const name = token.value;
      if (take("punct", "(")) {
        const args = [];
        if (!take("punct", ")")) {
          do {
            args.push(comparison());
          } while (take("punct", ","));
          expect("punct", ")");
        }
        return { type: "call", name: name.toUpperCase(), args };
      }

      const upper = name.toUpperCase();
      if (upper === "TRUE" || upper === "VERDADERO") return { type: "literal", value: true };
      if (upper === "FALSE" || upper === "FALSO") return { type: "literal", value: false };
      return { type: "reference", name };
    }

    if (take("punct", "(")) {
      const node = comparison();
      expect("punct", ")");
      return node;
    }

    throw new Error(`Expresión incompleta cerca de: ${token.value || token.type}`);
  }

  function unary() {
    if (take("operator", "-")) return { type: "unary", op: "-", value: unary() };
    if (take("operator", "+")) return { type: "unary", op: "+", value: unary() };
    return primary();
  }

  function multiplicative() {
    let node = unary();
    while (current().type === "operator" && ["*", "/"].includes(current().value)) {
      const op = current().value;
      index += 1;
      node = { type: "binary", op, left: node, right: unary() };
    }
    return node;
  }

  function additive() {
    let node = multiplicative();
    while (current().type === "operator" && ["+", "-"].includes(current().value)) {
      const op = current().value;
      index += 1;
      node = { type: "binary", op, left: node, right: multiplicative() };
    }
    return node;
  }

  function comparison() {
    let node = additive();
    if (current().type === "operator" && [">", "<", ">=", "<=", "=", "==", "!="].includes(current().value)) {
      const op = current().value;
      index += 1;
      node = { type: "binary", op, left: node, right: additive() };
    }
    return node;
  }

  const ast = comparison();
  expect("eof");
  return ast;
}

function flatten(values) {
  const out = [];
  (Array.isArray(values) ? values : [values]).forEach((value) => {
    if (Array.isArray(value)) out.push(...flatten(value));
    else out.push(value);
  });
  return out;
}

function numeric(value, label) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  const raw = String(value == null ? "" : value).trim().replace(",", ".");
  if (!raw) throw new Error(`${label || "Valor"} está vacío.`);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${label || "Valor"} no es numérico.`);
  return parsed;
}

function numericList(values) {
  return flatten(values)
    .filter((value) => value !== "" && value != null)
    .map((value) => numeric(value, "Valor"));
}

function normalizeNumber(value) {
  if (!Number.isFinite(value)) throw new Error("El cálculo produjo un número no válido.");
  return Number(value.toFixed(12));
}

function sameValue(a, b) {
  const na = Number(String(a).replace(",", "."));
  const nb = Number(String(b).replace(",", "."));
  if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  return String(a) === String(b);
}

function findObjectValue(object, requested) {
  const target = normalizeKey(requested);
  const key = Object.keys(object || {}).find((item) => normalizeKey(item) === target);
  return key == null ? undefined : object[key];
}

function findFormValue(formData, requested) {
  const target = normalizeKey(requested);
  const key = Object.keys(formData || {}).find((item) => normalizeKey(item) === target);
  return key == null ? undefined : formData[key];
}

function dataReference(sourceBundle, markerName, rest) {
  const datasets = ((sourceBundle && sourceBundle.calculationData) || [])
    .filter((item) => normalizeKey(item.markerName) === normalizeKey(markerName));
  if (!datasets.length) return undefined;

  if (rest.length === 1) {
    const column = rest[0];
    return datasets.flatMap((dataset) =>
      (dataset.sheets || []).flatMap((sheet) =>
        (sheet.rows || []).map((row) => findObjectValue(row, column)).filter((value) => value !== undefined)
      )
    );
  }

  if (rest.length >= 2) {
    const sheetName = rest[0];
    const column = rest.slice(1).join(".");
    const values = datasets.flatMap((dataset) => {
      const sheet = (dataset.sheets || []).find((item) => normalizeKey(item.name) === normalizeKey(sheetName));
      if (!sheet) return [];
      return (sheet.rows || []).map((row) => findObjectValue(row, column)).filter((value) => value !== undefined);
    });
    return values.length ? values : undefined;
  }

  return undefined;
}

function tableReference(formData, markerName, column) {
  const rows = findFormValue(formData, markerName);
  if (!Array.isArray(rows)) return undefined;
  return rows.map((row) => findObjectValue(row, column)).filter((value) => value !== undefined);
}

function evaluateAst(ast, resolveReference) {
  if (ast.type === "literal") return ast.value;
  if (ast.type === "reference") return resolveReference(ast.name);

  if (ast.type === "unary") {
    const value = numeric(evaluateAst(ast.value, resolveReference), ast.op);
    return ast.op === "-" ? -value : value;
  }

  if (ast.type === "binary") {
    const left = evaluateAst(ast.left, resolveReference);
    const right = evaluateAst(ast.right, resolveReference);

    if (ast.op === "+") return normalizeNumber(numeric(left, "Izquierda") + numeric(right, "Derecha"));
    if (ast.op === "-") return normalizeNumber(numeric(left, "Izquierda") - numeric(right, "Derecha"));
    if (ast.op === "*") return normalizeNumber(numeric(left, "Izquierda") * numeric(right, "Derecha"));
    if (ast.op === "/") {
      const divisor = numeric(right, "Divisor");
      if (divisor === 0) throw new Error("No se puede dividir para cero.");
      return normalizeNumber(numeric(left, "Dividendo") / divisor);
    }

    if (ast.op === "=" || ast.op === "==") return sameValue(left, right);
    if (ast.op === "!=") return !sameValue(left, right);

    const a = numeric(left, "Izquierda");
    const b = numeric(right, "Derecha");
    if (ast.op === ">") return a > b;
    if (ast.op === "<") return a < b;
    if (ast.op === ">=") return a >= b;
    if (ast.op === "<=") return a <= b;
  }

  if (ast.type === "call") {
    if (ast.name === "IF") {
      if (ast.args.length !== 3) throw new Error("IF necesita 3 argumentos.");
      return evaluateAst(ast.args[0], resolveReference)
        ? evaluateAst(ast.args[1], resolveReference)
        : evaluateAst(ast.args[2], resolveReference);
    }

    const args = ast.args.map((arg) => evaluateAst(arg, resolveReference));

    if (ast.name === "SUM") return normalizeNumber(numericList(args).reduce((a, b) => a + b, 0));

    if (ast.name === "AVG") {
      const nums = numericList(args);
      if (!nums.length) throw new Error("AVG no tiene valores numéricos.");
      return normalizeNumber(nums.reduce((a, b) => a + b, 0) / nums.length);
    }

    if (ast.name === "MIN") {
      const nums = numericList(args);
      if (!nums.length) throw new Error("MIN no tiene valores numéricos.");
      return Math.min(...nums);
    }

    if (ast.name === "MAX") {
      const nums = numericList(args);
      if (!nums.length) throw new Error("MAX no tiene valores numéricos.");
      return Math.max(...nums);
    }

    if (ast.name === "COUNT") {
      return flatten(args).filter((value) => value !== "" && value != null).length;
    }

    if (ast.name === "ROUND") {
      if (!args.length || args.length > 2) throw new Error("ROUND necesita 1 o 2 argumentos.");
      const digits = args.length === 2 ? Math.max(0, Math.min(10, Math.trunc(numeric(args[1], "Decimales")))) : 0;
      const factor = 10 ** digits;
      return normalizeNumber(Math.round((numeric(args[0], "Valor") + Number.EPSILON) * factor) / factor);
    }

    if (ast.name === "PERCENT") {
      if (args.length !== 2) throw new Error("PERCENT necesita 2 argumentos.");
      const total = numeric(args[1], "Total");
      if (total === 0) throw new Error("No se puede calcular un porcentaje con total igual a cero.");
      return normalizeNumber((numeric(args[0], "Parte") / total) * 100);
    }

    if (ast.name === "ABS") {
      if (args.length !== 1) throw new Error("ABS necesita 1 argumento.");
      return Math.abs(numeric(args[0], "Valor"));
    }

    throw new Error(`Función no permitida: ${ast.name}`);
  }

  throw new Error("Expresión de cálculo no reconocida.");
}

function calcFields(project) {
  const markers = (project && project.template && project.template.markers) || [];
  return markers.filter((field) => field.valid && field.type === "CALC");
}

function applyCalculations(project, sourceBundle) {
  const next = Object.assign({}, project, {
    formData: Object.assign({}, project && project.formData || {})
  });
  const fields = calcFields(next);
  const byName = new Map(fields.map((field) => [normalizeKey(field.name), field]));
  const states = new Map();
  const values = {};
  const errors = [];
  const warnings = [];

  function resolveReference(name) {
    const parts = String(name || "").split(".");
    const root = parts[0];
    const calc = byName.get(normalizeKey(root));
    if (calc && parts.length === 1) return evaluateField(calc);

    if (parts.length > 1) {
      const manual = tableReference(next.formData, root, parts.slice(1).join("."));
      if (manual !== undefined) return manual;

      const data = dataReference(sourceBundle || {}, root, parts.slice(1));
      if (data !== undefined) return data;
    }

    const direct = findFormValue(next.formData, name);
    if (direct !== undefined) return direct;

    throw new Error(`No existe el campo o referencia: ${name}`);
  }

  function evaluateField(field) {
    const key = normalizeKey(field.name);
    const state = states.get(key);
    if (state === "done") return values[key];
    if (state === "visiting") throw new Error(`Dependencia circular detectada en ${field.name}.`);
    if (state === "error") throw new Error(`No se pudo resolver la dependencia ${field.name}.`);

    states.set(key, "visiting");
    try {
      const ast = parseFormula(field.formula || field.config || "");
      const value = evaluateAst(ast, resolveReference);
      values[key] = value;
      next.formData[field.name] = value;
      states.set(key, "done");
      return value;
    } catch (error) {
      delete next.formData[field.name];
      states.set(key, "error");
      throw error;
    }
  }

  fields.forEach((field) => {
    try {
      const value = evaluateField(field);
      if (field.required && (value === "" || value == null)) {
        errors.push(`${field.label}: el cálculo obligatorio quedó vacío.`);
      }
    } catch (error) {
      errors.push(`${field.label}: ${error.message}`);
    }
  });

  return {
    ok: errors.length === 0,
    project: next,
    calculated: Object.fromEntries(fields
      .filter((field) => Object.prototype.hasOwnProperty.call(next.formData, field.name))
      .map((field) => [field.name, next.formData[field.name]])),
    errors,
    warnings
  };
}

function validateAstFunctions(ast) {
  const allowed = new Set(["SUM", "AVG", "MIN", "MAX", "COUNT", "ROUND", "PERCENT", "ABS", "IF"]);
  if (!ast || typeof ast !== "object") return;
  if (ast.type === "call") {
    if (!allowed.has(ast.name)) throw new Error(`Función no permitida: ${ast.name}`);
    ast.args.forEach(validateAstFunctions);
    return;
  }
  if (ast.type === "binary") {
    validateAstFunctions(ast.left);
    validateAstFunctions(ast.right);
    return;
  }
  if (ast.type === "unary") validateAstFunctions(ast.value);
}

function validateFormulaSyntax(formula) {
  try {
    const ast = parseFormula(formula);
    validateAstFunctions(ast);
    return { ok: true, error: "" };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}

module.exports = {
  normalizeKey,
  tokenize,
  parseFormula,
  evaluateAst,
  applyCalculations,
  validateFormulaSyntax
};
