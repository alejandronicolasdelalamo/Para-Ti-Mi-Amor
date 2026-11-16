/**
 * Genera el árbol: tronco, ramas y una copa de hojas con forma de corazón.
 *
 * Todo se calcula en unidades normalizadas (la mitad del ancho del corazón
 * vale 1, el origen es la base del tronco y el eje Y crece hacia arriba).
 * La escena solo tiene que escalar y trasladar para pintarlo a cualquier
 * tamaño, de modo que redimensionar la ventana no regenera nada.
 */
import { crearRng } from './util.js';

/** Altura desde el suelo hasta la punta inferior del corazón. */
export const ALTO_TRONCO = 0.8;
/** Altura del origen de la curva del corazón. */
export const CENTRO_Y = ALTO_TRONCO + 1.0625;
/** Altura total del árbol, del suelo a lo más alto de la copa. */
export const ALTO_TOTAL = CENTRO_Y + 0.75;

const PUNTOS_POR_RAMA = 14;

/** Curva paramétrica clásica del corazón, normalizada a un ancho de 2. */
function corazon(t) {
  return {
    x: Math.pow(Math.sin(t), 3),
    y: (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16,
  };
}

function contornoCorazon(n = 160) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const p = corazon((i / n) * Math.PI * 2);
    pts.push({ x: p.x, y: CENTRO_Y + p.y });
  }
  return pts;
}

/** Punto dentro de polígono por trazado de rayos. */
export function dentroDe(poligono, x, y) {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i];
    const b = poligono[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
      dentro = !dentro;
    }
  }
  return dentro;
}

/** Muestrea una Bézier cuadrática guardando la normal en cada punto. */
function muestrear(p0, c, p1, n = PUNTOS_POR_RAMA) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const v = 1 - u;
    const dx = 2 * v * (c.x - p0.x) + 2 * u * (p1.x - c.x);
    const dy = 2 * v * (c.y - p0.y) + 2 * u * (p1.y - c.y);
    const largo = Math.hypot(dx, dy) || 1;
    pts.push({
      x: v * v * p0.x + 2 * v * u * c.x + u * u * p1.x,
      y: v * v * p0.y + 2 * v * u * c.y + u * u * p1.y,
      nx: -dy / largo,
      ny: dx / largo,
      tx: dx / largo,
      ty: dy / largo,
    });
  }
  return pts;
}

/**
 * Momento en que una rama madre, que crece con easeOutCubic, alcanza el
 * punto `u` de su recorrido. Las hijas nacen justo entonces.
 */
const instanteEn = (madre, u) => madre.t0 + madre.dur * (1 - Math.cbrt(1 - u));

/**
 * @param {number} semilla
 * @param {number} numHojas
 * @returns {{ramas: object[], hojas: object[], contorno: {x:number,y:number}[], finRamas: number, finBrote: number, horquilla: {x:number,y:number}}}
 */
export function crearArbol(semilla, numHojas) {
  const rng = crearRng(semilla);
  const entre = (a, b) => a + (b - a) * rng();
  const contorno = contornoCorazon();
  const ramas = [];

  // --- Tronco: del suelo a la horquilla, ya dentro de la copa -------------
  const horquilla = { x: 0.015, y: ALTO_TRONCO + 0.52 };
  const tronco = {
    pts: muestrear({ x: 0, y: 0 }, { x: 0.11, y: ALTO_TRONCO * 0.7 }, horquilla, 20),
    w0: 0.17,
    w1: 0.07,
    ensanche: 0.14,
    conPunta: false,
    t0: 0,
    dur: 1.5,
    brillo: true,
  };
  ramas.push(tronco);

  // --- Ramas principales: abren la copa hacia los lóbulos del corazón ------
  const destinos = [
    [-0.52, 0.4], [0.52, 0.4],
    [-0.86, 0.18], [0.86, 0.18],
    [-0.3, 0.52], [0.3, 0.52],
    [-0.58, -0.28], [0.58, -0.28],
    [0, 0.12],
  ];
  const principales = destinos.map(([hx, hy], i) => {
    // La última rama nace en la punta del tronco y lo prolonga con su mismo
    // grosor; las demás salen escalonadas un poco más abajo.
    const esGuia = i === destinos.length - 1;
    const uInicio = esGuia ? 1 : 0.68 + 0.28 * (i / (destinos.length - 2));
    const origen = tronco.pts[Math.round(uInicio * (tronco.pts.length - 1))];
    const fin = {
      x: hx + entre(-0.05, 0.05),
      y: CENTRO_Y + hy + entre(-0.05, 0.05),
    };
    const control = {
      x: origen.x + (fin.x - origen.x) * 0.62 + entre(-0.04, 0.04),
      y: origen.y + (fin.y - origen.y) * 0.3 + entre(-0.03, 0.03),
    };
    const rama = {
      pts: muestrear(origen, control, fin),
      w0: esGuia ? tronco.w1 : 0.052 + 0.02 * rng(),
      w1: 0.012,
      ensanche: 0,
      conPunta: true,
      t0: instanteEn(tronco, uInicio),
      dur: entre(0.95, 1.25),
      brillo: true,
    };
    ramas.push(rama);
    return rama;
  });

  // --- Ramitas: dos niveles que rellenan el interior de la copa ----------
  const brotar = (madre, cuantas, largoMin, largoMax, grosor, dur) => {
    const hijas = [];
    for (let i = 0; i < cuantas; i++) {
      const u = entre(0.3, 0.92);
      const origen = madre.pts[Math.round(u * (madre.pts.length - 1))];
      const lado = i % 2 === 0 ? 1 : -1;
      const base = Math.atan2(origen.ty, origen.tx);
      const angulo = base + lado * entre(0.45, 1.0);
      let largo = entre(largoMin, largoMax) * (1 - u * 0.35);
      let fin = null;
      for (let intento = 0; intento < 3; intento++) {
        const candidato = {
          x: origen.x + Math.cos(angulo) * largo,
          y: origen.y + Math.sin(angulo) * largo,
        };
        if (dentroDe(contorno, candidato.x, candidato.y)) {
          fin = candidato;
          break;
        }
        largo *= 0.6;
      }
      if (!fin) continue;
      const control = {
        x: (origen.x + fin.x) / 2 - Math.sin(angulo) * largo * 0.18 * lado,
        y: (origen.y + fin.y) / 2 + Math.cos(angulo) * largo * 0.18 * lado,
      };
      const hija = {
        pts: muestrear(origen, control, fin, 8),
        w0: grosor,
        w1: grosor * 0.3,
        ensanche: 0,
        conPunta: true,
        t0: instanteEn(madre, u),
        dur,
        brillo: false,
      };
      ramas.push(hija);
      hijas.push(hija);
    }
    return hijas;
  };

  let finRamas = tronco.dur;
  for (const principal of principales) {
    for (const ramita of brotar(principal, 4, 0.2, 0.36, 0.022, 0.6)) {
      for (const brote of brotar(ramita, 2, 0.09, 0.16, 0.011, 0.4)) {
        finRamas = Math.max(finRamas, brote.t0 + brote.dur);
      }
      finRamas = Math.max(finRamas, ramita.t0 + ramita.dur);
    }
  }

  // --- Hojas: corazones repartidos dentro del contorno --------------------
  const INICIO_BROTE = 2.1;
  const hojas = [];
  let finBrote = INICIO_BROTE;
  while (hojas.length < numHojas) {
    let x;
    let y;
    if (rng() < 0.24) {
      // Refuerzo del borde para que la silueta del corazón quede nítida.
      const p = corazon(rng() * Math.PI * 2);
      const hacia = 1 - rng() * 0.1;
      x = p.x * hacia;
      y = CENTRO_Y + 0.08 + (p.y - 0.08) * hacia;
    } else {
      x = entre(-1, 1);
      y = CENTRO_Y + entre(-1.07, 0.76);
      if (!dentroDe(contorno, x, y)) continue;
    }
    const z = rng();
    const distancia = Math.hypot(x - horquilla.x, y - horquilla.y);
    const tBrote = INICIO_BROTE + distancia * 1.25 + rng() * 0.55;
    finBrote = Math.max(finBrote, tBrote + 0.45);
    hojas.push({
      x,
      y,
      z,
      tam: entre(0.062, 0.118) * (0.82 + z * 0.3),
      rot: entre(-0.55, 0.55),
      fase: rng() * Math.PI * 2,
      tono: rng(),
      tBrote,
    });
  }
  hojas.sort((a, b) => a.z - b.z);

  return { ramas, hojas, contorno, finRamas, finBrote, horquilla };
}
