/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PCMusTavernCanvas.tsx - Canvas de la taberna y tablero de juego
 *
 * Componente principal de renderizado de la partida en curso. Dibuja:
 *   - Fondo de la taberna y superposiciones (barra, mesa)
 *   - Personajes animados en sus asientos (compañero y rivales)
 *   - Cartas del jugador y manos de los oponentes
 *   - Controles de acción (MUS, descarte, apuestas, señas)
 *   - Indicador de lance actual, puntuación y garbanzos (tanteo)
 *
 * Es un componente presentacional: recibe todo el estado vía props y
 * notifica acciones al padre (App.tsx) mediante callbacks onAction.
 */

import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BetState, Card, Character, DrinkItem, GamePhase, LancePhase, PlayerPosition, PlayerSpeech, PlayerSobrietyState, SpeechSpeaker, TeamScore, TimeOfDay } from '../types/mus';
import { getAlcoholEffectInfo, getBravuraButtonLabel, getCaffeineEffectInfo, getPlayerMentalAssessment } from '../utils/drinks';
import { SpanishCard } from './SpanishCard';
import { AnimatedCharacter } from './AnimatedCharacter';
import { TableAmarracosTray } from './TableAmarracosTray';
import { CHARACTERS } from '../utils/characters';
import { MUS_PLAYER_ORDER } from '../utils/musRules';
import { resolveImageAsset } from '../utils/assetLoader';

export interface SeatDisplayMeta {
  name: string;
  isHuman: boolean;
  connected: boolean;
}

interface PCMusTavernCanvasProps {
  hands: Record<PlayerPosition, Card[]>;
  partnerChar: Character;
  oppLeftChar: Character;
  oppRightChar: Character;
  seatMeta?: Record<PlayerPosition, SeatDisplayMeta>;
  manoPlayer: PlayerPosition;
  currentTurn: PlayerPosition;
  currentLance: LancePhase | null;
  betState: BetState | null;
  scoreTeam1: TeamScore;
  scoreTeam2: TeamScore;
  targetPiedras: number;
  gamePhase: GamePhase;
  selectedDiscards: string[];
  activeSpeeches: Record<PlayerPosition, PlayerSpeech | null>;
  waiterSpeech: PlayerSpeech | null;
  activeAudioSpeaker?: SpeechSpeaker | null;
  isVoiceEnabled?: boolean;
  canCatchSignOpponent: PlayerPosition | null;
  isFirstHandOfGame?: boolean;
  canBetPares?: boolean;
  canBetJuego?: boolean;
  playerHasPares?: boolean;
  playerHasJuego?: boolean;
  timeOfDay?: TimeOfDay;
  sobriety: PlayerSobrietyState;
  npcSobriety?: Record<'partner' | 'oppLeft' | 'oppRight', PlayerSobrietyState>;
  isTurnBusy?: boolean;
  pendingPlayerDrink?: DrinkItem | null;
  canOrderDrinkThisHand?: boolean;
  onOpenDrinksModal: () => void;
  onToggleTimeOfDay?: () => void;
  onCatchOpponentSign: () => void;
  onToggleDiscard: (cardId: string) => void;
  onConfirmDiscards: () => void;
  onAction: (act: 'mus' | 'no_mus' | 'paso' | 'envido' | 'cinco' | 'reenvio' | 'quiero' | 'no_quiero' | 'ordago' | 'declare', customAmount?: number) => void;
  onOpenSignsModal: () => void;
  onOpenTorneoSheet: () => void;
  onWaiterClick: () => void;
  onJukeboxClick: () => void;
  isMusicPlaying: boolean;
}

// Generates radial optical displacement maps (PNG data URL) for SVG feDisplacementMap:
// - 'fisheye': barrel bulge (center magnified, outer field curved inward) for alcohol > 3
// - 'pincushion': tunnel/hyper-focus pull (center taut, outer field stretched) for caffeine > 3
function createLensDisplacementMapUrl(mode: 'fisheye' | 'pincushion'): string {
  if (typeof document === 'undefined') return '';
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    const ny = (y / (size - 1)) * 2 - 1;
    for (let x = 0; x < size; x++) {
      const nx = (x / (size - 1)) * 2 - 1;
      const r = Math.hypot(nx, ny);
      const idx = (y * size + x) * 4;

      if (r < 0.0001) {
        data[idx] = 128;
        data[idx + 1] = 128;
        data[idx + 2] = 128;
        data[idx + 3] = 255;
        continue;
      }

      // Smooth fade at extreme corners so edges never tear cleanly past viewport
      const edgeFade = r > 1.0 ? Math.max(0, 1 - (r - 1.0) / 0.42) : 1;
      const rTarget =
        mode === 'fisheye'
          ? r * (0.68 + 0.36 * r * r)
          : r * (1.28 - 0.32 * r * r);
      const delta = (rTarget - r) * edgeFade;

      const dx = Math.max(-1, Math.min(1, (delta * nx) / r));
      const dy = Math.max(-1, Math.min(1, (delta * ny) / r));

      data[idx] = Math.round(128 + dx * 127);
      data[idx + 1] = Math.round(128 + dy * 127);
      data[idx + 2] = 128;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

export const PCMusTavernCanvas: React.FC<PCMusTavernCanvasProps> = ({
  hands,
  partnerChar,
  oppLeftChar,
  oppRightChar,
  seatMeta,
  manoPlayer,
  currentTurn,
  currentLance,
  betState,
  scoreTeam1,
  scoreTeam2,
  targetPiedras,
  gamePhase,
  selectedDiscards,
  activeSpeeches,
  waiterSpeech,
  activeAudioSpeaker = null,
  isVoiceEnabled = true,
  canCatchSignOpponent,
  isFirstHandOfGame = false,
  canBetPares = true,
  canBetJuego = true,
  playerHasPares = false,
  playerHasJuego = false,
  timeOfDay = 'atardecer',
  sobriety,
  npcSobriety,
  isTurnBusy = false,
  pendingPlayerDrink = null,
  canOrderDrinkThisHand = true,
  onOpenDrinksModal,
  onToggleTimeOfDay,
  onCatchOpponentSign,
  onToggleDiscard,
  onConfirmDiscards,
  onAction,
  onOpenSignsModal,
  onOpenTorneoSheet,
  onWaiterClick,
  onJukeboxClick,
  isMusicPlaying
}) => {
  const isPlayerTurn = currentTurn === 'player';
  const isDrinksOrderPhase = gamePhase === 'DRINKS_ORDER';
  const isDiscardPhase = gamePhase === 'DISCARD';
  const isMusCheckPhase = gamePhase === 'MUS_CHECK';
  const isDeclarationPhase = gamePhase === 'LANCE_DECLARATION';
  const isBettingPhase = gamePhase === 'LANCE_BETTING';
  const showActionConsole =
    !isTurnBusy &&
    isPlayerTurn &&
    (isDiscardPhase || isMusCheckPhase || isDeclarationPhase || isBettingPhase);
  const isFacingOrdago = Boolean(betState?.isOrdago);
  const hasIncomingBet = Boolean(betState && (betState.currentBet > 0 || betState.isOrdago));

  // Rule constraints for betting
  const isParesForbidden = currentLance === 'PARES' && !canBetPares;
  const isJuegoForbidden = currentLance === 'JUEGO' && !canBetJuego;
  const cannotRaiseOrEnvido = isParesForbidden || isJuegoForbidden;

  const maxBetAmount = Math.max(5, targetPiedras);
  const [enviteAmount, setEnviteAmount] = useState<number>(5);
  const [reenvioAmount, setReenvioAmount] = useState<number>(2);
  const maxTeamPiedras = Math.max(scoreTeam1.piedras, scoreTeam2.piedras);
  const activeBetTotal = betState?.currentBet ?? 0;
  const envido2BecomesOrdago = activeBetTotal + 2 + maxTeamPiedras >= targetPiedras;
  const enviteBecomesOrdago = activeBetTotal + enviteAmount + maxTeamPiedras >= targetPiedras;
  const reenvioBecomesOrdago = activeBetTotal + reenvioAmount + maxTeamPiedras >= targetPiedras;

  useEffect(() => {
    setEnviteAmount(5);
  }, [currentLance, gamePhase]);

  useEffect(() => {
    setReenvioAmount(2);
  }, [currentLance, betState?.currentBet, gamePhase]);

  // Drinks & Sobriety calculations
  const alcoholInfo = getAlcoholEffectInfo(sobriety.alcohol);
  const caffeineInfo = getCaffeineEffectInfo(sobriety.caffeine);
  const mentalAssessment = getPlayerMentalAssessment(hands.player || [], sobriety.alcohol, sobriety.caffeine);

  const drunkSwayClass = sobriety.alcohol >= 4
    ? 'animate-drunk-sway-heavy'
    : sobriety.alcohol >= 2
    ? 'animate-drunk-sway'
    : '';

  const caffeineJitterClass = sobriety.caffeine >= 4
    ? 'animate-caffeine-heavy'
    : sobriety.caffeine >= 3
    ? 'animate-caffeine-jitter'
    : '';

  // Optical Bar-Scene Distortion & Blur for Sobriety Levels > 3 (Levels 4 & 5)
  const rawFilterId = useId();
  const barFilterId = `sobriety-bar-lens-${rawFilterId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const lensMaps = useMemo(
    () => ({
      fisheye: createLensDisplacementMapUrl('fisheye'),
      pincushion: createLensDisplacementMapUrl('pincushion'),
    }),
    []
  );

  const hasAlcoholDistortion = sobriety.alcohol > 3;
  const hasCaffeineDistortion = sobriety.caffeine > 3;
  const hasSceneDistortion = hasAlcoholDistortion || hasCaffeineDistortion;

  const activeDisplacementMap = hasAlcoholDistortion ? lensMaps.fisheye : lensMaps.pincushion;
  const displacementScale =
    (hasAlcoholDistortion ? (sobriety.alcohol >= 5 ? 64 : 42) : 0) +
    (hasCaffeineDistortion ? (sobriety.caffeine >= 5 ? 36 : 22) : 0);
  const alcoholBlurPx = hasAlcoholDistortion ? (sobriety.alcohol >= 5 ? 2.5 : 1.45) : 0;
  const caffeineContrast = hasCaffeineDistortion ? (sobriety.caffeine >= 5 ? 1.28 : 1.18) : 1;
  const caffeineSaturate = hasCaffeineDistortion ? (sobriety.caffeine >= 5 ? 1.32 : 1.18) : 1;

  const barSceneFilterParts: string[] = [];
  if (hasSceneDistortion && activeDisplacementMap) {
    barSceneFilterParts.push(`url(#${barFilterId})`);
  } else if (alcoholBlurPx > 0) {
    barSceneFilterParts.push(`blur(${alcoholBlurPx}px)`);
  }
  if (hasCaffeineDistortion) {
    barSceneFilterParts.push(`contrast(${caffeineContrast}) saturate(${caffeineSaturate})`);
  }
  const barSceneFilterStyle = barSceneFilterParts.length > 0 ? barSceneFilterParts.join(' ') : undefined;

  const drunkSceneAnimClass = hasAlcoholDistortion
    ? sobriety.alcohol >= 5
      ? 'animate-drunk-scene-swim-heavy'
      : 'animate-drunk-scene-swim'
    : '';
  const caffeineSceneAnimClass = hasCaffeineDistortion
    ? sobriety.caffeine >= 5
      ? 'animate-caffeine-scene-jitter-heavy'
      : 'animate-caffeine-scene-jitter'
    : '';

  // Layer 0 & Layer 2 pixel-aligned assets
  const backdropImage = resolveImageAsset('/src/assets/images/pcmus_tavern_backdrop_single_chairs.jpg');
  const barOverlayImage = resolveImageAsset('/src/assets/images/tavern_bar_overlay.png');
  const tableOverlayImage = resolveImageAsset('/src/assets/images/tavern_table_overlay.png');

  // Garbanzo calculations
  const team1Amarracos = Math.floor(scoreTeam1.piedras / 5);
  const team1Piedras = scoreTeam1.piedras % 5;
  const team2Amarracos = Math.floor(scoreTeam2.piedras / 5);
  const team2Piedras = scoreTeam2.piedras % 5;

  // El postre es el jugador inmediatamente a la izquierda de la mano (anterior en sentido antihorario)
  const manoIndex = MUS_PLAYER_ORDER.indexOf(manoPlayer);
  const postrePlayer: PlayerPosition =
    MUS_PLAYER_ORDER[(manoIndex + 3) % MUS_PLAYER_ORDER.length];

  // La baraja se coloca sobre la mesa, a la derecha del postre
  const deckPositionClass: Record<PlayerPosition, string> = {
    oppLeft: 'left-[30%] top-[73%]',   // Derecha de oppLeft (mira al Este -> lado Sur-Oeste de la mesa)
    player: 'left-[70%] top-[74%]',    // Derecha de player (mira al Norte -> lado Sur-Este de la mesa)
    oppRight: 'left-[61%] top-[63%]',  // Derecha de oppRight (mira al Oeste -> lado Nor-Este de la mesa)
    partner: 'left-[39%] top-[63%]',   // Derecha de partner (mira al Sur -> lado Nor-Oeste de la mesa)
  };

  // Measure available gameplay area cleanly to compute exact 4:3 stage dimensions
  // without relying on CSS size containment (which can collapse inside indefinite flex parents).
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const availW = rect.width;
      const availH = rect.height;
      if (availW <= 0 || availH <= 0) return;

      const maxW = Math.min(availW, 1280);
      const maxH = Math.min(availH, 960);
      const width = Math.floor(Math.min(maxW, (maxH * 4) / 3));
      const height = Math.floor((width * 3) / 4);
      setStageSize((prev) =>
        prev && prev.width === width && prev.height === height ? prev : { width, height }
      );
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    window.addEventListener('resize', updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full flex items-center justify-center overflow-hidden select-none bg-stone-950"
    >
      {/* 4:3 RETRO VINTAGE PC-MUS SCREEN CONTAINER (exact 4:3 fit in any viewport) */}
      <div
        className="relative overflow-hidden shadow-2xl border-4 border-stone-900 bg-[#efe577]"
        style={
          stageSize
            ? { width: `${stageSize.width}px`, height: `${stageSize.height}px` }
            : { width: 'min(100%, 1024px)', aspectRatio: '4 / 3' }
        }
      >
        
        {/* Hidden SVG optical lens filter definition for alcohol > 3 (fish-eye + blur) & caffeine > 3 (pincushion tunnel) */}
        {hasSceneDistortion && activeDisplacementMap && (
          <svg className="absolute w-0 h-0 overflow-hidden pointer-events-none" aria-hidden="true">
            <defs>
              <filter
                id={barFilterId}
                x="-12%"
                y="-12%"
                width="124%"
                height="124%"
                colorInterpolationFilters="sRGB"
              >
                <feImage
                  href={activeDisplacementMap}
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  preserveAspectRatio="none"
                  result="lensMap"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="lensMap"
                  xChannelSelector="R"
                  yChannelSelector="G"
                  scale={displacementScale}
                  result="warpedScene"
                />
                {alcoholBlurPx > 0 ? (
                  <feGaussianBlur in="warpedScene" stdDeviation={alcoholBlurPx} />
                ) : (
                  <feMerge>
                    <feMergeNode in="warpedScene" />
                  </feMerge>
                )}
              </filter>
            </defs>
          </svg>
        )}

        {/* High Caffeine Heartbeat Pulse Vignette */}
        {sobriety.caffeine >= 4 && (
          <div className="absolute inset-0 pointer-events-none z-45 animate-nervous-pulse" />
        )}

        {/* Alcohol > 3 Peripheral Bottle-Lens Blur & Warm Haze Overlay */}
        {hasAlcoholDistortion && (
          <div
            data-testid="alcohol-lens-overlay"
            className="absolute inset-0 pointer-events-none z-35 transition-opacity duration-500"
          >
            <div
              className="absolute inset-0"
              style={{
                backdropFilter: `blur(${sobriety.alcohol >= 5 ? 3.2 : 1.8}px)`,
                WebkitBackdropFilter: `blur(${sobriety.alcohol >= 5 ? 3.2 : 1.8}px)`,
                maskImage: 'radial-gradient(circle at 50% 48%, transparent 24%, rgba(0,0,0,0.85) 74%, black 100%)',
                WebkitMaskImage: 'radial-gradient(circle at 50% 48%, transparent 24%, rgba(0,0,0,0.85) 74%, black 100%)',
              }}
            />
            <div
              className={`absolute inset-0 ${
                sobriety.alcohol >= 5
                  ? 'bg-[radial-gradient(circle_at_50%_46%,transparent_30%,rgba(120,53,15,0.28)_74%,rgba(28,25,23,0.62)_100%)]'
                  : 'bg-[radial-gradient(circle_at_50%_46%,transparent_38%,rgba(120,53,15,0.18)_78%,rgba(28,25,23,0.42)_100%)]'
              }`}
            />
          </div>
        )}

        {/* Caffeine > 3 Peripheral Tunnel-Vision Blur & Electric Tension Overlay */}
        {hasCaffeineDistortion && (
          <div
            data-testid="caffeine-lens-overlay"
            className="absolute inset-0 pointer-events-none z-35 animate-caffeine-tunnel"
          >
            <div
              className="absolute inset-0"
              style={{
                backdropFilter: `blur(${sobriety.caffeine >= 5 ? 4 : 2.4}px)`,
                WebkitBackdropFilter: `blur(${sobriety.caffeine >= 5 ? 4 : 2.4}px)`,
                maskImage: 'radial-gradient(circle at 50% 46%, transparent 32%, rgba(0,0,0,0.85) 72%, black 100%)',
                WebkitMaskImage: 'radial-gradient(circle at 50% 46%, transparent 32%, rgba(0,0,0,0.85) 72%, black 100%)',
              }}
            />
            <div
              className={`absolute inset-0 ${
                sobriety.caffeine >= 5
                  ? 'bg-[radial-gradient(circle_at_50%_46%,transparent_38%,rgba(6,182,212,0.16)_72%,rgba(153,27,27,0.42)_100%)]'
                  : 'bg-[radial-gradient(circle_at_50%_46%,transparent_44%,rgba(6,182,212,0.12)_76%,rgba(153,27,27,0.26)_100%)]'
              }`}
            />
          </div>
        )}

        {/* =========================================================================
            ESCENA DEL BAR (SUJETA A DISTORSIÓN ÓPTICA POR ALCOHOL / CAFEÍNA > 3)
           ========================================================================= */}
        <div
          data-testid="tavern-bar-scene"
          className={`absolute inset-0 z-10 transition-[filter] duration-500 ${drunkSceneAnimClass}`}
          style={{ filter: barSceneFilterStyle }}
        >
          <div className={`absolute inset-0 ${caffeineSceneAnimClass}`}>

        {/* =========================================================================
            LAYER 0: CLEAN TAVERN & EMPTY TABLE BACKGROUND
           ========================================================================= */}
        <img
          src={backdropImage}
          alt="Taberna del Mus"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none z-0"
        />

        {/* Ambient Warm Vignette & Scanline Texture */}
        <div className="absolute inset-0 pointer-events-none z-1 bg-gradient-to-b from-black/10 via-transparent to-black/30" />
        <div className="absolute inset-0 pointer-events-none z-1 bg-[radial-gradient(ellipse_at_center,_transparent_65%,_rgba(0,0,0,0.35)_100%)]" />

        {/* =========================================================================
            DYNAMIC TIME-OF-DAY ATMOSPHERE & LIGHTING OVERLAYS (LO-FI TAVERN)
           ========================================================================= */}
        {timeOfDay === 'atardecer' && (
          <div className="absolute inset-0 pointer-events-none z-2 transition-opacity duration-700">
            {/* Sunset golden amber rays & warm bounce */}
            <div className="absolute inset-0 bg-gradient-to-tr from-amber-600/18 via-orange-500/10 to-amber-900/25 mix-blend-color-burn" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_20%,_rgba(251,146,60,0.22)_0%,_rgba(180,83,9,0.12)_50%,_transparent_100%)]" />
          </div>
        )}

        {timeOfDay === 'noche' && (
          <div className="absolute inset-0 pointer-events-none z-2 transition-opacity duration-700">
            {/* Tavern night: Incandescent overhead lamp pool & darker ambient */}
            <div className="absolute inset-0 bg-stone-950/30" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_38%,_rgba(253,224,71,0.22)_0%,_rgba(245,158,11,0.1)_45%,_rgba(10,10,15,0.65)_85%)] animate-lamp-flicker" />
          </div>
        )}

        {timeOfDay === 'madrugada' && (
          <div className="absolute inset-0 pointer-events-none z-2 transition-opacity duration-700">
            {/* Madrugada: Clandestine late bar, deep indigo shadows + jukebox glow */}
            <div className="absolute inset-0 bg-indigo-950/40" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,_rgba(245,158,11,0.18)_0%,_rgba(30,27,75,0.7)_80%)]" />
            {/* Neon highlights from jukebox */}
            <div className="absolute bottom-20 right-16 w-64 h-64 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="absolute bottom-28 right-24 w-40 h-40 rounded-full bg-fuchsia-500/10 blur-2xl" />
          </div>
        )}

        {timeOfDay === 'tarde' && (
          <div className="absolute inset-0 pointer-events-none z-2 transition-opacity duration-700">
            {/* Crisp warm tavern daylight */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-200/15 via-yellow-100/10 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_35%_25%,_rgba(254,240,138,0.2)_0%,_transparent_70%)]" />
          </div>
        )}

        {/* Lo-fi Floating Dust Motes caught in the tavern lamp rays */}
        <div className="absolute inset-0 pointer-events-none z-2 overflow-hidden">
          <div className="absolute top-[28%] left-[46%] w-1.5 h-1.5 rounded-full bg-amber-200/50 blur-[0.5px] animate-dust-1" />
          <div className="absolute top-[34%] left-[54%] w-1 h-1 rounded-full bg-amber-100/40 blur-[0.5px] animate-dust-2" />
          <div className="absolute top-[42%] left-[39%] w-1.5 h-1.5 rounded-full bg-yellow-200/35 blur-[0.5px] animate-dust-3" />
        </div>

        {/* =========================================================================
            CAPA 1: CAMARERO MANOLO DETRÁS DE LA BARRA + BARRA FRENTE
           ========================================================================= */}
        <AnimatedCharacter
          position="camarero"
          pose="top"
          character={CHARACTERS.camarero}
          isTurn={false}
          isMano={false}
          activeSpeech={waiterSpeech ?? null}
          isAudioSpeaking={activeAudioSpeaker === 'camarero'}
          isVoiceEnabled={isVoiceEnabled}
          sobriety={{ alcohol: 0, caffeine: 0, totalDrinks: 0 }}
          onClick={onWaiterClick}
          className="absolute left-[6.5%] top-[5.5%] w-[17.5%] group"
        />

        {/* Bar Counter & Steaming Pie Overlay (cuts across Manolo's lower torso) */}
        <img
          src={barOverlayImage}
          alt="Barra de la taberna"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none z-18"
        />

        {/* Torneo Bracket Sheet (Center Wall) */}
        <button
          onClick={onOpenTorneoSheet}
          className="absolute top-[10%] left-[24%] w-[12%] h-[16%] z-28 cursor-pointer rounded group transition-all"
          title="Póster del Torneo: Toca para abrir la libreta de tanteo"
        >
          <div className="w-full h-full rounded border-2 border-transparent group-hover:border-red-500/80 group-hover:bg-amber-300/20 transition-all flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-black bg-red-700 text-white px-1.5 py-0.5 rounded shadow border border-white">
              Libreta 📋
            </span>
          </div>
        </button>

        {/* Jukebox / Gramola (Right Wall) */}
        <button
          onClick={onJukeboxClick}
          className="absolute top-[21%] left-[62%] w-[13%] h-[25%] z-28 cursor-pointer rounded-2xl group transition-all"
          title="Gramola / Jukebox: Toca para encender o apagar el jazz"
        >
          <div className="w-full h-full rounded-2xl border-2 border-transparent group-hover:border-cyan-400/80 group-hover:bg-cyan-500/15 transition-all flex flex-col items-center justify-start pt-1">
            {isMusicPlaying && (
              <span className="text-xs font-black text-amber-300 animate-bounce leading-none drop-shadow">
                ♪ ♫
              </span>
            )}
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[8px] font-black bg-sky-900 text-cyan-200 px-1 py-0.5 rounded shadow border border-cyan-400 mt-auto mb-2">
              {isMusicPlaying ? 'Jazz ON 🎷' : 'Jazz OFF 🔇'}
            </span>
          </div>
        </button>

        {/* =========================================================================
            CAPA 1: JUGADORES SENTADOS EN SUS SILLAS (Norte, Oeste, Este)
           ========================================================================= */}
        {/* 1. PARTNER (Norte / Silla de enfrente)
           Posicionada sobre la silla central del fondo. Se reduce el ancho y se
           sube un poco para no cubrir la mesa superpuesta y alinearse con el
           respaldo de la silla del fondo.
        */}
        <AnimatedCharacter
          position="partner"
          pose="top"
          character={partnerChar}
          isTurn={currentTurn === 'partner'}
          isMano={manoPlayer === 'partner'}
          activeSpeech={activeSpeeches.partner ?? null}
          isAudioSpeaking={activeAudioSpeaker === 'partner'}
          isVoiceEnabled={isVoiceEnabled}
          sobriety={npcSobriety?.partner ?? { alcohol: 0, caffeine: 0, totalDrinks: 0 }}
          roleLabel={partnerChar.gender === 'female' ? 'Compañera' : 'Compañero'}
          playerDisplayName={seatMeta?.partner.name}
          isHuman={seatMeta?.partner.isHuman}
          isConnected={seatMeta?.partner.connected ?? true}
          className="absolute left-[32.5%] top-[24%] w-[35%]"
        />

        {/* 2. LEFT OPPONENT (Oeste / Silla izquierda, mirando hacia la mesa)
           Se mueve más a la izquierda y se reduce el ancho para alinearse con
           la silla del fondo y no superponerse con la mesa central.
        */}
        <AnimatedCharacter
          position="oppLeft"
          pose="left"
          character={oppLeftChar}
          isTurn={currentTurn === 'oppLeft'}
          isMano={manoPlayer === 'oppLeft'}
          activeSpeech={activeSpeeches.oppLeft ?? null}
          isAudioSpeaking={activeAudioSpeaker === 'oppLeft'}
          isVoiceEnabled={isVoiceEnabled}
          sobriety={npcSobriety?.oppLeft ?? { alcohol: 0, caffeine: 0, totalDrinks: 0 }}
          roleLabel="Rival"
          playerDisplayName={seatMeta?.oppLeft.name}
          isHuman={seatMeta?.oppLeft.isHuman}
          isConnected={seatMeta?.oppLeft.connected ?? true}
          onCatchSign={onCatchOpponentSign}
          canCatchSign={canCatchSignOpponent === 'oppLeft'}
          className="absolute left-[-1%] top-[35%] w-[40%]"
        />

        {/* 3. RIGHT OPPONENT (Este / Silla derecha, mirando hacia la mesa)
           Se mueve más a la derecha y se reduce el ancho para alinearse con
           la silla del fondo y no superponerse con la mesa central.
        */}
        <AnimatedCharacter
          position="oppRight"
          pose="right"
          character={oppRightChar}
          isTurn={currentTurn === 'oppRight'}
          isMano={manoPlayer === 'oppRight'}
          activeSpeech={activeSpeeches.oppRight ?? null}
          isAudioSpeaking={activeAudioSpeaker === 'oppRight'}
          isVoiceEnabled={isVoiceEnabled}
          sobriety={npcSobriety?.oppRight ?? { alcohol: 0, caffeine: 0, totalDrinks: 0 }}
          roleLabel="Rival"
          playerDisplayName={seatMeta?.oppRight.name}
          isHuman={seatMeta?.oppRight.isHuman}
          isConnected={seatMeta?.oppRight.connected ?? true}
          onCatchSign={onCatchOpponentSign}
          canCatchSign={canCatchSignOpponent === 'oppRight'}
          className="absolute right-[-1%] top-[35%] w-[40%]"
        />

        {/* =========================================================================
            CAPA 2: MESA DE MADERA SUPERPUESTA
            Debe coincidir EXACTAMENTE con la mesa dibujada en el fondo (backdropImage).
            Ambas imágenes son 1200x896 px. Usamos object-cover con inset-0 w-full h-full
            para que la mesa superpuesta ocupe exactamente el mismo área que la mesa
            pintada en el fondo, sin estiramiento ni desplazamiento.
           ========================================================================= */}
        <img
          src={tableOverlayImage}
          alt="Mesa de mus"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none z-25"
        />

        {/* =========================================================================
            CAPA 3: OBJETOS SOBRE LA MESA (BARAJA, AMARRACOS POR JUGADOR, CENICERO)
           ========================================================================= */}
        {/* Mazo de cartas en la mesa, siempre a la derecha del postre */}
        <div
          data-testid="table-deck"
          data-postre={postrePlayer}
          className={`absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none flex flex-col items-center transition-all duration-300 ${deckPositionClass[postrePlayer]}`}
        >
          <div className="relative group">
            <div className="w-9 h-12 rounded-[3px] bg-red-900 border-2 border-stone-900 shadow-xl flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0.5 border border-dashed border-amber-400/50 flex flex-col items-center justify-center">
                <div className="w-2.5 h-2.5 rotate-45 bg-amber-400/80 mb-0.5" />
                <span className="text-[6px] font-black text-amber-200 tracking-tighter leading-none">MUS</span>
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 w-9 h-12 rounded-[3px] bg-red-950 border border-red-900 -z-10" />
          </div>
        </div>

        {/* Tanteo con amarracos sobre la mesa: en cada pareja un jugador lleva las piedras de 5 y otro las de 1 */}
        {/* Pareja 1 (Nosotros): Compañero lleva los amarracos de 5; Jugador lleva las piedras de 1 */}
        <TableAmarracosTray
          testId="amarracos-partner"
          denomination={5}
          count={team1Amarracos}
          teamTotalPiedras={scoreTeam1.piedras}
          teamJuegosWon={scoreTeam1.chicosWon}
          targetPiedras={targetPiedras}
          teamLabel="Nosotros"
          holderName={seatMeta?.partner.name || partnerChar.name}
          isPlayerTeam={true}
          onClick={onOpenTorneoSheet}
          className="absolute left-[50%] top-[60.8%] -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-auto"
        />
        <TableAmarracosTray
          testId="amarracos-player"
          denomination={1}
          count={team1Piedras}
          teamTotalPiedras={scoreTeam1.piedras}
          teamJuegosWon={scoreTeam1.chicosWon}
          targetPiedras={targetPiedras}
          teamLabel="Nosotros"
          holderName={seatMeta?.player.name || 'Tú'}
          isPlayerTeam={true}
          onClick={onOpenTorneoSheet}
          className="absolute left-[50%] top-[69.8%] -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-auto"
        />

        {/* Pareja 2 (Ellos): Rival derecha lleva los amarracos de 5; Rival izquierda lleva las piedras de 1 */}
        <TableAmarracosTray
          testId="amarracos-oppLeft"
          denomination={1}
          count={team2Piedras}
          teamTotalPiedras={scoreTeam2.piedras}
          teamJuegosWon={scoreTeam2.chicosWon}
          targetPiedras={targetPiedras}
          teamLabel="Ellos"
          holderName={seatMeta?.oppLeft.name || oppLeftChar.name}
          isPlayerTeam={false}
          onClick={onOpenTorneoSheet}
          className="absolute left-[34.5%] top-[65.5%] -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-auto"
        />
        <TableAmarracosTray
          testId="amarracos-oppRight"
          denomination={5}
          count={team2Amarracos}
          teamTotalPiedras={scoreTeam2.piedras}
          teamJuegosWon={scoreTeam2.chicosWon}
          targetPiedras={targetPiedras}
          teamLabel="Ellos"
          holderName={seatMeta?.oppRight.name || oppRightChar.name}
          isPlayerTeam={false}
          onClick={onOpenTorneoSheet}
          className="absolute left-[65.5%] top-[65.5%] -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-auto"
        />

        <div className="absolute top-[65.2%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center">
          {/* Vintage Lo-fi Ashtray with Smoke */}
          <div className="flex items-center gap-2.5">

              {/* Authentic 90s Spanish Ceramic/Glass Ashtray with Floating Smoke Wisps */}
              <div 
                onClick={onToggleTimeOfDay}
                title={`Cenicero castizo de taberna con humo flotante (Ambiente: ${timeOfDay}). ¡Haz clic para cambiar iluminación!`}
                className="relative group cursor-pointer pointer-events-auto"
              >
                {/* Ashtray Ceramic Dish */}
                <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-amber-800 via-amber-950 to-stone-900 border-2 border-stone-950 shadow-md flex items-center justify-center transform scale-y-90 group-hover:scale-100 transition-transform">
                  {/* Inner basin with ash specks */}
                  <div className="w-5 h-5 rounded-full bg-stone-800 border border-stone-900 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-stone-700/60" />
                    <div className="absolute top-1 left-1.5 w-1 h-1 rounded-full bg-stone-500/80" />
                    <div className="absolute bottom-1 right-2 w-1.5 h-1 rounded-full bg-stone-600/70" />
                    
                    {/* Resting cigarette with classic orange filter */}
                    <div className="absolute -top-0.5 left-0.5 w-4 h-1.5 bg-stone-100 border border-stone-900 rounded-xs rotate-[25deg] shadow-xs flex items-center justify-end">
                      <div className="w-1.5 h-full bg-amber-600 border-l border-stone-900" />
                    </div>

                    {/* Glowing Cigarette Ember with animated pulse */}
                    <div className="absolute top-2 right-1 w-1.5 h-1.5 rounded-full animate-ember-glow z-10" />
                  </div>

                  {/* 4 Ashtray Rim Grooves */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1 bg-stone-950/80 rounded-b" />
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1 bg-stone-950/80 rounded-t" />
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1.5 bg-stone-950/80 rounded-r" />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1.5 bg-stone-950/80 rounded-l" />
                </div>

                {/* CONTINUOUS FLOATING LO-FI SMOKE WISPS RISING FROM ASHTRAY */}
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 pointer-events-none w-14 h-32 overflow-visible z-40">
                  {/* Smoke Wisp 1 */}
                  <svg className="absolute bottom-1 left-2.5 w-6 h-20 animate-smoke-1 text-stone-200/55" viewBox="0 0 24 64" fill="none">
                    <path d="M 12 60 Q 6 45 15 30 Q 22 16 10 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" filter="blur(1px)" />
                  </svg>
                  {/* Smoke Wisp 2 */}
                  <svg className="absolute bottom-2 left-4 w-6 h-24 animate-smoke-2 text-stone-300/45" viewBox="0 0 24 64" fill="none">
                    <path d="M 10 60 Q 18 42 8 26 Q 3 14 14 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" filter="blur(1px)" />
                  </svg>
                  {/* Smoke Wisp 3 */}
                  <svg className="absolute bottom-3 left-1.5 w-7 h-28 animate-smoke-3 text-stone-100/40" viewBox="0 0 24 64" fill="none">
                    <path d="M 14 60 Q 6 38 16 22 Q 22 10 11 0" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" filter="blur(1.2px)" />
                  </svg>
                </div>
              </div>
            </div>

        </div>

          </div>
        </div>

        {/* =========================================================================
            BANNERS SUPERIORES DE FASE DEL MUS Y 1ª MANO (FUERA DEL FILTRO ÓPTICO)
           ========================================================================= */}
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1.5 w-[92%] max-w-lg pointer-events-none">
          {/* First Hand Mus Corrido Notification Banner */}
          {isFirstHandOfGame && (
            <div className="animate-in fade-in slide-in-from-top duration-300">
              <div className="bg-amber-400 text-stone-950 px-3 py-0.5 rounded-full border-2 border-stone-900 shadow-xl flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-center">
                <span>🎴</span>
                <span>1ª Mano: Mus corrido y sin señas · Quien corte será la Mano</span>
              </div>
            </div>
          )}

          {/* Lance and Bet Banner */}
          <div className="bg-[#78350f]/95 border-3 border-stone-950 rounded-xl px-3 py-1 shadow-2xl flex items-center justify-between gap-3 w-full max-w-md text-stone-100">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-extrabold text-amber-300 font-mono">
                ↺ Antihorario
              </span>
              <span className="text-[11px] font-black uppercase text-amber-100 font-serif-vintage tracking-wider">
                {isDrinksOrderPhase
                  ? 'Consumiciones'
                  : isDiscardPhase
                  ? 'Descarte'
                  : currentLance
                  ? currentLance === 'PUNTO'
                    ? 'Punto'
                    : currentLance
                  : 'Fase Mus'}
              </span>
            </div>

            {/* Bet or Status */}
            <div>
              {isDrinksOrderPhase ? (
                <span className="text-[10px] font-black text-amber-200 bg-stone-900/90 px-2 py-0.5 rounded-lg border border-amber-500/60">
                  Pidiendo ronda antes del mus...
                </span>
              ) : isDiscardPhase ? (
                <span className="text-[10px] font-black text-amber-200 bg-stone-900/90 px-2 py-0.5 rounded-lg border border-amber-500/60">
                  {isPlayerTurn ? 'Tu descarte' : 'Descartando en turno...'}
                </span>
              ) : isDeclarationPhase ? (
                <span className="text-[10px] font-black text-amber-200 bg-stone-900/90 px-2 py-0.5 rounded-lg border border-amber-500/60">
                  {currentLance === 'PARES' ? '¿Pares? (En orden)' : '¿Juego? (En orden)'}
                </span>
              ) : betState ? (
                betState.isOrdago ? (
                  <span className="text-[11px] font-black text-rose-200 bg-rose-900 border-2 border-red-500 px-2 py-0.5 rounded-lg animate-ordago">
                    ¡ÓRDAGO!
                  </span>
                ) : betState.currentBet > 0 ? (
                  <span className="text-[10px] font-black text-stone-950 bg-amber-400 px-2 py-0.5 rounded-lg border border-stone-900">
                    {betState.currentBet} piedras
                  </span>
                ) : (
                  <span className="text-[10px] text-stone-300 font-bold">En paso</span>
                )
              ) : (
                <span className="text-[10px] text-amber-200 font-bold">¿Hay mus?</span>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================================
            CAPA 3 (ENCIMA DE MESA): MANOS Y CARTAS DEL JUGADOR + CONSOLA
           ========================================================================= */}
        <div className="absolute inset-x-0 bottom-0 z-45 w-full flex items-end justify-between gap-2 px-2.5 sm:px-5 pb-2 pointer-events-none">
          {/* Player Speech Bubble */}
          {activeSpeeches.player && (
            <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in zoom-in-95 min-w-[130px] max-w-[220px]">
              <div className="comic-bubble comic-bubble-tail-bottom px-3 py-1.5 text-center shadow-2xl border-2 border-black bg-white text-stone-950">
                <p className="text-xs font-black leading-tight">
                  {activeSpeeches.player.text}
                </p>
              </div>
            </div>
          )}

          {/* Mano Badge on Player */}
          {manoPlayer === 'player' && (
            <div className="absolute -top-7 left-3 sm:left-5 bg-gradient-to-r from-amber-300 to-amber-500 text-stone-950 font-black text-[10px] px-2.5 py-0.5 rounded-full border-2 border-stone-900 shadow-xl z-50 animate-pulse">
              ★ {seatMeta?.player.name ? `${seatMeta.player.name.toUpperCase()} · MANO` : 'TÚ ERES LA MANO'}
            </div>
          )}

          {/* TAVERN DRINK COASTER & SOBRIETY HUD (Bottom Left) */}
          <div className="z-40 shrink-0 flex flex-col items-start gap-1 w-[138px] sm:w-[168px] select-none pointer-events-auto">
            {/* Compact Player Mental Assessment tucked cleanly above coaster HUD */}
            <div
              className={`w-full px-2 py-0.5 rounded-lg border shadow text-[8px] font-bold leading-tight flex items-center gap-1 ${
                mentalAssessment.confidence === 'drunk'
                  ? 'bg-rose-950/95 border-rose-500 text-rose-200'
                  : mentalAssessment.confidence === 'tipsy'
                  ? 'bg-amber-950/90 border-amber-500 text-amber-200'
                  : mentalAssessment.confidence === 'panicked'
                  ? 'bg-red-950/95 border-red-400 text-red-200'
                  : mentalAssessment.confidence === 'caffeinated'
                  ? 'bg-cyan-950/90 border-cyan-400 text-cyan-200'
                  : 'bg-stone-900/90 border-stone-700 text-stone-300'
              }`}
              title={mentalAssessment.text}
            >
              <span className="shrink-0">{mentalAssessment.confidence === 'drunk' ? '🥴' : mentalAssessment.confidence === 'tipsy' ? '🍺' : mentalAssessment.confidence === 'caffeinated' ? '⚡' : mentalAssessment.confidence === 'panicked' ? '💓' : '🧠'}</span>
              <span className="truncate">{mentalAssessment.text}</span>
            </div>

            {/* Active Drink Served on Bar Coaster */}
            <div 
              onClick={onOpenDrinksModal}
              title={
                pendingPlayerDrink
                  ? `Pedido pendiente: ${pendingPlayerDrink.name} (hace efecto al cortar el mus)`
                  : canOrderDrinkThisHand
                  ? 'Pedir consumición antes de que se corte el mus'
                  : 'En mitad de la mano no se pide · Espera al comienzo de la siguiente mano'
              }
              className="relative group cursor-pointer flex items-center gap-2 bg-stone-900/90 border-2 border-amber-600/70 hover:border-amber-400 rounded-xl p-1.5 shadow-xl transition-all hover:scale-102 active:scale-95 w-full"
            >
              {/* Coaster & Drink Graphic */}
              <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-amber-950/80 border-2 border-amber-800 flex items-center justify-center shadow-inner shrink-0 group-hover:rotate-6 transition-transform">
                {pendingPlayerDrink ? (
                  <span className="text-lg sm:text-xl animate-drink-serve">{pendingPlayerDrink.icon}</span>
                ) : sobriety.activeGlass ? (
                  <span className="text-lg sm:text-xl animate-drink-serve">
                    {sobriety.activeGlass === 'cana' ? '🍺' :
                     sobriety.activeGlass === 'vino' ? '🍷' :
                     sobriety.activeGlass === 'carajillo' ? '🥃' :
                     sobriety.activeGlass === 'cafe' ? '☕' :
                     sobriety.activeGlass === 'agua' ? '🥤' : '🫒'}
                  </span>
                ) : (
                  <span className="text-base sm:text-lg opacity-60">🍺</span>
                )}
                {/* Steam if coffee or carajillo */}
                {((pendingPlayerDrink?.id || sobriety.activeGlass) === 'cafe' || (pendingPlayerDrink?.id || sobriety.activeGlass) === 'carajillo') && (
                  <span className="absolute -top-2 left-2.5 text-[10px] text-stone-200 animate-smoke-1 pointer-events-none">
                    ~
                  </span>
                )}
              </div>

              {/* Status info */}
              <div className="flex flex-col text-left min-w-0">
                <span className="text-[9px] sm:text-[10px] font-black text-amber-200 leading-tight truncate">
                  {pendingPlayerDrink
                    ? `Pedido: ${pendingPlayerDrink.name}`
                    : sobriety.lastDrinkName || (canOrderDrinkThisHand ? 'Pedir consumición' : 'Barra cerrada (mano)')}
                </span>
                <span className="text-[8px] font-bold text-stone-400 truncate">
                  {pendingPlayerDrink
                    ? 'Efecto al cortar el mus'
                    : sobriety.totalDrinks > 0
                    ? `${sobriety.totalDrinks} ronda${sobriety.totalDrinks > 1 ? 's' : ''}`
                    : 'Barra de Manolo'}
                </span>
              </div>
            </div>

            {/* Compact Sobriety Meters */}
            <div 
              onClick={onOpenDrinksModal}
              title="Estado psicofísico. Haz clic para abrir la carta"
              className="cursor-pointer bg-stone-950/90 border border-stone-700/80 rounded-lg px-2 py-1 flex flex-col gap-1 w-full shadow-md hover:border-amber-500/70 transition-colors"
            >
              {/* Alcohol meter */}
              <div className="flex items-center justify-between gap-1 text-[8px]">
                <span className="text-amber-300 font-bold flex items-center gap-0.5 truncate">
                  🍺 {sobriety.alcohol === 0 ? 'Sobrio' : alcoholInfo.title}
                </span>
                <div className="flex gap-0.5 shrink-0">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <div
                      key={`alchud-${lvl}`}
                      className={`w-1.5 h-2 rounded-xs ${
                        lvl <= sobriety.alcohol ? (lvl >= 4 ? 'bg-rose-500' : 'bg-amber-400') : 'bg-stone-800'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Caffeine meter */}
              <div className="flex items-center justify-between gap-1 text-[8px]">
                <span className="text-cyan-300 font-bold flex items-center gap-0.5 truncate">
                  ☕ {sobriety.caffeine === 0 ? 'Pausado' : caffeineInfo.title}
                </span>
                <div className="flex gap-0.5 shrink-0">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <div
                      key={`cafhud-${lvl}`}
                      className={`w-1.5 h-2 rounded-xs ${
                        lvl <= sobriety.caffeine ? (lvl >= 4 ? 'bg-red-500' : 'bg-cyan-400') : 'bg-stone-800'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* FIRST-PERSON POV: ILLUSTRATED HANDS HOLDING REAL DYNAMIC CARDS */}
          <div className={`relative flex justify-center items-end mx-auto -mb-1 pointer-events-auto ${drunkSwayClass} ${caffeineJitterClass}`}>
            {/* Left Thumb */}
            <div className="absolute -bottom-1 -left-3 z-30 pointer-events-none flex flex-col items-center">
              <div className="w-8 h-11 sm:w-9 sm:h-12 rounded-t-full bg-[#fed7aa] border-3 border-stone-900 shadow-xl transform rotate-12">
                <div className="w-4 h-3 bg-[#f472b6] rounded-t-full mx-auto mt-1 border-t border-stone-900" />
              </div>
            </div>

            {/* 4 Large Standing Spanish Cards in Abanico */}
            <div className="flex -space-x-5 sm:-space-x-4 md:-space-x-5 lg:-space-x-4 z-20">
              {hands.player.map((card, idx) => {
                const isSelected = selectedDiscards.includes(card.id);
                const rotation = (idx - 1.5) * 4;
                return (
                  <div
                    key={card.id}
                    style={{
                      transform: `rotate(${rotation}deg) translateY(${isSelected ? '-16px' : '0px'})`,
                      transition: 'transform 0.15s ease'
                    }}
                    className="relative cursor-pointer"
                  >
                    {/* Discard selection badge */}
                    {isSelected && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-black border-2 border-white shadow-lg z-30 animate-bounce">
                        ✕
                      </div>
                    )}
                    <SpanishCard
                      card={card}
                      selected={isSelected}
                      onClick={() => {
                        if (isDiscardPhase && isPlayerTurn && !isTurnBusy) {
                          onToggleDiscard(card.id);
                        }
                      }}
                      size="xl"
                      className="shadow-[0_12px_28px_rgba(0,0,0,0.7)]"
                    />
                  </div>
                );
              })}
            </div>

            {/* Right Thumb */}
            <div className="absolute -bottom-1 -right-3 z-30 pointer-events-none flex flex-col items-center">
              <div className="w-8 h-11 sm:w-9 sm:h-12 rounded-t-full bg-[#fed7aa] border-3 border-stone-900 shadow-xl transform -rotate-12">
                <div className="w-4 h-3 bg-[#f472b6] rounded-t-full mx-auto mt-1 border-t border-stone-900" />
              </div>
            </div>
          </div>

          {/* =========================================================================
              LAYER 5: THE ICONIC PC-MUS RETRO POLYGON CONTROL CONSOLE (Bottom Right)
              Solo se abre cuando es el turno efectivo del jugador (y no hay locución en curso)
             ========================================================================= */}
          {!showActionConsole ? (
            <div className="shrink-0 w-[174px] sm:w-[205px] md:w-56 pointer-events-none" aria-hidden="true" />
          ) : (
          <div data-testid="action-console" className="z-50 shrink-0 w-[174px] sm:w-[205px] md:w-56 bg-stone-950/95 border-3 border-stone-900 rounded-2xl p-2 shadow-2xl backdrop-blur-md pointer-events-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Phase 1: Discard Controls - Bizkaia Art. IV: mínimo 1 descarte */}
            {isDiscardPhase && (
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={onConfirmDiscards}
                  disabled={selectedDiscards.length === 0}
                  className={`w-full min-h-[44px] rounded-xl font-black text-xs uppercase shadow-md transition-all border-2 border-stone-900 flex items-center justify-center gap-1.5 ${
                    selectedDiscards.length > 0
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 text-stone-950 active:scale-95 cursor-pointer ring-2 ring-amber-300'
                      : 'bg-stone-800 text-stone-400 cursor-not-allowed opacity-80'
                  }`}
                >
                  <span>
                    {selectedDiscards.length === 0
                      ? 'Marca mín. 1 carta'
                      : `Pedir ${selectedDiscards.length} carta${selectedDiscards.length > 1 ? 's' : ''}`}
                  </span>
                  <span className="text-base">🎴</span>
                </button>
                <div className="text-[10px] text-amber-300/80 text-center font-mono leading-tight px-1">
                  Art. IV Reg. Bizkaia: Obligatorio pedir al menos 1 carta
                </div>
              </div>
            )}

            {/* Phase 2: Mus Check Controls */}
            {isMusCheckPhase && (
              isPlayerTurn ? (
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => onAction('mus')}
                    className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-300 text-stone-950 font-black text-sm uppercase shadow-lg active:scale-95 transition-transform cursor-pointer border-2 border-stone-900 flex items-center justify-center gap-1"
                  >
                    <span>🌱</span>
                    <span>¡MUS!</span>
                  </button>
                  <button
                    onClick={() => onAction('no_mus')}
                    className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-300 text-stone-950 font-black text-sm uppercase shadow-lg active:scale-95 transition-transform cursor-pointer border-2 border-stone-900 flex items-center justify-center gap-1"
                  >
                    <span>✋</span>
                    <span>NO HAY MUS</span>
                  </button>
                </div>
              ) : (
                <div className="min-h-[44px] flex items-center justify-center text-center px-2 py-1 bg-stone-900 border border-stone-800 rounded-xl text-amber-200 text-xs font-bold animate-pulse">
                  Esperando votos de mus...
                </div>
              )
            )}

            {/* Phase 2.5: Pares / Juego Declaration Controls (Mano -> Postre) */}
            {isDeclarationPhase && (
              isPlayerTurn ? (
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => onAction('declare')}
                    className={`w-full min-h-[46px] rounded-xl font-black text-sm uppercase shadow-lg active:scale-95 transition-transform cursor-pointer border-2 border-stone-900 flex items-center justify-center gap-1.5 ${
                      (currentLance === 'PARES' ? playerHasPares : playerHasJuego)
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-300 text-stone-950'
                        : 'bg-gradient-to-r from-sky-400 to-sky-300 hover:from-sky-300 text-stone-950'
                    }`}
                  >
                    <span>🗣️</span>
                    <span>
                      {currentLance === 'PARES'
                        ? (playerHasPares ? 'Pares SÍ' : 'Pares NO')
                        : (playerHasJuego ? 'Juego SÍ' : 'Juego NO')}
                    </span>
                  </button>
                  <div className="text-[9px] text-amber-200/80 text-center font-mono leading-tight px-1">
                    {currentLance === 'PARES'
                      ? 'Art. III Bizkaia: Declara si llevas pares'
                      : 'Art. III Bizkaia: Declara si llevas juego (>30)'}
                  </div>
                </div>
              ) : (
                <div className="min-h-[44px] flex items-center justify-center text-center px-2 py-1 bg-stone-900 border border-stone-800 rounded-xl text-amber-200 text-xs font-bold animate-pulse">
                  {currentLance === 'PARES' ? 'Declarando pares...' : 'Declarando juego...'}
                </div>
              )
            )}

            {/* Phase 3: Lance Bidding Controls (The Iconic Trapezoid PC-Mus Console) */}
            {isBettingPhase && (
              isPlayerTurn ? (
                <div className="flex flex-col gap-1 select-none">
                  {/* Top Hexagon: SEÑAS (Disabled if first hand / Mus corrido) */}
                  <div className="flex justify-center mb-0.5">
                    <button
                      onClick={() => {
                        if (!isFirstHandOfGame) onOpenSignsModal();
                      }}
                      disabled={isFirstHandOfGame}
                      title={isFirstHandOfGame ? 'Sin señas en la primera mano (mus corrido)' : 'Pasar seña a tu compañero'}
                      className={`w-36 h-8 text-xs uppercase border-2 rounded-lg shadow-md flex items-center justify-center transition-all ${
                        isFirstHandOfGame
                          ? 'bg-stone-800 border-stone-700 text-stone-500 cursor-not-allowed opacity-60'
                          : 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 hover:from-emerald-400 text-stone-950 font-black border-stone-900 active:scale-95 cursor-pointer'
                      }`}
                      style={{ clipPath: 'polygon(10% 0%, 90% 0%, 100% 50%, 90% 100%, 10% 100%, 0% 50%)' }}
                    >
                      <span className="text-red-700 font-serif-vintage text-sm font-black">S</span>
                      <span className="font-extrabold tracking-tight">
                        {isFirstHandOfGame ? 'in señas (1ª)' : 'eñas'}
                      </span>
                    </button>
                  </div>

                  {!hasIncomingBet ? (
                    /* Initial Bid State: Paso, Envido, Reenvio, Órdago */
                    <div className="space-y-1">
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          onClick={() => onAction('paso')}
                          className="min-h-[38px] rounded-lg bg-[#38bdf8] hover:bg-sky-300 text-stone-950 font-black text-xs border-2 border-stone-900 shadow active:scale-95 transition-transform cursor-pointer flex items-center justify-center gap-1"
                        >
                          <span>👞</span>
                          <span className="truncate">{getBravuraButtonLabel('Paso', 'paso', sobriety.alcohol, sobriety.caffeine)}</span>
                        </button>
                        <button
                          onClick={() => {
                            if (!cannotRaiseOrEnvido) onAction('envido');
                          }}
                          disabled={cannotRaiseOrEnvido}
                          title={
                            isParesForbidden
                              ? 'No podéis envidar: vuestro equipo no tiene pares'
                              : isJuegoForbidden
                              ? 'No podéis envidar: vuestro equipo no tiene juego'
                              : envido2BecomesOrdago
                              ? `Con 2 piedras más una pareja alcanza ${targetPiedras}: se convierte en Órdago`
                              : 'Envido dos piedras'
                          }
                          className={`min-h-[38px] rounded-lg font-black text-xs border-2 shadow flex items-center justify-center gap-1 transition-all ${
                            cannotRaiseOrEnvido
                              ? 'bg-stone-800 border-stone-700 text-stone-500 cursor-not-allowed opacity-60'
                              : envido2BecomesOrdago
                              ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 text-white border-amber-300 active:scale-95 cursor-pointer'
                              : 'bg-[#ef4444] hover:bg-red-400 text-white border-stone-900 active:scale-95 cursor-pointer'
                          }`}
                        >
                          <span className="text-amber-200 text-sm">{envido2BecomesOrdago ? '🔥' : '2'}</span>
                          <span className="truncate">
                            {cannotRaiseOrEnvido
                              ? 'Sin opción'
                              : envido2BecomesOrdago
                              ? 'Órdago (2)'
                              : getBravuraButtonLabel('Envido', 'envido', sobriety.alcohol, sobriety.caffeine)}
                          </span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-1">
                        <div
                          className={`min-h-[34px] rounded-lg font-black text-xs border-2 shadow flex items-stretch overflow-hidden transition-all ${
                            cannotRaiseOrEnvido
                              ? 'bg-stone-800 border-stone-700 text-stone-500 opacity-60'
                              : enviteBecomesOrdago
                              ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-stone-950 border-amber-200'
                              : 'bg-[#f59e0b] text-stone-950 border-stone-900'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (!cannotRaiseOrEnvido) {
                                setEnviteAmount((prev) => Math.max(2, prev - 1));
                              }
                            }}
                            disabled={cannotRaiseOrEnvido || enviteAmount <= 2}
                            aria-label="Disminuir piedras a envidar"
                            className={`w-6 shrink-0 flex items-center justify-center font-black text-sm border-r border-stone-900/40 transition-colors ${
                              cannotRaiseOrEnvido || enviteAmount <= 2
                                ? 'opacity-40 cursor-not-allowed'
                                : 'hover:bg-amber-300 active:bg-amber-600 cursor-pointer'
                            }`}
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!cannotRaiseOrEnvido) onAction('cinco', enviteAmount);
                            }}
                            disabled={cannotRaiseOrEnvido}
                            title={
                              cannotRaiseOrEnvido
                                ? 'No podéis envidar en este lance'
                                : enviteBecomesOrdago
                                ? `Envidar ${enviteAmount} piedras alcanza ${targetPiedras} → se convierte en Órdago`
                                : `Envidar ${enviteAmount} piedras`
                            }
                            className={`flex-1 min-w-0 flex items-center justify-center gap-0.5 font-black text-sm tabular-nums transition-colors ${
                              cannotRaiseOrEnvido
                                ? 'cursor-not-allowed'
                                : 'hover:bg-amber-400 active:scale-95 cursor-pointer'
                            }`}
                          >
                            <span>{enviteAmount}</span>
                            {enviteBecomesOrdago && <span className="text-[11px]">🔥</span>}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!cannotRaiseOrEnvido) {
                                setEnviteAmount((prev) => Math.min(maxBetAmount, prev + 1));
                              }
                            }}
                            disabled={cannotRaiseOrEnvido || enviteAmount >= maxBetAmount}
                            aria-label="Aumentar piedras a envidar"
                            className={`w-6 shrink-0 flex items-center justify-center font-black text-sm border-l border-stone-900/40 transition-colors ${
                              cannotRaiseOrEnvido || enviteAmount >= maxBetAmount
                                ? 'opacity-40 cursor-not-allowed'
                                : 'hover:bg-amber-300 active:bg-amber-600 cursor-pointer'
                            }`}
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            if (!cannotRaiseOrEnvido) onAction('ordago');
                          }}
                          disabled={cannotRaiseOrEnvido}
                          className={`min-h-[34px] rounded-lg font-black text-xs tracking-wider border-2 shadow flex items-center justify-center gap-1 transition-all ${
                            cannotRaiseOrEnvido
                              ? 'bg-stone-800 border-stone-700 text-stone-500 cursor-not-allowed opacity-60'
                              : 'bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 hover:from-blue-500 text-white border-stone-900 active:scale-95 cursor-pointer'
                          }`}
                        >
                          <span>🔥</span>
                          <span className="truncate">{getBravuraButtonLabel('Órdago', 'ordago', sobriety.alcohol, sobriety.caffeine)}</span>
                        </button>
                      </div>
                    </div>
                  ) : isFacingOrdago ? (
                    /* Facing ÓRDAGO */
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-red-950/80 rounded-xl border-2 border-red-500">
                      <button
                        onClick={() => onAction('quiero')}
                        className="min-h-[44px] rounded-lg bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 text-white font-black text-xs uppercase border-2 border-white shadow-xl active:scale-95 transition-transform cursor-pointer flex items-center justify-center gap-1 animate-pulse"
                      >
                        <span>🤝</span>
                        <span className="truncate">{getBravuraButtonLabel('¡QUIERO!', 'quiero', sobriety.alcohol, sobriety.caffeine)}</span>
                      </button>
                      <button
                        onClick={() => onAction('no_quiero')}
                        className="min-h-[44px] rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-100 font-extrabold text-xs border-2 border-stone-600 active:scale-95 transition-transform cursor-pointer flex items-center justify-center gap-1"
                      >
                        <span>👞</span>
                        <span className="truncate">{getBravuraButtonLabel('No Quiero', 'no_quiero', sobriety.alcohol, sobriety.caffeine)}</span>
                      </button>
                    </div>
                  ) : (
                    /* Facing Bet */
                    <div className="space-y-1">
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          onClick={() => onAction('quiero')}
                          className="min-h-[38px] rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs border-2 border-stone-900 shadow active:scale-95 transition-transform cursor-pointer flex items-center justify-center gap-1"
                        >
                          <span>🤝</span>
                          <span className="truncate">{getBravuraButtonLabel(`Quiero (${betState?.currentBet ?? 0})`, 'quiero', sobriety.alcohol, sobriety.caffeine)}</span>
                        </button>
                        <button
                          onClick={() => onAction('no_quiero')}
                          className="min-h-[38px] rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-100 font-bold text-xs border-2 border-stone-900 shadow active:scale-95 transition-transform cursor-pointer flex items-center justify-center gap-1"
                        >
                          <span>👞</span>
                          <span className="truncate">{getBravuraButtonLabel('No Quiero', 'no_quiero', sobriety.alcohol, sobriety.caffeine)}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-1">
                        <div
                          className={`min-h-[34px] rounded-lg font-black text-xs border-2 shadow flex items-stretch overflow-hidden transition-all ${
                            cannotRaiseOrEnvido
                              ? 'bg-stone-800 border-stone-700 text-stone-500 opacity-60'
                              : reenvioBecomesOrdago
                              ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-stone-950 border-amber-200'
                              : 'bg-amber-500 text-stone-950 border-stone-900'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (!cannotRaiseOrEnvido) {
                                setReenvioAmount((prev) => Math.max(2, prev - 1));
                              }
                            }}
                            disabled={cannotRaiseOrEnvido || reenvioAmount <= 2}
                            aria-label="Disminuir piedras de reenvío"
                            className={`w-6 shrink-0 flex items-center justify-center font-black text-sm border-r border-stone-900/40 transition-colors ${
                              cannotRaiseOrEnvido || reenvioAmount <= 2
                                ? 'opacity-40 cursor-not-allowed'
                                : 'hover:bg-amber-300 active:bg-amber-600 cursor-pointer'
                            }`}
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!cannotRaiseOrEnvido) onAction('reenvio', reenvioAmount);
                            }}
                            disabled={cannotRaiseOrEnvido}
                            title={
                              cannotRaiseOrEnvido
                                ? 'No podéis reenviar en este lance'
                                : reenvioBecomesOrdago
                                ? `Reenviar ${reenvioAmount} piedras más alcanza ${targetPiedras} → se convierte en Órdago`
                                : `Reenviar ${reenvioAmount} piedras más`
                            }
                            className={`flex-1 min-w-0 flex items-center justify-center gap-0.5 font-black text-sm tabular-nums transition-colors ${
                              cannotRaiseOrEnvido
                                ? 'cursor-not-allowed'
                                : 'hover:bg-amber-400 active:scale-95 cursor-pointer'
                            }`}
                          >
                            <span>{reenvioAmount}</span>
                            {reenvioBecomesOrdago && <span className="text-[11px]">🔥</span>}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!cannotRaiseOrEnvido) {
                                setReenvioAmount((prev) => Math.min(maxBetAmount, prev + 1));
                              }
                            }}
                            disabled={cannotRaiseOrEnvido || reenvioAmount >= maxBetAmount}
                            aria-label="Aumentar piedras de reenvío"
                            className={`w-6 shrink-0 flex items-center justify-center font-black text-sm border-l border-stone-900/40 transition-colors ${
                              cannotRaiseOrEnvido || reenvioAmount >= maxBetAmount
                                ? 'opacity-40 cursor-not-allowed'
                                : 'hover:bg-amber-300 active:bg-amber-600 cursor-pointer'
                            }`}
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            if (!cannotRaiseOrEnvido) onAction('ordago');
                          }}
                          disabled={cannotRaiseOrEnvido}
                          className={`min-h-[34px] rounded-lg font-black text-xs border-2 active:scale-95 transition-transform flex items-center justify-center gap-1 ${
                            cannotRaiseOrEnvido
                              ? 'bg-stone-800 border-stone-700 text-stone-500 cursor-not-allowed opacity-60'
                              : 'bg-blue-700 hover:bg-blue-600 text-white border-stone-900 cursor-pointer'
                          }`}
                        >
                          <span>🔥</span>
                          <span>Órdago</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="min-h-[44px] flex items-center justify-center text-center px-2 py-1 bg-stone-900 border border-stone-800 rounded-xl text-amber-200 text-xs font-bold animate-pulse">
                  Pensando jugada... ↺
                </div>
              )
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
};
