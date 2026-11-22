/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ThumbControlDrawer.tsx - Panel de controles táctiles (pulgar)
 *
 * Interfaz optimizada para móviles que se despliega desde abajo con:
 *   - Controles de descarte: seleccionar cartas para descartar y confirmar
 *   - Botones de voto MUS: ¡MUS! / NO HAY MUS
 *   - Botones de apuesta: Quiero, No Quiero, Reenvío, Órdago
 *   - Panel de señas tradicionales para pasar información al compañero
 *   - Mensajes de "Pensando jugada..." cuando no es turno del jugador
 *
 * Diseñado para ser usado con el pulgar en dispositivos móviles.
 */

import React, { useState } from 'react';
import { BetState, Card, GamePhase, LancePhase, MusSign } from '../types/mus';
import { AUTHENTIC_MUS_SIGNS, getSignAnimationClass } from '../utils/characters';
import { SpanishCard } from './SpanishCard';

interface ThumbControlDrawerProps {
  playerHand: Card[];
  gamePhase: GamePhase;
  currentLance: LancePhase | null;
  betState: BetState | null;
  isPlayerTurn: boolean;
  selectedDiscards: string[];
  onToggleDiscard: (cardId: string) => void;
  onConfirmDiscards: () => void;
  onAction: (action: 'mus' | 'no_mus' | 'paso' | 'envido' | 'reenvio' | 'quiero' | 'no_quiero' | 'ordago') => void;
  onSendSign: (sign: MusSign) => void;
  validSigns: string[];
  onOpenRules: () => void;
  onOpenScoreSheet?: () => void;
}

export const ThumbControlDrawer: React.FC<ThumbControlDrawerProps> = ({
  playerHand,
  gamePhase,
  betState,
  isPlayerTurn,
  selectedDiscards,
  onToggleDiscard,
  onConfirmDiscards,
  onAction,
  onSendSign,
  validSigns,
  onOpenScoreSheet
}) => {
  const [showSignsModal, setShowSignsModal] = useState(false);

  const isDiscardPhase = gamePhase === 'DISCARD';
  const isMusCheckPhase = gamePhase === 'MUS_CHECK';
  const isBettingPhase = gamePhase === 'LANCE_BETTING';

  const hasIncomingBet = betState && betState.currentBet > 0;
  const isFacingOrdago = betState?.isOrdago;

  return (
    <>
      {/* Floating High-Z-Index Modal for Señas (Authentic PC-Mus Signs) */}
      {showSignsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-[340px] bg-stone-900 border-2 border-amber-500 rounded-3xl p-4 shadow-2xl flex flex-col text-stone-100 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2 mb-2.5">
              <div>
                <h3 className="text-sm font-bold font-serif-vintage text-amber-300">
                  Pasar Seña Tradicional
                </h3>
                <p className="text-[10px] text-stone-400">
                  Transmite tu jugada a tu compañero (¡cuidado si te pillan!).
                </p>
              </div>
              <button
                onClick={() => setShowSignsModal(false)}
                className="w-7 h-7 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* List of 6 Authentic Mus Signs */}
            <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-0.5">
              {AUTHENTIC_MUS_SIGNS.map((sign) => {
                const isValid = validSigns.includes(sign.id);
                return (
                  <button
                    key={sign.id}
                    onClick={() => {
                      onSendSign(sign);
                      setShowSignsModal(false);
                    }}
                    className={`w-full min-h-[46px] p-2 rounded-2xl text-left border flex items-center gap-2.5 transition-all cursor-pointer ${
                      isValid
                        ? 'bg-amber-950/80 border-amber-500 hover:bg-amber-900 text-amber-100 ring-2 ring-amber-400/50 shadow-md'
                        : 'bg-stone-800/80 border-stone-700 hover:bg-stone-700 text-stone-300'
                    }`}
                  >
                    <span className={`text-2xl shrink-0 inline-block ${getSignAnimationClass(sign.id)}`}>{sign.icon}</span>
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
                          <span className="text-[8px] text-stone-500 italic">
                            Farol
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-400 block truncate mt-0.5">
                        {sign.meaning}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setShowSignsModal(false)}
              className="mt-3 w-full min-h-[40px] rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold cursor-pointer"
            >
              Cerrar sin pasar seña
            </button>
          </div>
        </div>
      )}

      {/* Main Bottom Area: Hands holding cards + Retro PC-Mus Console */}
      <div className="w-full shrink-0 bg-stone-950/95 border-t border-amber-600/50 rounded-t-3xl pt-1 pb-3 px-2 shadow-2xl backdrop-blur-md z-30">
        {/* Top Header Strip of Controls Drawer */}
        <div className="flex items-center justify-between w-full max-w-[380px] mx-auto px-1 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-black text-amber-300 font-serif-vintage uppercase tracking-wide">
              Tus Cartas
            </span>
            {isDiscardPhase && (
              <span className="text-[9px] text-amber-400 font-semibold animate-pulse">
                (Toca las que quieras cambiar)
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenScoreSheet && (
              <button
                onClick={onOpenScoreSheet}
                className="min-h-[26px] px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 border border-stone-700 bg-stone-900 text-stone-300 hover:text-white cursor-pointer shadow-sm active:scale-95"
                title="Ver Libreta de Torneo y Tanteo"
              >
                <span>📋 Libreta</span>
              </button>
            )}

            <button
              onClick={() => setShowSignsModal(true)}
              className="min-h-[26px] px-2.5 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1 border border-emerald-500/60 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900 cursor-pointer shadow-sm active:scale-95"
            >
              <span>Señas</span>
              {validSigns.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              )}
            </button>
          </div>
        </div>

        {/* First-Person POV: Illustrated Hands holding the 4 cards upright (PC-Mus style) */}
        <div className="relative flex justify-center items-end py-0.5 max-w-[380px] mx-auto">
          {/* Left Thumb holding the cards */}
          <div className="absolute -bottom-1 left-2 sm:left-6 z-20 pointer-events-none flex flex-col items-center opacity-85">
            <div className="w-5 h-7 rounded-t-full bg-[#fbcfe8] border-2 border-stone-800 shadow-md transform -rotate-12" />
            <div className="w-7 h-4 bg-[#f472b6] rounded-full border-t border-stone-800 -mt-1" />
          </div>

          {/* Cards Spread */}
          <div className="flex justify-center -space-x-1 sm:space-x-1 z-10">
            {playerHand.map((card, idx) => {
              const isSelected = selectedDiscards.includes(card.id);
              // Slight fan rotation like holding cards in hand
              const rotation = (idx - 1.5) * 3;
              return (
                <div
                  key={card.id}
                  style={{
                    transform: `rotate(${rotation}deg) translateY(${isSelected ? '-12px' : '0px'})`,
                    transition: 'transform 0.15s ease'
                  }}
                >
                  <SpanishCard
                    card={card}
                    selected={isSelected}
                    onClick={() => {
                      if (isDiscardPhase) {
                        onToggleDiscard(card.id);
                      }
                    }}
                    size="md"
                  />
                </div>
              );
            })}
          </div>

          {/* Right Thumb holding the cards */}
          <div className="absolute -bottom-1 right-2 sm:right-6 z-20 pointer-events-none flex flex-col items-center opacity-85">
            <div className="w-5 h-7 rounded-t-full bg-[#fbcfe8] border-2 border-stone-800 shadow-md transform rotate-12" />
            <div className="w-7 h-4 bg-[#f472b6] rounded-full border-t border-stone-800 -mt-1" />
          </div>
        </div>

        {/* Action Controls Section: Retro PC-Mus Console */}
        <div className="w-full max-w-[380px] mx-auto mt-1">
          {/* Phase 1: Discard Controls */}
          {isDiscardPhase && (
            <div className="flex gap-1.5">
              <button
                onClick={onConfirmDiscards}
                className="flex-1 min-h-[44px] rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 text-stone-950 font-black text-xs shadow-md active:scale-[0.98] transition-transform cursor-pointer flex items-center justify-center gap-1.5 border border-amber-300"
              >
                <span>Descartar ({selectedDiscards.length})</span>
                <span className="text-base">🎴</span>
              </button>
              <button
                onClick={onConfirmDiscards}
                className="min-h-[44px] px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold active:scale-[0.98] transition-transform cursor-pointer border border-stone-600"
              >
                Servido / Paso
              </button>
            </div>
          )}

          {/* Phase 2: Mus Check Controls */}
          {isMusCheckPhase && isPlayerTurn && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onAction('mus')}
                className="min-h-[46px] rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 text-stone-950 font-black text-sm shadow-lg active:scale-[0.98] transition-transform cursor-pointer border-2 border-emerald-300 flex items-center justify-center gap-1"
              >
                <span>🌱</span>
                <span>¡MUS!</span>
              </button>
              <button
                onClick={() => onAction('no_mus')}
                className="min-h-[46px] rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-400 text-stone-950 font-black text-sm shadow-lg active:scale-[0.98] transition-transform cursor-pointer border-2 border-amber-300 flex items-center justify-center gap-1"
              >
                <span>✋</span>
                <span>NO HAY MUS</span>
              </button>
            </div>
          )}

          {/* Phase 3: Lance Bidding Controls (Authentic PC-Mus Trapezoidal Console layout) */}
          {isBettingPhase && isPlayerTurn && (
            <div className="flex flex-col gap-1 select-none">
              {!hasIncomingBet ? (
                /* No incoming bet on table: Paso, Envido, Órdago console */
                <div className="bg-stone-900/90 p-1 rounded-xl border border-stone-700 shadow-md">
                  <div className="grid grid-cols-2 gap-1 mb-1">
                    <button
                      onClick={() => onAction('paso')}
                      className="min-h-[40px] rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-100 font-extrabold text-xs shadow-sm active:scale-[0.98] transition-transform cursor-pointer border-2 border-stone-600 flex items-center justify-center gap-1.5"
                    >
                      <span>👞</span>
                      <span>Paso</span>
                    </button>
                    <button
                      onClick={() => onAction('envido')}
                      className="min-h-[40px] rounded-lg bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs shadow-md active:scale-[0.98] transition-transform cursor-pointer border-2 border-amber-200 flex items-center justify-center gap-1"
                    >
                      <span>2</span>
                      <span>Envido</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => onAction('reenvio')}
                      className="min-h-[36px] rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs shadow-sm active:scale-[0.98] transition-transform cursor-pointer border border-amber-300 flex items-center justify-center gap-1"
                    >
                      <span>Cinco (5)</span>
                    </button>
                    <button
                      onClick={() => onAction('ordago')}
                      className="min-h-[36px] rounded-lg bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 text-white font-black text-xs tracking-wider shadow-md animate-ordago active:scale-[0.98] transition-transform cursor-pointer border-2 border-red-300 flex items-center justify-center gap-1"
                    >
                      <span>🔥</span>
                      <span>ÓRDAGO</span>
                    </button>
                  </div>
                </div>
              ) : isFacingOrdago ? (
                /* Facing ÓRDAGO console */
                <div className="grid grid-cols-2 gap-2 bg-rose-950/80 p-1.5 rounded-xl border-2 border-rose-500 shadow-xl">
                  <button
                    onClick={() => onAction('quiero')}
                    className="min-h-[48px] rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 text-white font-black text-xs shadow-xl ring-2 ring-rose-300 active:scale-[0.98] transition-transform cursor-pointer border-2 border-white flex items-center justify-center gap-1"
                  >
                    <span>🤝</span>
                    <span>¡QUIERO EL ÓRDAGO!</span>
                  </button>
                  <button
                    onClick={() => onAction('no_quiero')}
                    className="min-h-[48px] rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs active:scale-[0.98] transition-transform cursor-pointer border-2 border-stone-600 flex items-center justify-center gap-1"
                  >
                    <span>👞</span>
                    <span>No Quiero</span>
                  </button>
                </div>
              ) : (
                /* Facing standard Envite (Quiero, No Quiero, Reenvío, Órdago) */
                <div className="bg-stone-900/90 p-1 rounded-xl border border-stone-700 shadow-md">
                  <div className="grid grid-cols-2 gap-1 mb-1">
                    <button
                      onClick={() => onAction('quiero')}
                      className="min-h-[42px] rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs shadow-md active:scale-[0.98] transition-transform cursor-pointer border-2 border-emerald-200 flex items-center justify-center gap-1"
                    >
                      <span>🤝</span>
                      <span>Quiero ({betState.currentBet})</span>
                    </button>
                    <button
                      onClick={() => onAction('no_quiero')}
                      className="min-h-[42px] rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 font-extrabold text-xs active:scale-[0.98] transition-transform cursor-pointer border-2 border-stone-600 flex items-center justify-center gap-1"
                    >
                      <span>👞</span>
                      <span>No Quiero</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => onAction('reenvio')}
                      className="min-h-[36px] rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs active:scale-[0.98] transition-transform cursor-pointer border border-amber-300"
                    >
                      Reenvío (+2)
                    </button>
                    <button
                      onClick={() => onAction('ordago')}
                      className="min-h-[36px] rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-black text-xs active:scale-[0.98] transition-transform cursor-pointer border border-rose-300 flex items-center justify-center gap-1"
                    >
                      <span>🔥</span>
                      <span>ÓRDAGO</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Waiting for other players message */}
          {!isPlayerTurn && (isMusCheckPhase || isBettingPhase) && (
            <div className="min-h-[38px] flex items-center justify-center text-center px-3 py-1 rounded-xl bg-stone-900/80 border border-stone-700 text-amber-200 text-xs font-semibold">
              <span className="animate-pulse">Pensando jugada... ↺</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
