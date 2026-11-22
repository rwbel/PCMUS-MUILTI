/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CharactersModal.tsx - Modal de selección de personajes
 *
 * Permite al jugador elegir su compañero y/o rivales antes de empezar:
 *   - Lista de 8 personajes castizos con avatar, título y descripción
 *   - Filtro por género: Todos, Mujeres, Hombres
 *   - Indicador de estilo de juego: Prudente, Equilibrado, Agresivo, Farolero
 *   - Muestra una cita de ejemplo de cada personaje
 *   - Excluye al camarero (Manolo) de los seleccionables
 *
 * Los personajes afectan las voces, tendencias de IA y citas durante la partida.
 */

import React, { useState } from 'react';
import { Character } from '../types/mus';
import { CHARACTERS } from '../utils/characters';

interface CharactersModalProps {
  currentPartnerId: string;
  oppLeftId?: string;
  oppRightId?: string;
  onSelectPartner: (id: string) => void;
  onSelectOpponents?: (leftId: string, rightId: string) => void;
  onClose: () => void;
}

export const CharactersModal: React.FC<CharactersModalProps> = ({
  currentPartnerId,
  oppLeftId = 'guardia',
  oppRightId = 'tuno',
  onSelectPartner,
  onSelectOpponents,
  onClose
}) => {
  const [filterGender, setFilterGender] = useState<'all' | 'female' | 'male'>('all');

  // Filter out the barkeep NPC from playable roster
  const playableCharacters = Object.values(CHARACTERS).filter(
    (c: Character) => c.id !== 'camarero'
  );

  const filtered = playableCharacters.filter(c => {
    if (filterGender === 'female') return c.gender === 'female';
    if (filterGender === 'male') return c.gender === 'male';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
      <div className="relative w-full max-w-lg max-h-[90vh] bg-stone-900 border-3 border-amber-600/70 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col overflow-hidden text-stone-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-stone-800 pb-3 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black font-serif-vintage text-amber-300">
                Parroquia del Bar: Elige tu Compañero
              </h2>
              <span className="text-[10px] bg-amber-400 text-stone-950 font-black px-2 py-0.5 rounded-full">
                50/50 Hombres y Mujeres
              </span>
            </div>
            <p className="text-[11px] text-stone-300 mt-0.5">
              8 personajes castizos españoles con estilos de juego, voces y chascarrillos propios.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-200 flex items-center justify-center cursor-pointer border border-stone-700 font-bold"
          >
            ✕
          </button>
        </div>

        {/* Gender Filter Tabs */}
        <div className="flex gap-1.5 mb-3 bg-stone-950 p-1 rounded-xl border border-stone-800">
          <button
            onClick={() => setFilterGender('all')}
            className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterGender === 'all'
                ? 'bg-amber-500 text-stone-950 shadow'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            Todos (8)
          </button>
          <button
            onClick={() => setFilterGender('female')}
            className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterGender === 'female'
                ? 'bg-rose-500 text-white shadow'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            ♀ Mujeres (4)
          </button>
          <button
            onClick={() => setFilterGender('male')}
            className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterGender === 'male'
                ? 'bg-sky-600 text-white shadow'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            ♂ Hombres (4)
          </button>
        </div>

        {/* Characters List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filtered.map((char: Character) => {
            const isPartner = char.id === currentPartnerId;
            const isOppLeft = char.id === oppLeftId;
            const isOppRight = char.id === oppRightId;

            return (
              <div
                key={char.id}
                onClick={() => onSelectPartner(char.id)}
                className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-3 ${
                  isPartner
                    ? 'bg-amber-950/70 border-amber-400 shadow-xl ring-2 ring-amber-400/80'
                    : 'bg-stone-800/80 border-stone-700 hover:bg-stone-800 hover:border-stone-600'
                }`}
              >
                {/* Avatar with pixel art border */}
                <div className="relative shrink-0">
                  <img
                    src={char.avatar}
                    alt={char.name}
                    className="w-16 h-16 rounded-xl object-cover border-2 border-stone-900 shadow-lg"
                  />
                  <span
                    className={`absolute -bottom-1.5 -right-1 text-[9px] font-black px-1.5 py-0.2 rounded-full border border-stone-900 ${
                      char.gender === 'female'
                        ? 'bg-rose-500 text-white'
                        : 'bg-sky-500 text-white'
                    }`}
                  >
                    {char.gender === 'female' ? '♀' : '♂'}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-amber-100 font-serif-vintage truncate">
                      {char.name}
                    </span>
                    {isPartner && (
                      <span className="text-[10px] font-black text-stone-950 bg-gradient-to-r from-amber-300 to-amber-500 px-2 py-0.5 rounded-full border border-stone-900 shadow">
                        ★ TU COMPAÑERO
                      </span>
                    )}
                    {isOppLeft && !isPartner && (
                      <span className="text-[10px] font-bold text-sky-200 bg-sky-950 px-2 py-0.5 rounded-full border border-sky-800">
                        Rival Izq.
                      </span>
                    )}
                    {isOppRight && !isPartner && (
                      <span className="text-[10px] font-bold text-red-200 bg-red-950 px-2 py-0.5 rounded-full border border-red-800">
                        Rival Der.
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-bold text-amber-300 block">
                    {char.title} · Estilo: {char.tendency === 'bluffer' ? '🃏 Farolero' : char.tendency === 'aggressive' ? '🔥 Agresivo' : char.tendency === 'conservative' ? '🛡️ Prudente' : '⚖️ Equilibrado'}
                  </span>

                  <p className="text-[11px] text-stone-300 leading-snug line-clamp-2 mt-0.5">
                    {char.description}
                  </p>

                  {/* Sample quote */}
                  <p className="text-[10px] text-amber-200/80 italic mt-1 truncate">
                    &ldquo;{char.quotes.envido[0]}&rdquo;
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t-2 border-stone-800 mt-2">
          <button
            onClick={onClose}
            className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 hover:from-amber-300 text-stone-950 font-black text-xs uppercase tracking-wider cursor-pointer transition-transform active:scale-98 border-2 border-stone-900 shadow-xl"
          >
            Listo para Jugar
          </button>
        </div>
      </div>
    </div>
  );
};
