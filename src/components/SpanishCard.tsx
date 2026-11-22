/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SpanishCard.tsx - Componente de carta de la baraja española
 *
 * Renderiza cada naipe usando los diseños digitalizados de la baraja española
 * completa (40 cartas: Oros, Copas, Espadas y Bastos, del 1 al 7 y 10 al 12):
 *   - Frente: ilustración digitalizada real en /assets/cards/{palo}_{rango}.png
 *   - Reverso: patrón clásico español cuando está boca abajo
 *   - Tamaños: sm, md, lg, xl con proporción fiel al naipe español (240:370)
 *   - Estados: seleccionada (para descarte), faceDown (boca abajo)
 *   - Badges especiales: "= Rey" para 3s, "= As" para 2s (regla 8 Reyes/8 Ases)
 */

import React from 'react';
import { Card, Rank, Suit } from '../types/mus';

const SUITS: Suit[] = ['oros', 'copas', 'espadas', 'bastos'];
const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

export function getSpanishCardImageUrl(suit: Suit, rank: Rank): string {
  return `/assets/cards/${suit}_${rank}.png`;
}

// Precarga ligera de las 40 cartas digitalizadas para evitar parpadeos al repartir o en el tanteo
if (typeof window !== 'undefined') {
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const img = new window.Image();
      img.src = getSpanishCardImageUrl(suit, rank);
    }
  }
}

interface SpanishCardProps {
  card?: Card;
  faceDown?: boolean;
  selected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSpecialRuleHint?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
  sm: 'w-10 h-[62px] rounded-md',
  md: 'w-[60px] h-[92px] sm:w-16 sm:h-[98px] rounded-lg',
  lg: 'w-20 h-[123px] rounded-xl',
  xl: 'w-20 h-[123px] sm:w-[88px] sm:h-[136px] md:w-[104px] md:h-[160px] lg:w-[120px] lg:h-[185px] rounded-xl',
};

const RANK_NAMES: Record<Rank, string> = {
  1: 'As',
  2: 'Dos',
  3: 'Tres',
  4: 'Cuatro',
  5: 'Cinco',
  6: 'Seis',
  7: 'Siete',
  10: 'Sota',
  11: 'Caballo',
  12: 'Rey',
};

const SUIT_NAMES: Record<Suit, string> = {
  oros: 'Oros',
  copas: 'Copas',
  espadas: 'Espadas',
  bastos: 'Bastos',
};

export const SpanishCard: React.FC<SpanishCardProps> = ({
  card,
  faceDown = false,
  selected = false,
  onClick,
  size = 'md',
  showSpecialRuleHint = true,
  className = '',
}) => {
  if (faceDown || !card) {
    return (
      <div
        onClick={onClick}
        className={`relative border border-amber-950/80 shadow-md overflow-hidden bg-red-950 transition-all duration-200 select-none ${SIZE_CLASSES[size]} ${className}`}
      >
        {/* Reverso clásico español */}
        <div className="absolute inset-1 border border-amber-500/50 rounded-[inherit] bg-gradient-to-br from-red-900 to-amber-950 flex items-center justify-center">
          <div className="w-full h-full opacity-30 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:6px_6px]" />
          <div className="absolute w-5 h-5 rounded-full border border-amber-400/60 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rotate-45 bg-amber-400/80" />
          </div>
        </div>
      </div>
    );
  }

  const { suit, rank } = card;
  const isTresComoRey = rank === 3;
  const isDosComoAs = rank === 2;
  const cardImgSrc = getSpanishCardImageUrl(suit, rank);
  const cardAlt = `${RANK_NAMES[rank]} de ${SUIT_NAMES[suit]}`;

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden border transition-all duration-200 select-none cursor-pointer bg-[#f7f4ec] ${SIZE_CLASSES[size]} ${
        selected
          ? 'border-amber-500 shadow-xl -translate-y-3 ring-2 ring-amber-400'
          : 'border-stone-400/80 shadow-md hover:border-amber-400'
      } ${className}`}
    >
      <img
        src={cardImgSrc}
        alt={cardAlt}
        draggable={false}
        className="w-full h-full object-contain pointer-events-none select-none"
      />

      {/* Mus 8-Reyes / 8-Ases Rule Badge */}
      {showSpecialRuleHint && size !== 'sm' && (isTresComoRey || isDosComoAs) && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          {isTresComoRey && (
            <span className="text-[8px] sm:text-[9px] font-black text-amber-900 bg-amber-100/95 rounded px-1.5 py-0.2 leading-tight border border-amber-500 shadow-sm whitespace-nowrap">
              = Rey
            </span>
          )}
          {isDosComoAs && (
            <span className="text-[8px] sm:text-[9px] font-black text-sky-900 bg-sky-100/95 rounded px-1.5 py-0.2 leading-tight border border-sky-500 shadow-sm whitespace-nowrap">
              = As
            </span>
          )}
        </div>
      )}

      {/* Discard selection indicator */}
      {selected && (
        <div className="absolute top-1 right-1 bg-amber-500 text-stone-950 rounded-full w-5 h-5 flex items-center justify-center shadow-md font-bold text-[11px] border border-amber-200 z-20">
          ✓
        </div>
      )}
    </div>
  );
};
