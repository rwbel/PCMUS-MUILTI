/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * gameConfig.ts - Configuración centralizada del juego PCMus Lo-Fi
 *
 * Aquí están todas las constantes, tiempos y valores de equilibrio del juego.
 * Edita este archivo para ajustar la dificultad, puntuaciones, tiempos de animación,
 * y comportamiento general sin tener que buscar en el código fuente.
 */

// ============================================================================
// CONFIGURACIÓN DE LA PARTIDA (Reglamento Oficial de Mus de Bizkaia)
// ============================================================================

// Número de piedras (amarrakos) necesarios para ganar un juego (chico)
export const TARGET_PIEDRAS = 40;

// Número de juegos necesarios para ganar la partida completa
export const TARGET_JUEGOS = 4;

// ============================================================================
// TIEMPOS DE ANIMACIÓN (en milisegundos)
// ============================================================================

export const TIMING = {
  // Tiempo que se muestra un mensaje de habla (seña o frase de personaje)
  SPEECH_DISPLAY_MS: 2800,

  // Tiempo que se muestra un comentario del camarero (Manolo)
  WAITER_COMMENT_MS: 3500,

  // Retraso antes de pasar al siguiente lance después de resolver uno
  NEXT_LANCE_DELAY_MS: 1400,

  // Retraso antes de resolver el showdown final de la ronda
  SHOWDOWN_DELAY_MS: 1600,

  // Retraso antes de pasar a DESCARDE después de la fase de MUS
  DISCARD_DELAY_MS: 750,

  // Retraso antes de iniciar el primer lance si el jugador corta el MUS
  FIRST_LANCE_DELAY_MS: 950,

  // Retraso de la IA del bot antes de tomar una decisión
  BOT_THINKING_DELAY_MS: 950,

  // Duración de la animación de reparto de cartas
  DEALING_ANIMATION_MS: 700,
} as const;

// ============================================================================
// PUNTUACIÓN DE LANCES
// ============================================================================

export const SCORE = {
  // Piedras que se ganan por defecto en un lance sin envite (paso)
  DEFAULT_STONES: 1,

  // Piedras de un envite estándar de Envido (2 piedras)
  ENVIDO_STONES: 2,

  // Piedras de un Cinco (5 piedras)
  CINCO_STONES: 5,

  // Umbral para considerar que se tiene "Juego" (suma de cartas > 30)
  JUEGO_THRESHOLD: 30,

  // Mejor puntuación posible de Juego (31 puntos)
  BEST_JUEGO: 31,

  // Puntuación de Punto cuando no hay Juego (más cercano a 30)
  PUNTO_TARGET: 30,
} as const;

// ============================================================================
// UMBRALES DE IA (comportamiento de los bots)
// ============================================================================

export const AI = {
  // Probabilidad (0-1) de que un oponente intente una seña "picara" al inicio de un lance
  SNEAKY_SIGN_PROBABILITY: 0.25,

  // Umbral de valor de mano (0-100) por encima del cual el bot considera envidar
  ENVITE_UMBRAL: 45,

  // Umbral alto de valor de mano para considerar Órdago
  ORDAGO_UMBRAL: 75,

  // Probabilidad de que un bot bluffer tire Órdago incluso con mano media
  BLUFFER_ORDAGO_PROBABILITY: 0.75,

  // Umbral bajo de valor de mano por debajo del cual el bot pasa (paso)
  PASO_UMBRAL: 35,

  // Umbral para considerar que el bot quiere aceptar una apuesta
  QUIERO_UMBRAL: 70,
} as const;

// ============================================================================
// ESTADOS DE SOBRIEDAD (alcohol y cafeína)
// ============================================================================

export const SOBRIEDAD = {
  // Nivel de alcohol a partir del cual el jugador se considera "borracho"
  DRUNK_THRESHOLD: 2,

  // Nivel de alcohol a partir del cual está "muy borracho"
  HEAVY_DRUNK_THRESHOLD: 4,

  // Nivel de cafeína a partir del cual está "cafeinado"
  CAFFEINATED_THRESHOLD: 3,

  // Nivel de cafeína a partir del cual está "ligeramente nervioso"
  SLIGHTLY_WIRED_THRESHOLD: 1,

  // Valor máximo de cada estadística (0-5)
  MAX_LEVEL: 5,
} as const;