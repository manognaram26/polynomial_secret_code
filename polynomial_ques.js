const fs = require('fs');

// Get JSON filename from command-line argument
const filename = process.argv[2];
if (!filename) {
  console.error("Usage: node polynomial_ques.js <json_filename>");
  process.exit(1);
}

// Read and parse JSON file synchronously
let jsonObj;
try {
  const rawData = fs.readFileSync(filename, 'utf8');
  jsonObj = JSON.parse(rawData);
} catch (err) {
  console.error("Error reading or parsing file:", err.message);
  process.exit(1);
}

// Decode a BigInt from a string with the given base
function decodeBigInt(str, base) {
  base = Number(base);
  if (base <= 36) {
    return BigInt(parseInt(str, base));
  } else {
    throw new Error("Base > 36 not implemented");
  }
}

// If modulus is provided, use it; otherwise, do normal integer arithmetic (not recommended)
const mod = jsonObj.keys.p ? BigInt(jsonObj.keys.p) : null;

function modinv(a, m) {
  let m0 = m, y = 0n, x = 1n;
  if (m === 1n) return 0n;
  a = ((a % m) + m) % m;
  while (a > 1n) {
    let q = a / m;
    [m, a] = [a % m, m];
    [y, x] = [x - q * y, y];
  }
  if (x < 0n) x += m0;
  return x;
}

// Extract parameters n and k
const n = jsonObj.keys.n;
const k = jsonObj.keys.k;

// Collect points: x as BigInt key, y as decoded BigInt value
const points = [];
for (const key in jsonObj) {
  if (key === "keys") continue;
  const point = jsonObj[key];
  if (!point.value || !point.base) {
    console.error(`Malformed point at x=${key}`);
    process.exit(1);
  }
  points.push([BigInt(key), decodeBigInt(point.value, point.base)]);
}

if (points.length < k) {
  console.error(`Not enough shares provided (have ${points.length}, need ${k})`);
  process.exit(1);
}

// Lagrange interpolation to find secret = f(0)
function lagrangeAt0(points, k, mod) {
  points = points.slice(0,k);
  let secret = 0n;

  for (let i = 0; i < k; i++) {
    const [xi, yi] = points[i];
    let numerator = 1n;
    let denominator = 1n;

    for (let j = 0; j < k; j++) {
      if (j === i) continue;
      const [xj] = points[j];
      numerator *= -xj;
      denominator *= (xi - xj);

      if (mod) {
        numerator = ((numerator % mod) + mod) % mod;
        denominator = ((denominator % mod) + mod) % mod;
      }
    }

    let term;
    if (mod) {
      term = (yi * numerator % mod) * modinv(denominator, mod) % mod;
    } else {
      if (denominator === 0n) {
        throw new Error("Zero denominator encountered in interpolation");
      }
      if ((numerator % denominator) !== 0n) {
        console.warn("Warning: Fractional division - result may be truncated");
      }
      term = yi * numerator / denominator;
    }
    secret += term;
    if (mod) secret = ((secret % mod) + mod) % mod;
  }

  return secret;
}

const secret = lagrangeAt0(points, k, mod);
console.log("Secret (c):", secret.toString());
