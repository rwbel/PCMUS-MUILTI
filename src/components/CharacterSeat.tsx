/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CharacterSeat.tsx - Asiento de personaje en la mesa
 *
 * Componente ligero que muestra un personaje sentado con:
 *   - Avatar circular con borde dorado si es turno o Mano
 *   - Burbuja de cómic con el texto que dice
 *   - Badge "MANO" si es el jugador que habla primero
 *   - Botón "¡Seña!" para cazar señas del oponente (jugador solo)
 *   - Fan de cartas (rectángulos rojos) representando las cartas en mano
 *   - Nombre y rol del personaje debajo del avatar
 *
 * Es una versión simplificada de AnimatedCharacter para uso en la mesa.
 */

import React from 'react';
import { Character, PlayerPosition, PlayerSpeech } from '../types/mus';

interface CharacterSeatProps {
  position: PlayerPosition;
  character: Character;
  cardCount: number;
  isMano: boolean;
  isTurn: boolean;
  activeSpeech?: PlayerSpeech | null;
  roleLabel: string;
  onCatchSign?: () => void;
  canCatchSign?: boolean;
}

export const CharacterSeat: React.FC<CharacterSeatProps> = ({
  position,
  character,
  cardCount,
  isMano,
  isTurn,
  activeSpeech,
  roleLabel,
  onCatchSign,
  canCatchSign = false
}) => {
  const isTop = position === 'partner';
  const isLeft = position === 'oppLeft';
  const isRight = position === 'oppRight';

  return (
    <div
      className={`relative flex items-center transition-all duration-300 ${
        isTop
          ? 'flex-col justify-center'
          : isLeft
          ? 'flex-col items-center'
          : 'flex-col items-center'
      }`}
    >
      {/* Authentic Comic Speech Bubble (PC-Mus style: white background, thick black outline, black bold font) */}
      {activeSpeech && (
        <div
          className={`absolute z-40 transition-all duration-200 pointer-events-none animate-in fade-in zoom-in-95 ${
            isTop
              ? '-top-10 left-1/2 -translate-x-1/2'
              : isLeft
              ? 'left-12 -top-5'
              : 'right-12 -top-5'
          }`}
        >
          <div
            className={`comic-bubble ${
              isTop
                ? 'comic-bubble-tail-bottom'
                : isLeft
                ? 'comic-bubble-tail-left'
                : 'comic-bubble-tail-right'
            } px-2.5 py-1.5 min-w-[100px] max-w-[150px] sm:max-w-[170px] text-center text-stone-950 font-bold`}
            style={{
              borderColor: activeSpeech.actionType === 'ordago' ? '#b91c1c' : '#000000',
              borderWidth: activeSpeech.actionType === 'ordago' ? '3px' : '2.5px',
              backgroundColor: activeSpeech.actionType === 'ordago' ? '#fef2f2' : '#ffffff'
            }}
          >
            <p className="text-[10px] sm:text-[11px] leading-tight font-extrabold tracking-tight">
              {activeSpeech.text}
            </p>
          </div>
        </div>
      )}

      {/* Avatar Container with Tavern Chair Backing & Hands holding cards */}
      <div className="relative group">
        {/* Subtle wooden tavern chair silhouette behind character */}
        <div className="absolute -top-1.5 -inset-x-1.5 h-14 bg-amber-950/80 rounded-t-xl border border-amber-800/60 -z-10 shadow-inner" />

        <div
          className={`relative w-12 h-12 sm:w-13 sm:h-13 rounded-full overflow-hidden border-2 transition-all duration-300 shadow-md ${
            isTurn
              ? 'border-amber-400 ring-4 ring-amber-400/80 scale-105 shadow-amber-500/50'
              : isMano
              ? 'border-amber-400 ring-2 ring-amber-500/40 bg-stone-900'
              : 'border-amber-900/70 bg-stone-900'
          }`}
        >
          <img
            src={character.avatar}
            alt={character.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-stone-800 -z-10 flex items-center justify-center text-xs font-serif-vintage text-amber-200">
            {character.name.charAt(0)}
          </div>
        </div>

        {/* Clear, Prominent Mano Badge (Authentic gold star) */}
        {isMano && (
          <div
            title="Mano de la partida (habla primero)"
            className="absolute -top-2.5 -right-2 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-stone-950 text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-lg border border-amber-100 flex items-center gap-0.5 z-20 animate-pulse"
          >
            <span>★</span>
            <span>MANO</span>
          </div>
        )}

        {/* Catch opponent sign button */}
        {canCatchSign && (
          <button
            onClick={onCatchSign}
            className="absolute -bottom-2 -left-2 bg-rose-600 hover:bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-lg animate-bounce border border-rose-300 whitespace-nowrap cursor-pointer z-30"
          >
            ¡Seña! 👀
          </button>
        )}

        {/* Fan of cards held by character (like in PC-Mus screenshot) */}
        <div
          className={`absolute flex -space-x-1.5 z-10 ${
            isTop
              ? '-bottom-2 left-1/2 -translate-x-1/2'
              : isLeft
              ? '-bottom-1 -right-2'
              : '-bottom-1 -left-2'
          }`}
        >
          {Array.from({ length: Math.min(cardCount, 4) }).map((_, i) => (
            <div
              key={i}
              className="w-2.5 h-4 bg-gradient-to-b from-red-700 via-red-800 to-red-900 rounded-[2px] border border-amber-400/80 shadow-sm transform"
              style={{
                transform: `rotate(${(i - 1.5) * 8}deg)`
              }}
            />
          ))}
        </div>
      </div>

      {/* Name & Role tag */}
      <div className="flex flex-col text-center items-center mt-1">
        <span className="text-[10px] sm:text-[11px] font-bold text-amber-100 font-serif-vintage leading-tight drop-shadow truncate max-w-[75px]">
          {character.name}
        </span>
        <span className="text-[8px] text-amber-300/80 font-medium leading-none">
          {roleLabel}
        </span>
      </div>
    </div>
  );
};
