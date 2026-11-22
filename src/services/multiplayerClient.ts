/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * services/multiplayerClient.ts - Cliente WebSocket para el Mus Multijugador
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

export type WsConnectionStatus = 'connecting' | 'connected' | 'reconnecting';

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
      clientId: typeof parsed.clientId === 'string' && parsed.clientId.trim() ? parsed.clientId : defaultProfile.clientId,
      name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim().slice(0, 20) : defaultProfile.name,
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

export function useMultiplayerClient() {
  const [profile, setProfile] = useState<PlayerProfile>(loadSavedProfile);
  const profileRef = useRef<PlayerProfile>(profile);
  profileRef.current = profile;

  const [connectionStatus, setConnectionStatus] = useState<WsConnectionStatus>('connecting');
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [lobbyView, setLobbyView] = useState<RoomLobbyView | null>(null);
  const [gameView, setGameView] = useState<GameClientView | null>(null);
  const [lastSignEvent, setLastSignEvent] = useState<TableSignEvent | null>(null);
  const [lastDrinkEffect, setLastDrinkEffect] = useState<DrinkEffectNotification | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const errorTimerRef = useRef<number | null>(null);
  const unmountedRef = useRef(false);
  const backoffRef = useRef(500);

  const pushError = useCallback((msg: string) => {
    setError(msg);
    if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = window.setTimeout(() => {
      setError(null);
    }, 5000);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    if (errorTimerRef.current) {
      window.clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
  }, []);

  const sendRaw = useCallback((msg: ClientWsMessage): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    ws.send(JSON.stringify(msg));
    return true;
  }, []);

  useEffect(() => {
    unmountedRef.current = false;

    const connect = () => {
      if (unmountedRef.current || typeof window === 'undefined') return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws`;

      setConnectionStatus((prev) => (prev === 'connected' ? 'connected' : 'connecting'));
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
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
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        if (unmountedRef.current) return;
        setConnectionStatus('reconnecting');
        const waitMs = backoffRef.current;
        backoffRef.current = Math.min(5000, Math.round(backoffRef.current * 1.6));
        reconnectTimerRef.current = window.setTimeout(connect, waitMs);
      };

      ws.onerror = () => {
        // onclose will handle reconnection
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
    };
  }, [pushError]);

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
      sendRaw({ type: 'profile:update', name: next.name, avatarId: next.avatarId });
    },
    [sendRaw]
  );

  const refreshRooms = useCallback(() => sendRaw({ type: 'rooms:subscribe' }), [sendRaw]);

  const createRoom = useCallback(
    (opts: {
      title?: string;
      visibility: RoomVisibility;
      autoStartSolo?: boolean;
      botIds?: [string, string, string];
    }) => {
      clearError();
      return sendRaw({ type: 'room:create', ...opts });
    },
    [clearError, sendRaw]
  );

  const joinRoom = useCallback(
    (opts: { roomId?: string; code?: string }) => {
      clearError();
      return sendRaw({ type: 'room:join', ...opts });
    },
    [clearError, sendRaw]
  );

  const leaveRoom = useCallback(() => {
    setLobbyView(null);
    setGameView(null);
    return sendRaw({ type: 'room:leave' });
  }, [sendRaw]);

  const claimSeat = useCallback(
    (seatIndex: SeatIndex) => sendRaw({ type: 'room:claim_seat', seatIndex }),
    [sendRaw]
  );

  const configureSeat = useCallback(
    (
      seatIndex: SeatIndex,
      opts: { avatarId?: string; allowHumanJoin?: boolean; setBot?: boolean }
    ) => sendRaw({ type: 'room:configure_seat', seatIndex, ...opts }),
    [sendRaw]
  );

  const toggleReady = useCallback(
    (ready?: boolean) => sendRaw({ type: 'room:toggle_ready', ready }),
    [sendRaw]
  );

  const sendChat = useCallback(
    (text: string) => sendRaw({ type: 'room:chat', text }),
    [sendRaw]
  );

  const startGame = useCallback(() => sendRaw({ type: 'room:start_game' }), [sendRaw]);
  const returnToLobby = useCallback(() => sendRaw({ type: 'room:return_lobby' }), [sendRaw]);

  const sendMusVote = useCallback(
    (voteMus: boolean) => sendRaw({ type: 'game:mus_vote', voteMus }),
    [sendRaw]
  );
  const sendDiscard = useCallback(
    (cardIds: string[]) => sendRaw({ type: 'game:discard', cardIds }),
    [sendRaw]
  );
  const sendDeclare = useCallback(() => sendRaw({ type: 'game:declare' }), [sendRaw]);
  const sendBetAction = useCallback(
    (action: GameBetActionType, customAmount?: number) =>
      sendRaw({ type: 'game:bet_action', action, customAmount }),
    [sendRaw]
  );
  const orderDrink = useCallback(
    (drinkId: DrinkId) => sendRaw({ type: 'game:order_drink', drinkId }),
    [sendRaw]
  );
  const sendSign = useCallback(
    (signId: string) => sendRaw({ type: 'game:send_sign', signId }),
    [sendRaw]
  );
  const catchSign = useCallback(
    (signId: string) => sendRaw({ type: 'game:catch_sign', signId }),
    [sendRaw]
  );
  const sendNextHandReady = useCallback(() => sendRaw({ type: 'game:next_hand_ready' }), [sendRaw]);
  const sendRematch = useCallback(() => sendRaw({ type: 'game:rematch' }), [sendRaw]);
  const cycleTimeOfDay = useCallback(() => sendRaw({ type: 'game:cycle_time_of_day' }), [sendRaw]);
  const pokeWaiter = useCallback(() => sendRaw({ type: 'game:poke_waiter' }), [sendRaw]);

  return {
    profile,
    updateProfile,
    connectionStatus,
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
