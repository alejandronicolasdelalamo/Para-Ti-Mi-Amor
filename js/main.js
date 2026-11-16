/**
 * Punto de entrada: rellena los textos desde la configuración, conecta la
 * pantalla inicial con la escena y lleva la carta y el contador.
 */
import { CONFIG } from './config.js';
import { Escena } from './escena.js';
import { movimientoReducido } from './util.js';

const $ = (id) => document.getElementById(id);

const ui = {
  inicio: $('inicio'),
  plantar: $('plantar'),
  corazon: $('corazonInicio'),
  carta: $('carta'),
  mensaje: $('mensaje'),
  contador: $('contador'),
  repetir: $('repetir'),
};

const UNIDADES = [
  { id: 'dias', uno: 'día', varios: 'días' },
  { id: 'horas', uno: 'hora', varios: 'horas' },
  { id: 'minutos', uno: 'minuto', varios: 'minutos' },
  { id: 'segundos', uno: 'segundo', varios: 'segundos' },
];

const fechaInicio = new Date(CONFIG.fechaInicio);
let totalLetras = 0;
let temporizadores = [];

// ---------------------------------------------------------------- contenido

function rellenarTextos() {
  $('ocasion').textContent = CONFIG.ocasion;
  $('pista').textContent = CONFIG.pista;
  $('titulo').textContent = CONFIG.titulo;
  $('contadorIntro').textContent = CONFIG.contadorIntro;
  $('mensajeAccesible').replaceChildren(
    ...CONFIG.mensaje.map((texto) => Object.assign(document.createElement('p'), { textContent: texto })),
  );

  // Cada letra va en su propio <span> para poder revelarlas de una en una.
  // Las palabras se agrupan para que el salto de línea nunca las parta.
  let indice = 0;
  const parrafos = CONFIG.mensaje.map((texto) => {
    const p = document.createElement('p');
    texto.split(' ').forEach((palabra, n) => {
      if (n > 0) p.append(' ');
      const grupo = document.createElement('span');
      grupo.className = 'palabra';
      for (const caracter of palabra) {
        const letra = document.createElement('span');
        letra.className = 'letra';
        letra.style.setProperty('--i', String(indice++));
        letra.textContent = caracter;
        grupo.append(letra);
      }
      p.append(grupo);
    });
    indice += 14; // pausa entre párrafos
    return p;
  });
  ui.mensaje.replaceChildren(...parrafos);
  totalLetras = indice;
}

// ----------------------------------------------------------------- contador

function actualizarContador() {
  const total = Math.max(0, Math.floor((Date.now() - fechaInicio.getTime()) / 1000));
  const valores = [
    Math.floor(total / 86400),
    Math.floor((total % 86400) / 3600),
    Math.floor((total % 3600) / 60),
    total % 60,
  ];

  UNIDADES.forEach(({ id, uno, varios }, i) => {
    const elemento = $(id);
    const texto = valores[i].toLocaleString('es-ES');
    if (elemento.textContent === texto) return;
    elemento.textContent = texto;
    $(`${id}Unidad`).textContent = valores[i] === 1 ? uno : varios;
    // Reinicia la animación del dígito que acaba de cambiar.
    elemento.classList.remove('cambia');
    void elemento.offsetWidth;
    elemento.classList.add('cambia');
  });

  // Versión para lectores de pantalla, sin los segundos para no saturar.
  const resumen = `${CONFIG.contadorIntro} ${valores[0]} días, ${valores[1]} horas y ${valores[2]} minutos.`;
  const accesible = $('contadorAccesible');
  if (accesible.textContent !== resumen) accesible.textContent = resumen;
}

function iniciarContador() {
  if (Number.isNaN(fechaInicio.getTime())) {
    console.error(`[config] fechaInicio no es una fecha válida: "${CONFIG.fechaInicio}"`);
    ui.contador.hidden = true;
    return;
  }
  actualizarContador();
  // Se sincroniza con el cambio de segundo para que el tic sea regular.
  setTimeout(() => {
    actualizarContador();
    setInterval(actualizarContador, 1000);
  }, 1000 - (Date.now() % 1000));
}

// ---------------------------------------------------------------- secuencia

const despues = (ms, fn) => temporizadores.push(setTimeout(fn, ms));

function mostrarCarta() {
  ui.carta.classList.add('visible');
  const escritura = movimientoReducido.matches ? 0 : totalLetras * 30 + 900;
  despues(escritura, () => ui.contador.classList.add('visible'));
  despues(escritura + 1600, () => (ui.repetir.hidden = false));
}

const escena = new Escena($('escena'), $('zonaArbol'), {
  semilla: CONFIG.semilla,
  alEvento: (nombre) => {
    if (nombre === 'texto') mostrarCarta();
  },
});

function plantar() {
  const r = ui.corazon.getBoundingClientRect();
  ui.inicio.classList.add('fuera');
  ui.plantar.disabled = true;
  escena.plantar({ x: r.left + r.width / 2, y: r.top + r.height / 2, tam: r.width });
}

function reiniciar() {
  temporizadores.forEach(clearTimeout);
  temporizadores = [];
  ui.repetir.hidden = true;
  ui.carta.classList.remove('visible');
  ui.contador.classList.remove('visible');
  ui.inicio.classList.remove('fuera');
  ui.plantar.disabled = false;
  escena.reiniciar();
  // El botón no admite foco hasta que la pantalla inicial vuelve a ser visible.
  despues(750, () => ui.plantar.focus({ preventScroll: true }));
}

rellenarTextos();
iniciarContador();
ui.plantar.addEventListener('click', plantar);
ui.repetir.addEventListener('click', reiniciar);

// «?directo» salta la pantalla inicial: útil para compartir el enlace ya abierto.
if (new URLSearchParams(location.search).has('directo')) plantar();
