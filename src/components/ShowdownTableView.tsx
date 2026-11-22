/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ShowdownTableView.tsx - Vista de showdown y desglose de lances
 *
 * Se muestra al final de cada ronda con:
 *   - Las manos reveladas de los 4 jugadores
 *   - Resultado de cada lance (Grande, Chica, Pares, Juego)
 *   - Piedras ganadas por equipo y motivo
 *   - Marcador de juegos y tantos actualizado
 *   - Botón para continuar a la siguiente mano
 *
 * Es un componente de solo lectura: no tiene lógica de juego, solo muestra resultados.
 */

import React from 'react';
import { Card, LancePhase, LanceResult } from '../types/mus';
import { SpanishCard } from './SpanishCard';

export interface LanceBreakdownDetail {
  lance: LancePhase;
  winnerTeam: 1 | 2 | null;
  winnerPlayerName: string;
  stonesWon: number;
  reason: string;
  explanation: string;
}

interface ShowdownTableViewProps {
  hands: Record<string, Card[]>;
  playerName?: string;
  partnerName: string;
  oppLeftName: string;
  oppRightName: string;
  showdownMessage: string | null;
  onNextHand: () => void;
  lanceResults: Record<LancePhase, LanceResult>;
  scoreTeam1Piedras: number;
  scoreTeam2Piedras: number;
  scoreTeam1Juegos?: number;
  scoreTeam2Juegos?: number;
  justWonJuego?: boolean;
  breakdownDetails?: LanceBreakdownDetail[];
  readyNextHandCount?: number;
  totalConnectedHumans?: number;
  myReadyForNextHand?: boolean;
}

export const ShowdownTableView: React.FC<ShowdownTableViewProps> = ({
  hands,
  playerName,
  partnerName,
  oppLeftName,
  oppRightName,
  showdownMessage,
  onNextHand,
  lanceResults,
  scoreTeam1Piedras,
  scoreTeam2Piedras,
  scoreTeam1Juegos = 0,
  scoreTeam2Juegos = 0,
  justWonJuego = false,
  breakdownDetails = [],
  readyNextHandCount = 0,
  totalConnectedHumans = 1,
  myReadyForNextHand = false,
}) => {
  // Compute total hand stones from breakdown
  const t1HandStones = breakdownDetails
    .filter(b => b.winnerTeam === 1)
    .reduce((acc, curr) => acc + curr.stonesWon, 0);

  const t2HandStones = breakdownDetails
    .filter(b => b.winnerTeam === 2)
    .reduce((acc, curr) => acc + curr.stonesWon, 0);

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-3 select-none overflow-hidden bg-gradient-to-b from-[#b45309] via-[#d97706] to-[#78350f] border-4 border-stone-900 shadow-2xl">
      {/* Wood plank texture & glow */}
      <div className="absolute inset-0 pointer-events-none opacity-25 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-200 via-stone-900 to-black" />
      <div className="absolute inset-0 pointer-events-none divide-y-2 divide-amber-950/40 flex flex-col justify-around">
        <div /><div /><div /><div /><div />
      </div>

      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-3 pt-1 z-20">
        <div className="flex items-center gap-2 bg-stone-950/90 px-4 py-1.5 rounded-full border-2 border-stone-900 shadow-xl">
          <span className="text-xs sm:text-sm text-amber-300 font-serif-vintage font-black uppercase tracking-wider">
            RECUENTO DE LANCES Y DESGLOSE DE TANTEO
          </span>
          <span className="text-[11px] font-bold text-amber-400 font-mono-numbers ml-2">
            Juegos: {scoreTeam1Juegos}-{scoreTeam2Juegos} · Tantos: Nosotros {scoreTeam1Piedras} p | Ellos {scoreTeam2Piedras} p
          </span>
        </div>

        {/* Deck in corner */}
        <div className="relative">
          <div className="w-10 h-14 rounded-[3px] bg-red-900 border-2 border-stone-900 shadow-xl flex items-center justify-center">
            <span className="text-[8px] text-amber-200 font-black">BARAJA</span>
          </div>
          <div className="absolute -bottom-1 -right-1 w-10 h-14 rounded-[3px] bg-red-950 border border-red-900 -z-10" />
        </div>
      </div>

      {/* Main Playfield: Cross arrangement of revealed hands + Central Breakdown Modal */}
      <div className="flex-1 flex flex-col justify-between items-center py-1 relative z-10 max-w-[1020px] mx-auto w-full">
        {/* Partner Hand (Top) */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5 mb-1 bg-stone-900/85 px-3 py-0.5 rounded-full border border-stone-800 shadow">
            <span className="text-xs font-black text-amber-300 font-serif-vintage">
              {partnerName} (Compañero)
            </span>
          </div>
          <div className="flex gap-1.5">
            {hands.partner?.map((c, i) => (
              <SpanishCard key={c.id || i} card={c} size="md" className="shadow-xl" />
            ))}
          </div>
        </div>

        {/* Middle Row: Left Opponent Hand - Detailed Score Breakdown - Right Opponent Hand */}
        <div className="w-full flex items-center justify-between px-2 sm:px-6 my-1">
          {/* Left Opponent Hand (Oeste) */}
          <div className="flex flex-col items-center shrink-0">
            <div className="flex items-center gap-1.5 mb-1 bg-stone-900/85 px-2.5 py-0.5 rounded-full border border-stone-800 shadow">
              <span className="text-xs font-bold text-stone-200 font-serif-vintage truncate max-w-[90px]">
                {oppLeftName}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {hands.oppLeft?.map((c, i) => (
                <SpanishCard key={c.id || i} card={c} size="sm" className="shadow-lg" />
              ))}
            </div>
          </div>

          {/* =========================================================================
              CENTRAL DESGLOSE DEL TANTEO (EXHAUSTIVE HAND BREAKDOWN)
             ========================================================================= */}
          <div className="flex flex-col items-center flex-1 max-w-[480px] text-center mx-2 z-30">
            {/* Comic Speech Bubble Announcement */}
            <div className="comic-bubble comic-bubble-tail-bottom px-3 py-2 text-stone-950 shadow-2xl border-3 border-black bg-white mb-2 w-full">
              <p className="text-xs sm:text-sm font-black leading-tight text-stone-950">
                {showdownMessage || '¡Fin de la mano! Recuento oficial de amarracos:'}
              </p>
            </div>

            {/* Exhaustive Tanteo Breakdown Table */}
            <div className="bg-stone-950/95 border-3 border-stone-900 rounded-2xl p-2.5 text-xs text-amber-200 w-full space-y-1.5 shadow-2xl backdrop-blur-md">
              <div className="text-[11px] font-black uppercase text-amber-300 border-b-2 border-stone-800 pb-1 flex justify-between items-center">
                <span>Lance y Jugada</span>
                <span>Ganador y Piedras</span>
              </div>

              {breakdownDetails.length > 0 ? (
                breakdownDetails.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center border-b border-stone-800/80 pb-1 text-[11px]"
                  >
                    <div className="text-left">
                      <span className="font-black text-amber-100">{item.lance}: </span>
                      <span className="text-stone-300 text-[10px]">{item.explanation}</span>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span
                        className={`font-black px-1.5 py-0.5 rounded text-[10px] ${
                          item.winnerTeam === 1
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : item.winnerTeam === 2
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : 'bg-stone-800 text-stone-400 border border-stone-700'
                        }`}
                      >
                        {item.winnerTeam === 1
                          ? `Nosotros (+${item.stonesWon} p)`
                          : item.winnerTeam === 2
                          ? `Ellos (+${item.stonesWon} p)`
                          : 'Nadie (0 p)'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                /* Fallback if breakdown not populated yet */
                <>
                  <div className="flex justify-between border-b border-stone-800 pb-0.5">
                    <span className="font-bold">Grande:</span>
                    <span className="font-black text-white">
                      {lanceResults.GRANDE.winnerTeam === 1 ? 'Nosotros (+1 p)' : 'Ellos (+1 p)'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-stone-800 pb-0.5">
                    <span className="font-bold">Chica:</span>
                    <span className="font-black text-white">
                      {lanceResults.CHICA.winnerTeam === 1 ? 'Nosotros (+1 p)' : 'Ellos (+1 p)'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-stone-800 pb-0.5">
                    <span className="font-bold">Pares:</span>
                    <span className="font-black text-white">
                      {lanceResults.PARES.winnerTeam === 1 ? 'Nosotros (+2 p)' : 'Ellos (+2 p)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Juego / Punto:</span>
                    <span className="font-black text-white">
                      {lanceResults.JUEGO.winnerTeam === 1 ? 'Nosotros (+3 p)' : 'Ellos (+3 p)'}
                    </span>
                  </div>
                </>
              )}

              {/* Total hand stones summary bar */}
              <div className="pt-1 mt-1 border-t-2 border-stone-800 flex justify-between items-center text-[11px] font-black text-white">
                <span className="text-amber-300">Tanteo de esta mano:</span>
                <span className="text-amber-400 font-mono-numbers">
                  Nosotros: +{t1HandStones} p | Ellos: +{t2HandStones} p
                </span>
              </div>
            </div>
          </div>

          {/* Right Opponent Hand (Este) */}
          <div className="flex flex-col items-center shrink-0">
            <div className="flex items-center gap-1.5 mb-1 bg-stone-900/85 px-2.5 py-0.5 rounded-full border border-stone-800 shadow">
              <span className="text-xs font-bold text-stone-200 font-serif-vintage truncate max-w-[90px]">
                {oppRightName}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {hands.oppRight?.map((c, i) => (
                <SpanishCard key={c.id || i} card={c} size="sm" className="shadow-lg" />
              ))}
            </div>
          </div>
        </div>

        {/* Player Hand (Bottom) */}
        <div className="flex flex-col items-center">
          <div className="flex gap-2 mb-1">
            {hands.player?.map((c, i) => (
              <SpanishCard key={c.id || i} card={c} size="md" className="shadow-2xl ring-2 ring-amber-400" />
            ))}
          </div>
          <div className="flex items-center gap-1.5 bg-stone-900/85 px-3 py-0.5 rounded-full border border-stone-800 shadow">
            <span className="text-xs font-black text-amber-300 font-serif-vintage">
              {playerName ? `${playerName} (Tú)` : 'Tus Cartas (Jugador)'}
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer: Continuar button */}
      <div className="pt-2 border-t-2 border-stone-900 flex items-center justify-center z-20">
        <button
          onClick={onNextHand}
          disabled={totalConnectedHumans > 1 && myReadyForNextHand}
          className={`w-full max-w-[420px] min-h-[46px] rounded-2xl font-black text-sm uppercase tracking-wider shadow-2xl transition-transform border-3 border-stone-900 ${
            totalConnectedHumans > 1 && myReadyForNextHand
              ? 'bg-stone-700 text-amber-200 cursor-default'
              : 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 hover:from-amber-300 text-stone-950 active:scale-95 cursor-pointer'
          }`}
        >
          {totalConnectedHumans > 1
            ? myReadyForNextHand
              ? `Esperando jugadores (${readyNextHandCount}/${totalConnectedHumans})...`
              : `${justWonJuego ? 'Empezar Siguiente Juego' : 'Recoger Garbanzos y Continuar'} (${readyNextHandCount}/${totalConnectedHumans})`
            : justWonJuego
            ? 'Empezar Siguiente Juego 🎴'
            : 'Recoger Garbanzos y Continuar 🎴'}
        </button>
      </div>
    </div>
  );
};
