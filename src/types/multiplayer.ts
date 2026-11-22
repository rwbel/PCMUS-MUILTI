/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * types/multiplayer.ts - Tipos compartidos cliente-servidor para el Mus Multijugador
 */

import {
  BetState,
  Card,
  DrinkId,
  DrinkItem,
  GamePhase,
  LancePhase,
  LanceResult,
  PlayerPosition,
  PlayerSpeech,
  PlayerSobrietyState,
  TeamScore,
  TimeOfDay,
} from './mus';

export type SeatIndex = 0 | 1 | 2 | 3;
export type SeatController = 'human' | 'bot';
export type RoomVisibility = 'public' | 'private';
export type RoomPhase = 'LOBBY' | 'IN_GAME';

export interface PlayerProfile {
  clientId: string;
  name: string;
  avatarId: string;
}

export interface LobbySeat {
  seatIndex: SeatIndex;
  team: 1 | 2;
  controller: SeatController;
  playerId: string | null;
  name: string;
  avatarId: string;
  connected: boolean;
  ready: boolean;
  isHost: boolean;
  allowHumanJoin: boolean;
}

export interface LobbyChatMessage {
  id: string;
  senderName: string;
  avatarId: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface RoomSummary {
  roomId: string;
  code: string;
  title: string;
  visibility: RoomVisibility;
  phase: RoomPhase;
  hostName: string;
  humanCount: number;
  maxHumans: number;
  createdAt: number;
  seatsPreview: Array<{
    seatIndex: SeatIndex;
    name: string;
    avatarId: string;
    controller: SeatController;
    connected: boolean;
  }>;
}

export interface RoomLobbyView {
  roomId: string;
  code: string;
  title: string;
  visibility: RoomVisibility;
  phase: RoomPhase;
  hostPlayerId: string;
  mySeatIndex: SeatIndex | null;
  seats: LobbySeat[];
  chat: LobbyChatMessage[];
}

export interface GameSeatInfo {
  seatIndex: SeatIndex;
  relativePos: PlayerPosition;
  team: 1 | 2;
  controller: SeatController;
  name: string;
  avatarId: string;
  connected: boolean;
  cardCount: number;
  sobriety: PlayerSobrietyState;
  pendingDrink: DrinkItem | null;
  orderedDrinkThisHand: boolean;
  readyForNextHand: boolean;
}

export interface ShowdownBreakdownItem {
  lance: LancePhase;
  winnerTeam: 1 | 2 | null;
  winnerPlayerName: string;
  stonesWon: number;
  reason: string;
  explanation: string;
}

export interface TableSignEvent {
  signId: string;
  seatIndex: SeatIndex;
  relativePos: PlayerPosition;
  signIcon: string;
  durationMs: number;
  catchableByOpponent: boolean;
  timestamp: number;
}

export interface DrinkEffectNotification {
  seatIndex: SeatIndex;
  relativePos: PlayerPosition;
  drink: DrinkItem;
  alcohol: number;
  caffeine: number;
  timestamp: number;
}

export interface GameClientView {
  roomId: string;
  code: string;
  title: string;
  hostPlayerId: string;
  mySeatIndex: SeatIndex;
  myTeam: 1 | 2;
  gamePhase: GamePhase;
  isFirstHandOfGame: boolean;
  hasFirstHandCutDone: boolean;
  musCutThisHand: boolean;
  manoPos: PlayerPosition;
  currentTurnPos: PlayerPosition;
  currentLance: LancePhase | null;
  completedLances: LancePhase[];
  betState: BetState | null;
  scoreTeam1: TeamScore;
  scoreTeam2: TeamScore;
  lanceResults: Record<LancePhase, LanceResult>;
  seats: Record<PlayerPosition, GameSeatInfo>;
  hands: Record<PlayerPosition, Card[]>;
  speeches: Record<PlayerPosition, PlayerSpeech | null>;
  waiterSpeech: PlayerSpeech | null;
  activeCatchableSign: {
    signId: string;
    opponentPos: PlayerPosition;
    signIcon: string;
  } | null;
  showdownMessage: string | null;
  justWonJuego: boolean;
  breakdownDetails: ShowdownBreakdownItem[];
  readyNextHandCount: number;
  totalConnectedHumans: number;
  myReadyForNextHand: boolean;
  isTurnBusy: boolean;
  timeOfDay: TimeOfDay;
}

export type GameBetActionType =
  | 'paso'
  | 'envido'
  | 'cinco'
  | 'reenvio'
  | 'quiero'
  | 'no_quiero'
  | 'ordago';

export type ClientWsMessage =
  | { type: 'hello'; clientId: string; name: string; avatarId: string }
  | { type: 'profile:update'; name: string; avatarId: string }
  | { type: 'rooms:subscribe' }
  | {
      type: 'room:create';
      title?: string;
      visibility: RoomVisibility;
      autoStartSolo?: boolean;
      botIds?: [string, string, string];
    }
  | { type: 'room:join'; roomId?: string; code?: string }
  | { type: 'room:leave' }
  | { type: 'room:claim_seat'; seatIndex: SeatIndex }
  | {
      type: 'room:configure_seat';
      seatIndex: SeatIndex;
      avatarId?: string;
      allowHumanJoin?: boolean;
      setBot?: boolean;
    }
  | { type: 'room:toggle_ready'; ready?: boolean }
  | { type: 'room:chat'; text: string }
  | { type: 'room:start_game' }
  | { type: 'room:return_lobby' }
  | { type: 'game:mus_vote'; voteMus: boolean }
  | { type: 'game:discard'; cardIds: string[] }
  | { type: 'game:declare' }
  | { type: 'game:bet_action'; action: GameBetActionType; customAmount?: number }
  | { type: 'game:order_drink'; drinkId: DrinkId }
  | { type: 'game:send_sign'; signId: string }
  | { type: 'game:catch_sign'; signId: string }
  | { type: 'game:next_hand_ready' }
  | { type: 'game:rematch' }
  | { type: 'game:cycle_time_of_day' }
  | { type: 'game:poke_waiter' };

export type ServerWsMessage =
  | { type: 'welcome'; clientId: string; activeRoomId: string | null }
  | { type: 'rooms:list'; rooms: RoomSummary[] }
  | { type: 'room:lobby'; lobby: RoomLobbyView }
  | { type: 'room:left'; reason?: string }
  | { type: 'game:state'; state: GameClientView }
  | { type: 'game:sign'; sign: TableSignEvent }
  | { type: 'game:drink_effect'; effect: DrinkEffectNotification }
  | { type: 'error'; message: string };
