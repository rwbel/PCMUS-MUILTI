/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * src/shared/musRoom.ts - Motor isomórfico (servidor + navegador) de partida de Mus (Reglamento de Bizkaia)
 */

function makeUuid(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
import {
  BetState,
  Card,
  DrinkId,
  DrinkItem,
  GamePhase,
  LancePhase,
  LanceResult,
  PlayerPosition,
  PlayerSobrietyState,
  PlayerSpeech,
  TeamScore,
  TimeOfDay,
} from '../types/mus';
import {
  DrinkEffectNotification,
  GameBetActionType,
  GameClientView,
  GameSeatInfo,
  LobbyChatMessage,
  LobbySeat,
  PlayerProfile,
  RoomLobbyView,
  RoomPhase,
  RoomSummary,
  RoomVisibility,
  SeatController,
  SeatIndex,
  ShowdownBreakdownItem,
  TableSignEvent,
} from '../types/multiplayer';
import {
  AUTHENTIC_MUS_SIGNS,
  CHARACTER_DATA,
  PLAYABLE_CHARACTER_IDS,
} from './characterData';
import {
  createSpanishDeck,
  evaluateJuego,
  evaluateLanceBetweenTeams,
  evaluatePares,
  getValidSignsForHand,
  shuffleDeck,
} from '../utils/musRules';
import {
  decideBettingAction,
  decideDeclaration,
  decideDiscards,
  decideMus,
  getBotThinkingDelay,
} from '../utils/aiBot';
import {
  getNpcOrderQuote,
  pickNpcDrink,
  shouldNpcOrderDrink,
  TAVERN_DRINKS,
} from '../utils/drinks';
import { TARGET_JUEGOS, TARGET_PIEDRAS, TIMING } from '../config/gameConfig';

const ALL_SEATS: SeatIndex[] = [0, 1, 2, 3];

const DEFAULT_BOT_IDS = ['cura', 'guardia', 'tuno', 'taxista'];

function emptySobriety(): PlayerSobrietyState {
  return { alcohol: 0, caffeine: 0, totalDrinks: 0 };
}

function emptyLanceResults(): Record<LancePhase, LanceResult> {
  return {
    GRANDE: { bet: 0, accepted: false },
    CHICA: { bet: 0, accepted: false },
    PARES: { bet: 0, accepted: false },
    JUEGO: { bet: 0, accepted: false },
    PUNTO: { bet: 0, accepted: false },
  };
}

function getCanonicalTeam(seat: SeatIndex): 1 | 2 {
  return seat === 0 || seat === 2 ? 1 : 2;
}

function nextSeat(seat: SeatIndex): SeatIndex {
  return ((seat + 1) % 4) as SeatIndex;
}

function getOrderedSeatsFrom(start: SeatIndex): SeatIndex[] {
  return [0, 1, 2, 3].map((offset) => ((start + offset) % 4) as SeatIndex);
}

function toRelativePos(targetSeat: SeatIndex, observerSeat: SeatIndex): PlayerPosition {
  const diff = (targetSeat - observerSeat + 4) % 4;
  if (diff === 0) return 'player';
  if (diff === 1) return 'oppRight';
  if (diff === 2) return 'partner';
  return 'oppLeft';
}

function canonicalSeatToBasePos(seat: SeatIndex): PlayerPosition {
  if (seat === 0) return 'player';
  if (seat === 1) return 'oppRight';
  if (seat === 2) return 'partner';
  return 'oppLeft';
}

function basePosToCanonicalSeat(pos: PlayerPosition): SeatIndex {
  if (pos === 'player') return 0;
  if (pos === 'oppRight') return 1;
  if (pos === 'partner') return 2;
  return 3;
}

function flipTeam(team: 1 | 2, perspectiveTeam: 1 | 2): 1 | 2 {
  if (perspectiveTeam === 1) return team;
  return team === 1 ? 2 : 1;
}

export interface RoomBroadcastCallbacks {
  sendToClient: (clientId: string, payload: unknown) => void;
  onRoomUpdated: (room: MusRoom) => void;
}

interface InternalSeat {
  seatIndex: SeatIndex;
  team: 1 | 2;
  controller: SeatController;
  playerId: string | null;
  name: string;
  avatarId: string;
  connected: boolean;
  ready: boolean;
  allowHumanJoin: boolean;
  sobriety: PlayerSobrietyState;
  pendingDrink: DrinkItem | null;
  orderedDrinkThisHand: boolean;
  readyForNextHand: boolean;
}

interface ActiveCatchableSign {
  signId: string;
  senderSeat: SeatIndex;
  senderTeam: 1 | 2;
  signIcon: string;
  expiresAt: number;
  caught: boolean;
}

export class MusRoom {
  public readonly roomId: string;
  public readonly code: string;
  public title: string;
  public visibility: RoomVisibility;
  public phase: RoomPhase = 'LOBBY';
  public hostPlayerId: string;
  public readonly createdAt: number = Date.now();
  public lastActivityAt: number = Date.now();

  private seats: InternalSeat[];
  private chat: LobbyChatMessage[] = [];
  private callbacks: RoomBroadcastCallbacks;

  // Game State
  private gamePhase: GamePhase = 'TITLE';
  private isFirstHandOfGame = true;
  private hasFirstHandCutDone = false;
  private musCutThisHand = false;
  private manoSeat: SeatIndex = 0;
  private currentTurnSeat: SeatIndex = 0;
  private currentLance: LancePhase | null = null;
  private completedLances: LancePhase[] = [];
  private deck: Card[] = [];
  private hands: Record<SeatIndex, Card[]> = { 0: [], 1: [], 2: [], 3: [] };
  private musVotes: Record<SeatIndex, boolean | null> = { 0: null, 1: null, 2: null, 3: null };
  private discardDone: Record<SeatIndex, boolean> = { 0: false, 1: false, 2: false, 3: false };
  private lanceDeclarations: Record<SeatIndex, boolean | null> = { 0: null, 1: null, 2: null, 3: null };
  private betState: {
    lance: LancePhase;
    currentTurnSeat: SeatIndex;
    currentBet: number;
    previousBet: number;
    isOrdago: boolean;
    bettingTeam: 1 | 2 | null;
    lastActorSeat: SeatIndex | null;
    lastAction: GameBetActionType | null;
    eligibleSeats: SeatIndex[];
    passedSeats: SeatIndex[];
    declinedSeats: SeatIndex[];
    history: string[];
    resolved: boolean;
    accepted: boolean;
    winnerTeam?: 1 | 2;
  } | null = null;

  private scoreTeam1: TeamScore = { piedras: 0, chicosWon: 0 };
  private scoreTeam2: TeamScore = { piedras: 0, chicosWon: 0 };
  private lanceResults: Record<LancePhase, LanceResult> = emptyLanceResults();
  private speeches: Record<SeatIndex, PlayerSpeech | null> = { 0: null, 1: null, 2: null, 3: null };
  private waiterSpeech: PlayerSpeech | null = null;
  private activeCatchableSign: ActiveCatchableSign | null = null;
  private showdownMessage: string | null = null;
  private justWonJuego = false;
  private breakdownDetails: ShowdownBreakdownItem[] = [];
  private isTurnBusy = false;
  private timeOfDay: TimeOfDay = 'atardecer';

  // Timers & Cycle Guards
  private handCycleId = 0;
  private turnActionTimer: ReturnType<typeof setTimeout> | null = null;
  private transitionTimer: ReturnType<typeof setTimeout> | null = null;
  private catchSignTimer: ReturnType<typeof setTimeout> | null = null;
  private waiterSpeechTimer: ReturnType<typeof setTimeout> | null = null;
  private seatSpeechTimers: Partial<Record<SeatIndex, ReturnType<typeof setTimeout>>> = {};
  private botReactionTimers: ReturnType<typeof setTimeout>[] = [];

  constructor(
    roomId: string,
    code: string,
    creator: PlayerProfile,
    options: {
      title?: string;
      visibility: RoomVisibility;
      botIds?: [string, string, string];
    },
    callbacks: RoomBroadcastCallbacks
  ) {
    this.roomId = roomId;
    this.code = code;
    this.visibility = options.visibility;
    this.hostPlayerId = creator.clientId;
    this.callbacks = callbacks;

    const cleanTitle = (options.title || '').trim().slice(0, 36);
    this.title = cleanTitle || `Mesa de ${creator.name.slice(0, 18)}`;

    const safeCreatorAvatar = this.normalizeAvatarId(creator.avatarId);
    const chosenBots = this.pickDistinctBotIds(safeCreatorAvatar, options.botIds);

    this.seats = ALL_SEATS.map((idx) => {
      if (idx === 0) {
        return {
          seatIndex: 0,
          team: 1,
          controller: 'human',
          playerId: creator.clientId,
          name: this.sanitizeName(creator.name),
          avatarId: safeCreatorAvatar,
          connected: true,
          ready: true,
          allowHumanJoin: true,
          sobriety: emptySobriety(),
          pendingDrink: null,
          orderedDrinkThisHand: false,
          readyForNextHand: false,
        };
      }
      const botCharId = chosenBots[idx - 1] || DEFAULT_BOT_IDS[idx % DEFAULT_BOT_IDS.length];
      const botChar = CHARACTER_DATA[botCharId] || CHARACTER_DATA.cura;
      return {
        seatIndex: idx,
        team: getCanonicalTeam(idx),
        controller: 'bot',
        playerId: null,
        name: botChar.name,
        avatarId: botChar.id,
        connected: true,
        ready: true,
        allowHumanJoin: true,
        sobriety: emptySobriety(),
        pendingDrink: null,
        orderedDrinkThisHand: false,
        readyForNextHand: true,
      };
    });

    this.addSystemChat(`${this.sanitizeName(creator.name)} ha abierto la mesa (${this.code}).`);
  }

  private normalizeAvatarId(id?: string): string {
    if (id && (PLAYABLE_CHARACTER_IDS as readonly string[]).includes(id)) {
      return id;
    }
    return 'cura';
  }

  private sanitizeName(name?: string): string {
    const cleaned = (name || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 20);
    return cleaned || 'Parroquiano';
  }

  private pickDistinctBotIds(excludeId: string, preferred?: [string, string, string]): string[] {
    const result: string[] = [];
    const candidates = preferred ? [...preferred, ...PLAYABLE_CHARACTER_IDS] : [...PLAYABLE_CHARACTER_IDS];
    for (const c of candidates) {
      if (result.length >= 3) break;
      const norm = this.normalizeAvatarId(c);
      if (norm !== excludeId && !result.includes(norm)) {
        result.push(norm);
      }
    }
    while (result.length < 3) {
      const next = PLAYABLE_CHARACTER_IDS[result.length % PLAYABLE_CHARACTER_IDS.length];
      if (!result.includes(next)) result.push(next);
      else result.push('cura');
    }
    return result;
  }

  private addSystemChat(text: string) {
    this.chat.push({
      id: makeUuid(),
      senderName: 'Manolo',
      avatarId: 'camarero',
      text: text.slice(0, 220),
      timestamp: Date.now(),
      isSystem: true,
    });
    if (this.chat.length > 40) {
      this.chat = this.chat.slice(-40);
    }
  }

  public getHumanSeats(): InternalSeat[] {
    return this.seats.filter((s) => s.controller === 'human' && s.playerId !== null);
  }

  public getConnectedHumanCount(): number {
    return this.seats.filter((s) => s.controller === 'human' && s.connected).length;
  }

  public hasPlayer(clientId: string): boolean {
    return this.seats.some((s) => s.playerId === clientId);
  }

  public getPlayerSeat(clientId: string): InternalSeat | undefined {
    return this.seats.find((s) => s.playerId === clientId);
  }

  public getSummary(): RoomSummary {
    const hostSeat = this.seats.find((s) => s.playerId === this.hostPlayerId) || this.getHumanSeats()[0];
    return {
      roomId: this.roomId,
      code: this.code,
      title: this.title,
      visibility: this.visibility,
      phase: this.phase,
      hostName: hostSeat?.name || 'Anfitrión',
      humanCount: this.getHumanSeats().length,
      maxHumans: 4,
      createdAt: this.createdAt,
      seatsPreview: this.seats.map((s) => ({
        seatIndex: s.seatIndex,
        name: s.name,
        avatarId: s.avatarId,
        controller: s.controller,
        connected: s.connected,
      })),
    };
  }

  private clearAllTimers() {
    if (this.turnActionTimer) {
      clearTimeout(this.turnActionTimer);
      this.turnActionTimer = null;
    }
    if (this.transitionTimer) {
      clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
    if (this.catchSignTimer) {
      clearTimeout(this.catchSignTimer);
      this.catchSignTimer = null;
    }
    if (this.waiterSpeechTimer) {
      clearTimeout(this.waiterSpeechTimer);
      this.waiterSpeechTimer = null;
    }
    for (const key of ALL_SEATS) {
      const t = this.seatSpeechTimers[key];
      if (t) {
        clearTimeout(t);
        delete this.seatSpeechTimers[key];
      }
    }
    for (const t of this.botReactionTimers) {
      clearTimeout(t);
    }
    this.botReactionTimers = [];
  }

  public destroy() {
    this.handCycleId += 1;
    this.clearAllTimers();
  }

  // =========================================================================
  // LOBBY & CONNECTION MANAGEMENT
  // =========================================================================

  public joinPlayer(profile: PlayerProfile): { ok: boolean; error?: string } {
    this.lastActivityAt = Date.now();
    const existing = this.getPlayerSeat(profile.clientId);
    if (existing) {
      existing.connected = true;
      existing.name = this.sanitizeName(profile.name);
      existing.avatarId = this.normalizeAvatarId(profile.avatarId);
      this.broadcastState();
      return { ok: true };
    }

    if (this.phase !== 'LOBBY') {
      return { ok: false, error: 'La partida ya está en curso en esta mesa.' };
    }

    // Prefer placing the 2nd player as partner (seat 2) if empty, else first open bot seat
    const preferredOrder: SeatIndex[] = [2, 1, 3, 0];
    const openSeatIdx = preferredOrder.find((idx) => {
      const s = this.seats[idx];
      return s.controller === 'bot' && s.allowHumanJoin;
    });

    if (openSeatIdx === undefined) {
      return { ok: false, error: 'La mesa está completa o cerrada a nuevos jugadores.' };
    }

    const seat = this.seats[openSeatIdx];
    seat.controller = 'human';
    seat.playerId = profile.clientId;
    seat.name = this.sanitizeName(profile.name);
    seat.avatarId = this.normalizeAvatarId(profile.avatarId);
    seat.connected = true;
    seat.ready = true;
    seat.readyForNextHand = false;

    this.addSystemChat(`${seat.name} se ha sentado en la mesa.`);
    this.broadcastState();
    this.callbacks.onRoomUpdated(this);
    return { ok: true };
  }

  public updatePlayerProfile(profile: PlayerProfile) {
    const seat = this.getPlayerSeat(profile.clientId);
    if (!seat) return;
    seat.name = this.sanitizeName(profile.name);
    seat.avatarId = this.normalizeAvatarId(profile.avatarId);
    this.lastActivityAt = Date.now();
    this.broadcastState();
    this.callbacks.onRoomUpdated(this);
  }

  public handleDisconnect(clientId: string) {
    const seat = this.getPlayerSeat(clientId);
    if (!seat) return;
    seat.connected = false;
    this.lastActivityAt = Date.now();

    if (this.phase === 'LOBBY') {
      this.addSystemChat(`${seat.name} se ha desconectado temporalmente.`);
      this.broadcastState();
      this.callbacks.onRoomUpdated(this);
      return;
    }

    // In game: if it's currently this disconnected human's turn, schedule AI takeover
    this.addSystemChat(`${seat.name} perdió la conexión (la IA le cubrirá el turno si hace falta).`);
    this.scheduleTurnDriver();
    this.checkNextHandReadyBarrier();
    this.broadcastState();
    this.callbacks.onRoomUpdated(this);
  }

  public handleReconnect(clientId: string) {
    const seat = this.getPlayerSeat(clientId);
    if (!seat) return;
    seat.connected = true;
    this.lastActivityAt = Date.now();
    this.broadcastState();
    this.callbacks.onRoomUpdated(this);
  }

  public leavePlayer(clientId: string, reason?: string): boolean {
    const seat = this.getPlayerSeat(clientId);
    if (!seat) return false;
    this.lastActivityAt = Date.now();

    const leavingName = seat.name;
    // Revert vacated seat to an AI bot preserving its character avatar
    const fallbackBotId = this.normalizeAvatarId(seat.avatarId);
    const botChar = CHARACTER_DATA[fallbackBotId] || CHARACTER_DATA.cura;
    seat.controller = 'bot';
    seat.playerId = null;
    seat.name = botChar.name;
    seat.avatarId = botChar.id;
    seat.connected = true;
    seat.ready = true;
    seat.allowHumanJoin = true;
    seat.readyForNextHand = true;

    const remainingHumans = this.getHumanSeats();
    if (remainingHumans.length === 0) {
      this.destroy();
      return true; // room is now empty and should be deleted
    }

    if (this.hostPlayerId === clientId) {
      const connectedNext = remainingHumans.find((s) => s.connected) || remainingHumans[0];
      this.hostPlayerId = connectedNext.playerId!;
      this.addSystemChat(`${leavingName} salió de la mesa. ${connectedNext.name} es ahora el anfitrión.`);
    } else {
      this.addSystemChat(reason || `${leavingName} dejó su silla (la ocupa ${botChar.name} IA).`);
    }

    if (this.phase === 'IN_GAME') {
      // If it was the leaving player's turn, let the bot drive it immediately
      this.scheduleTurnDriver();
      this.checkNextHandReadyBarrier();
    }

    this.broadcastState();
    this.callbacks.onRoomUpdated(this);
    return false;
  }

  public claimSeat(clientId: string, targetSeatIndex: SeatIndex): { ok: boolean; error?: string } {
    if (this.phase !== 'LOBBY') {
      return { ok: false, error: 'Solo puedes cambiar de silla en la sala de espera.' };
    }
    const currentSeat = this.getPlayerSeat(clientId);
    if (!currentSeat) return { ok: false, error: 'No estás sentado en esta mesa.' };
    if (currentSeat.seatIndex === targetSeatIndex) return { ok: true };

    const target = this.seats[targetSeatIndex];
    if (!target || target.controller === 'human') {
      return { ok: false, error: 'Esa silla ya está ocupada por otro jugador humano.' };
    }

    const oldBotChar = CHARACTER_DATA[this.normalizeAvatarId(currentSeat.avatarId)] || CHARACTER_DATA.cura;

    // Move human to target seat
    target.controller = 'human';
    target.playerId = clientId;
    target.name = currentSeat.name;
    target.avatarId = currentSeat.avatarId;
    target.connected = true;
    target.ready = currentSeat.ready;
    target.allowHumanJoin = true;

    // Revert old seat to bot
    currentSeat.controller = 'bot';
    currentSeat.playerId = null;
    currentSeat.name = oldBotChar.name;
    currentSeat.avatarId = oldBotChar.id;
    currentSeat.connected = true;
    currentSeat.ready = true;
    currentSeat.allowHumanJoin = true;

    this.lastActivityAt = Date.now();
    this.broadcastState();
    this.callbacks.onRoomUpdated(this);
    return { ok: true };
  }

  public configureSeat(
    clientId: string,
    seatIndex: SeatIndex,
    opts: { avatarId?: string; allowHumanJoin?: boolean; setBot?: boolean }
  ): { ok: boolean; error?: string } {
    if (this.phase !== 'LOBBY') {
      return { ok: false, error: 'No se pueden configurar sillas con la partida empezada.' };
    }
    if (clientId !== this.hostPlayerId) {
      return { ok: false, error: 'Solo el anfitrión de la mesa puede configurar las sillas.' };
    }
    const target = this.seats[seatIndex];
    if (!target) return { ok: false, error: 'Silla inválida.' };

    if (opts.setBot && target.controller === 'human' && target.playerId !== clientId) {
      const kickedId = target.playerId!;
      const botChar = CHARACTER_DATA[this.normalizeAvatarId(target.avatarId)] || CHARACTER_DATA.cura;
      target.controller = 'bot';
      target.playerId = null;
      target.name = botChar.name;
      target.avatarId = botChar.id;
      target.connected = true;
      target.ready = true;
      this.callbacks.sendToClient(kickedId, {
        type: 'room:left',
        reason: 'El anfitrión convirtió tu asiento en bot IA.',
      });
    }

    if (target.controller === 'bot' && opts.avatarId) {
      const charId = this.normalizeAvatarId(opts.avatarId);
      const char = CHARACTER_DATA[charId];
      if (char) {
        target.avatarId = char.id;
        target.name = char.name;
      }
    }

    if (typeof opts.allowHumanJoin === 'boolean') {
      target.allowHumanJoin = opts.allowHumanJoin;
    }

    this.lastActivityAt = Date.now();
    this.broadcastState();
    this.callbacks.onRoomUpdated(this);
    return { ok: true };
  }

  public toggleReady(clientId: string, ready?: boolean) {
    if (this.phase !== 'LOBBY') return;
    const seat = this.getPlayerSeat(clientId);
    if (!seat) return;
    seat.ready = typeof ready === 'boolean' ? ready : !seat.ready;
    this.lastActivityAt = Date.now();
    this.broadcastState();
  }

  public addChat(clientId: string, rawText: string) {
    const seat = this.getPlayerSeat(clientId);
    if (!seat) return;
    const text = rawText.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 220);
    if (!text) return;

    this.chat.push({
      id: makeUuid(),
      senderName: seat.name,
      avatarId: seat.avatarId,
      text,
      timestamp: Date.now(),
    });
    if (this.chat.length > 40) {
      this.chat = this.chat.slice(-40);
    }
    this.lastActivityAt = Date.now();
    this.broadcastState();
  }

  public returnToLobby(clientId: string): { ok: boolean; error?: string } {
    if (clientId !== this.hostPlayerId) {
      return { ok: false, error: 'Solo el anfitrión puede devolver la mesa a la sala de espera.' };
    }
    this.handCycleId += 1;
    this.clearAllTimers();
    this.phase = 'LOBBY';
    this.gamePhase = 'TITLE';
    this.isTurnBusy = false;
    this.activeCatchableSign = null;
    this.showdownMessage = null;
    this.breakdownDetails = [];
    for (const s of this.seats) {
      s.sobriety = emptySobriety();
      s.pendingDrink = null;
      s.orderedDrinkThisHand = false;
      s.ready = true;
      s.readyForNextHand = s.controller === 'bot';
    }
    this.addSystemChat('La mesa ha vuelto a la sala de espera.');
    this.broadcastState();
    this.callbacks.onRoomUpdated(this);
    return { ok: true };
  }

  // =========================================================================
  // GAME ENGINE (REGLAMENTO DE BIZKAIA)
  // =========================================================================

  public startGame(clientId?: string): { ok: boolean; error?: string } {
    if (clientId && clientId !== this.hostPlayerId) {
      return { ok: false, error: 'Solo el anfitrión puede iniciar la partida.' };
    }
    const unready = this.seats.filter(
      (s) => s.controller === 'human' && s.connected && s.playerId !== this.hostPlayerId && !s.ready
    );
    if (unready.length > 0) {
      return { ok: false, error: `Faltan por marcar listo: ${unready.map((u) => u.name).join(', ')}` };
    }

    this.phase = 'IN_GAME';
    this.scoreTeam1 = { piedras: 0, chicosWon: 0 };
    this.scoreTeam2 = { piedras: 0, chicosWon: 0 };
    this.isFirstHandOfGame = true;
    this.hasFirstHandCutDone = false;
    this.justWonJuego = false;
    this.manoSeat = 0;

    for (const s of this.seats) {
      s.sobriety = emptySobriety();
      s.pendingDrink = null;
      s.orderedDrinkThisHand = false;
      s.readyForNextHand = s.controller === 'bot';
    }

    this.lastActivityAt = Date.now();
    this.startNewHand(0);
    this.callbacks.onRoomUpdated(this);
    return { ok: true };
  }

  public rematch(clientId: string): { ok: boolean; error?: string } {
    if (this.gamePhase !== 'GAME_OVER') {
      return { ok: false, error: 'La partida aún no ha terminado.' };
    }
    if (clientId !== this.hostPlayerId && this.getConnectedHumanCount() > 1) {
      return { ok: false, error: 'Solo el anfitrión puede iniciar la revancha.' };
    }
    return this.startGame();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private isCycleActive(cycleId: number): boolean {
    return (
      cycleId === this.handCycleId &&
      this.phase === 'IN_GAME' &&
      this.gamePhase !== 'GAME_OVER' &&
      this.gamePhase !== 'TITLE'
    );
  }

  private setSpeech(
    seatIdx: SeatIndex,
    text: string,
    actionType?: PlayerSpeech['actionType'],
    signType?: string
  ) {
    const existing = this.seatSpeechTimers[seatIdx];
    if (existing) clearTimeout(existing);

    const speech: PlayerSpeech = {
      playerId: canonicalSeatToBasePos(seatIdx),
      text,
      actionType,
      signType,
      timestamp: Date.now(),
    };
    this.speeches[seatIdx] = speech;
    this.broadcastState();

    this.seatSpeechTimers[seatIdx] = setTimeout(() => {
      this.speeches[seatIdx] = null;
      this.broadcastState();
    }, TIMING.SPEECH_DISPLAY_MS);
  }

  private triggerWaiterComment(text: string) {
    if (this.waiterSpeechTimer) clearTimeout(this.waiterSpeechTimer);
    this.waiterSpeech = {
      playerId: 'camarero',
      text,
      timestamp: Date.now(),
    };
    this.broadcastState();

    this.waiterSpeechTimer = setTimeout(() => {
      this.waiterSpeech = null;
      this.broadcastState();
    }, TIMING.WAITER_COMMENT_MS);
  }

  private startNewHand(manoOverride?: SeatIndex) {
    const activeMano = manoOverride ?? this.manoSeat;
    this.handCycleId += 1;
    const cycleId = this.handCycleId;
    this.clearAllTimers();

    this.isTurnBusy = true;
    const d = shuffleDeck(createSpanishDeck());
    this.hands = {
      0: d.slice(0, 4),
      1: d.slice(4, 8),
      2: d.slice(8, 12),
      3: d.slice(12, 16),
    };
    this.deck = d.slice(16);
    this.manoSeat = activeMano;
    this.currentTurnSeat = activeMano;
    this.musCutThisHand = false;
    this.musVotes = { 0: null, 1: null, 2: null, 3: null };
    this.discardDone = { 0: false, 1: false, 2: false, 3: false };
    this.lanceDeclarations = { 0: null, 1: null, 2: null, 3: null };
    this.lanceResults = emptyLanceResults();
    this.completedLances = [];
    this.currentLance = null;
    this.betState = null;
    this.activeCatchableSign = null;
    this.showdownMessage = null;
    this.justWonJuego = false;
    this.breakdownDetails = [];
    this.speeches = { 0: null, 1: null, 2: null, 3: null };
    this.waiterSpeech = null;
    this.gamePhase = 'DRINKS_ORDER';

    for (const s of this.seats) {
      s.pendingDrink = null;
      s.orderedDrinkThisHand = false;
      s.readyForNextHand = s.controller === 'bot';
    }

    this.broadcastState();
    void this.runPreMusDrinkPhase(cycleId, activeMano);
  }

  private async runPreMusDrinkPhase(cycleId: number, activeMano: SeatIndex) {
    await this.sleep(Math.min(TIMING.DEALING_ANIMATION_MS, 500));
    if (!this.isCycleActive(cycleId)) return;

    const orderedSeats = getOrderedSeatsFrom(activeMano);
    for (const seatIdx of orderedSeats) {
      if (!this.isCycleActive(cycleId)) return;
      const seat = this.seats[seatIdx];
      if (seat.controller !== 'bot') continue;

      const char = CHARACTER_DATA[seat.avatarId];
      if (!char) continue;
      if (!shouldNpcOrderDrink(seat.avatarId, seat.sobriety)) continue;

      const drink = pickNpcDrink(seat.avatarId, seat.sobriety);
      seat.pendingDrink = drink;
      seat.orderedDrinkThisHand = true;

      this.currentTurnSeat = seatIdx;
      this.setSpeech(seatIdx, getNpcOrderQuote(seat.name, drink), 'mus');
      await this.sleep(1050);
      if (!this.isCycleActive(cycleId)) return;

      this.triggerWaiterComment(`¡Marchando ${drink.name} para ${seat.name}!`);
      await this.sleep(900);
    }

    if (!this.isCycleActive(cycleId)) return;
    this.gamePhase = 'MUS_CHECK';
    this.currentTurnSeat = activeMano;
    this.isTurnBusy = false;
    this.broadcastState();
    this.scheduleTurnDriver();
  }

  public orderDrink(clientId: string, drinkId: DrinkId): { ok: boolean; error?: string } {
    const seat = this.getPlayerSeat(clientId);
    if (!seat) return { ok: false, error: 'No estás en esta partida.' };

    if (
      this.musCutThisHand ||
      seat.orderedDrinkThisHand ||
      !['DRINKS_ORDER', 'MUS_CHECK', 'DISCARD'].includes(this.gamePhase)
    ) {
      this.triggerWaiterComment('¡Durante esta mano ya no se sirven más rondas! Espera al comienzo de la siguiente.');
      return { ok: false, error: 'Ya no puedes pedir consumiciones en esta mano.' };
    }

    const drink = TAVERN_DRINKS.find((d) => d.id === drinkId);
    if (!drink) return { ok: false, error: 'Consumición no encontrada.' };

    seat.pendingDrink = drink;
    seat.orderedDrinkThisHand = true;
    const waiterLine = drink.waiterLines[Math.floor(Math.random() * drink.waiterLines.length)];
    this.triggerWaiterComment(`${waiterLine} (${seat.name}, hará efecto al cortar el mus).`);
    this.broadcastState();
    return { ok: true };
  }

  private applyPendingDrinkEffects() {
    for (const seat of this.seats) {
      const drink = seat.pendingDrink;
      if (!drink) continue;
      const nextState: PlayerSobrietyState = {
        alcohol: Math.max(0, Math.min(5, seat.sobriety.alcohol + drink.alcoholDelta)),
        caffeine: Math.max(0, Math.min(5, seat.sobriety.caffeine + drink.caffeineDelta)),
        totalDrinks: seat.sobriety.totalDrinks + 1,
        lastDrinkId: drink.id,
        lastDrinkName: drink.name,
        activeGlass: drink.id,
      };
      seat.sobriety = nextState;
      seat.pendingDrink = null;

      this.broadcastDrinkEffect(seat.seatIndex, drink, nextState.alcohol, nextState.caffeine);
    }
  }

  private broadcastDrinkEffect(
    targetSeat: SeatIndex,
    drink: DrinkItem,
    alcohol: number,
    caffeine: number
  ) {
    for (const viewer of this.getHumanSeats()) {
      if (!viewer.connected || !viewer.playerId) continue;
      const effect: DrinkEffectNotification = {
        seatIndex: targetSeat,
        relativePos: toRelativePos(targetSeat, viewer.seatIndex),
        drink,
        alcohol,
        caffeine,
        timestamp: Date.now(),
      };
      this.callbacks.sendToClient(viewer.playerId, {
        type: 'game:drink_effect',
        effect,
      });
    }
  }

  private broadcastSignEvent(
    senderSeat: SeatIndex,
    signId: string,
    signIcon: string,
    durationMs: number,
    catchableByOpponent: boolean
  ) {
    const senderTeam = getCanonicalTeam(senderSeat);
    for (const viewer of this.getHumanSeats()) {
      if (!viewer.connected || !viewer.playerId) continue;
      const viewerTeam = getCanonicalTeam(viewer.seatIndex);
      const event: TableSignEvent = {
        signId,
        seatIndex: senderSeat,
        relativePos: toRelativePos(senderSeat, viewer.seatIndex),
        signIcon,
        durationMs,
        catchableByOpponent: catchableByOpponent && viewerTeam !== senderTeam,
        timestamp: Date.now(),
      };
      this.callbacks.sendToClient(viewer.playerId, {
        type: 'game:sign',
        sign: event,
      });
    }
  }

  private pickCharacterMusSign(hand: Card[], sob?: PlayerSobrietyState) {
    const validIds = getValidSignsForHand(hand);
    const priority = ['guino', 'cejas', 'boca_lado', 'labio', 'lengua', 'ciego'];
    const chosenId = priority.find((id) => validIds.includes(id));
    if (chosenId) {
      return AUTHENTIC_MUS_SIGNS.find((s) => s.id === chosenId) || null;
    }
    if (sob && (sob.alcohol >= 2 || sob.caffeine >= 2)) {
      const bluffIds = ['guino', 'labio', 'cejas', 'boca_lado'];
      const bluffId = bluffIds[Math.floor(Math.random() * bluffIds.length)];
      return AUTHENTIC_MUS_SIGNS.find((s) => s.id === bluffId) || null;
    }
    return null;
  }

  // =========================================================================
  // TURN DRIVER (Bots & Disconnected Humans)
  // =========================================================================

  private scheduleTurnDriver() {
    if (this.turnActionTimer) {
      clearTimeout(this.turnActionTimer);
      this.turnActionTimer = null;
    }

    if (this.phase !== 'IN_GAME' || this.isTurnBusy) return;
    if (!['MUS_CHECK', 'DISCARD', 'LANCE_DECLARATION', 'LANCE_BETTING'].includes(this.gamePhase)) {
      return;
    }

    const seatIdx = this.currentTurnSeat;
    const seat = this.seats[seatIdx];
    const isBot = seat.controller === 'bot';
    const isDisconnectedHuman = seat.controller === 'human' && !seat.connected;

    if (!isBot && !isDisconnectedHuman) return;

    const cycleId = this.handCycleId;
    const baseDelay = isDisconnectedHuman
      ? 5500
      : this.gamePhase === 'LANCE_BETTING'
      ? TIMING.BOT_THINKING_DELAY_MS
      : this.gamePhase === 'DISCARD'
      ? 700
      : TIMING.DISCARD_DELAY_MS;
    const delayMs = isDisconnectedHuman ? baseDelay : getBotThinkingDelay(baseDelay, seat.sobriety);

    this.turnActionTimer = setTimeout(() => {
      if (!this.isCycleActive(cycleId) || this.isTurnBusy || this.currentTurnSeat !== seatIdx) return;
      const char = CHARACTER_DATA[seat.avatarId] || CHARACTER_DATA.cura;
      const hand = this.hands[seatIdx];

      if (this.gamePhase === 'MUS_CHECK') {
        if (this.musVotes[seatIdx] !== null) return;
        const wantsMus = decideMus(hand, char.tendency, seat.sobriety);
        void this.executeMusVote(seatIdx, wantsMus);
      } else if (this.gamePhase === 'DISCARD') {
        if (this.discardDone[seatIdx]) return;
        const discardIds = decideDiscards(hand, undefined, seat.sobriety);
        void this.executeDiscard(seatIdx, discardIds);
      } else if (this.gamePhase === 'LANCE_DECLARATION') {
        if (this.lanceDeclarations[seatIdx] !== null) return;
        void this.executeDeclaration(seatIdx);
      } else if (this.gamePhase === 'LANCE_BETTING' && this.betState && !this.betState.resolved) {
        const action = decideBettingAction(
          hand,
          this.betState.lance,
          {
            currentBet: this.betState.currentBet,
            isOrdago: this.betState.isOrdago,
            bettingTeam: this.betState.bettingTeam,
            lastAction: this.betState.lastAction,
            previousBet: this.betState.previousBet,
          },
          char.tendency,
          this.manoSeat === seatIdx,
          seat.sobriety
        );
        void this.executeBetAction(seatIdx, action);
      }
    }, delayMs);
  }

  // =========================================================================
  // CLIENT GAMEPLAY ACTIONS
  // =========================================================================

  public handleMusVote(clientId: string, voteMus: boolean): { ok: boolean; error?: string } {
    const seat = this.getPlayerSeat(clientId);
    if (!seat) return { ok: false, error: 'No estás sentado en esta mesa.' };
    if (this.isTurnBusy || this.gamePhase !== 'MUS_CHECK' || this.currentTurnSeat !== seat.seatIndex) {
      return { ok: false, error: 'No es tu turno para votar mus.' };
    }
    if (this.musVotes[seat.seatIndex] !== null) {
      return { ok: false, error: 'Ya has votado.' };
    }
    this.lastActivityAt = Date.now();
    void this.executeMusVote(seat.seatIndex, voteMus);
    return { ok: true };
  }

  private async executeMusVote(seatIdx: SeatIndex, voteMus: boolean) {
    if (this.isTurnBusy || this.gamePhase !== 'MUS_CHECK' || this.currentTurnSeat !== seatIdx) return;
    if (this.musVotes[seatIdx] !== null) return;

    const cycleId = this.handCycleId;
    this.isTurnBusy = true;
    const seat = this.seats[seatIdx];
    const char = CHARACTER_DATA[seat.avatarId];

    if (!voteMus) {
      let nextMano = this.manoSeat;
      let triggeredManoComment = false;
      if (this.isFirstHandOfGame && !this.hasFirstHandCutDone) {
        nextMano = seatIdx;
        this.manoSeat = seatIdx;
        this.hasFirstHandCutDone = true;
        triggeredManoComment = true;
      }

      this.musVotes[seatIdx] = false;
      const cutLine =
        seat.controller === 'human'
          ? '¡Corto el mus!'
          : char
          ? char.quotes.noMus[Math.floor(Math.random() * char.quotes.noMus.length)]
          : '¡No hay mus!';
      this.setSpeech(seatIdx, cutLine, 'mus');

      await this.sleep(1050);
      if (!this.isCycleActive(cycleId)) return;

      if (triggeredManoComment) {
        this.triggerWaiterComment(`¡${seat.name} corta el primer mus y se convierte en la Mano!`);
        await this.sleep(900);
        if (!this.isCycleActive(cycleId)) return;
      }

      this.musCutThisHand = true;
      this.applyPendingDrinkEffects();
      this.startLance('GRANDE', nextMano);
      return;
    }

    this.musVotes[seatIdx] = true;
    const musLine =
      seat.controller === 'human'
        ? '¡Mus!'
        : char
        ? char.quotes.mus[Math.floor(Math.random() * char.quotes.mus.length)]
        : '¡Mus!';
    this.setSpeech(seatIdx, musLine, 'mus');

    await this.sleep(950);
    if (!this.isCycleActive(cycleId)) return;

    const nxt = nextSeat(seatIdx);
    if (nxt === this.manoSeat) {
      this.discardDone = { 0: false, 1: false, 2: false, 3: false };
      this.gamePhase = 'DISCARD';
      this.currentTurnSeat = this.manoSeat;
      this.isTurnBusy = false;
      this.broadcastState();
      this.scheduleTurnDriver();
    } else {
      this.currentTurnSeat = nxt;
      this.isTurnBusy = false;
      this.broadcastState();
      this.scheduleTurnDriver();
    }
  }

  public handleDiscard(clientId: string, cardIds: string[]): { ok: boolean; error?: string } {
    const seat = this.getPlayerSeat(clientId);
    if (!seat) return { ok: false, error: 'No estás sentado en esta mesa.' };
    if (this.isTurnBusy || this.gamePhase !== 'DISCARD' || this.currentTurnSeat !== seat.seatIndex) {
      return { ok: false, error: 'No es tu turno para descartar.' };
    }
    if (this.discardDone[seat.seatIndex]) {
      return { ok: false, error: 'Ya te has descartado en esta ronda.' };
    }
    const uniqueValid = Array.from(new Set(cardIds)).filter((id) =>
      this.hands[seat.seatIndex].some((c) => c.id === id)
    );
    if (uniqueValid.length === 0) {
      return { ok: false, error: 'Art. IV Reg. Bizkaia: es obligatorio descartar al menos 1 carta.' };
    }

    this.lastActivityAt = Date.now();
    void this.executeDiscard(seat.seatIndex, uniqueValid);
    return { ok: true };
  }

  private async executeDiscard(seatIdx: SeatIndex, discardIds: string[]) {
    if (this.isTurnBusy || this.gamePhase !== 'DISCARD' || this.currentTurnSeat !== seatIdx) return;
    if (this.discardDone[seatIdx]) return;

    const cycleId = this.handCycleId;
    this.isTurnBusy = true;

    const currentHand = this.hands[seatIdx];
    const kept = currentHand.filter((c) => !discardIds.includes(c.id));
    const needed = Math.max(1, 4 - kept.length);

    let pool = [...this.deck];
    if (pool.length < needed) {
      const activeIds = new Set<string>([
        ...kept.map((c) => c.id),
        ...this.hands[0].map((c) => c.id),
        ...this.hands[1].map((c) => c.id),
        ...this.hands[2].map((c) => c.id),
        ...this.hands[3].map((c) => c.id),
        ...pool.map((c) => c.id),
      ]);
      const reshuffled = shuffleDeck(createSpanishDeck().filter((c) => !activeIds.has(c.id)));
      pool = [...pool, ...reshuffled];
    }

    const drawn = pool.slice(0, needed);
    this.deck = pool.slice(needed);
    this.discardDone[seatIdx] = true;
    this.hands[seatIdx] = [...kept, ...drawn];

    this.setSpeech(seatIdx, needed === 1 ? 'Me pido una' : `Me pido ${needed}`, 'mus');
    await this.sleep(900);
    if (!this.isCycleActive(cycleId)) return;

    const nxt = nextSeat(seatIdx);
    if (nxt === this.manoSeat) {
      this.musVotes = { 0: null, 1: null, 2: null, 3: null };
      this.gamePhase = 'MUS_CHECK';
      this.currentTurnSeat = this.manoSeat;
      this.isTurnBusy = false;
      this.broadcastState();
      this.scheduleTurnDriver();
    } else {
      this.currentTurnSeat = nxt;
      this.isTurnBusy = false;
      this.broadcastState();
      this.scheduleTurnDriver();
    }
  }

  private startLance(lance: LancePhase, manoOverride?: SeatIndex) {
    const activeMano = manoOverride ?? this.manoSeat;
    this.manoSeat = activeMano;
    this.showdownMessage = null;

    if (lance === 'PARES' || lance === 'JUEGO') {
      this.currentLance = lance;
      this.lanceDeclarations = { 0: null, 1: null, 2: null, 3: null };
      this.betState = null;
      this.gamePhase = 'LANCE_DECLARATION';
      this.currentTurnSeat = activeMano;
      this.isTurnBusy = false;
      this.broadcastState();
      this.scheduleTurnDriver();
      return;
    }

    const orderedAll = getOrderedSeatsFrom(activeMano);
    this.beginBettingForLance(lance, orderedAll);
  }

  private beginBettingForLance(lance: LancePhase, eligibleSeats: SeatIndex[]) {
    const firstTurn = eligibleSeats[0] ?? this.manoSeat;
    this.currentLance = lance;
    this.gamePhase = 'LANCE_BETTING';
    this.currentTurnSeat = firstTurn;
    this.isTurnBusy = false;
    this.betState = {
      lance,
      currentTurnSeat: firstTurn,
      currentBet: 0,
      previousBet: 0,
      isOrdago: false,
      bettingTeam: null,
      lastActorSeat: null,
      lastAction: null,
      eligibleSeats,
      passedSeats: [],
      declinedSeats: [],
      history: [],
      resolved: false,
      accepted: false,
    };

    const cycleId = this.handCycleId;
    const signsAllowed = !(this.isFirstHandOfGame && !this.hasFirstHandCutDone);

    if (signsAllowed && lance === 'GRANDE') {
      // Bot teammates pass a helpful authentic sign at the start of Grande
      for (const seat of this.seats) {
        if (seat.controller !== 'bot') continue;
        const partnerSeat = this.seats[((seat.seatIndex + 2) % 4) as SeatIndex];
        // Only proactively signal if partner is human or on random bot rhythm
        if (partnerSeat.controller === 'human') {
          const sign = this.pickCharacterMusSign(this.hands[seat.seatIndex], seat.sobriety);
          if (sign) {
            const durationMs = Math.max(
              2400,
              3200 + seat.sobriety.alcohol * 220 - seat.sobriety.caffeine * 140
            );
            const t = setTimeout(() => {
              if (!this.isCycleActive(cycleId)) return;
              this.broadcastSignEvent(seat.seatIndex, `bot-${makeUuid()}`, sign.icon, durationMs, false);
            }, 350);
            this.botReactionTimers.push(t);
          }
        }
      }

      // Chance of a sneaky bot opponent slipping a catchable sign
      const botOpponents = this.seats.filter((s) => s.controller === 'bot');
      if (botOpponents.length > 0) {
        const sneakySeat = botOpponents[Math.floor(Math.random() * botOpponents.length)];
        const slipChance =
          0.25 +
          (sneakySeat.sobriety.alcohol >= 2 ? 0.14 : 0) +
          (sneakySeat.sobriety.caffeine >= 2 ? 0.12 : 0);
        if (Math.random() < slipChance) {
          const sign =
            this.pickCharacterMusSign(this.hands[sneakySeat.seatIndex], sneakySeat.sobriety) ||
            AUTHENTIC_MUS_SIGNS[Math.floor(Math.random() * AUTHENTIC_MUS_SIGNS.length)];
          const maxOppCaffeine = Math.max(
            0,
            ...this.seats
              .filter((s) => s.team !== sneakySeat.team)
              .map((s) => s.sobriety.caffeine)
          );
          const catchWindowMs = Math.round(
            TIMING.WAITER_COMMENT_MS * (1 + maxOppCaffeine * 0.25 + sneakySeat.sobriety.alcohol * 0.12)
          );
          const signId = makeUuid();
          this.activeCatchableSign = {
            signId,
            senderSeat: sneakySeat.seatIndex,
            senderTeam: sneakySeat.team,
            signIcon: sign.icon,
            expiresAt: Date.now() + catchWindowMs,
            caught: false,
          };
          this.broadcastSignEvent(sneakySeat.seatIndex, signId, sign.icon, catchWindowMs, true);
          if (this.catchSignTimer) clearTimeout(this.catchSignTimer);
          this.catchSignTimer = setTimeout(() => {
            if (this.activeCatchableSign?.signId === signId) {
              this.activeCatchableSign = null;
              this.broadcastState();
            }
          }, catchWindowMs);
        }
      }
    }

    this.broadcastState();
    this.scheduleTurnDriver();
  }

  public handleDeclare(clientId: string): { ok: boolean; error?: string } {
    const seat = this.getPlayerSeat(clientId);
    if (!seat) return { ok: false, error: 'No estás en la mesa.' };
    if (this.isTurnBusy || this.gamePhase !== 'LANCE_DECLARATION' || this.currentTurnSeat !== seat.seatIndex) {
      return { ok: false, error: 'No es tu turno para declarar.' };
    }
    this.lastActivityAt = Date.now();
    void this.executeDeclaration(seat.seatIndex);
    return { ok: true };
  }

  private async executeDeclaration(seatIdx: SeatIndex) {
    const activeLance = this.currentLance;
    if (
      this.isTurnBusy ||
      this.gamePhase !== 'LANCE_DECLARATION' ||
      !activeLance ||
      this.currentTurnSeat !== seatIdx
    ) {
      return;
    }
    if (activeLance !== 'PARES' && activeLance !== 'JUEGO') return;
    if (this.lanceDeclarations[seatIdx] !== null) return;

    const cycleId = this.handCycleId;
    this.isTurnBusy = true;

    const seat = this.seats[seatIdx];
    const hand = this.hands[seatIdx];
    const char = CHARACTER_DATA[seat.avatarId] || CHARACTER_DATA.cura;

    const hasForLance =
      seat.controller === 'human'
        ? activeLance === 'PARES'
          ? evaluatePares(hand).level > 0
          : evaluateJuego(hand).hasJuego
        : decideDeclaration(hand, activeLance, char.tendency, seat.sobriety);

    const spokenText =
      activeLance === 'PARES'
        ? hasForLance
          ? 'Pares sí'
          : 'Pares no'
        : hasForLance
        ? 'Juego sí'
        : 'Juego no';

    this.lanceDeclarations[seatIdx] = hasForLance;
    this.setSpeech(seatIdx, spokenText, hasForLance ? 'quiero' : 'paso');

    await this.sleep(950);
    if (!this.isCycleActive(cycleId)) return;

    const nxt = nextSeat(seatIdx);
    if (nxt !== this.manoSeat) {
      this.currentTurnSeat = nxt;
      this.isTurnBusy = false;
      this.broadcastState();
      this.scheduleTurnDriver();
      return;
    }

    const t1Has = Boolean(this.lanceDeclarations[0] || this.lanceDeclarations[2]);
    const t2Has = Boolean(this.lanceDeclarations[1] || this.lanceDeclarations[3]);

    if (activeLance === 'PARES') {
      if (!t1Has && !t2Has) {
        if (!this.completedLances.includes('PARES')) this.completedLances.push('PARES');
        this.lanceResults.PARES = { bet: 0, accepted: false, noPairs: true };
        this.showdownMessage = 'Nadie lleva pares · Pasamos a Juego';
        this.broadcastState();
        this.transitionTimer = setTimeout(() => {
          if (this.isCycleActive(cycleId)) this.startLance('JUEGO');
        }, TIMING.NEXT_LANCE_DELAY_MS);
      } else if (!t1Has || !t2Has) {
        if (!this.completedLances.includes('PARES')) this.completedLances.push('PARES');
        const onlyTeam: 1 | 2 = t1Has ? 1 : 2;
        this.lanceResults.PARES = { bet: 0, accepted: false, onlyTeamWithPares: onlyTeam };
        this.showdownMessage = `Solo lleva pares la Pareja ${onlyTeam} · Se cobran en el tanteo`;
        this.broadcastState();
        this.transitionTimer = setTimeout(() => {
          if (this.isCycleActive(cycleId)) this.startLance('JUEGO');
        }, TIMING.SHOWDOWN_DELAY_MS);
      } else {
        const eligible = getOrderedSeatsFrom(this.manoSeat).filter((s) => Boolean(this.lanceDeclarations[s]));
        this.broadcastState();
        this.transitionTimer = setTimeout(() => {
          if (this.isCycleActive(cycleId)) this.beginBettingForLance('PARES', eligible);
        }, TIMING.DISCARD_DELAY_MS);
      }
      return;
    }

    // JUEGO
    if (!t1Has && !t2Has) {
      this.showdownMessage = 'Nadie tiene juego (>30) · ¡Se juega a PUNTO!';
      this.broadcastState();
      this.transitionTimer = setTimeout(() => {
        if (this.isCycleActive(cycleId)) this.startLance('PUNTO');
      }, TIMING.NEXT_LANCE_DELAY_MS);
    } else if (!t1Has || !t2Has) {
      if (!this.completedLances.includes('JUEGO')) this.completedLances.push('JUEGO');
      const onlyTeam: 1 | 2 = t1Has ? 1 : 2;
      this.lanceResults.JUEGO = { bet: 0, accepted: false, onlyTeamWithJuego: onlyTeam };
      this.showdownMessage = `Solo tiene Juego la Pareja ${onlyTeam} · Se cobrará en el tanteo`;
      this.broadcastState();
      this.transitionTimer = setTimeout(() => {
        if (this.isCycleActive(cycleId)) this.resolveRoundShowdown();
      }, TIMING.SHOWDOWN_DELAY_MS);
    } else {
      const eligible = getOrderedSeatsFrom(this.manoSeat).filter((s) => Boolean(this.lanceDeclarations[s]));
      this.broadcastState();
      this.transitionTimer = setTimeout(() => {
        if (this.isCycleActive(cycleId)) this.beginBettingForLance('JUEGO', eligible);
      }, TIMING.DISCARD_DELAY_MS);
    }
  }

  public handleBetAction(
    clientId: string,
    action: GameBetActionType,
    customAmount?: number
  ): { ok: boolean; error?: string } {
    const seat = this.getPlayerSeat(clientId);
    if (!seat) return { ok: false, error: 'No estás en la mesa.' };
    if (
      this.isTurnBusy ||
      this.gamePhase !== 'LANCE_BETTING' ||
      !this.betState ||
      this.betState.resolved ||
      this.betState.currentTurnSeat !== seat.seatIndex
    ) {
      return { ok: false, error: 'No es tu turno en este lance.' };
    }
    this.lastActivityAt = Date.now();
    void this.executeBetAction(seat.seatIndex, action, customAmount);
    return { ok: true };
  }

  private async executeBetAction(
    actorSeat: SeatIndex,
    action: GameBetActionType,
    customAmount?: number
  ) {
    const curBet = this.betState;
    if (
      this.isTurnBusy ||
      this.gamePhase !== 'LANCE_BETTING' ||
      !curBet ||
      curBet.resolved ||
      curBet.currentTurnSeat !== actorSeat
    ) {
      return;
    }

    if (curBet.isOrdago && action !== 'quiero' && action !== 'no_quiero') return;
    if (curBet.currentBet > 0 && action === 'paso') return;

    const cycleId = this.handCycleId;
    this.isTurnBusy = true;
    const team = getCanonicalTeam(actorSeat);

    if (action === 'paso') {
      this.setSpeech(actorSeat, 'Paso', 'paso');
      const nextPassed = [...curBet.passedSeats, actorSeat];

      if (nextPassed.length >= curBet.eligibleSeats.length && curBet.currentBet === 0 && !curBet.isOrdago) {
        this.lanceResults[curBet.lance] = { bet: 0, accepted: false, enPaso: true };
        this.betState = {
          ...curBet,
          passedSeats: nextPassed,
          resolved: true,
          lastActorSeat: actorSeat,
          lastAction: 'paso',
        };
        this.broadcastState();

        await this.sleep(950);
        if (!this.isCycleActive(cycleId)) return;

        this.showdownMessage = `${curBet.lance}: Queda en paso`;
        this.moveToNextLance(curBet.lance, cycleId);
      } else {
        const idx = curBet.eligibleSeats.indexOf(actorSeat);
        const nxt = curBet.eligibleSeats[(idx + 1) % curBet.eligibleSeats.length] ?? nextSeat(actorSeat);
        this.betState = {
          ...curBet,
          passedSeats: nextPassed,
          lastActorSeat: actorSeat,
          lastAction: 'paso',
        };
        this.broadcastState();

        await this.sleep(900);
        if (!this.isCycleActive(cycleId)) return;

        this.betState.currentTurnSeat = nxt;
        this.currentTurnSeat = nxt;
        this.isTurnBusy = false;
        this.broadcastState();
        this.scheduleTurnDriver();
      }
      return;
    }

    if (action === 'envido' || action === 'cinco' || action === 'reenvio' || action === 'ordago') {
      const prevBet = curBet.currentBet;
      const customDelta =
        typeof customAmount === 'number' && Number.isFinite(customAmount)
          ? Math.max(2, Math.min(TARGET_PIEDRAS, Math.round(customAmount)))
          : null;
      const nextBet =
        action === 'cinco'
          ? prevBet + (customDelta ?? 5)
          : action === 'reenvio'
          ? prevBet + (customDelta ?? 2)
          : action === 'ordago'
          ? prevBet
          : prevBet + 2;

      const reachesFortyAsOrdago =
        action !== 'ordago' &&
        (nextBet + this.scoreTeam1.piedras >= TARGET_PIEDRAS ||
          nextBet + this.scoreTeam2.piedras >= TARGET_PIEDRAS);
      const nextOrdago = action === 'ordago' || reachesFortyAsOrdago ? true : curBet.isOrdago;
      const effectiveAction: GameBetActionType = nextOrdago ? 'ordago' : action;

      if (effectiveAction === 'ordago') {
        this.setSpeech(actorSeat, '¡¡ÓRDAGO!!', 'ordago');
      } else {
        const cincoDelta = customDelta ?? 5;
        const reenvioDelta = customDelta ?? 2;
        const text =
          action === 'cinco'
            ? cincoDelta === 5
              ? '¡Envido cinco!'
              : `¡Envido ${cincoDelta}!`
            : action === 'reenvio'
            ? reenvioDelta === 2
              ? '¡Dos más de reenvío!'
              : `¡${reenvioDelta} más de reenvío!`
            : '¡Envido dos!';
        this.setSpeech(actorSeat, text, 'envido');
      }

      const opposingEligible = getOrderedSeatsFrom(nextSeat(actorSeat)).filter(
        (s) => curBet.eligibleSeats.includes(s) && getCanonicalTeam(s) !== team
      );
      const nextResponder = opposingEligible[0] ?? nextSeat(actorSeat);

      this.betState = {
        ...curBet,
        previousBet: prevBet,
        currentBet: nextBet,
        isOrdago: nextOrdago,
        bettingTeam: team,
        lastActorSeat: actorSeat,
        lastAction: effectiveAction,
        passedSeats: [],
        declinedSeats: [],
      };
      this.broadcastState();

      await this.sleep(effectiveAction === 'ordago' ? 1200 : 950);
      if (!this.isCycleActive(cycleId)) return;

      if (effectiveAction === 'ordago') {
        this.triggerWaiterComment('¡¡SILENCIO EN LA SALA, HAN TIRADO UN ÓRDAGO!!');
        await this.sleep(850);
        if (!this.isCycleActive(cycleId)) return;
      }

      this.betState.currentTurnSeat = nextResponder;
      this.currentTurnSeat = nextResponder;
      this.isTurnBusy = false;
      this.broadcastState();
      this.scheduleTurnDriver();
      return;
    }

    if (action === 'quiero') {
      this.setSpeech(actorSeat, '¡Quiero!', 'quiero');
      this.betState = {
        ...curBet,
        resolved: true,
        accepted: true,
        lastActorSeat: actorSeat,
        lastAction: 'quiero',
      };
      this.broadcastState();

      await this.sleep(950);
      if (!this.isCycleActive(cycleId)) return;

      if (curBet.isOrdago) {
        this.resolveImmediateOrdago(curBet.lance);
      } else {
        this.lanceResults[curBet.lance] = { bet: curBet.currentBet, accepted: true };
        this.showdownMessage = `${curBet.lance}: Envite de ${curBet.currentBet} piedras aceptado`;
        this.moveToNextLance(curBet.lance, cycleId);
      }
      return;
    }

    if (action === 'no_quiero') {
      this.setSpeech(actorSeat, 'No quiero', 'paso');
      const nextDeclined = [...curBet.declinedSeats, actorSeat];
      const remainingDefenders = getOrderedSeatsFrom(nextSeat(actorSeat)).filter(
        (s) =>
          curBet.eligibleSeats.includes(s) &&
          getCanonicalTeam(s) !== curBet.bettingTeam &&
          !nextDeclined.includes(s)
      );

      if (remainingDefenders.length > 0) {
        const partnerResponder = remainingDefenders[0];
        this.betState = {
          ...curBet,
          declinedSeats: nextDeclined,
          lastActorSeat: actorSeat,
          lastAction: 'no_quiero',
        };
        this.broadcastState();

        await this.sleep(900);
        if (!this.isCycleActive(cycleId)) return;

        this.betState.currentTurnSeat = partnerResponder;
        this.currentTurnSeat = partnerResponder;
        this.isTurnBusy = false;
        this.broadcastState();
        this.scheduleTurnDriver();
        return;
      }

      this.betState = {
        ...curBet,
        declinedSeats: nextDeclined,
        resolved: true,
        accepted: false,
        lastActorSeat: actorSeat,
        lastAction: 'no_quiero',
      };
      this.broadcastState();

      await this.sleep(950);
      if (!this.isCycleActive(cycleId)) return;

      const isPuntoMiedo = curBet.lance === 'PUNTO' && curBet.previousBet === 0;
      const stonesWon = curBet.previousBet > 0 ? curBet.previousBet : isPuntoMiedo ? 2 : 1;
      const winningTeam = curBet.bettingTeam || 1;
      const awardRes = this.awardPiedras(winningTeam, stonesWon);

      this.lanceResults[curBet.lance] = {
        bet: 0,
        accepted: false,
        resolvedByNoQuiero: true,
        noQuieroWinnerTeam: winningTeam,
        pointsGivenImmediate: stonesWon,
      };

      if (awardRes.wonMatch) {
        this.isTurnBusy = false;
        this.broadcastState();
        return;
      }

      if (awardRes.wonJuego) {
        this.breakdownDetails = [
          {
            lance: curBet.lance,
            winnerTeam: winningTeam,
            winnerPlayerName: this.getTeamNamesLabel(winningTeam),
            stonesWon,
            reason: isPuntoMiedo ? '¡Juego completado con punto y miedo!' : '¡Juego completado con el deje!',
            explanation: isPuntoMiedo
              ? `El rival no quiso el envite a PUNTO (+2 p: punto y miedo) y se completan las ${TARGET_PIEDRAS} piedras del juego.`
              : `El rival no quiso en ${curBet.lance} (+${stonesWon} p) y se completan las ${TARGET_PIEDRAS} piedras del juego.`,
          },
        ];
        this.justWonJuego = true;
        this.showdownMessage = `🏆 ¡Juego para ${this.getTeamNamesLabel(winningTeam)} en ${curBet.lance}! Tantos a 0.`;
        this.gamePhase = 'ROUND_SUMMARY';
        this.isTurnBusy = false;
        this.broadcastState();
        return;
      }

      this.showdownMessage = isPuntoMiedo
        ? `PUNTO: No querido — ¡Punto y miedo! (+2 piedras para ${this.getTeamNamesLabel(winningTeam)})`
        : `${curBet.lance}: No querido (+${stonesWon} piedra${stonesWon > 1 ? 's' : ''} para ${this.getTeamNamesLabel(winningTeam)})`;
      this.moveToNextLance(curBet.lance, cycleId);
    }
  }

  private moveToNextLance(current: LancePhase, cycleId: number) {
    if (!this.completedLances.includes(current)) {
      this.completedLances.push(current);
    }
    this.broadcastState();

    if (current === 'GRANDE') {
      this.transitionTimer = setTimeout(() => {
        if (this.isCycleActive(cycleId)) this.startLance('CHICA');
      }, TIMING.NEXT_LANCE_DELAY_MS);
    } else if (current === 'CHICA') {
      this.transitionTimer = setTimeout(() => {
        if (this.isCycleActive(cycleId)) this.startLance('PARES');
      }, TIMING.NEXT_LANCE_DELAY_MS);
    } else if (current === 'PARES') {
      this.transitionTimer = setTimeout(() => {
        if (this.isCycleActive(cycleId)) this.startLance('JUEGO');
      }, TIMING.NEXT_LANCE_DELAY_MS);
    } else if (current === 'JUEGO' || current === 'PUNTO') {
      this.transitionTimer = setTimeout(() => {
        if (this.isCycleActive(cycleId)) this.resolveRoundShowdown();
      }, TIMING.SHOWDOWN_DELAY_MS);
    }
  }

  private getTeamNamesLabel(team: 1 | 2): string {
    if (team === 1) return `${this.seats[0].name} & ${this.seats[2].name}`;
    return `${this.seats[1].name} & ${this.seats[3].name}`;
  }

  private winJuego(team: 1 | 2): { wonJuego: boolean; wonMatch: boolean; newJuegosCount: number } {
    const winnerCurrent = team === 1 ? this.scoreTeam1 : this.scoreTeam2;
    const newJuegosCount = winnerCurrent.chicosWon + 1;

    this.scoreTeam1 = {
      piedras: 0,
      chicosWon: team === 1 ? newJuegosCount : this.scoreTeam1.chicosWon,
    };
    this.scoreTeam2 = {
      piedras: 0,
      chicosWon: team === 2 ? newJuegosCount : this.scoreTeam2.chicosWon,
    };

    const teamLabel = this.getTeamNamesLabel(team);
    if (newJuegosCount >= TARGET_JUEGOS) {
      this.gamePhase = 'GAME_OVER';
      this.showdownMessage = `🏆 ¡¡TXAPELDUNES!! ${teamLabel} ganan la partida con ${newJuegosCount} juegos.`;
      this.triggerWaiterComment(`¡¡Torneo de Bizkaia finalizado!! Txapeldunes: ${teamLabel} con ${newJuegosCount} juegos.`);
    } else {
      this.showdownMessage = `¡Juego para ${teamLabel}! (${newJuegosCount} de ${TARGET_JUEGOS} juegos · Tantos a 0)`;
      this.triggerWaiterComment(`¡${teamLabel} se anotan su ${newJuegosCount}º juego! Tantos a cero.`);
    }

    return {
      wonJuego: true,
      wonMatch: newJuegosCount >= TARGET_JUEGOS,
      newJuegosCount,
    };
  }

  private awardPiedras(team: 1 | 2, count: number): { wonJuego: boolean; wonMatch: boolean } {
    if (count <= 0) return { wonJuego: false, wonMatch: false };
    const currentScore = team === 1 ? this.scoreTeam1 : this.scoreTeam2;
    const nextPiedras = currentScore.piedras + count;

    if (nextPiedras >= TARGET_PIEDRAS) {
      const res = this.winJuego(team);
      return { wonJuego: res.wonJuego, wonMatch: res.wonMatch };
    }

    const updated: TeamScore = { ...currentScore, piedras: nextPiedras };
    if (team === 1) this.scoreTeam1 = updated;
    else this.scoreTeam2 = updated;
    return { wonJuego: false, wonMatch: false };
  }

  private buildBaseHandsMap(): Record<PlayerPosition, Card[]> {
    return {
      player: this.hands[0],
      oppRight: this.hands[1],
      partner: this.hands[2],
      oppLeft: this.hands[3],
    };
  }

  private resolveImmediateOrdago(lance: LancePhase) {
    const baseHands = this.buildBaseHandsMap();
    const manoBasePos = canonicalSeatToBasePos(this.manoSeat);
    const res = evaluateLanceBetweenTeams(lance, baseHands, manoBasePos);
    const winningTeam = res.winningTeam;
    const winSeat = basePosToCanonicalSeat(res.winningPlayer);
    const winningName = this.seats[winSeat].name;
    const manoNote = res.isManoTiebreak ? ' por Mano oficial de Bizkaia' : '';

    const juegoRes = this.winJuego(winningTeam);

    this.breakdownDetails = [
      {
        lance,
        winnerTeam: winningTeam,
        winnerPlayerName: winningName,
        stonesWon: TARGET_PIEDRAS,
        reason: '¡ÓRDAGO GANADO! (Juego completo)',
        explanation: `${winningName} gana el órdago de ${lance}${manoNote}. Se llevan el juego (${juegoRes.newJuegosCount}/${TARGET_JUEGOS}) y se reinician los tantos a 0.`,
      },
    ];

    if (!juegoRes.wonMatch) {
      this.justWonJuego = true;
      this.showdownMessage = `¡¡ÓRDAGO GANADO por ${winningName}${manoNote}!! Juego (${juegoRes.newJuegosCount}/${TARGET_JUEGOS}) para ${this.getTeamNamesLabel(winningTeam)}.`;
      this.gamePhase = 'ROUND_SUMMARY';
    }
    this.isTurnBusy = false;
    this.broadcastState();
  }

  private resolveRoundShowdown() {
    this.isTurnBusy = false;
    const baseHands = this.buildBaseHandsMap();
    const manoBasePos = canonicalSeatToBasePos(this.manoSeat);
    const curResults = this.lanceResults;
    const curCompleted = this.completedLances;
    const curLance = this.currentLance;

    let t1Score = 0;
    let t2Score = 0;
    const pendingAwards: Array<{ team: 1 | 2; stones: number }> = [];
    const details: ShowdownBreakdownItem[] = [];

    const describeHandCards = (cards: Card[]): string => {
      if (!cards || cards.length === 0) return '';
      const rankNames: Record<number, string> = {
        12: 'Rey',
        11: 'Caballo',
        10: 'Sota',
        7: '7',
        6: '6',
        5: '5',
        4: '4',
        3: 'Tres (Rey)',
        2: 'Dos (As)',
        1: 'As',
      };
      return cards.map((c) => rankNames[c.rank] || `${c.rank}`).join(', ');
    };

    // 1. Grande
    if (curResults.GRANDE.resolvedByNoQuiero) {
      const wTeam = curResults.GRANDE.noQuieroWinnerTeam || 1;
      const stones = curResults.GRANDE.pointsGivenImmediate || 1;
      details.push({
        lance: 'GRANDE',
        winnerTeam: wTeam,
        winnerPlayerName: this.getTeamNamesLabel(wTeam),
        stonesWon: stones,
        reason: 'No querido (ya cobrado al momento)',
        explanation: `El rival no quiso el envite de Grande (+${stones} piedra al momento).`,
      });
    } else {
      const evalG = evaluateLanceBetweenTeams('GRANDE', baseHands, manoBasePos);
      const grandeWinner = evalG.winningTeam;
      const grandeBet = curResults.GRANDE.accepted ? curResults.GRANDE.bet : 1;
      const winningGPlayer = this.seats[basePosToCanonicalSeat(evalG.winningPlayer)].name;
      const manoNoteG = evalG.isManoTiebreak ? ' (Gana por Mano oficial de Bizkaia)' : '';
      if (grandeWinner === 1) t1Score += grandeBet;
      else t2Score += grandeBet;
      pendingAwards.push({ team: grandeWinner, stones: grandeBet });
      details.push({
        lance: 'GRANDE',
        winnerTeam: grandeWinner,
        winnerPlayerName: winningGPlayer,
        stonesWon: grandeBet,
        reason: curResults.GRANDE.accepted ? `Envite de ${grandeBet} piedras querido` : 'Paso (1 piedra a la mejor grande)',
        explanation: `${winningGPlayer} gana con ${describeHandCards(evalG.winningHand)}${manoNoteG}`,
      });
    }

    // 2. Chica
    if (curResults.CHICA.resolvedByNoQuiero) {
      const wTeam = curResults.CHICA.noQuieroWinnerTeam || 1;
      const stones = curResults.CHICA.pointsGivenImmediate || 1;
      details.push({
        lance: 'CHICA',
        winnerTeam: wTeam,
        winnerPlayerName: this.getTeamNamesLabel(wTeam),
        stonesWon: stones,
        reason: 'No querido (ya cobrado al momento)',
        explanation: `El rival no quiso el envite de Chica (+${stones} piedra al momento).`,
      });
    } else {
      const evalC = evaluateLanceBetweenTeams('CHICA', baseHands, manoBasePos);
      const chicaWinner = evalC.winningTeam;
      const chicaBet = curResults.CHICA.accepted ? curResults.CHICA.bet : 1;
      const winningCPlayer = this.seats[basePosToCanonicalSeat(evalC.winningPlayer)].name;
      const manoNoteC = evalC.isManoTiebreak ? ' (Gana por Mano oficial de Bizkaia)' : '';
      if (chicaWinner === 1) t1Score += chicaBet;
      else t2Score += chicaBet;
      pendingAwards.push({ team: chicaWinner, stones: chicaBet });
      details.push({
        lance: 'CHICA',
        winnerTeam: chicaWinner,
        winnerPlayerName: winningCPlayer,
        stonesWon: chicaBet,
        reason: curResults.CHICA.accepted ? `Envite de ${chicaBet} piedras querido` : 'Paso (1 piedra a la menor chica)',
        explanation: `${winningCPlayer} gana con ${describeHandCards(evalC.winningHand)}${manoNoteC}`,
      });
    }

    // 3. Pares
    const team1ParesBonus = evaluatePares(this.hands[0]).level + evaluatePares(this.hands[2]).level;
    const team2ParesBonus = evaluatePares(this.hands[1]).level + evaluatePares(this.hands[3]).level;

    if (curResults.PARES.noPairs) {
      details.push({
        lance: 'PARES',
        winnerTeam: null,
        winnerPlayerName: 'Nadie',
        stonesWon: 0,
        reason: 'Sin pares',
        explanation: 'Ningún equipo tenía pares.',
      });
    } else if (curResults.PARES.onlyTeamWithPares) {
      const wTeam = curResults.PARES.onlyTeamWithPares;
      const stones = wTeam === 1 ? team1ParesBonus : team2ParesBonus;
      if (wTeam === 1) t1Score += stones;
      else t2Score += stones;
      pendingAwards.push({ team: wTeam, stones });
      const wName = this.getTeamNamesLabel(wTeam);
      details.push({
        lance: 'PARES',
        winnerTeam: wTeam,
        winnerPlayerName: wName,
        stonesWon: stones,
        reason: `Pares cobrados (+${stones} p)`,
        explanation: `Solo ${wName} tenían pares (+${stones} p).`,
      });
    } else if (curResults.PARES.resolvedByNoQuiero) {
      const wTeam = curResults.PARES.noQuieroWinnerTeam || 1;
      const paresStones = wTeam === 1 ? team1ParesBonus : team2ParesBonus;
      const dejeStones = curResults.PARES.pointsGivenImmediate || 1;
      if (wTeam === 1) t1Score += paresStones;
      else t2Score += paresStones;
      pendingAwards.push({ team: wTeam, stones: paresStones });
      const wName = this.getTeamNamesLabel(wTeam);
      details.push({
        lance: 'PARES',
        winnerTeam: wTeam,
        winnerPlayerName: wName,
        stonesWon: dejeStones + paresStones,
        reason: `Deje (+${dejeStones} p) + Pares (+${paresStones} p)`,
        explanation: `${wName} cobran +${dejeStones} de deje y +${paresStones} de sus pares.`,
      });
    } else {
      const evalP = evaluateLanceBetweenTeams('PARES', baseHands, manoBasePos);
      const paresWinner = evalP.winningTeam;
      const paresBet = curResults.PARES.accepted ? curResults.PARES.bet : 1;
      const winningPPlayer = this.seats[basePosToCanonicalSeat(evalP.winningPlayer)].name;
      const winningBonus = paresWinner === 1 ? team1ParesBonus : team2ParesBonus;
      const totalParesStones = paresBet + winningBonus;
      const manoNoteP = evalP.isManoTiebreak ? ' (Gana par por Mano de Bizkaia)' : '';
      if (paresWinner === 1) t1Score += totalParesStones;
      else t2Score += totalParesStones;
      pendingAwards.push({ team: paresWinner, stones: totalParesStones });
      details.push({
        lance: 'PARES',
        winnerTeam: paresWinner,
        winnerPlayerName: winningPPlayer,
        stonesWon: totalParesStones,
        reason: `${curResults.PARES.accepted ? `Envite (${paresBet} p)` : 'Paso (1 p)'} + Pares (+${winningBonus} p)`,
        explanation: `${winningPPlayer} gana los pares${manoNoteP} (+${totalParesStones} p).`,
      });
    }

    // 4. Juego
    const calcJuegoBonus = (h: Card[]): number => {
      const ev = evaluateJuego(h);
      if (!ev.hasJuego) return 0;
      return ev.totalSum === 31 ? 3 : 2;
    };
    const team1JuegoBonus = calcJuegoBonus(this.hands[0]) + calcJuegoBonus(this.hands[2]);
    const team2JuegoBonus = calcJuegoBonus(this.hands[1]) + calcJuegoBonus(this.hands[3]);

    if (curResults.JUEGO.onlyTeamWithJuego) {
      const wTeam = curResults.JUEGO.onlyTeamWithJuego;
      const stones = wTeam === 1 ? team1JuegoBonus : team2JuegoBonus;
      if (wTeam === 1) t1Score += stones;
      else t2Score += stones;
      pendingAwards.push({ team: wTeam, stones });
      const wName = this.getTeamNamesLabel(wTeam);
      details.push({
        lance: 'JUEGO',
        winnerTeam: wTeam,
        winnerPlayerName: wName,
        stonesWon: stones,
        reason: `Juego cobrado (+${stones} p)`,
        explanation: `Solo ${wName} tenían juego (>30) (+${stones} p).`,
      });
    } else if (curResults.JUEGO.resolvedByNoQuiero) {
      const wTeam = curResults.JUEGO.noQuieroWinnerTeam || 1;
      const juegoStones = wTeam === 1 ? team1JuegoBonus : team2JuegoBonus;
      const dejeStones = curResults.JUEGO.pointsGivenImmediate || 1;
      if (wTeam === 1) t1Score += juegoStones;
      else t2Score += juegoStones;
      pendingAwards.push({ team: wTeam, stones: juegoStones });
      const wName = this.getTeamNamesLabel(wTeam);
      details.push({
        lance: 'JUEGO',
        winnerTeam: wTeam,
        winnerPlayerName: wName,
        stonesWon: dejeStones + juegoStones,
        reason: `Deje (+${dejeStones} p) + Juego (+${juegoStones} p)`,
        explanation: `${wName} cobran +${dejeStones} de deje y +${juegoStones} de juego.`,
      });
    } else if (
      curResults.JUEGO.accepted ||
      curResults.JUEGO.enPaso ||
      (curCompleted.includes('JUEGO') && (team1JuegoBonus > 0 || team2JuegoBonus > 0))
    ) {
      const evalJ = evaluateLanceBetweenTeams('JUEGO', baseHands, manoBasePos);
      const juegoWinner = evalJ.winningTeam;
      const juegoBet = curResults.JUEGO.accepted ? curResults.JUEGO.bet : 1;
      const winningJPlayer = this.seats[basePosToCanonicalSeat(evalJ.winningPlayer)].name;
      const winningBonus = juegoWinner === 1 ? team1JuegoBonus : team2JuegoBonus;
      const totalJuegoStones = juegoBet + winningBonus;
      const manoNoteJ = evalJ.isManoTiebreak ? ' (Ganan las 31 de Mano - Art. I)' : '';
      if (juegoWinner === 1) t1Score += totalJuegoStones;
      else t2Score += totalJuegoStones;
      pendingAwards.push({ team: juegoWinner, stones: totalJuegoStones });
      details.push({
        lance: 'JUEGO',
        winnerTeam: juegoWinner,
        winnerPlayerName: winningJPlayer,
        stonesWon: totalJuegoStones,
        reason: `${curResults.JUEGO.accepted ? `Envite (${juegoBet} p)` : 'Paso (1 p)'} + Juego (+${winningBonus} p)`,
        explanation: `${winningJPlayer} gana el Juego${manoNoteJ} (+${totalJuegoStones} p).`,
      });
    }

    // 5. Punto
    if (curCompleted.includes('PUNTO') || curLance === 'PUNTO') {
      if (curResults.PUNTO.resolvedByNoQuiero) {
        const wTeam = curResults.PUNTO.noQuieroWinnerTeam || 1;
        const stones = curResults.PUNTO.pointsGivenImmediate || 2;
        details.push({
          lance: 'PUNTO',
          winnerTeam: wTeam,
          winnerPlayerName: this.getTeamNamesLabel(wTeam),
          stonesWon: stones,
          reason: stones === 2 ? 'Punto y miedo (2 p ya cobradas)' : 'No querido (ya cobrado al momento)',
          explanation:
            stones === 2
              ? 'El rival no quiso el envite a Punto: 2 piedras al momento (punto y miedo).'
              : `El rival no quiso el envite a Punto (+${stones} p).`,
        });
      } else {
        const evalPt = evaluateLanceBetweenTeams('PUNTO', baseHands, manoBasePos);
        const puntoWinner = evalPt.winningTeam;
        const puntoBet = curResults.PUNTO.accepted ? curResults.PUNTO.bet : 1;
        const winningPtPlayer = this.seats[basePosToCanonicalSeat(evalPt.winningPlayer)].name;
        const ptSum = evalPt.winningHand.reduce((acc, c) => acc + c.value, 0);
        const manoNotePt = evalPt.isManoTiebreak ? ' (Gana Punto por Mano oficial)' : '';
        if (puntoWinner === 1) t1Score += puntoBet;
        else t2Score += puntoBet;
        pendingAwards.push({ team: puntoWinner, stones: puntoBet });
        details.push({
          lance: 'PUNTO',
          winnerTeam: puntoWinner,
          winnerPlayerName: winningPtPlayer,
          stonesWon: puntoBet,
          reason: curResults.PUNTO.accepted ? `Envite de ${puntoBet} piedras` : '1 piedra al mejor punto',
          explanation: `${winningPtPlayer} gana con Punto (${ptSum} de valor)${manoNotePt}`,
        });
      }
    }

    this.breakdownDetails = details;
    let juegoWinnerThisHand: 1 | 2 | null = null;
    let matchEnded = false;
    for (const item of pendingAwards) {
      const awardRes = this.awardPiedras(item.team, item.stones);
      if (awardRes.wonJuego) {
        juegoWinnerThisHand = item.team;
        matchEnded = awardRes.wonMatch;
        break;
      }
    }

    if (!matchEnded) {
      if (juegoWinnerThisHand) {
        this.justWonJuego = true;
        this.showdownMessage = `🏆 ¡Juego para ${this.getTeamNamesLabel(juegoWinnerThisHand)}! Tantos reiniciados a 0.`;
      } else {
        this.justWonJuego = false;
        this.showdownMessage = `Tanteo: +${t1Score} piedras (${this.getTeamNamesLabel(1)}) · +${t2Score} piedras (${this.getTeamNamesLabel(2)})`;
      }
      this.gamePhase = 'ROUND_SUMMARY';
    }

    for (const s of this.seats) {
      s.readyForNextHand = s.controller === 'bot';
    }
    this.broadcastState();
  }

  public handleNextHandReady(clientId: string) {
    if (this.gamePhase !== 'SHOWDOWN' && this.gamePhase !== 'ROUND_SUMMARY') return;
    const seat = this.getPlayerSeat(clientId);
    if (!seat) return;
    seat.readyForNextHand = true;
    this.lastActivityAt = Date.now();
    this.checkNextHandReadyBarrier();
  }

  private checkNextHandReadyBarrier() {
    if (this.gamePhase !== 'SHOWDOWN' && this.gamePhase !== 'ROUND_SUMMARY') return;
    const connectedHumans = this.seats.filter((s) => s.controller === 'human' && s.connected);
    if (connectedHumans.length === 0) return;
    const allReady = connectedHumans.every((s) => s.readyForNextHand);
    if (allReady) {
      this.isFirstHandOfGame = false;
      this.manoSeat = nextSeat(this.manoSeat);
      this.startNewHand(this.manoSeat);
    } else {
      this.broadcastState();
    }
  }

  public handleSendSign(clientId: string, signId: string): { ok: boolean; error?: string } {
    const seat = this.getPlayerSeat(clientId);
    if (!seat || this.phase !== 'IN_GAME') return { ok: false, error: 'Partida no activa.' };

    if (this.isFirstHandOfGame && !this.hasFirstHandCutDone) {
      return { ok: false, error: 'Sin señas en la primera mano hasta que se corte el mus.' };
    }

    const sign = AUTHENTIC_MUS_SIGNS.find((s) => s.id === signId);
    if (!sign) return { ok: false, error: 'Seña desconocida.' };

    this.lastActivityAt = Date.now();
    const cycleId = this.handCycleId;
    const senderIdx = seat.seatIndex;
    const senderTeam = getCanonicalTeam(senderIdx);

    this.setSpeech(senderIdx, `[Seña: ${sign.name}]`, 'seña');

    const catchWindowMs = Math.round(TIMING.WAITER_COMMENT_MS * (1 + seat.sobriety.alcohol * 0.1));
    const eventSignId = makeUuid();
    this.activeCatchableSign = {
      signId: eventSignId,
      senderSeat: senderIdx,
      senderTeam,
      signIcon: sign.icon,
      expiresAt: Date.now() + catchWindowMs,
      caught: false,
    };

    if (this.catchSignTimer) clearTimeout(this.catchSignTimer);
    this.catchSignTimer = setTimeout(() => {
      if (this.activeCatchableSign?.signId === eventSignId) {
        this.activeCatchableSign = null;
        this.broadcastState();
      }
    }, catchWindowMs);

    this.broadcastSignEvent(senderIdx, eventSignId, sign.icon, catchWindowMs, true);
    this.broadcastState();

    // If partner is a bot, let the bot react authentically
    const partnerIdx = ((senderIdx + 2) % 4) as SeatIndex;
    const partnerSeat = this.seats[partnerIdx];
    if (partnerSeat.controller === 'bot') {
      const partnerChar = CHARACTER_DATA[partnerSeat.avatarId] || CHARACTER_DATA.cura;
      const t = setTimeout(() => {
        if (!this.isCycleActive(cycleId)) return;
        const reaction =
          partnerChar.quotes.signReaction[
            Math.floor(Math.random() * partnerChar.quotes.signReaction.length)
          ];
        const replySign = this.pickCharacterMusSign(this.hands[partnerIdx], partnerSeat.sobriety);
        if (replySign) {
          this.broadcastSignEvent(partnerIdx, `reply-${makeUuid()}`, replySign.icon, 2600, false);
        }
        this.setSpeech(partnerIdx, reaction, 'seña');
      }, 1150);
      this.botReactionTimers.push(t);
    }

    return { ok: true };
  }

  public handleCatchSign(clientId: string, signId: string): { ok: boolean; error?: string } {
    const seat = this.getPlayerSeat(clientId);
    if (!seat || this.phase !== 'IN_GAME') return { ok: false, error: 'Partida no activa.' };

    const active = this.activeCatchableSign;
    if (!active || active.signId !== signId || active.caught || Date.now() > active.expiresAt) {
      return { ok: false, error: 'La seña ya ha expirado o ha sido cazada.' };
    }
    if (seat.team === active.senderTeam) {
      return { ok: false, error: 'No puedes cazar la seña de tu propio compañero.' };
    }

    active.caught = true;
    this.activeCatchableSign = null;
    if (this.catchSignTimer) {
      clearTimeout(this.catchSignTimer);
      this.catchSignTimer = null;
    }

    const senderSeat = this.seats[active.senderSeat];
    this.setSpeech(seat.seatIndex, `¡¡He pillado la seña de ${senderSeat.name}!! 👀`, 'envido');
    const awardRes = this.awardPiedras(seat.team, 1);

    const t = setTimeout(() => {
      this.setSpeech(active.senderSeat, '¡Maldita sea, qué vista tienes!', 'paso');
    }, 950);
    this.botReactionTimers.push(t);

    if (awardRes.wonMatch) {
      this.isTurnBusy = false;
    } else if (awardRes.wonJuego) {
      this.breakdownDetails = [
        {
          lance: this.currentLance || 'GRANDE',
          winnerTeam: seat.team,
          winnerPlayerName: seat.name,
          stonesWon: 1,
          reason: '¡Seña cazada que cierra el Juego!',
          explanation: `${seat.name} cazó la seña de ${senderSeat.name} (+1 piedra) completando las ${TARGET_PIEDRAS} piedras.`,
        },
      ];
      this.justWonJuego = true;
      this.gamePhase = 'ROUND_SUMMARY';
      this.isTurnBusy = false;
    }

    this.broadcastState();
    return { ok: true };
  }

  public handleCycleTimeOfDay() {
    const modes: TimeOfDay[] = ['atardecer', 'noche', 'madrugada', 'tarde'];
    const nextIndex = (modes.indexOf(this.timeOfDay) + 1) % modes.length;
    this.timeOfDay = modes[nextIndex];
    const timeComments: Record<TimeOfDay, string> = {
      atardecer: '¡Atardecer madrileño! Luces cálidas y cañitas bien tiradas.',
      noche: '¡Noche cerrada en la taberna! A ver quién aguanta el órdago.',
      madrugada: '¡Madrugada clandestina! Café solo y partida de campeonato.',
      tarde: '¡Tarde soleada en Malasaña! Tapas de tortilla y Mus corrido.',
    };
    this.triggerWaiterComment(timeComments[this.timeOfDay]);
    this.broadcastState();
  }

  public handlePokeWaiter() {
    const quotes = CHARACTER_DATA.camarero.quotes.mus;
    const text = quotes[Math.floor(Math.random() * quotes.length)];
    this.triggerWaiterComment(text);
  }

  // =========================================================================
  // VIEW SERIALIZATION & BROADCAST
  // =========================================================================

  public getLobbyView(clientId: string): RoomLobbyView {
    const mySeat = this.getPlayerSeat(clientId);
    const seats: LobbySeat[] = this.seats.map((s) => ({
      seatIndex: s.seatIndex,
      team: s.team,
      controller: s.controller,
      playerId: s.playerId,
      name: s.name,
      avatarId: s.avatarId,
      connected: s.connected,
      ready: s.ready,
      isHost: s.playerId !== null && s.playerId === this.hostPlayerId,
      allowHumanJoin: s.allowHumanJoin,
    }));

    return {
      roomId: this.roomId,
      code: this.code,
      title: this.title,
      visibility: this.visibility,
      phase: this.phase,
      hostPlayerId: this.hostPlayerId,
      mySeatIndex: mySeat ? mySeat.seatIndex : null,
      seats,
      chat: this.chat,
    };
  }

  public getGameClientView(clientId: string): GameClientView | null {
    const viewerSeat = this.getPlayerSeat(clientId);
    if (!viewerSeat) return null;

    const mySeatIndex = viewerSeat.seatIndex;
    const myTeam = viewerSeat.team;
    const revealAll =
      this.gamePhase === 'SHOWDOWN' ||
      this.gamePhase === 'ROUND_SUMMARY' ||
      this.gamePhase === 'GAME_OVER';

    const seatMap = {} as Record<PlayerPosition, GameSeatInfo>;
    const handsMap = {} as Record<PlayerPosition, Card[]>;
    const speechesMap = {} as Record<PlayerPosition, PlayerSpeech | null>;

    for (const s of this.seats) {
      const relPos = toRelativePos(s.seatIndex, mySeatIndex);
      seatMap[relPos] = {
        seatIndex: s.seatIndex,
        relativePos: relPos,
        team: flipTeam(s.team, myTeam),
        controller: s.controller,
        name: s.name,
        avatarId: s.avatarId,
        connected: s.connected,
        cardCount: this.hands[s.seatIndex].length,
        sobriety: s.sobriety,
        pendingDrink: s.seatIndex === mySeatIndex ? s.pendingDrink : null,
        orderedDrinkThisHand: s.orderedDrinkThisHand,
        readyForNextHand: s.readyForNextHand,
      };
      handsMap[relPos] = s.seatIndex === mySeatIndex || revealAll ? this.hands[s.seatIndex] : [];

      const rawSpeech = this.speeches[s.seatIndex];
      speechesMap[relPos] = rawSpeech ? { ...rawSpeech, playerId: relPos } : null;
    }

    // Flip BetState relative to viewer POV
    let clientBetState: BetState | null = null;
    if (this.betState) {
      clientBetState = {
        lance: this.betState.lance,
        currentTurn: toRelativePos(this.betState.currentTurnSeat, mySeatIndex),
        currentBet: this.betState.currentBet,
        previousBet: this.betState.previousBet,
        isOrdago: this.betState.isOrdago,
        bettingTeam: this.betState.bettingTeam ? flipTeam(this.betState.bettingTeam, myTeam) : null,
        lastActor:
          this.betState.lastActorSeat !== null
            ? toRelativePos(this.betState.lastActorSeat, mySeatIndex)
            : null,
        lastAction: this.betState.lastAction,
        eligiblePlayers: this.betState.eligibleSeats.map((s) => toRelativePos(s, mySeatIndex)),
        passedPlayers: this.betState.passedSeats.map((s) => toRelativePos(s, mySeatIndex)),
        declinedPlayers: this.betState.declinedSeats.map((s) => toRelativePos(s, mySeatIndex)),
        history: this.betState.history,
        resolved: this.betState.resolved,
        accepted: this.betState.accepted,
        winnerTeam: this.betState.winnerTeam ? flipTeam(this.betState.winnerTeam, myTeam) : undefined,
      };
    }

    // Flip LanceResults relative to viewer POV
    const clientLanceResults = {} as Record<LancePhase, LanceResult>;
    (['GRANDE', 'CHICA', 'PARES', 'JUEGO', 'PUNTO'] as LancePhase[]).forEach((lance) => {
      const r = this.lanceResults[lance];
      clientLanceResults[lance] = {
        ...r,
        noQuieroWinnerTeam: r.noQuieroWinnerTeam ? flipTeam(r.noQuieroWinnerTeam, myTeam) : undefined,
        onlyTeamWithPares: r.onlyTeamWithPares ? flipTeam(r.onlyTeamWithPares, myTeam) : undefined,
        onlyTeamWithJuego: r.onlyTeamWithJuego ? flipTeam(r.onlyTeamWithJuego, myTeam) : undefined,
        winnerTeam: r.winnerTeam ? flipTeam(r.winnerTeam, myTeam) : undefined,
      };
    });

    const clientBreakdowns = this.breakdownDetails.map((b) => ({
      ...b,
      winnerTeam: b.winnerTeam ? flipTeam(b.winnerTeam, myTeam) : null,
    }));

    const activeCatchable =
      this.activeCatchableSign &&
      !this.activeCatchableSign.caught &&
      Date.now() < this.activeCatchableSign.expiresAt &&
      this.activeCatchableSign.senderTeam !== myTeam
        ? {
            signId: this.activeCatchableSign.signId,
            opponentPos: toRelativePos(this.activeCatchableSign.senderSeat, mySeatIndex),
            signIcon: this.activeCatchableSign.signIcon,
          }
        : null;

    const connectedHumans = this.seats.filter((s) => s.controller === 'human' && s.connected);
    const readyCount = connectedHumans.filter((s) => s.readyForNextHand).length;

    return {
      roomId: this.roomId,
      code: this.code,
      title: this.title,
      hostPlayerId: this.hostPlayerId,
      mySeatIndex,
      myTeam,
      gamePhase: this.gamePhase,
      isFirstHandOfGame: this.isFirstHandOfGame,
      hasFirstHandCutDone: this.hasFirstHandCutDone,
      musCutThisHand: this.musCutThisHand,
      manoPos: toRelativePos(this.manoSeat, mySeatIndex),
      currentTurnPos: toRelativePos(this.currentTurnSeat, mySeatIndex),
      currentLance: this.currentLance,
      completedLances: [...this.completedLances],
      betState: clientBetState,
      scoreTeam1: myTeam === 1 ? this.scoreTeam1 : this.scoreTeam2,
      scoreTeam2: myTeam === 1 ? this.scoreTeam2 : this.scoreTeam1,
      lanceResults: clientLanceResults,
      seats: seatMap,
      hands: handsMap,
      speeches: speechesMap,
      waiterSpeech: this.waiterSpeech,
      activeCatchableSign: activeCatchable,
      showdownMessage: this.showdownMessage,
      justWonJuego: this.justWonJuego,
      breakdownDetails: clientBreakdowns,
      readyNextHandCount: readyCount,
      totalConnectedHumans: connectedHumans.length,
      myReadyForNextHand: viewerSeat.readyForNextHand,
      isTurnBusy: this.isTurnBusy,
      timeOfDay: this.timeOfDay,
    };
  }

  public sendSnapshotTo(clientId: string) {
    if (this.phase === 'LOBBY') {
      this.callbacks.sendToClient(clientId, {
        type: 'room:lobby',
        lobby: this.getLobbyView(clientId),
      });
    } else {
      const gameView = this.getGameClientView(clientId);
      if (gameView) {
        this.callbacks.sendToClient(clientId, {
          type: 'game:state',
          state: gameView,
        });
      }
    }
  }

  public broadcastState() {
    for (const human of this.getHumanSeats()) {
      if (human.connected && human.playerId) {
        this.sendSnapshotTo(human.playerId);
      }
    }
  }
}
