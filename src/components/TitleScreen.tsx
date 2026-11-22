/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TitleScreen.tsx - Pantalla de título e inicio del juego
 *
 * Muestra la portada inicial con:
 *   - Fondo de taberna con ilustración PC-Mus clásica
 *   - Título "PCMUS" con estilo vintage de los años 90
 *   - Información del compañero seleccionado (con botón para cambiarlo)
 *   - Botones principales:
 *     * "Echar la Partida" → inicia una nueva partida
 *     * "Personajes" → abre el modal de selección de personajes
 *     * "Manual y Señas" → abre el reglamento del Mus
 *   - Controles superiores: pantalla completa y música lo-fi
 *
 * Es el punto de entrada del usuario antes de comenzar a jugar.
 */

import React from 'react';
import { Character } from '../types/mus';
import { resolveImageAsset } from '../utils/assetLoader';

interface TitleScreenProps {
  onOpenLobby: () => void;
  onStartGame: () => void;
  onOpenRules: () => void;
  onSelectCharacters: () => void;
  onOpenAchievements: () => void;
  unlockedAchievementsCount: number;
  totalAchievementsCount: number;
  playerName: string;
  playerAvatar: Character;
  partnerCharacter: Character;
  isMusicPlaying: boolean;
  onToggleMusic: () => void;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onOpenLobby,
  onStartGame,
  onOpenRules,
  onSelectCharacters,
  onOpenAchievements,
  unlockedAchievementsCount,
  totalAchievementsCount,
  playerName,
  playerAvatar,
  partnerCharacter,
  isMusicPlaying,
  onToggleMusic,
  isFullScreen,
  onToggleFullScreen
}) => {
  return (
    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden text-stone-100">
      {/* Background tavern illustration with warm overlay */}
      <div className="absolute inset-0 -z-10">
        <img
          src={resolveImageAsset('/src/assets/images/pcmus_table_four_char_1794392271644.jpg')}
          alt="Bar clásico español PC-Mus"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover brightness-[0.72] contrast-[1.05]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/60 to-amber-950/30" />
        <div className="absolute inset-0 lofi-grain opacity-40 pointer-events-none" />
      </div>

      {/* Top Bar with Music & Audio Toggle */}
      <div className="pt-6 sm:pt-4 px-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 bg-stone-900/80 backdrop-blur-md px-3 py-1 rounded-full border border-amber-600/30">
          <span className="text-xs">☕</span>
          <span className="text-[11px] font-medium text-amber-200">Café Bar El Madroño</span>
        </div>

        {/* Controls: Full Screen & Music Player */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleFullScreen}
            className="min-h-[36px] px-2.5 py-1 rounded-full bg-stone-900/80 backdrop-blur-md border border-amber-500/40 text-amber-300 hover:text-amber-200 flex items-center gap-1 text-xs transition-colors cursor-pointer"
            title={isFullScreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa'}
          >
            <span>{isFullScreen ? '🗗' : '⛶'}</span>
            <span className="font-semibold hidden sm:inline">
              {isFullScreen ? 'Marco' : 'Full Screen'}
            </span>
          </button>

          <button
            onClick={onToggleMusic}
            className="min-h-[36px] px-2.5 py-1 rounded-full bg-stone-900/80 backdrop-blur-md border border-amber-500/40 text-amber-300 hover:text-amber-200 flex items-center gap-1 text-xs transition-colors cursor-pointer"
          >
            <span>{isMusicPlaying ? '🎷' : '🔇'}</span>
            <span className="font-semibold">{isMusicPlaying ? 'Jazz Lo-Fi' : 'Música'}</span>
          </button>
        </div>
      </div>

      {/* Center Branding & Vintage Title Lockup */}
      <div className="px-6 flex flex-col items-center text-center z-10 my-auto">
        <span className="text-[11px] font-bold text-amber-300 uppercase tracking-widest font-mono-numbers mb-1">
          1995 · Multijugador & IA
        </span>

        <h1 className="text-4xl sm:text-5xl font-black font-serif-vintage tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-amber-100 via-amber-300 to-amber-500 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
          PCMUS
        </h1>
        <p className="text-base sm:text-lg font-serif-vintage text-amber-200/90 italic tracking-wide mt-1">
          El Clásico del Bar Español
        </p>

        <p className="text-xs text-stone-300 max-w-sm mt-3 leading-relaxed">
          Cuatro cartas, 40 piedras y todo el ambiente de una taberna de siempre. Juega solo contra la IA o comparte mesa con pareja y rivales humanos.
        </p>

        {/* Player Identity + Partner Highlight */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={onOpenLobby}
            className="flex items-center gap-2.5 bg-stone-900/80 hover:bg-stone-800/90 backdrop-blur-md p-2 pr-3 rounded-2xl border border-amber-500/40 cursor-pointer transition-colors"
          >
            <img
              src={playerAvatar.avatar}
              alt={playerName}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-full object-cover border border-amber-400/70"
            />
            <div className="text-left">
              <span className="text-[10px] text-stone-400 block uppercase tracking-wider">Tu ficha:</span>
              <span className="text-xs font-bold text-amber-200">{playerName}</span>
            </div>
          </button>

          <div className="flex items-center gap-2.5 bg-stone-900/75 backdrop-blur-md p-2 rounded-2xl border border-stone-700/60">
            <img
              src={partnerCharacter.avatar}
              alt={partnerCharacter.name}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-full object-cover border border-amber-400/60"
            />
            <div className="text-left">
              <span className="text-[10px] text-stone-400 block uppercase tracking-wider">Compañero IA:</span>
              <span className="text-xs font-bold text-amber-200">{partnerCharacter.name}</span>
            </div>
            <button
              onClick={onSelectCharacters}
              className="ml-1 text-[10px] text-amber-400 hover:text-amber-300 font-bold px-2 py-1 rounded bg-stone-800 border border-stone-600 cursor-pointer"
            >
              Cambiar
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Action CTAs (Ergonomic Thumb Area) */}
      <div className="p-6 pb-8 space-y-2.5 z-10 max-w-md mx-auto w-full">
        <button
          onClick={onOpenLobby}
          className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-black text-sm sm:text-base shadow-[0_10px_25px_-5px_rgba(245,158,11,0.5)] active:scale-[0.98] transition-transform flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider whitespace-nowrap"
        >
          <span>🍻</span>
          <span>Sala de Espera (Multijugador)</span>
        </button>

        <button
          onClick={onStartGame}
          className="w-full min-h-[42px] rounded-xl bg-stone-900/95 hover:bg-stone-800 text-amber-200 font-bold text-xs uppercase tracking-wider border border-amber-500/40 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <span>🎴</span>
          <span>Jugar Solo Rápido (1 vs 3 IA)</span>
        </button>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={onSelectCharacters}
            className="min-h-[42px] rounded-xl bg-stone-900/90 hover:bg-stone-800 text-stone-200 text-xs font-bold border border-stone-700 active:scale-[0.98] transition-transform cursor-pointer px-1 whitespace-nowrap"
          >
            👥 Personajes
          </button>
          <button
            onClick={onOpenAchievements}
            className="min-h-[42px] rounded-xl bg-stone-900/90 hover:bg-stone-800 text-amber-200 text-xs font-bold border border-amber-600/50 active:scale-[0.98] transition-transform cursor-pointer px-1 flex items-center justify-center gap-1 whitespace-nowrap"
          >
            <span>🏆</span>
            <span>Logros</span>
            <span className="text-[10px] font-mono-numbers text-amber-400">
              {unlockedAchievementsCount}/{totalAchievementsCount}
            </span>
          </button>
          <button
            onClick={onOpenRules}
            className="min-h-[42px] rounded-xl bg-stone-900/90 hover:bg-stone-800 text-amber-300 text-xs font-bold border border-stone-700 active:scale-[0.98] transition-transform cursor-pointer px-1 whitespace-nowrap"
          >
            📖 Manual
          </button>
        </div>
      </div>
    </div>
  );
};
