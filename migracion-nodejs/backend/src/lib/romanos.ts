// Algunas secciones capturaron la manzana en romano (III, VIII, IX) y otras en
// arábigo (3, 8, 9) para el mismo número. Estas funciones permiten que buscar
// "16" encuentre "XVI" y viceversa.

const SIMBOLOS: [string, number][] = [
  ["M", 1000],
  ["CM", 900],
  ["D", 500],
  ["CD", 400],
  ["C", 100],
  ["XC", 90],
  ["L", 50],
  ["XL", 40],
  ["X", 10],
  ["IX", 9],
  ["V", 5],
  ["IV", 4],
  ["I", 1],
];

const VALORES: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

export function aRomano(n: number): string {
  if (!Number.isInteger(n) || n <= 0 || n > 3999) return "";
  let resto = n;
  let out = "";
  for (const [simbolo, valor] of SIMBOLOS) {
    while (resto >= valor) {
      out += simbolo;
      resto -= valor;
    }
  }
  return out;
}

// Convierte solo si el texto es un romano válido: se reconstruye el romano a
// partir del valor y se compara, así variantes como "IIII" se descartan.
export function aArabigo(texto: string): number | null {
  const v = texto.trim().toUpperCase();
  if (!v || !/^[IVXLCDM]+$/.test(v)) return null;

  let total = 0;
  for (let i = 0; i < v.length; i++) {
    const actual = VALORES[v[i]];
    const siguiente = VALORES[v[i + 1]];
    total += siguiente && actual < siguiente ? -actual : actual;
  }

  return aRomano(total) === v ? total : null;
}

// Variantes equivalentes de un término de manzana: si es numérico agrega su
// forma romana y si es un romano válido agrega la arábiga. Cualquier otro texto
// ("1A", "TALUD") se devuelve sin cambios.
export function variantesManzana(termino: string): string[] {
  const t = termino.trim();
  if (!t) return [];

  const variantes = new Set([t]);
  if (/^\d+$/.test(t)) {
    const romano = aRomano(Number(t));
    if (romano) variantes.add(romano);
  } else {
    const arabigo = aArabigo(t);
    if (arabigo !== null) variantes.add(String(arabigo));
  }
  return [...variantes];
}
