/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * server/roomManager.ts - Gestor de conexiones WebSocket y salas de espera del Mus
 */

import crypto from 'crypto';
import type { WebSocket } from 'ws';
import {
  ClientWsMessage,
  PlayerProfile,
  RoomSummary,
  ServerWsMessage,
} from '../src/types/multiplayer';
import { PLAYABLE_CHARACTER_IDS } from '../src/shared/characterData';
import { MusRoom } from './musRoom';

interface ClientSession {
  clientId: string;
  profile: PlayerProfile;
  socket: WebSocket | null;
  roomId: string | null;
  subscribedToRooms: boolean;
  lastSeenAt: number;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomManager {
  private rooms = new Map<string, MusRoom>();
  private clients = new Map<string, ClientSession>();
  private socketToClientId = new WeakMap<WebSocket, string>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => this.pruneIdleRooms(), 60_000);
  }

  public dispose() {
    clearInterval(this.cleanupInterval);
    for (const room of this.rooms.values()) {
      room.destroy();
    }
    this.rooms.clear();
  }

  private generateRoomCode(): string {
    for (let attempt = 0; attempt < 25; attempt++) {
      let suffix = '';
      for (let i = 0; i < 4; i++) {
        suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      }
      const code = `BAR-${suffix}`;
      const conflict = Array.from(this.rooms.values()).some((r) => r.code === code);
      if (!conflict) return code;
    }
    return `BAR-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  }

  private sendToClient = (clientId: string, payload: ServerWsMessage | unknown) => {
    const session = this.clients.get(clientId);
    if (!session?.socket || session.socket.readyState !== 1) return;
    try {
      session.socket.send(JSON.stringify(payload));
    } catch {
      // Ignore closed socket races
    }
  };

  private sendError(ws: WebSocket, message: string) {
    if (ws.readyState !== 1) return;
    try {
      const msg: ServerWsMessage = { type: 'error', message };
      ws.send(JSON.stringify(msg));
    } catch {
      // Ignore
    }
  }

  private sanitizeProfile(clientId: string, name?: string, avatarId?: string): PlayerProfile {
    const cleanName = (name || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 20) || 'Parroquiano';
    const validAvatar =
      avatarId && (PLAYABLE_CHARACTER_IDS as readonly string[]).includes(avatarId)
        ? avatarId
        : 'cura';
    return {
      clientId,
      name: cleanName,
      avatarId: validAvatar,
    };
  }

  public getPublicRoomSummaries(): RoomSummary[] {
    return Array.from(this.rooms.values())
      .filter((r) => r.visibility === 'public' && r.phase === 'LOBBY')
      .map((r) => r.getSummary())
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  private broadcastRoomList() {
    const list = this.getPublicRoomSummaries();
    const payload: ServerWsMessage = { type: 'rooms:list', rooms: list };
    const serialized = JSON.stringify(payload);
    for (const session of this.clients.values()) {
      if (session.subscribedToRooms && session.socket?.readyState === 1) {
        try {
          session.socket.send(serialized);
        } catch {
          // Ignore
        }
      }
    }
  }

  private pruneIdleRooms() {
    const now = Date.now();
    let changed = false;
    for (const [roomId, room] of this.rooms.entries()) {
      const connected = room.getConnectedHumanCount();
      const maxIdle = room.phase === 'LOBBY' ? 2 * 60_000 : 10 * 60_000;
      if (connected === 0 && now - room.lastActivityAt > maxIdle) {
        for (const s of room.getHumanSeats()) {
          if (s.playerId) {
            const client = this.clients.get(s.playerId);
            if (client && client.roomId === roomId) {
              client.roomId = null;
            }
          }
        }
        room.destroy();
        this.rooms.delete(roomId);
        changed = true;
      }
    }
    if (changed) {
      this.broadcastRoomList();
    }
  }

  public handleSocketDisconnect(ws: WebSocket) {
    const clientId = this.socketToClientId.get(ws);
    if (!clientId) return;
    const session = this.clients.get(clientId);
    if (!session || session.socket !== ws) return;

    session.socket = null;
    session.lastSeenAt = Date.now();

    if (session.roomId) {
      const room = this.rooms.get(session.roomId);
      if (room) {
        room.handleDisconnect(clientId);
      }
    }
  }

  public handleMessage(ws: WebSocket, msg: ClientWsMessage) {
    if (msg.type === 'hello') {
      const rawId = typeof msg.clientId === 'string' ? msg.clientId.trim().slice(0, 64) : '';
      const clientId = rawId || crypto.randomUUID();
      const profile = this.sanitizeProfile(clientId, msg.name, msg.avatarId);

      const existing = this.clients.get(clientId);
      const activeRoomId =
        existing?.roomId && this.rooms.has(existing.roomId) ? existing.roomId : null;

      this.clients.set(clientId, {
        clientId,
        profile,
        socket: ws,
        roomId: activeRoomId,
        subscribedToRooms: true,
        lastSeenAt: Date.now(),
      });
      this.socketToClientId.set(ws, clientId);

      this.sendToClient(clientId, {
        type: 'welcome',
        clientId,
        activeRoomId,
      });

      this.sendToClient(clientId, {
        type: 'rooms:list',
        rooms: this.getPublicRoomSummaries(),
      });

      if (activeRoomId) {
        const room = this.rooms.get(activeRoomId);
        if (room && room.hasPlayer(clientId)) {
          room.updatePlayerProfile(profile);
          room.handleReconnect(clientId);
          room.sendSnapshotTo(clientId);
        } else {
          const s = this.clients.get(clientId);
          if (s) s.roomId = null;
        }
      }
      return;
    }

    const clientId = this.socketToClientId.get(ws);
    if (!clientId) {
      this.sendError(ws, 'Sesión no inicializada. Reintentando conexión...');
      return;
    }
    const session = this.clients.get(clientId);
    if (!session) {
      this.sendError(ws, 'Sesión expirada.');
      return;
    }
    session.lastSeenAt = Date.now();

    switch (msg.type) {
      case 'profile:update': {
        session.profile = this.sanitizeProfile(clientId, msg.name, msg.avatarId);
        if (session.roomId) {
          this.rooms.get(session.roomId)?.updatePlayerProfile(session.profile);
        }
        return;
      }

      case 'rooms:subscribe': {
        session.subscribedToRooms = true;
        this.sendToClient(clientId, {
          type: 'rooms:list',
          rooms: this.getPublicRoomSummaries(),
        });
        return;
      }

      case 'room:create': {
        // Leave current room if already in one
        if (session.roomId) {
          this.leaveCurrentRoom(session);
        }

        const roomId = crypto.randomUUID();
        const code = this.generateRoomCode();
        const room = new MusRoom(
          roomId,
          code,
          session.profile,
          {
            title: msg.title,
            visibility: msg.visibility === 'private' ? 'private' : 'public',
            botIds: msg.botIds,
          },
          {
            sendToClient: this.sendToClient,
            onRoomUpdated: () => this.broadcastRoomList(),
          }
        );

        this.rooms.set(roomId, room);
        session.roomId = roomId;

        if (msg.autoStartSolo) {
          room.startGame(clientId);
        } else {
          room.sendSnapshotTo(clientId);
        }
        this.broadcastRoomList();
        return;
      }

      case 'room:join': {
        const targetCode = typeof msg.code === 'string' ? msg.code.trim().toUpperCase() : '';
        const targetRoom = msg.roomId
          ? this.rooms.get(msg.roomId)
          : Array.from(this.rooms.values()).find(
              (r) =>
                r.code === targetCode ||
                (targetCode.length === 4 && r.code === `BAR-${targetCode}`)
            );

        if (!targetRoom) {
          this.sendError(ws, 'No se encontró ninguna mesa con ese código.');
          return;
        }

        if (session.roomId && session.roomId !== targetRoom.roomId) {
          this.leaveCurrentRoom(session);
        }

        const res = targetRoom.joinPlayer(session.profile);
        if (!res.ok) {
          this.sendError(ws, res.error || 'No se pudo entrar en la mesa.');
          return;
        }

        session.roomId = targetRoom.roomId;
        targetRoom.sendSnapshotTo(clientId);
        this.broadcastRoomList();
        return;
      }

      case 'room:leave': {
        this.leaveCurrentRoom(session, undefined, true);
        return;
      }

      default: {
        if (!session.roomId) {
          this.sendError(ws, 'No estás dentro de ninguna mesa.');
          return;
        }
        const room = this.rooms.get(session.roomId);
        if (!room) {
          session.roomId = null;
          this.sendToClient(clientId, { type: 'room:left', reason: 'La mesa se cerró por inactividad.' });
          return;
        }
        this.dispatchRoomMessage(room, clientId, ws, msg);
      }
    }
  }

  private leaveCurrentRoom(session: ClientSession, reason?: string, notifyClient = false) {
    if (!session.roomId) return;
    const room = this.rooms.get(session.roomId);
    const oldRoomId = session.roomId;
    session.roomId = null;

    if (room) {
      const isEmpty = room.leavePlayer(session.clientId, reason);
      if (isEmpty) {
        this.rooms.delete(oldRoomId);
      }
      this.broadcastRoomList();
    }

    if (notifyClient) {
      this.sendToClient(session.clientId, { type: 'room:left', reason });
    }
  }

  private dispatchRoomMessage(room: MusRoom, clientId: string, ws: WebSocket, msg: ClientWsMessage) {
    switch (msg.type) {
      case 'room:claim_seat': {
        const res = room.claimSeat(clientId, msg.seatIndex);
        if (!res.ok) this.sendError(ws, res.error || 'No puedes sentarte ahí.');
        return;
      }
      case 'room:configure_seat': {
        const res = room.configureSeat(clientId, msg.seatIndex, {
          avatarId: msg.avatarId,
          allowHumanJoin: msg.allowHumanJoin,
          setBot: msg.setBot,
        });
        if (!res.ok) this.sendError(ws, res.error || 'Error configurando silla.');
        return;
      }
      case 'room:toggle_ready':
        room.toggleReady(clientId, msg.ready);
        return;
      case 'room:chat':
        room.addChat(clientId, msg.text);
        return;
      case 'room:start_game': {
        const res = room.startGame(clientId);
        if (!res.ok) this.sendError(ws, res.error || 'No se pudo empezar la partida.');
        return;
      }
      case 'room:return_lobby': {
        const res = room.returnToLobby(clientId);
        if (!res.ok) this.sendError(ws, res.error || 'No se pudo volver a la sala.');
        return;
      }
      case 'game:mus_vote': {
        const res = room.handleMusVote(clientId, Boolean(msg.voteMus));
        if (!res.ok) this.sendError(ws, res.error || 'Acción inválida.');
        return;
      }
      case 'game:discard': {
        const res = room.handleDiscard(clientId, Array.isArray(msg.cardIds) ? msg.cardIds : []);
        if (!res.ok) this.sendError(ws, res.error || 'Descarte inválido.');
        return;
      }
      case 'game:declare': {
        const res = room.handleDeclare(clientId);
        if (!res.ok) this.sendError(ws, res.error || 'Declaración inválida.');
        return;
      }
      case 'game:bet_action': {
        const res = room.handleBetAction(clientId, msg.action, msg.customAmount);
        if (!res.ok) this.sendError(ws, res.error || 'Envite inválido.');
        return;
      }
      case 'game:order_drink': {
        const res = room.orderDrink(clientId, msg.drinkId);
        if (!res.ok) this.sendError(ws, res.error || 'No se pudo pedir consumición.');
        return;
      }
      case 'game:send_sign': {
        const res = room.handleSendSign(clientId, msg.signId);
        if (!res.ok) this.sendError(ws, res.error || 'No se pudo pasar la seña.');
        return;
      }
      case 'game:catch_sign': {
        const res = room.handleCatchSign(clientId, msg.signId);
        if (!res.ok) this.sendError(ws, res.error || 'No se pudo cazar la seña.');
        return;
      }
      case 'game:next_hand_ready':
        room.handleNextHandReady(clientId);
        return;
      case 'game:rematch': {
        const res = room.rematch(clientId);
        if (!res.ok) this.sendError(ws, res.error || 'No se pudo iniciar la revancha.');
        return;
      }
      case 'game:cycle_time_of_day':
        room.handleCycleTimeOfDay();
        return;
      case 'game:poke_waiter':
        room.handlePokeWaiter();
        return;
    }
  }
}
