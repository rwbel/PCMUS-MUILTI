/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TorneoSheet.tsx - Libreta de puntuación del torneo
 *
 * Muestra el estado actual de la partida con estilo de libreta escolar:
 *   - Cabecera: "Torneo del Amarraco FEROZ" con sede (Bar Malasaña)
 *   - Tabla de tantos por equipo (módulo 40 piedras)
 *   - Estado de cada lance con flechas de progreso
 *   - Terminal retro estilo "Estado de Envite"
 *   - Puede mostrarse como modal flotante o embebido en la UI
 *
 * Es informativo: solo lectura, sin interacción de juego.
 */

import React from 'react';
import { LancePhase, LanceResult, TeamScore } from '../types/mus';

interface TorneoSheetProps {
  scoreTeam1: TeamScore;
  scoreTeam2: TeamScore;
  targetPiedras: number;
  lanceResults: Record<LancePhase, LanceResult>;
  currentLance: LancePhase | null;
  onClose?: () => void;
  isFloatingModal?: boolean;
}

export const TorneoSheet: React.FC<TorneoSheetProps> = ({
  scoreTeam1,
  scoreTeam2,
  lanceResults,
  currentLance,
  onClose,
  isFloatingModal = false
}) => {
  const lances: { key: LancePhase; label: string }[] = [
    { key: 'GRANDE', label: 'Grande' },
    { key: 'CHICA', label: 'Chica' },
    { key: 'PARES', label: 'Pares' },
    { key: 'JUEGO', label: 'Juego' }
  ];

  const getLanceStatusText = (l: LancePhase) => {
    const res = lanceResults[l];
    if (res.accepted) {
      return res.bet >= 40 ? 'Órdago visto' : `Ver ${res.bet}`;
    }
    if (res.resolvedByNoQuiero) {
      return `No quiero (+${res.pointsGivenImmediate || 1}p)`;
    }
    if (res.onlyTeamWithPares) {
      return res.onlyTeamWithPares === 1 ? 'Pares Nos.' : 'Pares Ellos';
    }
    if (res.onlyTeamWithJuego) {
      return res.onlyTeamWithJuego === 1 ? 'Juego Nos.' : 'Juego Ellos';
    }
    if (res.noPairs) {
      return 'Sin pares';
    }
    if (res.noJuego) {
      return 'Sin juego';
    }
    if (res.bet > 0) {
      return `Envido ${res.bet} (No)`;
    }
    if (currentLance === l) {
      return 'En juego...';
    }
    return 'En paso / Ninguno';
  };

  const sheetContent = (
    <div className="relative bg-[#fefce8] text-stone-900 rounded-2xl shadow-2xl border-2 border-stone-400 p-4 font-serif-vintage max-w-[340px] sm:max-w-[360px] mx-auto select-none overflow-hidden">
      {/* Notebook Perforated Spiral Edge (Authentic PC-Mus touch) */}
      <div className="absolute top-0 bottom-0 left-1 w-4 flex flex-col justify-around py-3 pointer-events-none">
        {Array.from({ length: 11 }).map((_, i) => (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-stone-900 border border-stone-700 shadow-inner -ml-1"
          />
        ))}
      </div>

      {/* Close button if modal */}
      {isFloatingModal && onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold flex items-center justify-center text-xs cursor-pointer z-20 shadow"
        >
          ✕
        </button>
      )}

      {/* Header Banner: Torneo del Amarraco FEROZ */}
      <div className="pl-4 pr-1">
        <div className="flex items-center justify-between border-b-2 border-red-800 pb-1 mb-2">
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-stone-950 uppercase leading-none">
              Torneo del
            </h2>
            <h1 className="text-lg sm:text-xl font-black tracking-wide text-red-700 font-serif-vintage uppercase">
              Amarraco FEROZ
            </h1>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 uppercase tracking-wider block">
              Semifinal
            </span>
            <span className="text-[9px] text-stone-600 block mt-0.5">
              Bar Malasaña
            </span>
          </div>
        </div>

        {/* Traditional PC-Mus Red Ruled Score Table */}
        <div className="border-2 border-red-700 rounded-lg overflow-hidden bg-white shadow-sm mb-3">
          <table className="w-full text-center text-xs">
            <thead>
              <tr className="bg-red-50 text-sky-800 font-bold border-b border-red-700">
                <th className="py-1 px-2 text-left font-mono text-[11px]"></th>
                <th className="py-1 px-2 border-l border-red-700 text-sky-700 font-black">
                  Nosotros
                </th>
                <th className="py-1 px-2 border-l border-red-700 text-sky-700 font-black">
                  Ellos
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-200 font-mono-numbers">
              <tr className="hover:bg-amber-50/50">
                <td className="py-1 px-2 text-left font-serif-vintage text-stone-900 font-bold">
                  Juegos (a 4)
                </td>
                <td className="py-1 px-2 border-l border-red-200 font-black text-stone-900">
                  {scoreTeam1.chicosWon} / 4
                </td>
                <td className="py-1 px-2 border-l border-red-200 font-black text-stone-900">
                  {scoreTeam2.chicosWon} / 4
                </td>
              </tr>
              <tr className="hover:bg-amber-50/50">
                <td className="py-1 px-2 text-left font-serif-vintage text-stone-900 font-bold">
                  Amarrakos
                </td>
                <td className="py-1 px-2 border-l border-red-200 font-black text-stone-900">
                  {Math.floor((scoreTeam1.piedras % 40) / 5)} / 8
                </td>
                <td className="py-1 px-2 border-l border-red-200 font-black text-stone-900">
                  {Math.floor((scoreTeam2.piedras % 40) / 5)} / 8
                </td>
              </tr>
              <tr className="bg-amber-100/60 font-bold">
                <td className="py-1 px-2 text-left font-serif-vintage text-red-900 font-black">
                  Tantos (Piedras)
                </td>
                <td className="py-1 px-2 border-l border-red-200 text-stone-950 font-black text-sm">
                  {scoreTeam1.piedras % 40} / 40
                </td>
                <td className="py-1 px-2 border-l border-red-200 text-stone-950 font-black text-sm">
                  {scoreTeam2.piedras % 40} / 40
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Lances connecting to Black Electronic Status Box (from pc-mus-circulo-asm-11.jpg) */}
        <div className="flex items-start gap-2 pt-1 border-t border-stone-300">
          {/* Lances list with connecting line anchors */}
          <div className="flex-1 space-y-1 text-xs font-bold">
            <div className="flex items-center justify-between text-blue-900">
              <span className="font-serif-vintage">Descartes</span>
              <span className="text-[10px] text-stone-500 font-mono">───►</span>
            </div>
            {lances.map(({ key, label }) => {
              const isCurrent = currentLance === key;
              return (
                <div
                  key={key}
                  className={`flex items-center justify-between px-1.5 py-0.5 rounded ${
                    isCurrent
                      ? 'bg-amber-300 border border-stone-800 text-stone-950 font-black shadow-sm'
                      : 'text-blue-900'
                  }`}
                >
                  <span className="font-serif-vintage">{label}</span>
                  <span className="text-[10px] text-stone-400 font-mono">───►</span>
                </div>
              );
            })}
          </div>

          {/* Retro Black Score Terminal (from image) */}
          <div className="w-36 bg-black text-emerald-400 font-mono text-[10px] p-2 rounded-lg border-2 border-stone-800 shadow-inner flex flex-col justify-between space-y-1">
            <div className="text-[8px] text-stone-500 uppercase font-sans border-b border-stone-800 pb-0.5">
              Estado de Envite
            </div>
            <div className="text-stone-300 truncate">
              Desc: <span className="text-amber-300">Listos</span>
            </div>
            {lances.map(({ key, label }) => {
              const isCurrent = currentLance === key;
              return (
                <div
                  key={key}
                  className={`truncate ${
                    isCurrent ? 'text-amber-300 font-bold' : 'text-stone-400'
                  }`}
                >
                  {label.slice(0, 3)}: {getLanceStatusText(key)}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-stone-300 flex items-center justify-between text-[9px] text-stone-600 font-sans">
          <span>Partida a 40 tantos</span>
          <span className="font-bold text-stone-800">Reglamento 8 Reyes / 8 Ases</span>
        </div>
      </div>
    </div>
  );

  if (isFloatingModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in">
        <div className="animate-in zoom-in-95">{sheetContent}</div>
      </div>
    );
  }

  return sheetContent;
};
