/**
 * Escena completa sobre un único <canvas> 2D: cielo de atardecer, colinas,
 * el árbol que crece desde una semilla y los corazones que brotan y caen.
 *
 * La línea de tiempo se mide en segundos desde que se planta la semilla:
 *   0 ............ la semilla cae desde el botón hasta el suelo
 *   CAIDA ........ impacto; empieza a crecer el tronco
 *   + ~2,1 s ..... brotan las hojas desde la horquilla hacia fuera
 *   + T_TEXTO .... se avisa a la página para que escriba la carta
 *   fin del brote  empiezan a desprenderse corazones
 */
import { crearArbol, dentroDe, ALTO_TOTAL, ALTO_TRONCO, CENTRO_Y } from './arbol.js';
import {
  clamp,
  lerp,
  easeOutCubic,
  easeInQuad,
  easeOutBack,
  crearRng,
  mezclar,
  movimientoReducido,
} from './util.js';

const TONOS = ['#8f1230', '#a8163a', '#c41e3a', '#d9324f', '#e8486a', '#f06a8a', '#f78fa7', '#ffb3c1'];
const COLOR_MADERA = '#1a0610';
const CAIDA = 0.85;
const T_TEXTO = 4.3;
const DPR_MAX = 2;
const MAX_CAIDOS = 150;
const VIDA_CAIDO = 10;

/** Pinta un corazón en un lienzo auxiliar para reutilizarlo como sprite. */
function crearSprite(color, px = 64) {
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = px;
  const ctx = lienzo.getContext('2d');
  const r = px * 0.46;
  ctx.translate(px / 2, px / 2);
  ctx.beginPath();
  ctx.moveTo(0, 0.9 * r);
  ctx.bezierCurveTo(-1.3 * r, 0.1 * r, -0.9 * r, -0.9 * r, -0.45 * r, -0.9 * r);
  ctx.bezierCurveTo(-0.2 * r, -0.9 * r, -0.05 * r, -0.75 * r, 0, -0.55 * r);
  ctx.bezierCurveTo(0.05 * r, -0.75 * r, 0.2 * r, -0.9 * r, 0.45 * r, -0.9 * r);
  ctx.bezierCurveTo(0.9 * r, -0.9 * r, 1.3 * r, 0.1 * r, 0, 0.9 * r);
  ctx.closePath();
  const luz = ctx.createRadialGradient(-0.35 * r, -0.5 * r, 0, 0, 0, 1.25 * r);
  luz.addColorStop(0, mezclar(color, '#ffffff', 0.32));
  luz.addColorStop(0.55, color);
  luz.addColorStop(1, mezclar(color, '#000000', 0.22));
  ctx.fillStyle = luz;
  ctx.fill();
  return lienzo;
}

/** Punto de luz difuso para las motas que flotan en el aire. */
function crearMota(px = 48) {
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = px;
  const ctx = lienzo.getContext('2d');
  const g = ctx.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
  g.addColorStop(0, 'rgba(255, 226, 190, 1)');
  g.addColorStop(0.25, 'rgba(255, 170, 150, 0.45)');
  g.addColorStop(1, 'rgba(255, 150, 150, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, px, px);
  return lienzo;
}

/** Doble pulso, como un latido, con periodo de 1,5 s. Devuelve 0..1. */
function latido(t) {
  const f = (t % 1.5) / 1.5;
  return Math.exp(-Math.pow((f - 0.08) / 0.05, 2)) + 0.6 * Math.exp(-Math.pow((f - 0.3) / 0.06, 2));
}

export class Escena {
  /**
   * @param {HTMLCanvasElement} lienzo
   * @param {HTMLElement} zona  elemento cuyo rectángulo delimita el árbol
   * @param {{semilla: number, alEvento?: (nombre: 'texto') => void}} opciones
   */
  constructor(lienzo, zona, { semilla, alEvento = () => {} }) {
    this.lienzo = lienzo;
    this.ctx = lienzo.getContext('2d');
    this.zona = zona;
    this.alEvento = alEvento;
    this.semilla = semilla;

    const ligero =
      window.matchMedia('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 600;
    this.arbol = crearArbol(semilla, ligero ? 560 : 860);
    this.escalaHoja = ligero ? 1.22 : 1;
    this.estado = this.arbol.hojas.map(() => ({ vuelve: 0 }));
    this.sprites = TONOS.map((c) => crearSprite(c));
    this.mota = crearMota();
    this.rng = crearRng(semilla ^ 0x9e3779b9);

    this.reloj = 0; // tiempo ambiente, corre siempre
    this.t = -1; // tiempo desde que se plantó; -1 = aún sin plantar
    this.rafaga = 0;
    this.viento = 0;
    this.proximaCaida = 0;
    this.cayendo = [];
    this.caidos = [];
    this.origen = { x: 0, y: 0, tam: 0 };
    this.avisado = false;
    this.capaRamas = null;
    this.reducido = movimientoReducido.matches;
    this._previo = 0;
    this._raf = 0;
    this._punteroX = null;

    this._bucle = this._bucle.bind(this);
    this._medir();
    this._escuchar();
    this._arrancar();
  }

  /** Tiempo de crecimiento: segundos desde el impacto de la semilla. */
  get _gt() {
    return this.t < 0 ? -1 : this.t - CAIDA;
  }

  /**
   * Planta la semilla y lanza toda la secuencia.
   * @param {{x: number, y: number, tam: number}} origen centro y tamaño del corazón pulsado
   */
  plantar(origen) {
    if (this.t >= 0) return;
    this.origen = origen;
    this.t = this.reducido ? 1000 : 0;
    this._arrancar();
  }

  /** Devuelve la escena al estado inicial, lista para plantar de nuevo. */
  reiniciar() {
    this.t = -1;
    this.avisado = false;
    this.capaRamas = null;
    this.cayendo.length = 0;
    this.caidos.length = 0;
    this.estado.forEach((e) => (e.vuelve = 0));
    this._arrancar();
  }

  // ------------------------------------------------------------ preparación

  _escuchar() {
    const remedir = () => {
      this._medir();
      if (this.reducido) this._dibujar();
    };
    window.addEventListener('resize', remedir);
    new ResizeObserver(remedir).observe(this.zona);

    window.addEventListener('pointermove', (e) => {
      if (this._punteroX !== null) {
        this.rafaga = clamp(this.rafaga + (e.clientX - this._punteroX) * 0.0035, -0.9, 0.9);
      }
      this._punteroX = e.clientX;
    });
    window.addEventListener('pointerdown', (e) => {
      if (e.target instanceof Element && e.target.closest('button, a')) return;
      this._sacudir(e.clientX, e.clientY);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(this._raf);
      else this._arrancar();
    });
    movimientoReducido.addEventListener('change', (e) => {
      this.reducido = e.matches;
      if (this.reducido && this.t >= 0) this.t = 1000;
      this._arrancar();
    });
  }

  /** Ajusta el lienzo a la ventana y sitúa el árbol dentro de su zona. */
  _medir() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
    const w = document.documentElement.clientWidth;
    const h = window.innerHeight;
    this.dpr = dpr;
    this.w = w;
    this.h = h;
    this.lienzo.width = Math.round(w * dpr);
    this.lienzo.height = Math.round(h * dpr);

    const r = this.zona.getBoundingClientRect();
    this.k = clamp(Math.min((r.width * 0.94) / 2, (r.height * 0.95) / ALTO_TOTAL), 40, 230);
    this.bx = r.left + r.width / 2;
    this.by = r.bottom;

    this.capaRamas = null;
    this.cayendo.length = 0;
    this.caidos.length = 0;

    // Estrellas y motas dependen del tamaño, pero no deben cambiar de sitio
    // en cada redimensionado: se generan con una semilla fija.
    const rng = crearRng(this.semilla + 7);
    const techo = this.by * 0.62;
    this.estrellas = Array.from({ length: Math.round(clamp((w * h) / 9000, 60, 190)) }, () => {
      const y = rng() * techo;
      return {
        x: rng() * w,
        y,
        r: rng() < 0.12 ? 2 : 1,
        a: (1 - y / techo) * (0.35 + rng() * 0.65),
        v: 0.6 + rng() * 1.8,
        f: rng() * Math.PI * 2,
      };
    });
    this.motas = Array.from({ length: 26 }, () => ({
      x: this.bx + (rng() - 0.5) * this.k * 4.2,
      y: rng(),
      v: 0.012 + rng() * 0.02,
      tam: 5 + rng() * 9,
      f: rng() * Math.PI * 2,
    }));

    const cielo = this.ctx.createLinearGradient(0, 0, 0, this.by);
    cielo.addColorStop(0, '#12040e');
    cielo.addColorStop(0.4, '#2a0a21');
    cielo.addColorStop(0.7, '#581337');
    cielo.addColorStop(0.9, '#9a2d4c');
    cielo.addColorStop(0.98, '#dd7468');
    cielo.addColorStop(1, '#f0a184');
    this.gradCielo = cielo;

    const radioSol = Math.max(w, h) * 0.55;
    const sol = this.ctx.createRadialGradient(this.bx, this.by, 0, this.bx, this.by, radioSol);
    sol.addColorStop(0, 'rgba(255, 196, 150, 0.6)');
    sol.addColorStop(0.3, 'rgba(255, 120, 120, 0.2)');
    sol.addColorStop(1, 'rgba(255, 120, 120, 0)');
    this.gradSol = sol;

    const tierra = this.ctx.createLinearGradient(0, this.by, 0, h);
    tierra.addColorStop(0, '#1d0812');
    tierra.addColorStop(1, '#0c0307');
    this.gradTierra = tierra;
  }

  /** Altura del suelo en cada x: una loma suave con el árbol en lo alto. */
  _suelo(x) {
    const d = (x - this.bx) / (this.w * 0.5);
    return this.by + 46 * (1 - Math.exp(-d * d * 0.65));
  }

  _arrancar() {
    cancelAnimationFrame(this._raf);
    if (this.reducido) {
      this._paso(0);
      this._dibujar();
      return;
    }
    this._previo = performance.now();
    this._raf = requestAnimationFrame(this._bucle);
  }

  _bucle(ahora) {
    // La marca de tiempo del primer fotograma puede ser anterior a `_previo`;
    // sin el mínimo en 0 el reloj retrocedería y la escena quedaría sin plantar.
    const dt = clamp((ahora - this._previo) / 1000, 0, 0.05);
    this._previo = ahora;
    this._paso(dt);
    this._dibujar();
    this._raf = requestAnimationFrame(this._bucle);
  }

  // ------------------------------------------------------------- simulación

  _paso(dt) {
    this.reloj += dt;
    if (this.t >= 0) this.t += dt;
    const gt = this._gt;

    if (!this.avisado && gt >= T_TEXTO) {
      this.avisado = true;
      this.alEvento('texto');
    }
    if (this.reducido) {
      this.viento = 0;
      return;
    }

    this.rafaga *= Math.exp(-dt * 2.2);
    this.viento = Math.sin(this.reloj * 0.5) * 0.22 + Math.sin(this.reloj * 1.13 + 2) * 0.1 + this.rafaga;

    if (gt > this.arbol.finBrote + 0.4) {
      this.proximaCaida -= dt;
      if (this.proximaCaida <= 0) {
        this._soltar(Math.floor(this.rng() * this.arbol.hojas.length));
        this.proximaCaida = 0.16 + this.rng() * 0.24;
      }
    }

    const esc = this.k / 200;
    for (let i = this.cayendo.length - 1; i >= 0; i--) {
      const c = this.cayendo[i];
      const aleteo = this.reloj * 2.2 + c.fase;
      c.vy = Math.min(c.vy + 150 * esc * dt, c.vmax * esc);
      c.y += c.vy * dt;
      c.x += (Math.sin(aleteo) * 34 + this.viento * 120 + c.deriva) * esc * dt;
      c.rot += (c.vrot + Math.cos(aleteo) * 1.5) * dt;
      if (c.y >= this._suelo(c.x) + c.hondo) {
        this.cayendo.splice(i, 1);
        this.caidos.push({ x: c.x, y: c.y, rot: c.rot, tam: c.tam, sprite: c.sprite, vida: 0 });
        if (this.caidos.length > MAX_CAIDOS) this.caidos.shift();
      }
    }
    for (let i = this.caidos.length - 1; i >= 0; i--) {
      this.caidos[i].vida += dt;
      if (this.caidos[i].vida > VIDA_CAIDO) this.caidos.splice(i, 1);
    }
  }

  _indiceSprite(hoja) {
    return Math.floor(clamp(0.1 + hoja.z * 0.45 + (hoja.tono - 0.5) * 0.7, 0, 0.999) * this.sprites.length);
  }

  /** Desprende una hoja: cae un corazón y la hoja vuelve a brotar más tarde. */
  _soltar(i) {
    const hoja = this.arbol.hojas[i];
    const estado = this.estado[i];
    if (estado.vuelve || this._gt < hoja.tBrote + 0.45) return;
    estado.vuelve = this.t + 2.5 + this.rng() * 4;
    this.cayendo.push({
      x: this.bx + hoja.x * this.k,
      y: this.by - hoja.y * this.k,
      vy: 12,
      vmax: 70 + this.rng() * 55,
      rot: hoja.rot,
      vrot: (this.rng() - 0.5) * 3,
      tam: hoja.tam * this.k * this.escalaHoja,
      sprite: this.sprites[this._indiceSprite(hoja)],
      fase: this.rng() * Math.PI * 2,
      deriva: (this.rng() - 0.5) * 30,
      hondo: 2 + this.rng() * 12,
    });
  }

  /** Al tocar la copa se sueltan los corazones cercanos al punto pulsado. */
  _sacudir(px, py) {
    if (this.reducido || this._gt < this.arbol.finBrote) return;
    const x = (px - this.bx) / this.k;
    const y = (this.by - py) / this.k;
    if (!dentroDe(this.arbol.contorno, x, y)) return;
    let sueltas = 0;
    const inicio = Math.floor(this.rng() * this.arbol.hojas.length);
    for (let n = 0; n < this.arbol.hojas.length && sueltas < 12; n++) {
      const i = (inicio + n) % this.arbol.hojas.length;
      const hoja = this.arbol.hojas[i];
      if (Math.hypot(hoja.x - x, hoja.y - y) < 0.24 && !this.estado[i].vuelve) {
        this._soltar(i);
        sueltas++;
      }
    }
    this.rafaga += (this.rng() - 0.5) * 0.5;
  }

  // ---------------------------------------------------------------- dibujo

  _dibujar() {
    const { ctx, dpr, w, h, bx, by, k } = this;
    const gt = this._gt;
    const vivo = this.reducido ? 0 : 1;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.gradCielo;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#fff4ea';
    for (const e of this.estrellas) {
      ctx.globalAlpha = e.a * (0.62 + 0.38 * vivo * Math.sin(this.reloj * e.v + e.f));
      ctx.fillRect(e.x, e.y, e.r, e.r);
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = this.gradSol;
    ctx.fillRect(0, 0, w, h);

    this._colina((x) => by - 30 - 20 * Math.sin(x * 0.0041 + 1.3) - 9 * Math.sin(x * 0.0113), '#48112f');
    this._colina((x) => by - 9 - 13 * Math.sin(x * 0.0062 + 4.1), '#2e0b20');

    // Resplandor de la copa, que late una vez ha brotado.
    const brote = clamp((gt - 2.1) / 2.4);
    if (brote > 0) {
      const cy = by - CENTRO_Y * k;
      const pulso = 1 + 0.2 * vivo * latido(this.reloj);
      const halo = ctx.createRadialGradient(bx, cy, 0, bx, cy, k * 1.9);
      halo.addColorStop(0, `rgba(255, 130, 150, ${0.34 * brote * pulso})`);
      halo.addColorStop(0.5, `rgba(255, 110, 140, ${0.12 * brote * pulso})`);
      halo.addColorStop(1, 'rgba(255, 110, 140, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(bx - k * 1.9, cy - k * 1.9, k * 3.8, k * 3.8);
    }

    this._colina((x) => this._suelo(x), this.gradTierra, 'rgba(255, 168, 150, 0.28)');

    if (gt >= 0) {
      this._dibujarRamas(gt);
      this._dibujarHojas(gt);
    }

    // Corazones posados en el suelo, aplastados por la perspectiva.
    for (const c of this.caidos) {
      const tam = c.tam * dpr;
      const cos = Math.cos(c.rot) * tam;
      const sen = Math.sin(c.rot) * tam;
      ctx.globalAlpha = clamp((VIDA_CAIDO - c.vida) / 2.5);
      ctx.setTransform(cos, sen * 0.5, -sen, cos * 0.5, c.x * dpr, c.y * dpr);
      ctx.drawImage(c.sprite, -0.5, -0.5, 1, 1);
    }
    ctx.globalAlpha = 1;
    for (const c of this.cayendo) {
      const tam = c.tam * dpr;
      const cos = Math.cos(c.rot) * tam;
      const sen = Math.sin(c.rot) * tam;
      ctx.setTransform(cos, sen, -sen, cos, c.x * dpr, c.y * dpr);
      ctx.drawImage(c.sprite, -0.5, -0.5, 1, 1);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (this.t >= 0 && this.t < CAIDA) this._dibujarSemilla();
    if (gt >= 0 && gt < 0.9) this._dibujarOnda(gt);

    // Motas de luz que suben despacio alrededor del árbol.
    ctx.globalCompositeOperation = 'lighter';
    const alto = k * ALTO_TOTAL * 1.1;
    for (const m of this.motas) {
      const fase = (m.y + this.reloj * m.v * vivo) % 1;
      const y = by - fase * alto;
      const x = m.x + Math.sin(this.reloj * 0.6 + m.f) * 14 * vivo;
      ctx.globalAlpha = Math.sin(fase * Math.PI) * (0.45 + 0.3 * Math.sin(this.reloj * 1.7 + m.f));
      ctx.drawImage(this.mota, x - m.tam / 2, y - m.tam / 2, m.tam, m.tam);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  /** Rellena desde una línea de horizonte `fn(x)` hasta el borde inferior. */
  _colina(fn, relleno, borde) {
    const { ctx, w, h } = this;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + 24; x += 24) ctx.lineTo(x, fn(x));
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = relleno;
    ctx.fill();
    if (borde) {
      ctx.beginPath();
      for (let x = 0; x <= w + 24; x += 24) ctx.lineTo(x, fn(x));
      ctx.strokeStyle = borde;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  _dibujarRamas(gt) {
    const { ctx, dpr, arbol } = this;
    if (gt >= arbol.finRamas + 0.05) {
      // Ya no crece: se pinta una vez en una capa y después solo se copia.
      if (!this.capaRamas) {
        this.capaRamas = document.createElement('canvas');
        this.capaRamas.width = this.lienzo.width;
        this.capaRamas.height = this.lienzo.height;
        const capa = this.capaRamas.getContext('2d');
        capa.setTransform(dpr, 0, 0, dpr, 0, 0);
        for (const rama of arbol.ramas) this._rama(capa, rama, 1);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.capaRamas, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return;
    }
    for (const rama of arbol.ramas) {
      this._rama(ctx, rama, easeOutCubic(clamp((gt - rama.t0) / rama.dur)));
    }
  }

  /** Pinta una rama afinada hasta la fracción `p` de su longitud. */
  _rama(ctx, rama, p) {
    if (p <= 0) return;
    const { bx, by, k } = this;
    const n = rama.pts.length - 1;
    const hasta = p * n;
    const entero = Math.min(n, Math.floor(hasta));
    const resto = hasta - entero;
    const izq = [];
    const der = [];
    const centro = [];

    const anadir = (pt, u) => {
      let ancho = rama.w1 + (rama.w0 - rama.w1) * (1 - u) + rama.ensanche * Math.pow(1 - u, 6);
      if (rama.conPunta || p < 1) ancho *= Math.min(1, (p - u) / 0.14 + 0.1);
      const mitad = (ancho * k) / 2;
      const x = bx + pt.x * k;
      const y = by - pt.y * k;
      izq.push(x + pt.nx * mitad, y - pt.ny * mitad);
      der.push(x - pt.nx * mitad, y + pt.ny * mitad);
      centro.push(x - pt.nx * mitad * 0.45, y + pt.ny * mitad * 0.45, mitad);
    };

    for (let i = 0; i <= entero; i++) anadir(rama.pts[i], i / n);
    if (resto > 0 && entero < n) {
      const a = rama.pts[entero];
      const b = rama.pts[entero + 1];
      anadir(
        { x: lerp(a.x, b.x, resto), y: lerp(a.y, b.y, resto), nx: a.nx, ny: a.ny },
        hasta / n,
      );
    }
    if (izq.length < 4) return;

    ctx.beginPath();
    ctx.moveTo(izq[0], izq[1]);
    for (let i = 2; i < izq.length; i += 2) ctx.lineTo(izq[i], izq[i + 1]);
    for (let i = der.length - 2; i >= 0; i -= 2) ctx.lineTo(der[i], der[i + 1]);
    ctx.closePath();
    ctx.fillStyle = COLOR_MADERA;
    ctx.fill();

    if (rama.brillo) {
      // Filo de luz en el lado que mira al sol para dar volumen.
      ctx.beginPath();
      ctx.moveTo(centro[0], centro[1]);
      for (let i = 3; i < centro.length; i += 3) ctx.lineTo(centro[i], centro[i + 1]);
      ctx.strokeStyle = 'rgba(255, 150, 150, 0.16)';
      ctx.lineWidth = Math.max(0.6, centro[2] * 0.45);
      ctx.lineCap = 'butt';
      ctx.stroke();
    }
  }

  _dibujarHojas(gt) {
    const { ctx, dpr, bx, by, k, arbol, estado, viento } = this;
    const vivo = this.reducido ? 0 : 1;
    for (let i = 0; i < arbol.hojas.length; i++) {
      const hoja = arbol.hojas[i];
      let escala = (gt - hoja.tBrote) / 0.45;
      if (escala <= 0) continue;
      escala = escala >= 1 ? 1 : easeOutBack(escala);

      const e = estado[i];
      if (e.vuelve) {
        const rebrote = (this.t - e.vuelve) / 0.5;
        if (rebrote <= 0) continue;
        if (rebrote >= 1) e.vuelve = 0;
        else escala *= easeOutBack(rebrote);
      }

      const balanceo = Math.sin(this.reloj * 1.4 + hoja.fase) * vivo;
      const altura = hoja.y - ALTO_TRONCO;
      const x = bx + hoja.x * k + (viento * altura * 0.045 + balanceo * 0.006) * k;
      const y = by - hoja.y * k;
      const angulo = hoja.rot + balanceo * 0.14 + viento * 0.35;
      const tam = hoja.tam * k * this.escalaHoja * escala * dpr;
      const cos = Math.cos(angulo) * tam;
      const sen = Math.sin(angulo) * tam;
      ctx.setTransform(cos, sen, -sen, cos, x * dpr, y * dpr);
      ctx.drawImage(this.sprites[this._indiceSprite(hoja)], -0.5, -0.5, 1, 1);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _dibujarSemilla() {
    const { ctx, bx, by, k, origen } = this;
    const p = this.t / CAIDA;
    const x = lerp(origen.x, bx, easeOutCubic(p));
    const y = lerp(origen.y, by, easeInQuad(p));
    const tam = lerp(origen.tam, k * 0.09, easeOutCubic(p));
    ctx.drawImage(this.sprites[4], x - tam / 2, y - tam / 2, tam, tam);
  }

  /** Onda en el suelo al caer la semilla. */
  _dibujarOnda(gt) {
    const { ctx, bx, by, k } = this;
    ctx.lineWidth = 1.5;
    for (const retraso of [0, 0.18]) {
      const p = (gt - retraso) / 0.7;
      if (p <= 0 || p >= 1) continue;
      ctx.beginPath();
      ctx.ellipse(bx, by, easeOutCubic(p) * k * 0.7, easeOutCubic(p) * k * 0.12, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 190, 180, ${0.7 * (1 - p)})`;
      ctx.stroke();
    }
  }
}
