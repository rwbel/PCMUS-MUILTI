/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TableAmarracosTray.tsx - Plato/zona de tanteo individual sobre la mesa de Mus
 *
 * En el Mus tradicional cada pareja lleva su puntuación sobre la mesa repartida
 * entre sus dos jugadores:
 *   - Un miembro de la pareja lleva los amarracos (fichas/garbanzos de 5 piedras)
 *   - El otro miembro lleva las piedras sueltas (garbanzos de 1 piedra, 0..4)
 */

import React from 'react';

export interface TableAmarracosTrayProps {
  /** 'five' para amarracos (5 piedras), 'one' para piedras sueltas (1 piedra) */
  denomination: 5 | 1;
  /** Cantidad de piezas de esta denominación actualmente en poder del jugador */
  count: number;
  /** Puntuación total de la pareja (para tooltip y verificación) */
  teamTotalPiedras: number;
  /** Juegos (chicos) ganados por la pareja */
  teamJuegosWon: number;
  /** Puntuación objetivo del juego (40 piedras) */
  targetPiedras: number;
  /** Etiqueta de pareja ('Nosotros' | 'Ellos') */
  teamLabel: 'Nosotros' | 'Ellos';
  /** Nombre corto del personaje que custodia estas piezas */
  holderName: string;
  /** Si pertenece a la pareja del jugador humano */
  isPlayerTeam: boolean;
  /** Clases de posicionamiento absoluto sobre la mesa */
  className?: string;
  /** ID para pruebas automatizadas */
  testId?: string;
  /** Acción al pulsar (abre la libreta de tanteo) */
  onClick?: () => void;
}

export const TableAmarracosTray: React.FC<TableAmarracosTrayProps> = ({
  denomination,
  count,
  teamTotalPiedras,
  teamJuegosWon,
  targetPiedras,
  teamLabel,
  holderName,
  isPlayerTeam,
  className = '',
  testId,
  onClick,
}) => {
  const isFive = denomination === 5;
  const maxVisible = isFive ? 8 : 4;
  const visibleCount = Math.min(Math.max(0, count), maxVisible);
  const stoneSum = count * denomination;

  const tooltip = isFive
    ? `${holderName} (${teamLabel}) · Lleva los amarracos de 5: ${count} (${stoneSum}p) · Pareja: ${teamTotalPiedras}/${targetPiedras}p · Juegos: ${teamJuegosWon}`
    : `${holderName} (${teamLabel}) · Lleva las piedras de 1: ${count} (${stoneSum}p) · Pareja: ${teamTotalPiedras}/${targetPiedras}p · Juegos: ${teamJuegosWon}`;

  const STONE_OFFSETS = [
    'rotate-[-8deg] translate-y-[0.5px]',
    'rotate-[6deg] -translate-y-[0.5px]',
    'rotate-[-4deg] translate-y-[1px]',
    'rotate-[9deg] translate-y-0',
    'rotate-[5deg] -translate-y-[0.5px]',
    'rotate-[-7deg] translate-y-[0.5px]',
    'rotate-[3deg] -translate-y-[1px]',
    'rotate-[-5deg] translate-y-0',
  ];

  return (
    <button
      type="button"
      data-testid={testId}
      data-denomination={denomination}
      data-count={count}
      onClick={onClick}
      title={tooltip}
      aria-label={tooltip}
      className={`bg-transparent border-0 p-0 shadow-none flex flex-wrap items-center justify-center gap-1 max-w-[76px] select-none transition-transform duration-150 ${
        visibleCount > 0
          ? 'cursor-pointer hover:scale-110 active:scale-95'
          : 'pointer-events-none opacity-0'
      } ${className}`}
    >
      {Array.from({ length: visibleCount }).map((_, idx) => {
        const organicClass = STONE_OFFSETS[idx % STONE_OFFSETS.length];
        return isFive ? (
          <span
            key={`amarraco-${idx}`}
            className={`w-4 h-4 rounded-full bg-gradient-to-br from-amber-100 via-amber-400 to-amber-800 border border-stone-950/90 shadow-[0_2px_3px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.65)] flex items-center justify-center text-[8px] font-black text-stone-950 leading-none animate-garbanzo-bounce ${organicClass}`}
          >
            5
          </span>
        ) : (
          <span
            key={`piedra-${idx}`}
            className={`w-3 h-3 rounded-[46%_54%_48%_52%] bg-gradient-to-br from-[#fffdf5] via-[#fde68a] to-[#b45309] border border-stone-950/85 shadow-[0_2px_2.5px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.8)] animate-garbanzo-bounce ${organicClass}`}
          />
        );
      })}
    </button>
  );
};
