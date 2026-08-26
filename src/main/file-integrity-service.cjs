const fs = require("fs");
const crypto = require("crypto");

function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest("hex");
}

function inspect(filePath, expectedHash) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { exists: false, ok: false, sha256: "", error: "Archivo no encontrado." };
  }

  try {
    const actual = sha256(filePath);
    const matches = !expectedHash || actual === expectedHash;
    return {
      exists: true,
      ok: matches,
      sha256: actual,
      error: matches ? "" : "El archivo cambió desde que fue registrado."
    };
  } catch (error) {
    return { exists: true, ok: false, sha256: "", error: error.message || String(error) };
  }
}

module.exports = { sha256, inspect };
