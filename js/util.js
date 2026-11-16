/** Utilidades matemáticas compartidas. Sin dependencias ni estado global. */

export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInQuad = (t) => t * t;
export const easeOutBack = (t) => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/**
 * Generador pseudoaleatorio determinista (mulberry32).
 * Con la misma semilla produce siempre la misma secuencia, así el árbol
 * no cambia al redimensionar ni al recargar.
 * @param {number} semilla
 * @returns {() => number} función que devuelve valores en [0, 1)
 */
export function crearRng(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mezcla dos colores `#rrggbb` y devuelve `rgb(...)`. */
export function mezclar(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const canal = (despl) => Math.round(lerp((a >> despl) & 255, (b >> despl) & 255, t));
  return `rgb(${canal(16)}, ${canal(8)}, ${canal(0)})`;
}

/** Consulta viva de la preferencia «reducir movimiento». */
export const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)');
