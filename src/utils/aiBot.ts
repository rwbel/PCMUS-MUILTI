/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * aiBot.ts - Lógica de Inteligencia Artificial para los oponentes (bots) del Mus
 *
 * Este archivo contiene toda la toma de decisiones de los bots (partner, oppLeft, oppRight).
 * Está separado de App.tsx para que sea fácil ajustar la dificultad o la personalidad
 * de cada personaje sin tocar la lógica principal del juego.
 *
 * Personalidades disponibles (definidas en characters.ts):
 *   - conservative: Juega seguro, rara vez arriesga
 *   - balanced: Juego equilibrado, se adapta a la situación
 *   - aggressive: Suele envidar y arriesgar más
 *   - bluffer: Puede farolear, tira Órdago incluso con manos mediocres
 */

import {
  Card,
  LancePhase,
  PlayerSobrietyState,
} from '../types/mus';
import { evaluateJuego, evaluatePares, getHandStrength } from './musRules';

type BotSobriety = Pick<PlayerSobrietyState, 'alcohol' | 'caffeine'>;

function clampLevel(val?: number): number {
  return Math.max(0, Math.min(5, val || 0));
}

/**
 * Calcula el tiempo de pensamiento del bot según su alcohol (más lento) y cafeína (más rápido).
 */
export function getBotThinkingDelay(baseMs: number, sobriety?: BotSobriety): number {
  const alc = clampLevel(sobriety?.alcohol);
  const caf = clampLevel(sobriety?.caffeine);
  // Alcohol ralentiza hasta +55%, cafeína acelera hasta -55%
  const factor = Math.max(0.45, Math.min(1.65, 1 + alc * 0.11 - caf * 0.11));
  return Math.round(baseMs * factor);
}

/**
 * Evalúa la fuerza de una mano para un lance específico, retornando una puntuación de 0 a 100.
 * El alcohol distorsiona al alza la percepción (sobreconfianza) y añade error;
 * la cafeína moderada afila el cálculo y la extrema añade precipitación.
 */
function evaluateHandStrengthForLance(
  hand: Card[],
  lance: LancePhase,
  sobriety?: BotSobriety
): number {
  const strength = getHandStrength(hand);
  const juego = evaluateJuego(hand);

  let baseScore = 50;
  switch (lance) {
    case 'GRANDE':
      baseScore = Math.min(100, strength.grandeScore);
      break;
    case 'CHICA':
      baseScore = Math.min(100, strength.chicaScore);
      break;
    case 'PARES':
      baseScore = strength.paresScore;
      break;
    case 'JUEGO':
      if (!juego.hasJuego) baseScore = 0;
      else baseScore = juego.totalSum === 31 ? 100 : 70;
      break;
    case 'PUNTO':
      baseScore = juego.hasJuego ? 0 : Math.min(100, juego.totalSum * 3);
      break;
  }

  const alc = clampLevel(sobriety?.alcohol);
  const caf = clampLevel(sobriety?.caffeine);

  // Alcohol: ve Reyes donde hay Caballos (+sobreestimación y ruido)
  const alcBias = alc > 0 ? alc * 6 + (Math.random() - 0.3) * alc * 5 : 0;
  // Cafeína: 1-3 precisa el juicio; 4-5 añade ligera precipitación nerviosa
  const cafBias = caf >= 4 ? 6 : caf > 0 ? (baseScore >= 55 ? caf * 2 : -caf * 2) : 0;

  return Math.max(0, Math.min(100, baseScore + alcBias + cafBias));
}

/**
 * Decide si el bot quiere aceptar el MUS (pedir nuevas cartas) o cortarlo.
 * - Con alcohol alto: se envalentona y corta mus con manos mediocres.
 * - Con cafeína alta: impaciencia por descartarse o cortar rápido.
 */
export function decideMus(
  hand: Card[],
  tendency: 'conservative' | 'balanced' | 'aggressive' | 'bluffer',
  sobriety?: BotSobriety
): boolean {
  const strength = getHandStrength(hand);
  const alc = clampLevel(sobriety?.alcohol);
  const caf = clampLevel(sobriety?.caffeine);

  // Alcohol hace creer que se lleva mejor mano de la real
  const perceivedScore =
    strength.grandeScore +
    strength.chicaScore +
    strength.paresScore +
    strength.juegoScore +
    alc * 7;

  // Con mucha borrachera, a veces corta el mus sin pensar
  if (alc >= 3 && Math.random() < alc * 0.1) {
    return false;
  }

  // Con cafeína alta (4+), busca jugada perfecta y suele pedir mus con nerviosismo si no lleva mucho
  if (caf >= 4 && strength.juegoScore === 0 && strength.paresScore < 40) {
    return true;
  }

  if (tendency === 'conservative') {
    return perceivedScore < 40;
  }

  if (tendency === 'aggressive') {
    return perceivedScore < 70;
  }

  if (tendency === 'bluffer') {
    return Math.random() > 0.4 + alc * 0.04;
  }

  return perceivedScore < 55;
}

/**
 * Declaración reglamentaria de Pares o Juego.
 * En el Mus real nadie puede declarar erróneamente ni mentir sobre si lleva pares o juego:
 * siempre devuelve el valor exacto de la mano independientemente de la personalidad o consumiciones.
 */
export function decideDeclaration(
  hand: Card[],
  lance: LancePhase,
  _tendency?: 'conservative' | 'balanced' | 'aggressive' | 'bluffer',
  _sobriety?: BotSobriety
): boolean {
  void _tendency;
  void _sobriety;

  if (lance === 'PARES') {
    return evaluatePares(hand).level > 0;
  }

  if (lance === 'JUEGO') {
    return evaluateJuego(hand).hasJuego;
  }

  return false;
}

/**
 * Decide qué acción tomar durante la fase de apuestas (LANCE_BETTING).
 * Tanto el alcohol como la cafeína modifican el umbral de riesgo y faroleo.
 */
export function decideBettingAction(
  hand: Card[],
  lance: LancePhase,
  betState: {
    currentBet: number;
    isOrdago: boolean;
    bettingTeam: number | null;
    lastAction: string | null;
    previousBet: number;
  },
  tendency: 'conservative' | 'balanced' | 'aggressive' | 'bluffer',
  isMano: boolean,
  sobriety?: BotSobriety
): 'paso' | 'envido' | 'cinco' | 'reenvio' | 'quiero' | 'no_quiero' | 'ordago' {
  const alc = clampLevel(sobriety?.alcohol);
  const caf = clampLevel(sobriety?.caffeine);
  const handStrength = evaluateHandStrengthForLance(hand, lance, sobriety);
  const manoBonus = isMano ? 4 : 0;
  const effectiveStrength = Math.min(100, handStrength + manoBonus);
  const { currentBet, isOrdago } = betState;

  // 1. Ante un Órdago (siempre se responde quiero o no_quiero, aunque el compañero ya haya dicho no_quiero)
  if (isOrdago) {
    const acceptThreshold = Math.max(38, 70 - alc * 6 + (caf >= 2 && caf <= 3 ? 5 : 0));
    if (effectiveStrength >= acceptThreshold || (tendency === 'aggressive' && effectiveStrength >= 55)) {
      return 'quiero';
    }
    if ((tendency === 'bluffer' || alc >= 3) && effectiveStrength >= 35 && Math.random() > 0.45) {
      return 'quiero';
    }
    return 'no_quiero';
  }

  // 2. Sin apuesta previa (currentBet === 0)
  if (currentBet === 0) {
    // Alcohol alto -> Órdagos y cincos temerarios
    if (alc >= 4 && Math.random() < 0.28) {
      return 'ordago';
    }
    if (alc >= 2 && effectiveStrength >= 55 && Math.random() < 0.45) {
      return 'cinco';
    }
    // Cafeína muy alta -> Impaciencia por meter cinco rápido con mano buena
    if (caf >= 4 && effectiveStrength >= 58) {
      return Math.random() < 0.55 ? 'cinco' : 'envido';
    }
    if (effectiveStrength >= 75 && tendency === 'bluffer') {
      return 'ordago';
    }
    if (effectiveStrength >= 72 && (tendency === 'aggressive' || alc >= 1)) {
      return 'cinco';
    }
    if (effectiveStrength >= (tendency === 'aggressive' ? 35 : 45) - alc * 3) {
      return 'envido';
    }
    return 'paso';
  }

  // 3. Ante una apuesta abierta (envite / reenvío)
  if (effectiveStrength >= 75 || (alc >= 4 && Math.random() < 0.25)) {
    if ((tendency === 'bluffer' || alc >= 3) && Math.random() > 0.72 - alc * 0.06) {
      return 'ordago';
    }
    return 'reenvio';
  }

  if (effectiveStrength >= 45 - alc * 4) {
    if (currentBet >= 5 + alc * 2) {
      return 'quiero';
    }
    // Con mucha cafeína tiende a reenviar rápido si ve opción
    if (caf >= 3 && effectiveStrength >= 52) {
      return 'reenvio';
    }
    return alc >= 2 || tendency === 'aggressive' ? 'reenvio' : 'quiero';
  }

  // Con mucho alcohol aguanta envites aunque no lleve buena mano
  if (alc >= 3 && currentBet <= 4 && Math.random() < alc * 0.14) {
    return 'quiero';
  }

  return 'no_quiero';
}

/**
 * Decide qué cartas descartar en la fase de DESCARTE.
 * - Sobrio / con cafeína: descarta óptimamente conservando Reyes (12), Ases (1) y parejas.
 * - Muy borracho (alcohol >= 3): puede cometer despistes al descartar.
 */
export function decideDiscards(
  hand: Card[],
  cardsNeeded?: number,
  sobriety?: BotSobriety
): string[] {
  const alc = clampLevel(sobriety?.alcohol);
  const caf = clampLevel(sobriety?.caffeine);

  // Determinar qué cartas conservar si no se fuerza cardsNeeded
  if (typeof cardsNeeded !== 'number') {
    const pares = evaluatePares(hand);
    const keepIds = new Set<string>();

    // Con cafeína o sobrio conserva Reyes (12), Ases (1) y parejas formadas
    for (const c of hand) {
      if (c.hierarchy === 12 || c.hierarchy === 1) {
        keepIds.add(c.id);
      }
    }
    if (pares.level > 0 && caf >= 1) {
      const counts = new Map<number, Card[]>();
      for (const c of hand) {
        const list = counts.get(c.hierarchy) || [];
        list.push(c);
        counts.set(c.hierarchy, list);
      }
      counts.forEach((cards) => {
        if (cards.length >= 2) cards.forEach((c) => keepIds.add(c.id));
      });
    }

    // Si está muy borracho puede descartar por error una carta buena o guardar una floja
    if (alc >= 3 && Math.random() < alc * 0.12 && keepIds.size > 0) {
      const firstKeep = Array.from(keepIds)[0];
      keepIds.delete(firstKeep);
    }

    if (keepIds.size === 4) {
      const weakestKeep = hand
        .filter((c) => keepIds.has(c.id))
        .sort((a, b) => a.hierarchy - b.hierarchy)[0];
      if (weakestKeep) keepIds.delete(weakestKeep.id);
    } else if (keepIds.size === 0) {
      const strongest = [...hand].sort((a, b) => b.hierarchy - a.hierarchy)[0];
      if (strongest) keepIds.add(strongest.id);
    }

    const discards = hand.filter((c) => !keepIds.has(c.id)).map((c) => c.id);
    if (discards.length === 0 && hand.length > 0) {
      return [hand[0].id];
    }
    return discards;
  }

  if (cardsNeeded <= 0 || cardsNeeded >= hand.length) return [];

  const sortedByWeakness = [...hand].sort((a, b) => a.hierarchy - b.hierarchy);
  if (alc >= 3 && Math.random() < alc * 0.12 && sortedByWeakness.length > cardsNeeded) {
    // Pequeño despiste alcohólico en el descarte
    const swapped = [...sortedByWeakness];
    const tmp = swapped[0];
    swapped[0] = swapped[swapped.length - 1];
    swapped[swapped.length - 1] = tmp;
    return swapped.slice(0, cardsNeeded).map((c) => c.id);
  }

  return sortedByWeakness.slice(0, cardsNeeded).map((c) => c.id);
}