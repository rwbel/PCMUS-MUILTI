/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * App.tsx - Componente principal de PCMus Lo-Fi (Multijugador & Solo IA)
 *
 * Conecta con el servidor autoritativo via WebSocket (/ws) para soportar:
 *   - Sala de espera donde cada jugador elige nombre y avatar
 *   - Mesas multijugador en cualquier combinación (1H+3IA, 2H+2IA pareja o rivales, 3H+1IA, 4H)
 *   - Partida rápida solo contra 3 bots de IA con la misma mecánica oficial de Bizkaia
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CharactersModal } from './components/CharactersModal';
import { PCMusTavernCanvas, SeatDisplayMeta } from './components/PCMusTavernCanvas';
import { DrinksModal } from './components/DrinksModal';
import { RulesModal } from './components/RulesModal';
import { AchievementsModal } from './components/AchievementsModal';
import { AchievementToast } from './components/AchievementToast';
import { ShowdownTableView } from './components/ShowdownTableView';
import { TitleScreen } from './components/TitleScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { WaitingRoomView } from './components/WaitingRoomView';
import { TorneoSheet } from './components/TorneoSheet';
import {
  DrinkItem,
  GamePhase,
  MusSign,
  PlayerPosition,
  PlayerSobrietyState,
  SpeechSpeaker,
} from './types/mus';
import { AUTHENTIC_MUS_SIGNS, CHARACTERS, getSignAnimationClass } from './utils/characters';
import { evaluateJuego, evaluatePares, getValidSignsForHand } from './utils/musRules';
import { soundEngine } from './utils/soundEngine';
import { ttsEngine } from './utils/ttsEngine';
import { getPlaybackRateForSobriety } from './utils/voiceProfiles';
import { TARGET_JUEGOS, TARGET_PIEDRAS } from './config/gameConfig';
import {
  ACHIEVEMENTS,
  AchievementDefinition,
  AchievementStats,
  AchievementStore,
  detectHandAchievementFlags,
  evaluateAndUnlockAchievements,
  loadAchievementStore,
  resetAchievementStore,
} from './utils/achievements';
import { useMultiplayerClient } from './services/multiplayerClient';

const EMPTY_SOBRIETY: PlayerSobrietyState = {
  alcohol: 0,
  caffeine: 0,
  totalDrinks: 0,
};

export default function App() {
  const mp = useMultiplayerClient();

  // Navegación entre Portada -> Sala de Espera -> Mesa de Juego
  const [showLobbyBrowser, setShowLobbyBrowser] = useState<boolean>(false);
  const pendingQuickSoloRef = useRef<boolean>(false);

  // Modales y preferencias locales de audio/pantalla
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [showTorneoSheet, setShowTorneoSheet] = useState<boolean>(false);
  const [showSignsModal, setShowSignsModal] = useState<boolean>(false);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showCharactersModal, setShowCharactersModal] = useState<boolean>(false);
  const [showDrinksModal, setShowDrinksModal] = useState<boolean>(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState<boolean>(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState<boolean>(true);
  const [activeAudioSpeaker, setActiveAudioSpeaker] = useState<SpeechSpeaker | null>(null);
  const [selectedDiscards, setSelectedDiscards] = useState<string[]>([]);

  // Preferencia rápida de pareja/rivales IA para partida rápida desde portada
  const [partnerId, setPartnerId] = useState<string>('cura');
  const [oppLeftId, setOppLeftId] = useState<string>('guardia');
  const [oppRightId, setOppRightId] = useState<string>('tuno');

  // Sistema de logros persistido localmente
  const [achievementStore, setAchievementStore] = useState<AchievementStore>(() => loadAchievementStore());
  const achievementStoreRef = useRef<AchievementStore>(achievementStore);
  achievementStoreRef.current = achievementStore;
  const [showAchievementsModal, setShowAchievementsModal] = useState<boolean>(false);
  const [achievementQueue, setAchievementQueue] = useState<AchievementDefinition[]>([]);

  const recordAchievementEvent = useCallback(
    (updater: (prevStats: AchievementStats) => AchievementStats) => {
      const { nextStore, newlyUnlocked } = evaluateAndUnlockAchievements(
        achievementStoreRef.current,
        updater
      );
      achievementStoreRef.current = nextStore;
      setAchievementStore(nextStore);
      if (newlyUnlocked.length > 0) {
        setAchievementQueue((prev) => [...prev, ...newlyUnlocked]);
      }
    },
    []
  );

  useEffect(() => {
    if (achievementQueue.length === 0) return;
    const timer = window.setTimeout(() => {
      setAchievementQueue((prev) => prev.slice(1));
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [achievementQueue]);

  useEffect(() => {
    return ttsEngine.subscribeSpeaking((speaker) => {
      setActiveAudioSpeaker(speaker);
    });
  }, []);

  // Sincronización de pantalla completa
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  const handleToggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if (
          (document.documentElement as unknown as { webkitRequestFullscreen?: () => Promise<void> })
            .webkitRequestFullscreen
        ) {
          await (
            document.documentElement as unknown as { webkitRequestFullscreen: () => Promise<void> }
          ).webkitRequestFullscreen();
        }
        setIsFullScreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (
          (document as unknown as { webkitExitFullscreen?: () => Promise<void> })
            .webkitExitFullscreen
        ) {
          await (
            document as unknown as { webkitExitFullscreen: () => Promise<void> }
          ).webkitExitFullscreen();
        }
        setIsFullScreen(false);
      }
    } catch {
      setIsFullScreen((prev) => !prev);
    }
  };

  // Precarga voces TTS de los personajes activos en portada o en la partida
  const activeSeatAvatarKey = mp.gameView
    ? `${mp.gameView.seats.partner.avatarId}-${mp.gameView.seats.oppLeft.avatarId}-${mp.gameView.seats.oppRight.avatarId}`
    : `${partnerId}-${oppLeftId}-${oppRightId}`;

  useEffect(() => {
    const ids = mp.gameView
      ? [
          mp.gameView.seats.partner.avatarId,
          mp.gameView.seats.oppLeft.avatarId,
          mp.gameView.seats.oppRight.avatarId,
          'camarero',
        ]
      : [partnerId, oppLeftId, oppRightId, 'camarero'];
    void ttsEngine.pregenerateForCharacters(ids);
  }, [activeSeatAvatarKey, mp.gameView, partnerId, oppLeftId, oppRightId]);

  // Si el usuario pulsó "Jugar Solo Rápido" mientras el socket conectaba, lo lanza en cuanto esté listo
  useEffect(() => {
    if (mp.connectionStatus === 'connected' && pendingQuickSoloRef.current) {
      pendingQuickSoloRef.current = false;
      mp.createRoom({
        visibility: 'private',
        autoStartSolo: true,
        botIds: [oppRightId, partnerId, oppLeftId],
      });
    }
  }, [mp.connectionStatus, mp.createRoom, oppRightId, partnerId, oppLeftId]);

  const handleQuickStartSolo = () => {
    soundEngine.playPop();
    const sent = mp.createRoom({
      visibility: 'private',
      autoStartSolo: true,
      botIds: [oppRightId, partnerId, oppLeftId],
    });
    if (!sent) {
      pendingQuickSoloRef.current = true;
    }
  };

  // =========================================================================
  // EFECTOS SENSORIALES (VOZ TTS, SFX, SEÑAS, BEBIDAS) DESDE ESTADO DE SERVIDOR
  // =========================================================================

  const prevSpeechTsRef = useRef<Record<string, number>>({});
  const prevPhaseRef = useRef<GamePhase | null>(null);
  const prevTurnRef = useRef<PlayerPosition | null>(null);
  const prevBetHistoryLenRef = useRef<number>(0);
  const prevScoresRef = useRef<{ p1: number; p2: number; j1: number; j2: number; roomId: string } | null>(
    null
  );
  const prevPlayerDrinksRef = useRef<number>(0);
  const handStatsRecordedRef = useRef<boolean>(false);
  const matchRecordedKeyRef = useRef<string | null>(null);
  const matchOverRecordedRef = useRef<boolean>(false);
  const lastSignEventTsRef = useRef<number>(0);
  const lastDrinkEventTsRef = useRef<number>(0);

  const gameView = mp.gameView;

  // Limpia tracking al salir de la mesa
  useEffect(() => {
    if (!gameView) {
      prevSpeechTsRef.current = {};
      prevPhaseRef.current = null;
      prevTurnRef.current = null;
      prevBetHistoryLenRef.current = 0;
      prevScoresRef.current = null;
      prevPlayerDrinksRef.current = 0;
      handStatsRecordedRef.current = false;
      matchRecordedKeyRef.current = null;
      matchOverRecordedRef.current = false;
      setSelectedDiscards([]);
      setShowTorneoSheet(false);
      setShowSignsModal(false);
      setShowDrinksModal(false);
      ttsEngine.stop();
    }
  }, [gameView]);

  // Limpia selección de descarte cuando ya no es tu turno en DISCARD
  useEffect(() => {
    if (!gameView || gameView.gamePhase !== 'DISCARD' || gameView.currentTurnPos !== 'player') {
      if (selectedDiscards.length > 0) setSelectedDiscards([]);
    }
  }, [gameView?.gamePhase, gameView?.currentTurnPos, selectedDiscards.length]);

  // Efectos de sonido, voces TTS y logros al actualizarse gameView
  useEffect(() => {
    if (!gameView) return;

    // 1. Nuevo partido / revancha
    const isFreshMatch =
      gameView.scoreTeam1.piedras === 0 &&
      gameView.scoreTeam2.piedras === 0 &&
      gameView.scoreTeam1.chicosWon === 0 &&
      gameView.scoreTeam2.chicosWon === 0 &&
      gameView.isFirstHandOfGame;

    if (isFreshMatch && matchOverRecordedRef.current) {
      matchOverRecordedRef.current = false;
      matchRecordedKeyRef.current = null;
    }

    if (matchRecordedKeyRef.current !== gameView.roomId) {
      matchRecordedKeyRef.current = gameView.roomId;
      matchOverRecordedRef.current = false;
      prevScoresRef.current = {
        p1: gameView.scoreTeam1.piedras,
        p2: gameView.scoreTeam2.piedras,
        j1: gameView.scoreTeam1.chicosWon,
        j2: gameView.scoreTeam2.chicosWon,
        roomId: gameView.roomId,
      };
      prevPlayerDrinksRef.current = gameView.seats.player.sobriety.totalDrinks;
      recordAchievementEvent((s) => ({
        ...s,
        gamesPlayed: s.gamesPlayed + 1,
      }));
    }

    // 2. Bocadillos y voces TTS
    (['partner', 'oppLeft', 'oppRight', 'player'] as PlayerPosition[]).forEach((pos) => {
      const sp = gameView.speeches[pos];
      if (!sp) return;
      const prevTs = prevSpeechTsRef.current[pos] || 0;
      if (sp.timestamp > prevTs) {
        prevSpeechTsRef.current[pos] = sp.timestamp;
        soundEngine.playPop();

        if (isVoiceEnabled && pos !== 'player') {
          const seat = gameView.seats[pos];
          const charKey = seat.avatarId;
          const charGender = CHARACTERS[charKey]?.gender || 'male';
          const rate = getPlaybackRateForSobriety(seat.sobriety);
          ttsEngine.speak(sp.text, charKey, {
            gender: charGender,
            speakerPosition: pos,
            playbackSpeed: rate,
          });
        }
      }
    });

    if (gameView.waiterSpeech) {
      const prevW = prevSpeechTsRef.current.camarero || 0;
      if (gameView.waiterSpeech.timestamp > prevW) {
        prevSpeechTsRef.current.camarero = gameView.waiterSpeech.timestamp;
        soundEngine.playPop();
        if (isVoiceEnabled) {
          ttsEngine.speak(gameView.waiterSpeech.text, 'camarero', {
            gender: 'male',
            speakerPosition: 'camarero',
            playbackSpeed: 1.0,
          });
        }
      }
    }

    // 3. Cambios de fase (reparto, fin de partida)
    const prevPhase = prevPhaseRef.current;
    if (prevPhase !== gameView.gamePhase) {
      if (gameView.gamePhase === 'DRINKS_ORDER') {
        soundEngine.playCardDeal();
        handStatsRecordedRef.current = false;
      } else if (gameView.gamePhase === 'DISCARD') {
        soundEngine.playCardDeal();
      } else if (gameView.gamePhase === 'GAME_OVER') {
        if (gameView.scoreTeam1.chicosWon >= TARGET_JUEGOS) {
          soundEngine.playWin();
        }
        if (!matchOverRecordedRef.current) {
          matchOverRecordedRef.current = true;
          if (gameView.scoreTeam1.chicosWon >= TARGET_JUEGOS) {
            const isShutout = gameView.scoreTeam2.chicosWon === 0;
            recordAchievementEvent((s) => ({
              ...s,
              gamesWon: s.gamesWon + 1,
              shutoutWins: s.shutoutWins + (isShutout ? 1 : 0),
            }));
          }
        }
      }
      prevPhaseRef.current = gameView.gamePhase;
    }

    if (prevTurnRef.current !== gameView.currentTurnPos) {
      if (gameView.gamePhase === 'DISCARD') {
        soundEngine.playCardDeal();
      }
      prevTurnRef.current = gameView.currentTurnPos;
    }

    // 4. Estadísticas de mano jugada (al cortarse el mus y entrar en Grande)
    if (!gameView.musCutThisHand) {
      handStatsRecordedRef.current = false;
    } else if (!handStatsRecordedRef.current && gameView.hands.player.length === 4) {
      handStatsRecordedRef.current = true;
      const flags = detectHandAchievementFlags(gameView.hands.player);
      const pSob = gameView.seats.player.sobriety;
      const isDrunkOrWired = pSob.alcohol >= 4 || pSob.caffeine >= 4;
      recordAchievementEvent((s) => ({
        ...s,
        handsPlayed: s.handsPlayed + 1,
        treintaYUnaCount: s.treintaYUnaCount + (flags.has31 ? 1 : 0),
        laRealCount: s.laRealCount + (flags.hasLaReal ? 1 : 0),
        pokerReyesCount: s.pokerReyesCount + (flags.hasPokerReyes ? 1 : 0),
        duplesCount: s.duplesCount + (flags.hasDuples ? 1 : 0),
        drunkOrWiredHands: s.drunkOrWiredHands + (isDrunkOrWired ? 1 : 0),
      }));
    }

    // 5. Sonidos de apuestas y órdagos del jugador
    const histLen = gameView.betState?.history.length || 0;
    if (histLen !== prevBetHistoryLenRef.current) {
      if (histLen > prevBetHistoryLenRef.current && gameView.betState) {
        const lastAct = gameView.betState.lastAction;
        if (lastAct === 'ordago') {
          soundEngine.playOrdagoDrama();
          if (gameView.betState.lastActor === 'player') {
            recordAchievementEvent((s) => ({
              ...s,
              ordagosCalledByPlayer: s.ordagosCalledByPlayer + 1,
            }));
          }
        } else if (lastAct === 'envido' || lastAct === 'cinco' || lastAct === 'reenvio') {
          soundEngine.playEnvidoChord();
        }
      }
      prevBetHistoryLenRef.current = histLen;
    }

    // 6. Tanteo y juegos ganados (sonido de piedras + logros)
    const prevSc = prevScoresRef.current;
    if (prevSc) {
      const dP1 = gameView.scoreTeam1.piedras - prevSc.p1;
      const dP2 = gameView.scoreTeam2.piedras - prevSc.p2;
      const dJ1 = gameView.scoreTeam1.chicosWon - prevSc.j1;

      if (dP1 > 0 || dP2 > 0 || dJ1 > 0) {
        soundEngine.playStoneClink();
      }
      if (dP1 > 0 || dJ1 > 0) {
        recordAchievementEvent((s) => ({
          ...s,
          totalPiedrasWon: s.totalPiedrasWon + (dP1 > 0 ? dP1 : 0),
          juegosWon: s.juegosWon + (dJ1 > 0 ? dJ1 : 0),
        }));
      }
      prevScoresRef.current = {
        p1: gameView.scoreTeam1.piedras,
        p2: gameView.scoreTeam2.piedras,
        j1: gameView.scoreTeam1.chicosWon,
        j2: gameView.scoreTeam2.chicosWon,
        roomId: gameView.roomId,
      };
    }

    // 7. Consumo de bebidas del jugador
    const pDrinks = gameView.seats.player.sobriety.totalDrinks;
    if (pDrinks > prevPlayerDrinksRef.current) {
      const pSob = gameView.seats.player.sobriety;
      recordAchievementEvent((s) => ({
        ...s,
        drinksOrdered: s.drinksOrdered + (pDrinks - prevPlayerDrinksRef.current),
        maxAlcoholReached: Math.max(s.maxAlcoholReached, pSob.alcohol),
        maxCaffeineReached: Math.max(s.maxCaffeineReached, pSob.caffeine),
        waterSavedDrunk:
          s.waterSavedDrunk +
          (pSob.lastDrinkId === 'agua' || pSob.lastDrinkId === 'tapa' ? 1 : 0),
      }));
      prevPlayerDrinksRef.current = pDrinks;
    }
  }, [gameView, isVoiceEnabled, recordAchievementEvent]);

  // Despacha eventos de animación de señas al avatar correspondiente
  useEffect(() => {
    const ev = mp.lastSignEvent;
    if (!ev || ev.timestamp === lastSignEventTsRef.current) return;
    lastSignEventTsRef.current = ev.timestamp;
    soundEngine.playPop();
    window.dispatchEvent(
      new CustomEvent('pcmus:character-sign', {
        detail: { position: ev.relativePos, signType: ev.signIcon, durationMs: ev.durationMs },
      })
    );
  }, [mp.lastSignEvent]);

  // Despacha eventos visuales de bebida aplicada sobre personajes
  useEffect(() => {
    const eff = mp.lastDrinkEffect;
    if (!eff || eff.timestamp === lastDrinkEventTsRef.current) return;
    lastDrinkEventTsRef.current = eff.timestamp;
    window.dispatchEvent(
      new CustomEvent('pcmus:drink-effect', {
        detail: {
          position: eff.relativePos,
          drink: eff.drink,
          alcohol: eff.alcohol,
          caffeine: eff.caffeine,
        },
      })
    );
  }, [mp.lastDrinkEffect]);

  // Controles de audio
  const handleToggleVoice = () => {
    const next = !isVoiceEnabled;
    setIsVoiceEnabled(next);
    ttsEngine.setEnabled(next);
    if (next) {
      ttsEngine.speak('¡Voz activada, que hable la taberna!', 'camarero', {
        gender: 'male',
        speakerPosition: 'camarero',
        playbackSpeed: 1.0,
      });
    }
  };

  const handleToggleMusic = () => {
    const isPlaying = soundEngine.toggleMusic();
    setIsMusicPlaying(isPlaying);
  };

  // Acciones de juego enviadas al servidor
  const handleToggleDiscard = (cardId: string) => {
    soundEngine.playPop();
    setSelectedDiscards((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  };

  const handleConfirmDiscards = () => {
    if (!gameView || gameView.isTurnBusy || gameView.gamePhase !== 'DISCARD' || gameView.currentTurnPos !== 'player') {
      return;
    }
    if (selectedDiscards.length === 0) {
      return;
    }
    soundEngine.playCardDeal();
    mp.sendDiscard(selectedDiscards);
    setSelectedDiscards([]);
  };

  const handleSendSign = (sign: MusSign) => {
    soundEngine.playPop();
    mp.sendSign(sign.id);
    recordAchievementEvent((s) => ({
      ...s,
      signsSent: s.signsSent + 1,
    }));
  };

  const handleCatchOpponentSign = () => {
    if (!gameView?.activeCatchableSign) return;
    soundEngine.playStoneClink();
    mp.catchSign(gameView.activeCatchableSign.signId);
    recordAchievementEvent((s) => ({
      ...s,
      signsCaught: s.signsCaught + 1,
    }));
  };

  const handleOrderDrink = (drink: DrinkItem) => {
    mp.orderDrink(drink.id);
    setShowDrinksModal(false);
  };

  const partnerChar = CHARACTERS[partnerId] || CHARACTERS.cura;
  const playerAvatarChar = CHARACTERS[mp.profile.avatarId] || CHARACTERS.cura;
  const unlockedAchievementsCount = ACHIEVEMENTS.filter(
    (a) => Boolean(achievementStore.unlocked[a.id])
  ).length;

  // Datos derivados de la partida en curso
  const isHostInGame = Boolean(gameView && gameView.hostPlayerId === mp.profile.clientId);
  const seatMeta: Record<PlayerPosition, SeatDisplayMeta> | undefined = gameView
    ? {
        player: {
          name: gameView.seats.player.name,
          isHuman: gameView.seats.player.controller === 'human',
          connected: gameView.seats.player.connected,
        },
        partner: {
          name: gameView.seats.partner.name,
          isHuman: gameView.seats.partner.controller === 'human',
          connected: gameView.seats.partner.connected,
        },
        oppLeft: {
          name: gameView.seats.oppLeft.name,
          isHuman: gameView.seats.oppLeft.controller === 'human',
          connected: gameView.seats.oppLeft.connected,
        },
        oppRight: {
          name: gameView.seats.oppRight.name,
          isHuman: gameView.seats.oppRight.controller === 'human',
          connected: gameView.seats.oppRight.connected,
        },
      }
    : undefined;

  const playerHand = gameView?.hands.player || [];
  const validSignsForPlayer = playerHand.length === 4 ? getValidSignsForHand(playerHand) : [];
  const playerHasPares = playerHand.length === 4 ? evaluatePares(playerHand).level > 0 : false;
  const playerHasJuego = playerHand.length === 4 ? evaluateJuego(playerHand).hasJuego : false;

  const playerSobriety = gameView?.seats.player.sobriety || EMPTY_SOBRIETY;
  const playerOrderedThisHand = gameView?.seats.player.orderedDrinkThisHand ?? false;
  const canOrderDrinkThisHand = Boolean(
    gameView &&
      !gameView.musCutThisHand &&
      !playerOrderedThisHand &&
      (gameView.gamePhase === 'DRINKS_ORDER' ||
        gameView.gamePhase === 'MUS_CHECK' ||
        gameView.gamePhase === 'DISCARD')
  );

  return (
    <div className="w-full h-screen h-dvh bg-stone-950 flex flex-col justify-between overflow-hidden select-none">
      {/* Vista 1: Partida activa (Tavern / Showdown / Game Over) */}
      {gameView ? (
        <div className="relative w-full flex-1 min-h-0 flex flex-col overflow-hidden bg-stone-950 text-stone-100">
          {/* Error Toast dentro de partida */}
          {mp.error && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-rose-950/95 border border-rose-500 text-rose-100 text-xs font-bold shadow-2xl flex items-center gap-3">
              <span>{mp.error}</span>
              <button
                type="button"
                onClick={mp.clearError}
                className="text-rose-300 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Top Bar Header */}
          <div className="px-3 sm:px-4 py-2 flex items-center justify-between border-b-2 border-stone-800 bg-stone-900 shadow-md z-30 shrink-0 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => {
                  ttsEngine.stop();
                  mp.leaveRoom();
                  setShowLobbyBrowser(false);
                }}
                className="text-stone-300 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-stone-800 border-2 border-stone-700 font-bold cursor-pointer hover:border-amber-400 active:scale-95 transition-all whitespace-nowrap shrink-0"
              >
                ◀ Salir
              </button>

              {isHostInGame && (
                <button
                  type="button"
                  onClick={() => {
                    ttsEngine.stop();
                    mp.returnToLobby();
                  }}
                  className="text-amber-200 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-stone-800 border-2 border-amber-600/50 font-bold cursor-pointer hover:border-amber-400 active:scale-95 transition-all whitespace-nowrap shrink-0"
                  title="Volver con toda la mesa a la Sala de Espera"
                >
                  🪑 Sala
                </button>
              )}

              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-black font-serif-vintage tracking-wider text-amber-300 truncate">
                  {gameView.title}
                </span>
                <span className="text-[10px] text-stone-300 font-mono-numbers hidden md:inline shrink-0">
                  · {gameView.code} · 👥 {gameView.totalConnectedHumans}/4
                </span>
              </div>
            </div>

            {/* Utility buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowTorneoSheet(true)}
                className="px-2.5 sm:px-3 py-1 rounded-xl bg-amber-500/20 border-2 border-amber-500/60 text-amber-300 hover:bg-amber-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow active:scale-95 transition-all whitespace-nowrap"
                title="Abrir Libreta de Tanteo y Torneo"
              >
                <span>📋</span>
                <span className="hidden sm:inline">Libreta</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAchievementsModal(true)}
                className="px-2.5 py-1 rounded-xl bg-amber-500/15 border-2 border-amber-500/50 text-amber-200 hover:bg-amber-500/25 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow active:scale-95 transition-all whitespace-nowrap"
                title="Ver Logros y Hazañas"
              >
                <span>🏆</span>
                <span className="hidden md:inline">Logros</span>
                <span className="text-[10px] font-mono-numbers text-amber-400">
                  {unlockedAchievementsCount}/{ACHIEVEMENTS.length}
                </span>
              </button>

              <button
                type="button"
                onClick={handleToggleVoice}
                className={`px-2.5 sm:px-3 py-1 rounded-xl border-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow active:scale-95 transition-all whitespace-nowrap ${
                  isVoiceEnabled
                    ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                    : 'bg-stone-800 border-stone-700 text-stone-500'
                }`}
                title={isVoiceEnabled ? 'Desactivar Voces TTS' : 'Activar Voces TTS'}
              >
                <span>{isVoiceEnabled ? '🔊' : '🔇'}</span>
                <span className="hidden sm:inline">{isVoiceEnabled ? 'Voz ON' : 'Voz OFF'}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleMusic}
                className={`px-2.5 sm:px-3 py-1 rounded-xl border-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow active:scale-95 transition-all whitespace-nowrap ${
                  isMusicPlaying
                    ? 'bg-sky-950/80 border-sky-500 text-sky-300'
                    : 'bg-stone-800 border-stone-700 text-stone-500'
                }`}
                title="Música Jazz"
              >
                <span>🎷</span>
                <span className="hidden sm:inline">{isMusicPlaying ? 'Jazz ON' : 'Jazz OFF'}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleFullScreen}
                className="px-2.5 sm:px-3 py-1 rounded-xl bg-stone-800 border-2 border-stone-700 text-stone-300 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all whitespace-nowrap"
                title={isFullScreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa'}
              >
                <span>{isFullScreen ? '🗗' : '⛶'}</span>
                <span className="hidden lg:inline">
                  {isFullScreen ? 'Ventana' : 'Pantalla Completa'}
                </span>
              </button>

              <button
                type="button"
                onClick={mp.cycleTimeOfDay}
                className="px-2.5 py-1 rounded-xl bg-stone-800 border-2 border-amber-500/50 text-amber-200 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow whitespace-nowrap"
                title={`Cambiar iluminación ambiental (Actual: ${gameView.timeOfDay}). Atardecer, Noche, Madrugada, Tarde`}
              >
                <span>
                  {gameView.timeOfDay === 'atardecer'
                    ? '🌅'
                    : gameView.timeOfDay === 'noche'
                    ? '🌙'
                    : gameView.timeOfDay === 'madrugada'
                    ? '🕯️'
                    : '☀️'}
                </span>
                <span className="capitalize hidden md:inline">{gameView.timeOfDay}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowRulesModal(true)}
                className="w-8 h-8 rounded-xl bg-stone-800 border-2 border-amber-500/60 text-amber-300 text-xs font-black flex items-center justify-center hover:bg-stone-700 cursor-pointer shadow shrink-0"
                title="Reglas y Señas del Mus"
              >
                ?
              </button>
            </div>
          </div>

          {/* Main Gameplay Screen */}
          <div className="flex-1 w-full min-h-0 overflow-hidden relative">
            {gameView.gamePhase === 'SHOWDOWN' || gameView.gamePhase === 'ROUND_SUMMARY' ? (
              <ShowdownTableView
                hands={gameView.hands}
                playerName={gameView.seats.player.name}
                partnerName={gameView.seats.partner.name}
                oppLeftName={gameView.seats.oppLeft.name}
                oppRightName={gameView.seats.oppRight.name}
                showdownMessage={gameView.showdownMessage}
                onNextHand={mp.sendNextHandReady}
                lanceResults={gameView.lanceResults}
                scoreTeam1Piedras={gameView.scoreTeam1.piedras}
                scoreTeam2Piedras={gameView.scoreTeam2.piedras}
                scoreTeam1Juegos={gameView.scoreTeam1.chicosWon}
                scoreTeam2Juegos={gameView.scoreTeam2.chicosWon}
                justWonJuego={gameView.justWonJuego}
                breakdownDetails={gameView.breakdownDetails}
                readyNextHandCount={gameView.readyNextHandCount}
                totalConnectedHumans={gameView.totalConnectedHumans}
                myReadyForNextHand={gameView.myReadyForNextHand}
              />
            ) : (
              <PCMusTavernCanvas
                hands={gameView.hands}
                partnerChar={CHARACTERS[gameView.seats.partner.avatarId] || CHARACTERS.cura}
                oppLeftChar={CHARACTERS[gameView.seats.oppLeft.avatarId] || CHARACTERS.guardia}
                oppRightChar={CHARACTERS[gameView.seats.oppRight.avatarId] || CHARACTERS.tuno}
                seatMeta={seatMeta}
                manoPlayer={gameView.manoPos}
                currentTurn={gameView.currentTurnPos}
                currentLance={gameView.currentLance}
                betState={gameView.betState}
                scoreTeam1={gameView.scoreTeam1}
                scoreTeam2={gameView.scoreTeam2}
                targetPiedras={TARGET_PIEDRAS}
                gamePhase={gameView.gamePhase}
                selectedDiscards={selectedDiscards}
                activeSpeeches={gameView.speeches}
                waiterSpeech={gameView.waiterSpeech}
                activeAudioSpeaker={activeAudioSpeaker}
                isVoiceEnabled={isVoiceEnabled}
                canCatchSignOpponent={gameView.activeCatchableSign?.opponentPos ?? null}
                isFirstHandOfGame={gameView.isFirstHandOfGame && !gameView.hasFirstHandCutDone}
                canBetPares={playerHasPares}
                canBetJuego={playerHasJuego}
                playerHasPares={playerHasPares}
                playerHasJuego={playerHasJuego}
                timeOfDay={gameView.timeOfDay}
                onToggleTimeOfDay={mp.cycleTimeOfDay}
                onCatchOpponentSign={handleCatchOpponentSign}
                onToggleDiscard={handleToggleDiscard}
                onConfirmDiscards={handleConfirmDiscards}
                onAction={(act, customAmount) => {
                  if (act === 'mus') {
                    mp.sendMusVote(true);
                  } else if (act === 'no_mus') {
                    mp.sendMusVote(false);
                  } else if (act === 'declare') {
                    mp.sendDeclare();
                  } else {
                    mp.sendBetAction(act, customAmount);
                  }
                }}
                onOpenSignsModal={() => setShowSignsModal(true)}
                onOpenTorneoSheet={() => setShowTorneoSheet(true)}
                onWaiterClick={mp.pokeWaiter}
                onJukeboxClick={handleToggleMusic}
                isMusicPlaying={isMusicPlaying}
                sobriety={playerSobriety}
                npcSobriety={{
                  partner: gameView.seats.partner.sobriety,
                  oppLeft: gameView.seats.oppLeft.sobriety,
                  oppRight: gameView.seats.oppRight.sobriety,
                }}
                isTurnBusy={gameView.isTurnBusy}
                pendingPlayerDrink={gameView.seats.player.pendingDrink}
                canOrderDrinkThisHand={canOrderDrinkThisHand}
                onOpenDrinksModal={() => setShowDrinksModal(true)}
              />
            )}
          </div>

          {/* Game Over Screen */}
          {gameView.gamePhase === 'GAME_OVER' && (
            <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in">
              <div className="bg-[#fefce8] border-4 border-stone-900 rounded-3xl p-8 max-w-md w-full text-center text-stone-950 shadow-2xl font-serif-vintage">
                <span className="text-xs font-black uppercase tracking-widest text-red-700 block mb-2">
                  Partida Terminada · {gameView.scoreTeam1.chicosWon} - {gameView.scoreTeam2.chicosWon} juegos
                </span>
                <h2 className="text-3xl font-black text-stone-950 mb-2">
                  {gameView.scoreTeam1.chicosWon >= TARGET_JUEGOS
                    ? '¡VICTORIA EN MALASAÑA!'
                    : '¡HAN GANADO ELLOS!'}
                </h2>
                <p className="text-sm text-stone-700 mb-6">
                  {gameView.scoreTeam1.chicosWon >= TARGET_JUEGOS
                    ? `Habéis ganado la txapela del torneo (${gameView.seats.player.name} y ${gameView.seats.partner.name}).`
                    : 'La próxima partida será vuestra. Toca pedir otra ronda en la barra.'}
                </p>

                <div className="space-y-2.5">
                  {isHostInGame ? (
                    <>
                      <button
                        type="button"
                        onClick={mp.sendRematch}
                        className="w-full min-h-[50px] rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 text-stone-950 font-black text-base uppercase tracking-wider shadow-xl border-3 border-stone-900 cursor-pointer active:scale-95 transition-transform"
                      >
                        Jugar la Revancha 🎴
                      </button>
                      <button
                        type="button"
                        onClick={mp.returnToLobby}
                        className="w-full min-h-[42px] rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-200 font-bold text-xs uppercase tracking-wider cursor-pointer"
                      >
                        Volver a Sala de Espera (cambiar parejas)
                      </button>
                    </>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-100 border border-amber-400 text-stone-900 text-xs font-bold">
                      Esperando a que el anfitrión inicie la revancha o vuelva a la sala...
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      ttsEngine.stop();
                      mp.leaveRoom();
                      setShowLobbyBrowser(false);
                    }}
                    className="w-full min-h-[40px] rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-900 font-bold text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Salir al Menú Principal
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : mp.lobbyView ? (
        /* Vista 2: Mesa de espera / Lobby de sala */
        <WaitingRoomView
          lobby={mp.lobbyView}
          profile={mp.profile}
          error={mp.error}
          onClearError={mp.clearError}
          onClaimSeat={mp.claimSeat}
          onConfigureSeat={mp.configureSeat}
          onToggleReady={() => mp.toggleReady()}
          onSendChat={mp.sendChat}
          onStartGame={mp.startGame}
          onLeaveRoom={() => {
            mp.leaveRoom();
            setShowLobbyBrowser(true);
            mp.refreshRooms();
          }}
        />
      ) : showLobbyBrowser ? (
        /* Vista 3: Sala de espera general (nombre, avatar, crear o unirse a mesas) */
        <LobbyScreen
          profile={mp.profile}
          connectionStatus={mp.connectionStatus}
          rooms={mp.rooms}
          error={mp.error}
          onClearError={mp.clearError}
          onUpdateProfile={mp.updateProfile}
          onCreateRoom={(opts) =>
            mp.createRoom({
              ...opts,
              botIds: [oppRightId, partnerId, oppLeftId],
            })
          }
          onJoinRoom={mp.joinRoom}
          onRefreshRooms={mp.refreshRooms}
          onBackToTitle={() => setShowLobbyBrowser(false)}
        />
      ) : (
        /* Vista 4: Portada Clásica */
        <div className="relative w-full h-full flex flex-col">
          {mp.error && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-rose-950/95 border border-rose-500 text-rose-100 text-xs font-bold shadow-2xl flex items-center gap-3">
              <span>{mp.error}</span>
              <button
                type="button"
                onClick={mp.clearError}
                className="text-rose-300 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}
          <TitleScreen
            onOpenLobby={() => {
              mp.refreshRooms();
              setShowLobbyBrowser(true);
            }}
            onStartGame={handleQuickStartSolo}
            onOpenRules={() => setShowRulesModal(true)}
            onSelectCharacters={() => setShowCharactersModal(true)}
            onOpenAchievements={() => setShowAchievementsModal(true)}
            unlockedAchievementsCount={unlockedAchievementsCount}
            totalAchievementsCount={ACHIEVEMENTS.length}
            playerName={mp.profile.name}
            playerAvatar={playerAvatarChar}
            partnerCharacter={partnerChar}
            isMusicPlaying={isMusicPlaying}
            onToggleMusic={handleToggleMusic}
            isFullScreen={isFullScreen}
            onToggleFullScreen={handleToggleFullScreen}
          />
        </div>
      )}

      {/* Libreta de Torneo */}
      {showTorneoSheet && gameView && (
        <TorneoSheet
          scoreTeam1={gameView.scoreTeam1}
          scoreTeam2={gameView.scoreTeam2}
          targetPiedras={TARGET_PIEDRAS}
          lanceResults={gameView.lanceResults}
          currentLance={gameView.currentLance}
          isFloatingModal={true}
          onClose={() => setShowTorneoSheet(false)}
        />
      )}

      {/* Modal de Señas */}
      {showSignsModal && gameView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-[360px] bg-stone-900 border-3 border-amber-500 rounded-3xl p-4 shadow-2xl flex flex-col text-stone-100 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2 mb-2.5">
              <div>
                <h3 className="text-base font-bold font-serif-vintage text-amber-300">
                  Pasar Seña Tradicional
                </h3>
                <p className="text-xs text-stone-400">
                  Transmite tu jugada en secreto a {gameView.seats.partner.name}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSignsModal(false)}
                className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {AUTHENTIC_MUS_SIGNS.map((sign) => {
                const isValid = validSignsForPlayer.includes(sign.id);
                return (
                  <button
                    key={sign.id}
                    type="button"
                    onClick={() => {
                      handleSendSign(sign);
                      setShowSignsModal(false);
                    }}
                    className={`w-full min-h-[48px] p-2.5 rounded-2xl text-left border-2 flex items-center gap-3 transition-all cursor-pointer ${
                      isValid
                        ? 'bg-amber-950/90 border-amber-500 hover:bg-amber-900 text-amber-100 ring-2 ring-amber-400 shadow-md'
                        : 'bg-stone-800/80 border-stone-700 hover:bg-stone-700 text-stone-300'
                    }`}
                  >
                    <span
                      className={`shrink-0 inline-block ${
                        playerSobriety.alcohol >= 3
                          ? 'animate-sign-alcohol-heavy'
                          : playerSobriety.alcohol >= 1
                          ? 'animate-sign-alcohol-sway'
                          : ''
                      }`}
                    >
                      <span
                        className={`inline-block ${
                          playerSobriety.caffeine >= 3
                            ? 'animate-sign-caffeine-heavy'
                            : playerSobriety.caffeine >= 1
                            ? 'animate-sign-caffeine-twitch'
                            : ''
                        }`}
                      >
                        <span className={`text-3xl inline-block ${getSignAnimationClass(sign.id)}`}>
                          {sign.icon}
                        </span>
                      </span>
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold truncate leading-tight">
                          {sign.name}
                        </span>
                        {isValid ? (
                          <span className="text-[9px] font-black text-emerald-400 bg-emerald-950/90 border border-emerald-500/50 rounded px-1.5 py-0.2 uppercase">
                            ¡Llevas esto!
                          </span>
                        ) : (
                          <span className="text-[8px] text-stone-500 italic">Farol</span>
                        )}
                      </div>
                      <span className="text-[11px] text-stone-400 block truncate mt-0.5">
                        {sign.meaning}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowSignsModal(false)}
              className="mt-3 w-full min-h-[42px] rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold cursor-pointer"
            >
              Cerrar sin pasar seña
            </button>
          </div>
        </div>
      )}

      {/* Manual y Reglas */}
      {showRulesModal && <RulesModal onClose={() => setShowRulesModal(false)} />}

      {/* Selección de Pareja IA para modo Solo Rápido */}
      {showCharactersModal && (
        <CharactersModal
          currentPartnerId={partnerId}
          oppLeftId={oppLeftId}
          oppRightId={oppRightId}
          onSelectPartner={(id) => {
            setPartnerId(id);
            const allPlayable = [
              'cura',
              'guardia',
              'tuno',
              'taxista',
              'tabernera',
              'flamenca',
              'cientifica',
              'chulapa',
            ].filter((x) => x !== id);
            const partnerGender = CHARACTERS[id]?.gender || 'male';
            const oppGender = partnerGender === 'female' ? 'male' : 'female';
            const opp1 = allPlayable.find((x) => CHARACTERS[x]?.gender === oppGender) || allPlayable[0];
            const remaining = allPlayable.filter((x) => x !== opp1);
            const opp2 =
              remaining.find((x) => CHARACTERS[x]?.gender !== CHARACTERS[opp1]?.gender) || remaining[0];
            setOppLeftId(opp1);
            setOppRightId(opp2);
          }}
          onClose={() => setShowCharactersModal(false)}
        />
      )}

      {/* Carta de Consumiciones */}
      {showDrinksModal && gameView && (
        <DrinksModal
          isOpen={showDrinksModal}
          onClose={() => setShowDrinksModal(false)}
          sobriety={playerSobriety}
          onOrderDrink={handleOrderDrink}
          canOrderThisHand={canOrderDrinkThisHand}
          pendingDrink={gameView.seats.player.pendingDrink}
          orderDisabledReason={
            playerOrderedThisHand
              ? 'Ya has pedido tu consumición de esta mano. La siguiente ronda estará disponible al empezar la próxima mano.'
              : 'El mus ya se ha cortado en esta mano. Espera al inicio de la siguiente mano para pedir otra consumición.'
          }
        />
      )}

      {/* Logros */}
      {showAchievementsModal && (
        <AchievementsModal
          store={achievementStore}
          onReset={() => {
            const fresh = resetAchievementStore();
            achievementStoreRef.current = fresh;
            setAchievementStore(fresh);
            setAchievementQueue([]);
          }}
          onClose={() => setShowAchievementsModal(false)}
        />
      )}

      {/* Notificación flotante de logro */}
      <AchievementToast
        achievement={achievementQueue[0] ?? null}
        onDismiss={() => setAchievementQueue((prev) => prev.slice(1))}
      />
    </div>
  );
}
