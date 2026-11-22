/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * types/mus.ts - Tipos y interfaces del dominio del juego Mus
 *
 * Define todas las estructuras de datos utilizadas en PCMus Lo-Fi:
 *   - Card: carta de la baraja española (palo, rango, jerarquía, valor)
 *   - PlayerPosition: posición en la mesa (player, oppLeft, partner, oppRight)
 *   - LancePhase: fases del juego (GRANDE, CHICA, PARES, JUEGO, PUNTO)
 *   - GamePhase: fases de la partida (TITLE, DEALING, MUS_CHECK, DISCARD, etc.)
 *   - BetState: estado de una apuesta en curso
 *   - TeamScore: puntuación de un equipo (piedras, juegos ganados)
 *   - Character: definición de un personaje (nombre, voz, tendencia, citas)
 *   - DrinkItem: consumición de la taberna (efectos de alcohol/cafeína)
 *   - PlayerSobrietyState: estado de ebriedad del jugador
 *   - MusSign: señas tradicionales del Mus de Bizkaia
 *
 * Es el "diccionario de datos" del juego. Todos los demás archivos
 * importan tipos desde aquí.
 */

export type Suit = 'oros' | 'copas' | 'espadas' | 'bastos';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  // In 8-reyes 8-ases Mus:
  // 3s and 12s are Reyes (value 10, hierarchy 12)
  // 2s and 1s are Ases (value 1, hierarchy 1)
  value: number; 
  hierarchy: number;
}

export type PlayerPosition = 'player' | 'oppLeft' | 'partner' | 'oppRight';

export type SeatPosition = 'left' | 'right' | 'top';

export type CharacterExpression = 'normal' | 'talking' | 'sign' | 'drunk' | 'caffeinated' | 'surprised' | 'sad';

export interface FaceRig {
  cx: number;
  eyeY: number;
  eyeDx: number;
  eyeW?: number;
  mouthX: number;
  mouthY: number;
  mouthW?: number;
  skin: string;
}

export interface Character {
  id: string;
  name: string;
  title: string;
  avatar: string;
  seatedAvatar?: string;
  /** Imagen sentada con fondo transparente según posición en la mesa */
  seatedLeft?: string;
  seatedRight?: string;
  seatedTop?: string;
  gender: 'male' | 'female';
  description: string;
  voiceStyle: string;
  tendency: 'conservative' | 'balanced' | 'aggressive' | 'bluffer';
  quotes: {
    mus: string[];
    noMus: string[];
    envido: string[];
    quiero: string[];
    noQuiero: string[];
    ordago: string[];
    win: string[];
    lose: string[];
    signReaction: string[];
    banter?: string[];
  };
}

export interface LanceBreakdownItem {
  lance: LancePhase;
  winnerTeam: 1 | 2 | null;
  winnerName: string;
  stonesWon: number;
  reason: string;
  detail: string;
}

export interface HandBreakdown {
  items: LanceBreakdownItem[];
  t1TotalStones: number;
  t2TotalStones: number;
}

export interface LanceResult {
  bet: number;
  accepted: boolean;
  enPaso?: boolean;
  resolvedByNoQuiero?: boolean;
  noQuieroWinnerTeam?: 1 | 2;
  pointsGivenImmediate?: number;
  noPairs?: boolean;
  onlyTeamWithPares?: 1 | 2;
  noJuego?: boolean;
  onlyTeamWithJuego?: 1 | 2;
  winnerTeam?: 1 | 2;
}

export type LancePhase = 'GRANDE' | 'CHICA' | 'PARES' | 'JUEGO' | 'PUNTO';

export type GamePhase =
  | 'TITLE'
  | 'DEALING'
  | 'DRINKS_ORDER'
  | 'MUS_CHECK'
  | 'DISCARD'
  | 'LANCE_INTRO'
  | 'LANCE_DECLARATION'
  | 'LANCE_BETTING'
  | 'SHOWDOWN'
  | 'ROUND_SUMMARY'
  | 'GAME_OVER';

export interface BetState {
  lance: LancePhase;
  currentTurn: PlayerPosition;
  currentBet: number; // 0 = paso, 2 = envido, 5 = cinco, etc.
  previousBet: number; // Prior bet before a reenvío/órdago for accurate no-quiero deje
  isOrdago: boolean;
  bettingTeam: 1 | 2 | null; // Team 1: Player + Partner, Team 2: Rivals
  lastActor: PlayerPosition | null;
  lastAction: 'paso' | 'envido' | 'cinco' | 'reenvio' | 'quiero' | 'no_quiero' | 'ordago' | null;
  eligiblePlayers: PlayerPosition[]; // Ordered clockwise/anti-clockwise from Mano
  passedPlayers: PlayerPosition[];
  declinedPlayers: PlayerPosition[]; // Opposing pair members who said "No quiero" to current bet
  history: string[];
  resolved: boolean;
  accepted: boolean;
  winnerTeam?: 1 | 2;
  pointsForImmediateNoQuiero?: { team: 1 | 2; points: number };
}

export interface TeamScore {
  piedras: number; // 1 stone = 1 point
  chicosWon: number; // Sets / Vacas won
}

export interface MusSign {
  id: string;
  name: string;
  gesture: string;
  meaning: string;
  icon: string;
  requiredCondition: string; // e.g. "2 Reyes", "2 Ases", "Duples", "31 de Juego"
}

export type TimeOfDay = 'atardecer' | 'noche' | 'madrugada' | 'tarde';

export type SpeechSpeaker = PlayerPosition | 'camarero';

export interface PlayerSpeech {
  playerId: SpeechSpeaker;
  text: string;
  actionType?: 'mus' | 'envido' | 'ordago' | 'quiero' | 'paso' | 'seña';
  signType?: string;
  timestamp: number;
}

export type DrinkId = 'cana' | 'vino' | 'carajillo' | 'cafe' | 'agua' | 'tapa';

export interface DrinkItem {
  id: DrinkId;
  name: string;
  category: 'alcohol' | 'caffeine' | 'remedy';
  icon: string;
  shortDesc: string;
  effectDesc: string;
  alcoholDelta: number;
  caffeineDelta: number;
  priceTag: string;
  waiterLines: string[];
}

export interface PlayerSobrietyState {
  alcohol: number;   // 0 (Sobrio) to 5 (Cantando asturianadas / Pasadísimo)
  caffeine: number;  // 0 (Tranquilo) to 5 (Como una moto / Histérico)
  totalDrinks: number;
  lastDrinkId?: DrinkId;
  lastDrinkName?: string;
  activeGlass?: DrinkId;
}

