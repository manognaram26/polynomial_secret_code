const fs = require('fs');
const path = require('path');
const bigInt = require('big-integer');

if (process.argv.length < 3) {
  console.error('Usage: node polynomial_secret_c.js <input.json>');
  process.exit(1);
}

const inputPath = path.resolve(process.argv[2]);
let raw;
try {
  raw = fs.readFileSync(inputPath, 'utf8');
} catch (err) {
  console.error(`Error reading file ${inputPath}:`, err.message);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(raw);
} catch (err) {
  console.error('Invalid JSON:', err.message);
  process.exit(1);
}

// Simple Fraction class using bigInt
class Fraction {
  constructor(num, den = bigInt.one) {
    this.num = bigInt(num);
    this.den = bigInt(den);
    this._normalize();
  }
  _normalize() {
    if (this.den.isNegative()) {
      this.num = this.num.negate();
      this.den = this.den.negate();
    }
    const g = bigInt.gcd(this.num.abs(), this.den);
    if (!g.isUnit()) {
      this.num = this.num.divide(g);
      this.den = this.den.divide(g);
    }
  }
  add(other) {
    const o = Fraction._coerce(other);
    return new Fraction(
      this.num.multiply(o.den).add(o.num.multiply(this.den)),
      this.den.multiply(o.den)
    );
  }
  subtract(other) {
    const o = Fraction._coerce(other);
    return new Fraction(
      this.num.multiply(o.den).subtract(o.num.multiply(this.den)),
      this.den.multiply(o.den)
    );
  }
  multiply(other) {
    const o = Fraction._coerce(other);
    return new Fraction(
      this.num.multiply(o.num),
      this.den.multiply(o.den)
    );
  }
  divide(other) {
    const o = Fraction._coerce(other);
    return new Fraction(
      this.num.multiply(o.den),
      this.den.multiply(o.num)
    );
  }
  valueOf() {
    return this.num.divide(this.den);
  }
  toString() {
    if (this.den.equals(1)) return this.num.toString();
    return `${this.num.toString()}/${this.den.toString()}`;
  }
  static _coerce(x) {
    return x instanceof Fraction ? x : new Fraction(x);
  }
}

// Decode a string in arbitrary base to bigInt
function decodeBig(value, base) {
  const b = bigInt(base);
  let result = bigInt.zero;
  const digits = value.split('');
  for (const ch of digits) {
    const digit = parseInt(ch, 36); // supports 0-9, a-z
    if (digit >= base) {
      throw new Error(`Invalid digit '${ch}' for base ${base}`);
    }
    result = result.multiply(b).add(bigInt(digit));
  }
  return result;
}

const { n, k } = data.keys;
const xs = [];
const ys = [];
// collect first k numeric keys
const keys = Object.keys(data)
  .filter(k1 => k1 !== 'keys')
  .map(x => Number(x))
  .filter(x => !isNaN(x))
  .sort((a, b) => a - b)
  .slice(0, k);

if (keys.length < k) {
  console.error(`Expected at least ${k} roots but found ${keys.length}.`);
  process.exit(1);
}

for (const xRaw of keys) {
  const entry = data[xRaw];
  const x = bigInt(xRaw);
  const y = decodeBig(entry.value, parseInt(entry.base, 10));
  xs.push(x);
  ys.push(y);
}

// Compute constant term c = P(0) via Lagrange interpolation: P(0) = sum(y_i * L_i(0))
let c = new Fraction(0);
for (let i = 0; i < k; i++) {
  let Li0 = new Fraction(1);
  for (let j = 0; j < k; j++) {
    if (j === i) continue;
    // factor = (0 - x_j) / (x_i - x_j)
    const num = xs[j].negate();
    const den = xs[i].subtract(xs[j]);
    Li0 = Li0.multiply(new Fraction(num, den));
  }
  c = c.add(Li0.multiply(ys[i]));
}

console.log(`Constant term c = ${c.toString()}`);
