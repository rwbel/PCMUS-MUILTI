/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TableCenter.tsx - Centro de la mesa de juego
 *
 * Muestra en el centro de la pantalla:
 *   - Puntuación de ambos equipos con garbanzos visuales (amarracos de 5 + piedras sueltas)
 *   - Lance actual (Grande, Chica, Pares, Juego)
 *   - Estado de la apuesta (envite, órdago, en paso)
 *   - Nombre de la Mano actual
 *   - Barra de mensajes de showdown
 *   - Cartas reveladas cuando se muestra el showdown
 *
 * Es un indicador de estado central que el jugador consulta constantemente.
 */

import React from 'react';
import { BetState, Card, LancePhase, TeamScore } from '../types/mus';
import { SpanishCard } from './SpanishCard';

interface TableCenterProps {
  currentLance: LancePhase | null;
  betState: BetState | null;
  scoreTeam1: TeamScore; // Player + Partner (Nosotros)
  scoreTeam2: TeamScore; // Rivals (Ellos)
  targetPiedras: number;
  manoName: string;
  revealedCards?: Record<string, Card[]>;
  showdownMessage?: string | null;
  completedLances?: LancePhase[];
  isDealing?: boolean;
}

export const TableCenter: React.FC<TableCenterProps> = ({
  currentLance,
  betState,
  scoreTeam1,
  scoreTeam2,
  targetPiedras,
  manoName,
  revealedCards,
  showdownMessage,
  completedLances = [],
  isDealing = false
}) => {
  const LANCES: { key: LancePhase; label: string }[] = [
    { key: 'GRANDE', label: 'Grande' },
    { key: 'CHICA', label: 'Chica' },
    { key: 'PARES', label: 'Pares' },
    { key: 'JUEGO', label: 'Juego' }
  ];

  // Visual Garbanzos (Tanteo de piedras y amarracos sobre madera)
  const renderGarbanzosTanteo = (score: TeamScore, label: string, isPlayerTeam = false) => {
    const amarracos = Math.floor(score.piedras / 5);
    const piedrasSueltas = score.piedras % 5;

    return (
      <div
        className={`flex flex-col items-center px-2 py-1 rounded-xl border shrink-0 transition-all ${
          isPlayerTeam
            ? 'bg-amber-950/80 border-amber-500/70 text-amber-200 shadow-md'
            : 'bg-stone-900/80 border-stone-700/70 text-stone-300'
        }`}
      >
        <span className="text-[8px] uppercase font-bold tracking-wider opacity-90 font-serif-vintage">
          {label}
        </span>
        <div className="flex items-center gap-0.5 leading-none mt-0.5">
          <span className="text-xs font-black font-mono-numbers text-amber-400">
            {score.piedras}
          </span>
          <span className="text-[8px] text-stone-400">/{targetPiedras}</span>
        </div>

        {/* Physical Garbanzos (Yellow chickpeas on wood) */}
        <div className="flex items-center gap-1 mt-1 min-h-[14px]">
          {/* Amarracos (5 stones each) */}
          {Array.from({ length: amarracos }).map((_, i) => (
            <div
              key={`am-${i}`}
              title="Amarraco (5 piedras)"
              className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 border border-amber-200 shadow-[0_1px_2px_rgba(0,0,0,0.6)] animate-garbanzo-bounce flex items-center justify-center text-[6px] font-black text-amber-950"
            >
              5
            </div>
          ))}

          {/* Piedras sueltas (1 stone each) */}
          {Array.from({ length: piedrasSueltas }).map((_, i) => (
            <div
              key={`pi-${i}`}
              title="Piedra (1 punto)"
              className="w-1.5 h-1.5 rounded-full bg-gradient-to-br from-amber-200 to-amber-400 border border-amber-300/80 shadow-[0_1px_1px_rgba(0,0,0,0.5)] animate-garbanzo-bounce"
            />
          ))}

          {amarracos === 0 && piedrasSueltas === 0 && (
            <span className="text-[7px] text-stone-500 italic">0 p</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full max-w-[210px] mx-auto rounded-3xl bg-gradient-to-b from-amber-900 via-amber-950 to-stone-950 border-2 border-amber-700/80 p-2 shadow-2xl overflow-hidden backdrop-blur-md">
      {/* Wood plank rings & grain subtle overlay */}
      <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-400 via-transparent to-black" />

      {/* Mano & Antihorario header */}
      <div className="flex items-center justify-between border-b border-amber-600/30 pb-1 mb-1 text-[8px] relative z-10">
        <div className="flex items-center gap-1 bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/40 font-bold truncate max-w-[125px]">
          <span>★ Mano:</span>
          <span className="truncate">{manoName}</span>
        </div>
        <span className="text-amber-400/90 font-mono text-[8px] font-bold">
          ↺ Antihorario
        </span>
      </div>

      {/* Tanteo (Garbanzos) Bar with deck in center */}
      <div className="flex items-center justify-between gap-1 relative z-10">
        {renderGarbanzosTanteo(scoreTeam1, 'Nosotros', true)}

        {/* Central Deck & Current Lance Status */}
        <div className="flex-1 flex flex-col items-center px-0.5 text-center min-w-0">
          {/* Deck of Spanish Cards (Taco) with dealing animation */}
          <div className="relative mb-0.5 group">
            <div
              className={`w-7 h-10 rounded-[3px] bg-red-900 border border-amber-300/80 shadow-md relative overflow-hidden transition-transform ${
                isDealing ? 'scale-110 rotate-3 animate-pulse' : ''
              }`}
            >
              <div className="absolute inset-0.5 border border-dashed border-amber-400/40 rounded-[2px] flex items-center justify-center">
                <span className="text-[7px] text-amber-300/90 font-black tracking-tighter">
                  MUS
                </span>
              </div>
            </div>
            {/* Card depth shadow */}
            <div className="absolute -bottom-0.5 -right-0.5 w-7 h-10 rounded-[3px] bg-red-950 border border-red-900/60 -z-10" />
          </div>

          <span className="text-[10px] uppercase font-serif-vintage text-amber-300 font-extrabold leading-tight truncate w-full">
            {currentLance ? (currentLance === 'PUNTO' ? 'Punto' : currentLance) : 'Fase Mus'}
          </span>

          {betState ? (
            <div className="mt-0.5">
              {betState.isOrdago ? (
                <span className="text-[8px] font-black uppercase text-rose-200 animate-ordago px-1 py-0.5 rounded bg-rose-950 border border-rose-500">
                  ¡ÓRDAGO!
                </span>
              ) : betState.currentBet > 0 ? (
                <span className="text-[8px] font-bold text-amber-100 bg-amber-950 px-1 py-0.5 rounded border border-amber-500/60 font-mono-numbers">
                  {betState.currentBet} piedras
                </span>
              ) : (
                <span className="text-[8px] text-stone-300 font-medium">
                  En paso
                </span>
              )}
            </div>
          ) : (
            <span className="text-[8px] text-amber-300/80 font-medium">
              ¿Hay mus?
            </span>
          )}
        </div>

        {renderGarbanzosTanteo(scoreTeam2, 'Ellos', false)}
      </div>

      {/* Lances Breadcrumb Step Progress */}
      <div className="grid grid-cols-4 gap-0.5 mt-1.5 pt-1 border-t border-amber-600/30 text-center relative z-10">
        {LANCES.map(({ key, label }) => {
          const isCurrent = currentLance === key || (key === 'JUEGO' && currentLance === 'PUNTO');
          const isDone = completedLances.includes(key);

          return (
            <div
              key={key}
              className={`py-0.5 px-0.5 rounded text-[8px] font-bold leading-none truncate transition-all ${
                isCurrent
                  ? 'bg-amber-400 text-stone-950 shadow-sm ring-1 ring-amber-200'
                  : isDone
                  ? 'bg-emerald-900/70 text-emerald-300 border border-emerald-600/40'
                  : 'text-stone-400 opacity-60'
              }`}
            >
              {isDone ? `✓ ${label}` : label}
            </div>
          );
        })}
      </div>

      {/* Showdown Message Banner */}
      {showdownMessage && (
        <div className="mt-1 text-center py-0.5 px-1 rounded bg-amber-950/95 border border-amber-500 text-amber-100 text-[9px] font-bold animate-in fade-in relative z-10">
          {showdownMessage}
        </div>
      )}

      {/* Compact Showdown Card Spread if cards revealed */}
      {revealedCards && Object.keys(revealedCards).length > 0 && (
        <div className="mt-1 grid grid-cols-2 gap-0.5 p-0.5 bg-black/50 rounded-lg relative z-10">
          {Object.entries(revealedCards).map(([playerKey, cards]) => (
            <div key={playerKey} className="flex flex-col items-center p-0.5 rounded bg-stone-900/90 border border-stone-800">
              <span className="text-[7px] text-amber-200 font-serif-vintage truncate mb-0.5">
                {playerKey === 'player' ? 'Tú' : playerKey === 'partner' ? 'Compañero' : playerKey === 'oppLeft' ? 'Izquierda' : 'Derecha'}
              </span>
              <div className="flex gap-0.5">
                {cards.map((c, i) => (
                  <SpanishCard key={c.id || i} card={c} size="sm" showSpecialRuleHint={false} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
