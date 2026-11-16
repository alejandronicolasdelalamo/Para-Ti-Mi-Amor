<div align="center">

<img src="assets/favicon.svg" alt="" width="72" />

# Para Ti, Mi Amor

**Una carta de San Valentín que se planta: tocas un corazón, cae como una semilla y de él crece un árbol entero de corazones.**

Hecha con HTML, CSS y JavaScript sin dependencias ni paso de compilación.

[![Demo](https://img.shields.io/badge/demo-GitHub%20Pages-e8486a?logo=github)](https://alejandronicolasdelalamo.github.io/Para-Ti-Mi-Amor/)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?logo=javascript&logoColor=black)
![Canvas](https://img.shields.io/badge/Canvas-2D-c41e3a)
![Dependencias](https://img.shields.io/badge/dependencias-0-success)
![License](https://img.shields.io/badge/license-MIT-green)

<img src="docs/portada.jpg" alt="El árbol de corazones ya crecido, con la carta y el contador a la izquierda" width="880" />

**[Ver la demo](https://alejandronicolasdelalamo.github.io/Para-Ti-Mi-Amor/)**

</div>

---

## Qué es

Una página de regalo para San Valentín. Al abrirla solo hay un corazón latiendo sobre un atardecer. Al tocarlo:

1. El corazón cae al suelo como una semilla y deja una onda al tocar tierra.
2. Crece el tronco y se abren las ramas, cada una naciendo de la anterior.
3. Brotan cientos de hojas con forma de corazón, de dentro hacia fuera, hasta dibujar un corazón gigante.
4. Se escribe la carta, letra a letra.
5. Aparece un contador en vivo con los días, horas, minutos y segundos desde que empezó todo.

A partir de ahí el árbol sigue vivo: las hojas se mecen con el viento, se desprenden, revolotean hasta el suelo y vuelven a brotar. Mover el ratón levanta ráfagas, y tocar la copa la sacude.

<table>
  <tr>
    <td><img src="docs/inicio.jpg" alt="Pantalla inicial con el corazón y el texto San Valentín" /></td>
    <td><img src="docs/crecimiento.jpg" alt="El árbol a medio crecer, con las primeras hojas brotando" /></td>
  </tr>
</table>

<p align="center">
  <img src="docs/movil.jpg" alt="Versión móvil" width="280" />
</p>

## Cómo está hecho

- **Un solo `<canvas>` 2D** pinta toda la escena: cielo, estrellas, colinas, árbol, hojas y motas de luz. El texto y el contador son HTML real por encima, así que se pueden leer, seleccionar y traducir.
- **Árbol procedural y determinista.** Las ramas son curvas de Bézier generadas con un generador pseudoaleatorio con semilla (`mulberry32`): la misma semilla produce siempre el mismo árbol, y cambiarla en la configuración da otro distinto.
- **Copa con la curva paramétrica del corazón.** Las hojas se reparten dentro del contorno con un test de punto en polígono, reforzando el borde para que la silueta quede nítida.
- **Geometría normalizada.** El árbol se calcula una sola vez en unidades relativas; redimensionar la ventana o girar el móvil solo cambia la escala, no regenera nada.
- **Rendimiento.** Los corazones son *sprites* pintados una vez y reutilizados; las ramas se vuelcan a una capa en cuanto dejan de crecer; el bucle se detiene cuando la pestaña no está visible y la densidad de píxeles se limita a 2×. En pantallas táctiles se usan menos hojas, algo más grandes.
- **Composición sin números mágicos.** El CSS define con Grid la zona que ocupa el árbol y el canvas lee ese rectángulo, de modo que el diseño adaptable se decide en un solo sitio.

## Accesibilidad

- La pantalla inicial es un `<button>` de verdad: funciona con teclado y muestra el foco.
- Los lectores de pantalla reciben la carta íntegra y un resumen del contador, no la animación letra a letra.
- Con **«reducir movimiento»** activado en el sistema no hay animación: el árbol aparece ya crecido, con la carta y el contador visibles.
- Sin JavaScript se muestra la carta en texto plano.

## Personalizar

Todo el contenido está en [`js/config.js`](js/config.js):

```js
export const CONFIG = Object.freeze({
  ocasion: 'San Valentín',
  titulo: 'Para el amor de mi vida:',
  mensaje: [
    'Si pudiera elegir un lugar seguro, sería a tu lado.',
    'Cuanto más tiempo estoy contigo, más te amo.',
  ],
  contadorIntro: 'Mi amor por ti comenzó hace',
  fechaInicio: '2025-09-01T00:00:00',
  semilla: 20250901, // cámbiala para obtener otro árbol
});
```

Añadir `?directo` a la dirección salta la pantalla inicial y planta el árbol nada más cargar.

## Ejecutarlo en local

Usa módulos ES, así que hay que servirlo por HTTP (abrir el archivo con doble clic no funciona):

```bash
python -m http.server 8000
```

Después abre `http://localhost:8000`.

## Estructura

```
├── index.html          Marcado y textos accesibles
├── css/estilos.css     Composición, tipografía y transiciones
├── js/
│   ├── config.js       Textos, fecha y semilla
│   ├── main.js         Arranque, carta y contador
│   ├── escena.js       Bucle de animación y dibujo en canvas
│   ├── arbol.js        Generación del tronco, las ramas y las hojas
│   └── util.js         Funciones de suavizado y generador con semilla
├── assets/favicon.svg
└── docs/               Capturas de este README
```

## Licencia

[MIT](LICENSE). Tipografías [Bodoni Moda](https://fonts.google.com/specimen/Bodoni+Moda) y [Newsreader](https://fonts.google.com/specimen/Newsreader), servidas por Google Fonts.
