/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * musRules.ts - Reglas del juego de Mus (Reglamento Oficial de Bizkaia)
 *
 * Este archivo contiene toda la lógica de reglas del Mus:
 * - Creación y barajado de la baraja española (40 cartas: 8 Reyes, 8 Ases)
 * - Comparación de manos para cada lance (Grande, Chica, Pares, Juego, Punto)
 * - Evaluación de pares, juego y fuerza de mano
 * - Señas tradicionales del Mus de Bizkaia
 * - Determinación del ganador entre equipos
 *
 * Reglas clave de 8 Reyes y 8 Ases:
 *   - Los 3 equivalen a Reyes (jerarquía 12, valor 10)
 *   - Los 2 equivalen a Ases (jerarquía 1, valor 1)
 *   - Las figuras (Sota=10, Caballo=11, Rey=12/3) mantienen su jerarquía normal
 */

import { Card, LancePhase, PlayerPosition, Rank, Suit } from '../types/mus';

export function getCardHierarchyAndValue(rank: Rank): { hierarchy: number; value: number } {
  // Regla estándar de 8 Reyes y 8 Ases:
  // 3s equivalen a Reyes (jerarquía 12, valor 10)
  // 2s equivalen a Ases (jerarquía 1, valor 1)
  if (rank === 12 || rank === 3) {
    return { hierarchy: 12, value: 10 };
  }
  if (rank === 1 || rank === 2) {
    return { hierarchy: 1, value: 1 };
  }
  if (rank === 11) {
    return { hierarchy: 11, value: 10 };
  }
  if (rank === 10) {
    return { hierarchy: 10, value: 10 };
  }
  return { hierarchy: rank, value: rank };
}

/**
 * Crea una baraja española completa de 40 cartas (4 palos × 10 rangos).
 *
 * Los palos son: Oros, Copas, Espadas, Bastos.
 * Los rangos son: 1(As), 2, 3(=Rey), 4, 5, 6, 7, 10(Sota), 11(Caballo), 12(Rey).
 *
 * Cada carta recibe un ID único para poder rastrearla durante la partida.
 *
 * @returns Array de 40 objetos Card barajados aleatoriamente
 */
export function createSpanishDeck(): Card[] {
  const suits: Suit[] = ['oros', 'copas', 'espadas', 'bastos'];
  const ranks: Rank[] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
  const deck: Card[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      const { hierarchy, value } = getCardHierarchyAndValue(rank);
      deck.push({
        id: `${suit}-${rank}-${Math.random().toString(36).substring(2, 6)}`,
        suit,
        rank,
        value,
        hierarchy
      });
    }
  }

  return deck;
}

/**
 * Baraja un array de cartas usando el algoritmo de Fisher-Yates.
 *
 * @param cards - Array de cartas a barajar
 * @returns Nuevo array con las cartas en orden aleatorio (no modifica el original)
 */
export function shuffleDeck(cards: Card[]): Card[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function getHandHierarchies(hand: Card[]): number[] {
  if (!hand || hand.length === 0) return [];
  return hand.map(c => c.hierarchy).sort((a, b) => b - a);
}

/**
 * Compara dos manos para el lance de GRANDE.
 *
 * En Grande gana quien tenga la carta de mayor jerarquía.
 * Compara carta por carta de mayor a menor; si hay empate, gana la Mano.
 *
 * @param handA - Mano del jugador A
 * @param handB - Mano del jugador B
 * @returns 1 si gana A, -1 si gana B, 0 si hay empate (gana la Mano)
 */
export function compareGrande(handA: Card[], handB: Card[]): number {
  const a = getHandHierarchies(handA);
  const b = getHandHierarchies(handB);
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < maxLen; i++) {
    const valA = a[i] ?? -1;
    const valB = b[i] ?? -1;
    if (valA > valB) return 1;
    if (valA < valB) return -1;
  }
  return 0; // Empate (en mus, gana quien sea Mano)
}

/**
 * Compara dos manos para el lance de CHICA.
 *
 * En Chica gana quien tenga la carta de menor jerarquía (Ases/2 son mejores que Reyes).
 * Compara carta por carta de menor a mayor; si hay empate, gana la Mano.
 *
 * @param handA - Mano del jugador A
 * @param handB - Mano del jugador B
 * @returns 1 si gana A, -1 si gana B, 0 si hay empate
 */
export function compareChica(handA: Card[], handB: Card[]): number {
  const a = [...(handA || []).map(c => c.hierarchy)].sort((x, y) => x - y);
  const b = [...(handB || []).map(c => c.hierarchy)].sort((x, y) => x - y);
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < maxLen; i++) {
    const valA = a[i] ?? 999;
    const valB = b[i] ?? 999;
    if (valA < valB) return 1; // Menor es mejor
    if (valA > valB) return -1;
  }
  return 0; // Empate
}

export type ParesType = 'none' | 'par' | 'medias' | 'duples';

export interface ParesEvaluation {
  type: ParesType;
  level: number; // 0 = none, 1 = par, 2 = medias, 3 = duples
  primaryRank: number; // Jerarquía del par/media principal
  secondaryRank: number; // Para duples (segundo par)
  description: string;
}

/**
 * Evalúa qué tipo de pares lleva una mano de 4 cartas.
 *
 * Tipos de pares (de mayor a menor):
 *   - Duples (póker o doble pareja): dos pares diferentes, ej. dos Reyes y dos Sotas
 *   - Medias: trío de la misma carta, ej. tres Reyes
 *   - Par: dos cartas del mismo rango, ej. dos Ases
 *   - Ninguno: sin pares
 *
 * @param hand - Mano de 4 cartas
 * @returns Objeto con el tipo, nivel (0-3), rango principal y descripción
 */
export function evaluatePares(hand: Card[]): ParesEvaluation {
  if (!hand || hand.length === 0) {
    return {
      type: 'none',
      level: 0,
      primaryRank: 0,
      secondaryRank: 0,
      description: 'No lleva pares'
    };
  }

  const countMap: Record<number, number> = {};
  for (const c of hand) {
    if (c) {
      countMap[c.hierarchy] = (countMap[c.hierarchy] || 0) + 1;
    }
  }

  const entries = Object.entries(countMap).map(([h, cnt]) => ({
    hierarchy: Number(h),
    count: cnt
  }));

  if (entries.length === 0) {
    return {
      type: 'none',
      level: 0,
      primaryRank: 0,
      secondaryRank: 0,
      description: 'No lleva pares'
    };
  }

  // Ordenar por count desc, luego hierarchy desc
  entries.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.hierarchy - a.hierarchy;
  });

  if (entries.length === 1 && entries[0].count === 4) {
    // 4 cartas de la misma jerarquía (póker = duples)
    return {
      type: 'duples',
      level: 3,
      primaryRank: entries[0].hierarchy,
      secondaryRank: entries[0].hierarchy,
      description: 'Duples (Póker)'
    };
  }

  if (entries.length >= 2 && entries[0].count === 2 && entries[1].count === 2) {
    return {
      type: 'duples',
      level: 3,
      primaryRank: entries[0].hierarchy,
      secondaryRank: entries[1].hierarchy,
      description: 'Duples'
    };
  }

  if (entries[0].count === 3) {
    return {
      type: 'medias',
      level: 2,
      primaryRank: entries[0].hierarchy,
      secondaryRank: 0,
      description: 'Medias'
    };
  }

  if (entries[0].count === 2) {
    return {
      type: 'par',
      level: 1,
      primaryRank: entries[0].hierarchy,
      secondaryRank: 0,
      description: 'Par'
    };
  }

  return {
    type: 'none',
    level: 0,
    primaryRank: 0,
    secondaryRank: 0,
    description: 'No lleva pares'
  };
}

/**
 * Compara dos manos para el lance de PARES.
 *
 * Jerarquía de pares: Duples (3) > Medias (2) > Par (1) > Ninguno (0).
 * Si ambos tienen el mismo nivel, gana el de rango más alto.
 *
 * @param handA - Mano del jugador A
 * @param handB - Mano del jugador B
 * @returns 1 si gana A, -1 si gana B, 0 si hay empate
 */
export function comparePares(handA: Card[], handB: Card[]): number {
  const pA = evaluatePares(handA);
  const pB = evaluatePares(handB);

  if (pA.level > pB.level) return 1;
  if (pA.level < pB.level) return -1;
  if (pA.level === 0) return 0;

  // Mismo tipo
  if (pA.primaryRank > pB.primaryRank) return 1;
  if (pA.primaryRank < pB.primaryRank) return -1;

  if (pA.type === 'duples') {
    if (pA.secondaryRank > pB.secondaryRank) return 1;
    if (pA.secondaryRank < pB.secondaryRank) return -1;
  }

  return 0; // Empate en pares
}

export interface JuegoEvaluation {
  hasJuego: boolean;
  totalSum: number;
  juegoOrder: number; // 31 es 1, 32 es 2, 40 es 3, 37 es 4, etc. (menor es mejor)
  description: string;
}

/**
 * Jerarquía de puntuaciones de Juego, de mejor a peor.
 * 31 es la mejor, seguida de 32, 40, 37, 36, 35, 34, 33.
 */
export const JUEGO_HIERARCHY: number[] = [31, 32, 40, 37, 36, 35, 34, 33];

/**
 * Evalúa si una mano tiene Juego y cuál es su puntuación total.
 *
 * Juego = la suma de los valores de las 4 cartas supera 30.
 * Valores de las cartas: Rey/Caballo/Sota/3 = 10, As/2 = 1, otros = valor nominal.
 *
 * @param hand - Mano de 4 cartas
 * @returns { hasJuego: true si suma > 30, totalSum: suma de valores, juegoOrder: posición en jerarquía }
 */
export function evaluateJuego(hand: Card[]): JuegoEvaluation {
  if (!hand || hand.length === 0) {
    return {
      hasJuego: false,
      totalSum: 0,
      juegoOrder: 999,
      description: 'Punto (0)'
    };
  }

  const totalSum = hand.reduce((sum, c) => sum + (c ? c.value : 0), 0);

  if (totalSum > 30) {
    const idx = JUEGO_HIERARCHY.indexOf(totalSum);
    return {
      hasJuego: true,
      totalSum,
      juegoOrder: idx >= 0 ? idx : 99,
      description: totalSum === 31 ? '¡31 de Juego!' : `Juego (${totalSum})`
    };
  }

  return {
    hasJuego: false,
    totalSum,
    juegoOrder: 999,
    description: `Punto (${totalSum})`
  };
}

/**
 * Compara dos manos para el lance de JUEGO.
 *
 * Juego significa que la suma de las 4 cartas supera 30.
 * La mejor puntuación es 31, seguida de 32, 40, 37, 36, 35, 34, 33.
 * Si ambos tienen juego, gana el de mejor puntuación.
 *
 * @param handA - Mano del jugador A
 * @param handB - Mano del jugador B
 * @returns 1 si gana A, -1 si gana B, 0 si hay empate
 */
export function compareJuego(handA: Card[], handB: Card[]): number {
  const jA = evaluateJuego(handA);
  const jB = evaluateJuego(handB);

  if (jA.hasJuego && !jB.hasJuego) return 1;
  if (!jA.hasJuego && jB.hasJuego) return -1;
  if (!jA.hasJuego && !jB.hasJuego) return 0;

  // Ambos tienen juego: menor juegoOrder es mejor (31 = 0)
  if (jA.juegoOrder < jB.juegoOrder) return 1;
  if (jA.juegoOrder > jB.juegoOrder) return -1;
  return 0;
}

/**
 * Compara dos manos para el lance de PUNTO.
 *
 * Se usa cuando ninguno de los dos equipos tiene Juego.
 * Gana quien tenga la suma de cartas más cercana a 30 (sin pasarse).
 *
 * @param handA - Mano del jugador A
 * @param handB - Mano del jugador B
 * @returns 1 si gana A, -1 si gana B, 0 si hay empate
 */
export function comparePunto(handA: Card[], handB: Card[]): number {
  if (!handA || !handB) return 0;
  const pA = handA.reduce((sum, c) => sum + (c ? c.value : 0), 0);
  const pB = handB.reduce((sum, c) => sum + (c ? c.value : 0), 0);

  // El que más se aproxime a 30 (30 es el mejor)
  if (pA > pB) return 1;
  if (pA < pB) return -1;
  return 0;
}

// Orden oficial de turno en la mesa en sentido antihorario (por la derecha):
// 0: player (Sur) -> 1: oppRight (Este) -> 2: partner (Norte) -> 3: oppLeft (Oeste)
export const MUS_PLAYER_ORDER: PlayerPosition[] = ['player', 'oppRight', 'partner', 'oppLeft'];

/**
 * Distancia correlativa a la Mano en sentido de juego (0 = es Mano, 1 = segundo, 2 = tercero, 3 = postre)
 */
export function getDistanceFromMano(pos: PlayerPosition, mano: PlayerPosition): number {
  const idxP = MUS_PLAYER_ORDER.indexOf(pos);
  const idxM = MUS_PLAYER_ORDER.indexOf(mano);
  if (idxP === -1 || idxM === -1) return 0;
  return (idxP - idxM + 4) % 4;
}

/**
 * Comparación de dos jugadores en un lance aplicando la regla de oro del Mus de Bizkaia:
 * "Ganan las 31 de mano", "Ganan los duples que tengan el par mayor y a igualdad de mano", etc.
 */
export function comparePlayersForLance(
  lance: LancePhase,
  handA: Card[],
  posA: PlayerPosition,
  handB: Card[],
  posB: PlayerPosition,
  mano: PlayerPosition
): { winner: 'A' | 'B'; diff: number; isManoTiebreak: boolean } {
  let cmp = 0;
  if (lance === 'GRANDE') {
    cmp = compareGrande(handA, handB);
  } else if (lance === 'CHICA') {
    cmp = compareChica(handA, handB);
  } else if (lance === 'PARES') {
    cmp = comparePares(handA, handB);
  } else if (lance === 'JUEGO') {
    cmp = compareJuego(handA, handB);
  } else if (lance === 'PUNTO') {
    cmp = comparePunto(handA, handB);
  }

  if (cmp > 0) return { winner: 'A', diff: 1, isManoTiebreak: false };
  if (cmp < 0) return { winner: 'B', diff: -1, isManoTiebreak: false };

  // En caso de igualdad matemática en cartas, gana quien esté más cerca de la Mano
  const distA = getDistanceFromMano(posA, mano);
  const distB = getDistanceFromMano(posB, mano);
  const winner = distA < distB ? 'A' : 'B';
  return { winner, diff: winner === 'A' ? 1 : -1, isManoTiebreak: true };
}

/**
 * Obtener el mejor representante de una pareja para un lance determinado respetando la Mano
 */
export function getTeamBestPlayer(
  lance: LancePhase,
  teamPositions: [PlayerPosition, PlayerPosition],
  hands: Record<PlayerPosition, Card[]>,
  mano: PlayerPosition
): { pos: PlayerPosition; hand: Card[] } {
  const [pos1, pos2] = teamPositions;
  const res = comparePlayersForLance(lance, hands[pos1], pos1, hands[pos2], pos2, mano);
  return res.winner === 'A'
    ? { pos: pos1, hand: hands[pos1] }
    : { pos: pos2, hand: hands[pos2] };
}

/**
 * Enfrentamiento oficial entre equipos para un lance específico.
 *
 * Equipo 1 (Nosotros): player + partner
 * Equipo 2 (Ellos): oppRight + oppLeft
 *
 * Cada equipo elige su mejor jugador para el lance, luego se comparan las dos mejores manos.
 * En caso de empate en cartas, gana quien esté más cerca de la Mano.
 *
 * @param lance - Fase del lance (GRANDE, CHICA, PARES, JUEGO, PUNTO)
 * @param hands - Cartas de cada jugador por posición
 * @param mano - Posición del jugador Mano (habla primero, gana empates)
 * @returns Equipo ganador, jugador ganador, mano ganadora y si fue desempate por Mano
 */
export function evaluateLanceBetweenTeams(
  lance: LancePhase,
  hands: Record<PlayerPosition, Card[]>,
  mano: PlayerPosition
): {
  winningTeam: 1 | 2;
  winningPlayer: PlayerPosition;
  winningHand: Card[];
  isManoTiebreak: boolean;
} {
  const bestT1 = getTeamBestPlayer(lance, ['player', 'partner'], hands, mano);
  const bestT2 = getTeamBestPlayer(lance, ['oppRight', 'oppLeft'], hands, mano);

  const res = comparePlayersForLance(lance, bestT1.hand, bestT1.pos, bestT2.hand, bestT2.pos, mano);
  if (res.winner === 'A') {
    return {
      winningTeam: 1,
      winningPlayer: bestT1.pos,
      winningHand: bestT1.hand,
      isManoTiebreak: res.isManoTiebreak
    };
  } else {
    return {
      winningTeam: 2,
      winningPlayer: bestT2.pos,
      winningHand: bestT2.hand,
      isManoTiebreak: res.isManoTiebreak
    };
  }
}

/**
 * Detecta qué señas tradicionales son válidas para una mano según el
 * Reglamento Oficial de Mus de Bizkaia (Art. II).
 *
 * Señas y sus condiciones:
 *   - Dos Reyes → morder el labio inferior (👄)
 *   - Dos Ases → sacar la punta de la lengua (👅)
 *   - Duples → levantar las cejas (🤨) [prohibido señas parciales si se tienen duples]
 *   - Medias → mover la comisura de los labios (😏)
 *   - 31 de Juego → guiñar un ojo (😉) [se pasa siempre con 31 incluso con dos Reyes]
 *   - Ciego (sin pares, sin juego, sin 29) → cerrar los dos ojos (😌)
 *
 * @param hand - Mano de 4 cartas
 * @returns Array de IDs de señas válidas para esa mano
 */
export function getValidSignsForHand(hand: Card[]): string[] {
  if (!hand || hand.length < 4) return [];
  const valid: string[] = [];
  const reyesCount = hand.filter(c => c && c.hierarchy === 12).length;
  const asesCount = hand.filter(c => c && c.hierarchy === 1).length;
  const pares = evaluatePares(hand);
  const juego = evaluateJuego(hand);

  // Art. II Punto 1 & 7 (Bizkaia):
  // - Dos reyes: morder el labio inferior
  // - Dos ases: sacar la punta de la lengua por el centro
  // - Duples: levantar las cejas (prohibido señas parciales de 2 reyes o 2 ases si se tienen duples)
  // - Medias: mover la comisura de los labios hacia un lado
  // - 31 de Juego: guiñar un ojo (Art. II Punto 5: se pasará siempre 31 incluso con dos reyes)
  // - Ciego: cerrar los dos ojos (Art. II Punto 1 & 6: no puede pasarse con cartas que tengan seña, ni pares ni juego ni 29)
  if (pares.type === 'duples') {
    valid.push('cejas');
  } else {
    if (reyesCount >= 2) valid.push('labio');
    if (asesCount >= 2) valid.push('lengua');
    if (pares.type === 'medias') valid.push('boca_lado');
  }

  if (juego.hasJuego && juego.totalSum === 31) {
    valid.push('guino');
  }

  if (reyesCount < 2 && asesCount < 2 && pares.level === 0 && !juego.hasJuego && juego.totalSum !== 29) {
    valid.push('ciego');
  }

  return valid;
}

/**
 * Evalúa la fuerza global de una mano para cada lance, usada por la IA.
 *
 * Retorna puntuaciones de 0-100 aproximadas para:
 *   - grandeScore: fuerza en Grande (Reyes y cartas altas)
 *   - chicaScore: fuerza en Chica (Ases y cartas bajas)
 *   - paresScore: fuerza en Pares (nivel de pares)
 *   - juegoScore: fuerza en Juego (si tiene juego y puntuación)
 *
 * @param hand - Mano de 4 cartas
 * @returns Puntuaciones de fuerza para cada lance
 */
export function getHandStrength(hand: Card[]): {
  grandeScore: number;
  chicaScore: number;
  paresScore: number;
  juegoScore: number;
} {
  if (!hand || hand.length === 0) {
    return {
      grandeScore: 0,
      chicaScore: 0,
      paresScore: 0,
      juegoScore: 0
    };
  }

  const reyesCount = hand.filter(c => c && c.hierarchy === 12).length;
  const asesCount = hand.filter(c => c && c.hierarchy === 1).length;
  const pares = evaluatePares(hand);
  const juego = evaluateJuego(hand);

  return {
    grandeScore: reyesCount * 30 + (hand.some(c => c && c.hierarchy === 11) ? 10 : 0),
    chicaScore: asesCount * 30 + (hand.some(c => c && c.hierarchy === 4) ? 10 : 0),
    paresScore: pares.level === 3 ? 90 : pares.level === 2 ? 60 : pares.level === 1 ? 30 : 0,
    juegoScore: juego.hasJuego ? (juego.totalSum === 31 ? 100 : 70) : (juego.totalSum === 30 ? 40 : 15)
  };
}
