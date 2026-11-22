/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * services/multiplayerClient.ts - Cliente WebSocket para el Mus Multijugador
 * con soporte automático de motor local en navegador (ideal para Vercel sin WS)
 * y conexión configurable a servidor WebSocket externo vía VITE_WS_URL.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { DrinkId } from '../types/mus';
import {
  ClientWsMessage,
  DrinkEffectNotification,
  GameBetActionType,
  GameClientView,
  PlayerProfile,
  RoomLobbyView,
  RoomSummary,
  RoomVisibility,
  SeatIndex,
  ServerWsMessage,
  TableSignEvent,
} from '../types/multiplayer';
import { PLAYABLE_CHARACTER_IDS } from '../shared/characterData';
import { MusRoom } from '../shared/musRoom';

export type WsConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'local';

const STORAGE_KEY = 'pcmus_multiplayer_profile_v1';

function generateLocalClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `cli-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadSavedProfile(): PlayerProfile {
  const defaultProfile: PlayerProfile = {
    clientId: generateLocalClientId(),
    name: 'Parroquiano',
    avatarId: 'cura',
  };
  if (typeof window === 'undefined') return defaultProfile;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultProfile));
      return defaultProfile;
    }
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    const validAvatar =
      parsed.avatarId && (PLAYABLE_CHARACTER_IDS as readonly string[]).includes(parsed.avatarId)
        ? parsed.avatarId
        : 'cura';
    const profile: PlayerProfile = {
      clientId:
        typeof parsed.clientId === 'string' && parsed.clientId.trim()
          ? parsed.clientId
          : defaultProfile.clientId,
      name:
        typeof parsed.name === 'string' && parsed.name.trim()
          ? parsed.name.trim().slice(0, 20)
          : defaultProfile.name,
      avatarId: validAvatar,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    return profile;
  } catch {
    return defaultProfile;
  }
}

function saveProfile(profile: PlayerProfile) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}

function normalizeWsUrl(rawUrl: string): string {
  let normalized = rawUrl.trim();
  if (normalized.startsWith('https://')) {
    normalized = `wss://${normalized.slice('https://'.length)}`;
  } else if (normalized.startsWith('http://')) {
    normalized = `ws://${normalized.slice('http://'.length)}`;
  } else if (!normalized.startsWith('ws://') && !normalized.startsWith('wss://')) {
    normalized = `wss://${normalized}`;
  }
  try {
    const u = new URL(normalized);
    if (!u.pathname || u.pathname === '/') {
      u.pathname = '/ws';
    }
    return u.toString();
  } catch {
    return normalized;
  }
}

function getConfiguredWsUrl(): string | null {
  const envUrl = (import.meta.env.VITE_WS_URL as string | undefined)?.trim();
  if (envUrl) return normalizeWsUrl(envUrl);
  return null;
}

function isVercelStaticHost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.endsWith('.vercel.app');
}

export function useMultiplayerClient() {
  const [profile, setProfile] = useState<PlayerProfile>(loadSavedProfile);
  const profileRef = useRef<PlayerProfile>(profile);
  profileRef.current = profile;

  const configuredWsUrl = getConfiguredWsUrl();
  const [connectionStatus, setConnectionStatus] = useState<WsConnectionStatus>(() => {
    if (!configuredWsUrl && isVercelStaticHost()) return 'local';
    return 'connecting';
  });
  const connectionStatusRef = useRef<WsConnectionStatus>(connectionStatus);
  connectionStatusRef.current = connectionStatus;

  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [lobbyView, setLobbyView] = useState<RoomLobbyView | null>(null);
  const [gameView, setGameView] = useState<GameClientView | null>(null);
  const [lastSignEvent, setLastSignEvent] = useState<TableSignEvent | null>(null);
  const [lastDrinkEffect, setLastDrinkEffect] = useState<DrinkEffectNotification | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const localRoomRef = useRef<MusRoom | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const errorTimerRef = useRef<number | null>(null);
  const unmountedRef = useRef(false);
  const backoffRef = useRef(500);
  const hadSuccessfulWsRef = useRef(false);

  const pushError = useCallback((msg: string) => {
    setError(msg);
    if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = window.setTimeout(() => {
      setError(null);
    }, 5500);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    if (errorTimerRef.current) {
      window.clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
  }, []);

  const handleServerPayload = useCallback(
    (msg: ServerWsMessage) => {
      switch (msg.type) {
        case 'welcome':
          if (msg.clientId && msg.clientId !== profileRef.current.clientId) {
            const updated = { ...profileRef.current, clientId: msg.clientId };
            profileRef.current = updated;
            saveProfile(updated);
            setProfile(updated);
          }
          if (!msg.activeRoomId) {
            setLobbyView(null);
            setGameView(null);
          }
          break;

        case 'rooms:list':
          setRooms(msg.rooms);
          break;

        case 'room:lobby':
          setLobbyView(msg.lobby);
          setGameView(null);
          break;

        case 'room:left':
          setLobbyView(null);
          setGameView(null);
          if (msg.reason) pushError(msg.reason);
          break;

        case 'game:state':
          setGameView(msg.state);
          setLobbyView(null);
          break;

        case 'game:sign':
          setLastSignEvent(msg.sign);
          break;

        case 'game:drink_effect':
          setLastDrinkEffect(msg.effect);
          break;

        case 'error':
          pushError(msg.message);
          break;
      }
    },
    [pushError]
  );

  useEffect(() => {
    unmountedRef.current = false;

    // En Vercel sin VITE_WS_URL activamos el motor local de MusRoom directamente
    if (!configuredWsUrl && isVercelStaticHost()) {
      setConnectionStatus('local');
      return () => {
        unmountedRef.current = true;
        localRoomRef.current?.destroy();
        localRoomRef.current = null;
      };
    }

    const connect = () => {
      if (unmountedRef.current || typeof window === 'undefined') return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = configuredWsUrl || `${protocol}//${window.location.host}/ws`;

      setConnectionStatus((prev) => (prev === 'connected' ? 'connected' : 'connecting'));
      const ws = new WebSocket(url);
      wsRef.current = ws;

      let opened = false;
      const probeTimer = !configuredWsUrl && !hadSuccessfulWsRef.current
        ? window.setTimeout(() => {
            if (!opened && wsRef.current === ws) {
              ws.close();
            }
          }, 2200)
        : null;

      ws.onopen = () => {
        opened = true;
        hadSuccessfulWsRef.current = true;
        if (probeTimer) window.clearTimeout(probeTimer);
        backoffRef.current = 500;
        setConnectionStatus('connected');
        const p = profileRef.current;
        ws.send(
          JSON.stringify({
            type: 'hello',
            clientId: p.clientId,
            name: p.name,
            avatarId: p.avatarId,
          } satisfies ClientWsMessage)
        );
      };

      ws.onmessage = (ev) => {
        let msg: ServerWsMessage;
        try {
          msg = JSON.parse(String(ev.data)) as ServerWsMessage;
        } catch {
          return;
        }
        handleServerPayload(msg);
      };

      ws.onclose = () => {
        if (probeTimer) window.clearTimeout(probeTimer);
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        if (unmountedRef.current) return;

        // Si no hay VITE_WS_URL y nunca hubo servidor WS (ej. dominio propio en Vercel),
        // cambia limpiamente a motor local en el navegador para jugar Solo contra 3 IA.
        if (!configuredWsUrl && !hadSuccessfulWsRef.current) {
          setConnectionStatus('local');
          return;
        }

        setConnectionStatus('reconnecting');
        const waitMs = backoffRef.current;
        backoffRef.current = Math.min(5000, Math.round(backoffRef.current * 1.6));
        reconnectTimerRef.current = window.setTimeout(connect, waitMs);
      };

      ws.onerror = () => {
        // onclose gestiona el fallback o la reconexión
      };
    };

    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      localRoomRef.current?.destroy();
      localRoomRef.current = null;
    };
  }, [configuredWsUrl, handleServerPayload]);

  const sendRaw = useCallback((msg: ClientWsMessage): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    ws.send(JSON.stringify(msg));
    return true;
  }, []);

  const isLocalEngine = () => connectionStatusRef.current === 'local' || (!!localRoomRef.current && !wsRef.current);

  const destroyLocalRoom = useCallback(() => {
    if (localRoomRef.current) {
      localRoomRef.current.destroy();
      localRoomRef.current = null;
    }
  }, []);

  const updateProfile = useCallback(
    (name: string, avatarId: string) => {
      const cleanName = name.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 20) || 'Parroquiano';
      const validAvatar = (PLAYABLE_CHARACTER_IDS as readonly string[]).includes(avatarId)
        ? avatarId
        : 'cura';
      const next: PlayerProfile = {
        ...profileRef.current,
        name: cleanName,
        avatarId: validAvatar,
      };
      profileRef.current = next;
      saveProfile(next);
      setProfile(next);

      if (localRoomRef.current) {
        localRoomRef.current.updatePlayerProfile(next);
        localRoomRef.current.sendSnapshotTo(next.clientId);
      } else {
        sendRaw({ type: 'profile:update', name: next.name, avatarId: next.avatarId });
      }
    },
    [sendRaw]
  );

  const refreshRooms = useCallback(() => {
    if (isLocalEngine()) {
      setRooms([]);
      return true;
    }
    return sendRaw({ type: 'rooms:subscribe' });
  }, [sendRaw]);

  const createRoom = useCallback(
    (opts: {
      title?: string;
      visibility: RoomVisibility;
      autoStartSolo?: boolean;
      botIds?: [string, string, string];
    }) => {
      clearError();

      if (connectionStatusRef.current === 'local') {
        destroyLocalRoom();
        const code = `SOLO-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const room = new MusRoom(
          `local-${generateLocalClientId()}`,
          code,
          profileRef.current,
          {
            title: opts.title || `Mesa de ${profileRef.current.name}`,
            visibility: 'private',
            botIds: opts.botIds,
          },
          {
            sendToClient: (clientId, payload) => {
              if (clientId === profileRef.current.clientId) {
                handleServerPayload(payload as ServerWsMessage);
              }
            },
            onRoomUpdated: () => {},
          }
        );
        localRoomRef.current = room;
        if (opts.autoStartSolo) {
          room.startGame(profileRef.current.clientId);
        } else {
          room.sendSnapshotTo(profileRef.current.clientId);
        }
        return true;
      }

      return sendRaw({ type: 'room:create', ...opts });
    },
    [clearError, destroyLocalRoom, handleServerPayload, sendRaw]
  );

  const joinRoom = useCallback(
    (opts: { roomId?: string; code?: string }) => {
      clearError();
      if (isLocalEngine()) {
        pushError(
          'El multijugador entre dispositivos requiere configurar VITE_WS_URL hacia el servidor WebSocket. Aquí puedes abrir una Mesa Solo con 3 IA.'
        );
        return false;
      }
      return sendRaw({ type: 'room:join', ...opts });
    },
    [clearError, pushError, sendRaw]
  );

  const leaveRoom = useCallback(() => {
    setLobbyView(null);
    setGameView(null);
    if (localRoomRef.current) {
      destroyLocalRoom();
      return true;
    }
    return sendRaw({ type: 'room:leave' });
  }, [destroyLocalRoom, sendRaw]);

  const claimSeat = useCallback(
    (seatIndex: SeatIndex) => {
      const room = localRoomRef.current;
      if (room) {
        const res = room.claimSeat(profileRef.current.clientId, seatIndex);
        if (!res.ok && res.error) pushError(res.error);
        return res.ok;
      }
      return sendRaw({ type: 'room:claim_seat', seatIndex });
    },
    [pushError, sendRaw]
  );

  const configureSeat = useCallback(
    (
      seatIndex: SeatIndex,
      opts: { avatarId?: string; allowHumanJoin?: boolean; setBot?: boolean }
    ) => {
      const room = localRoomRef.current;
      if (room) {
        const res = room.configureSeat(profileRef.current.clientId, seatIndex, opts);
        if (!res.ok && res.error) pushError(res.error);
        return res.ok;
      }
      return sendRaw({ type: 'room:configure_seat', seatIndex, ...opts });
    },
    [pushError, sendRaw]
  );

  const toggleReady = useCallback(
    (ready?: boolean) => {
      const room = localRoomRef.current;
      if (room) {
        room.toggleReady(profileRef.current.clientId, ready);
        return true;
      }
      return sendRaw({ type: 'room:toggle_ready', ready });
    },
    [sendRaw]
  );

  const sendChat = useCallback(
    (text: string) => {
      const room = localRoomRef.current;
      if (room) {
        room.addChat(profileRef.current.clientId, text);
        return true;
      }
      return sendRaw({ type: 'room:chat', text });
    },
    [sendRaw]
  );

  const startGame = useCallback(() => {
    const room = localRoomRef.current;
    if (room) {
      const res = room.startGame(profileRef.current.clientId);
      if (!res.ok && res.error) pushError(res.error);
      return res.ok;
    }
    return sendRaw({ type: 'room:start_game' });
  }, [pushError, sendRaw]);

  const returnToLobby = useCallback(() => {
    const room = localRoomRef.current;
    if (room) {
      const res = room.returnToLobby(profileRef.current.clientId);
      if (!res.ok && res.error) pushError(res.error);
      return res.ok;
    }
    return sendRaw({ type: 'room:return_lobby' });
  }, [pushError, sendRaw]);

  const sendMusVote = useCallback(
    (voteMus: boolean) => {
      const room = localRoomRef.current;
      if (room) {
        const res = room.handleMusVote(profileRef.current.clientId, voteMus);
        if (!res.ok && res.error) pushError(res.error);
        return res.ok;
      }
      return sendRaw({ type: 'game:mus_vote', voteMus });
    },
    [pushError, sendRaw]
  );

  const sendDiscard = useCallback(
    (cardIds: string[]) => {
      const room = localRoomRef.current;
      if (room) {
        const res = room.handleDiscard(profileRef.current.clientId, cardIds);
        if (!res.ok && res.error) pushError(res.error);
        return res.ok;
      }
      return sendRaw({ type: 'game:discard', cardIds });
    },
    [pushError, sendRaw]
  );

  const sendDeclare = useCallback(() => {
    const room = localRoomRef.current;
    if (room) {
      const res = room.handleDeclare(profileRef.current.clientId);
      if (!res.ok && res.error) pushError(res.error);
      return res.ok;
    }
    return sendRaw({ type: 'game:declare' });
  }, [pushError, sendRaw]);

  const sendBetAction = useCallback(
    (action: GameBetActionType, customAmount?: number) => {
      const room = localRoomRef.current;
      if (room) {
        const res = room.handleBetAction(profileRef.current.clientId, action, customAmount);
        if (!res.ok && res.error) pushError(res.error);
        return res.ok;
      }
      return sendRaw({ type: 'game:bet_action', action, customAmount });
    },
    [pushError, sendRaw]
  );

  const orderDrink = useCallback(
    (drinkId: DrinkId) => {
      const room = localRoomRef.current;
      if (room) {
        const res = room.orderDrink(profileRef.current.clientId, drinkId);
        if (!res.ok && res.error) pushError(res.error);
        return res.ok;
      }
      return sendRaw({ type: 'game:order_drink', drinkId });
    },
    [pushError, sendRaw]
  );

  const sendSign = useCallback(
    (signId: string) => {
      const room = localRoomRef.current;
      if (room) {
        const res = room.handleSendSign(profileRef.current.clientId, signId);
        if (!res.ok && res.error) pushError(res.error);
        return res.ok;
      }
      return sendRaw({ type: 'game:send_sign', signId });
    },
    [pushError, sendRaw]
  );

  const catchSign = useCallback(
    (signId: string) => {
      const room = localRoomRef.current;
      if (room) {
        const res = room.handleCatchSign(profileRef.current.clientId, signId);
        if (!res.ok && res.error) pushError(res.error);
        return res.ok;
      }
      return sendRaw({ type: 'game:catch_sign', signId });
    },
    [pushError, sendRaw]
  );

  const sendNextHandReady = useCallback(() => {
    const room = localRoomRef.current;
    if (room) {
      room.handleNextHandReady(profileRef.current.clientId);
      return true;
    }
    return sendRaw({ type: 'game:next_hand_ready' });
  }, [sendRaw]);

  const sendRematch = useCallback(() => {
    const room = localRoomRef.current;
    if (room) {
      const res = room.rematch(profileRef.current.clientId);
      if (!res.ok && res.error) pushError(res.error);
      return res.ok;
    }
    return sendRaw({ type: 'game:rematch' });
  }, [pushError, sendRaw]);

  const cycleTimeOfDay = useCallback(() => {
    const room = localRoomRef.current;
    if (room) {
      room.handleCycleTimeOfDay();
      return true;
    }
    return sendRaw({ type: 'game:cycle_time_of_day' });
  }, [sendRaw]);

  const pokeWaiter = useCallback(() => {
    const room = localRoomRef.current;
    if (room) {
      room.handlePokeWaiter();
      return true;
    }
    return sendRaw({ type: 'game:poke_waiter' });
  }, [sendRaw]);

  return {
    profile,
    updateProfile,
    connectionStatus,
    hasExternalWsConfig: Boolean(configuredWsUrl),
    rooms,
    lobbyView,
    gameView,
    lastSignEvent,
    lastDrinkEffect,
    error,
    clearError,
    refreshRooms,
    createRoom,
    joinRoom,
    leaveRoom,
    claimSeat,
    configureSeat,
    toggleReady,
    sendChat,
    startGame,
    returnToLobby,
    sendMusVote,
    sendDiscard,
    sendDeclare,
    sendBetAction,
    orderDrink,
    sendSign,
    catchSign,
    sendNextHandReady,
    sendRematch,
    cycleTimeOfDay,
    pokeWaiter,
  };
}
