/**
 * Todo lo que se puede personalizar sin tocar el resto del código.
 * Cambia los textos y la fecha, guarda y recarga la página.
 */
export const CONFIG = Object.freeze({
  /** Texto grande de la pantalla inicial. */
  ocasion: 'San Valentín',

  /** Indicación bajo el corazón de la pantalla inicial. */
  pista: 'Toca el corazón para plantarlo',

  /** Encabezado de la carta. */
  titulo: 'Para el amor de mi vida:',

  /** Cada elemento es un párrafo de la carta. */
  mensaje: [
    'Si pudiera elegir un lugar seguro, sería a tu lado.',
    'Cuanto más tiempo estoy contigo, más te amo.',
  ],

  /** Frase que precede al contador. */
  contadorIntro: 'Mi amor por ti comenzó hace',

  /** Fecha desde la que cuenta el contador (hora local, formato ISO). */
  fechaInicio: '2025-09-01T00:00:00',

  /**
   * Semilla del generador aleatorio. El árbol es siempre el mismo para una
   * misma semilla; cámbiala para obtener otro árbol distinto.
   */
  semilla: 20250901,
});
