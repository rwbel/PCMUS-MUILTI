/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DrinksModal.tsx - Modal de consumiciones de la taberna
 *
 * Permite al jugador pedir bebidas y tapas que afectan su sobriedad:
 *   - Bebidas con alcohol: caña, vino, carajillo (+alcohol)
 *   - Bebidas con cafeína: café solo (+cafeína)
 *   - Remedios: agua del grifo (-alcohol, -cafeína), gilda (-alcohol)
 *   - Cada consumición tiene precio y líneas de diálogo del camarero Manolo
 *
 * El estado de sobriedad (alcohol/cafeína 0-5) afecta:
 *   - Las expresiones faciales de los personajes
 *   - Los consejos de estrategia del compañero (borracho = faroles, cafeinado = nervioso)
 *   - Los comentarios de voz durante la partida
 */

import React from 'react';
import { DrinkId, DrinkItem, PlayerSobrietyState } from '../types/mus';
import { getAlcoholEffectInfo, getCaffeineEffectInfo, TAVERN_DRINKS } from '../utils/drinks';

interface DrinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  sobriety: PlayerSobrietyState;
  onOrderDrink: (drink: DrinkItem) => void;
  canOrderThisHand?: boolean;
  orderDisabledReason?: string;
  pendingDrink?: DrinkItem | null;
}

export const DrinksModal: React.FC<DrinksModalProps> = ({
  isOpen,
  onClose,
  sobriety,
  onOrderDrink,
  canOrderThisHand = true,
  orderDisabledReason,
  pendingDrink = null
}) => {
  if (!isOpen) return null;

  const alcoholInfo = getAlcoholEffectInfo(sobriety.alcohol);
  const caffeineInfo = getCaffeineEffectInfo(sobriety.caffeine);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-[#1c1917] border-4 border-[#78350f] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Retro Tavern Wooden Header Bar */}
        <div className="bg-gradient-to-r from-[#451a03] via-[#78350f] to-[#451a03] px-4 py-3 border-b-3 border-stone-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🍺</span>
            <div>
              <h2 className="text-base sm:text-lg font-black font-serif-vintage tracking-wider text-amber-200 uppercase">
                Tu Consumición en la Barra
              </h2>
              <p className="text-[10px] text-amber-300/80 font-bold">
                Atiende Manolo tras la barra · Cada jugador pide lo suyo
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-950/80 border-2 border-amber-500/60 text-amber-300 font-black hover:bg-red-800 hover:text-white transition-all flex items-center justify-center cursor-pointer shadow-md"
            title="Cerrar carta"
          >
            ✕
          </button>
        </div>

        {/* Sobriety Gauges Bar (Alcohol & Caffeine Status) */}
        <div className="bg-stone-900/90 border-b-2 border-stone-800 px-4 py-2.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Alcohol Gauge */}
          <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🍺</span>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-amber-300">Alcohol</span>
                  <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full border ${alcoholInfo.badgeColor}`}>
                    {alcoholInfo.title}
                  </span>
                </div>
                <p className="text-[10px] text-stone-400 mt-0.5 leading-tight">
                  {alcoholInfo.desc}
                </p>
              </div>
            </div>

            {/* 5-Pip Meter */}
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <div
                  key={`alc-${lvl}`}
                  className={`w-3 h-5 rounded-xs border border-stone-900 transition-all ${
                    lvl <= sobriety.alcohol
                      ? lvl >= 4
                        ? 'bg-rose-600 shadow-[0_0_6px_rgba(225,29,72,0.8)]'
                        : 'bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.6)]'
                      : 'bg-stone-800'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Caffeine Gauge */}
          <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">☕</span>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-cyan-300">Cafeína</span>
                  <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full border ${caffeineInfo.badgeColor}`}>
                    {caffeineInfo.title}
                  </span>
                </div>
                <p className="text-[10px] text-stone-400 mt-0.5 leading-tight">
                  {caffeineInfo.desc}
                </p>
              </div>
            </div>

            {/* 5-Pip Meter */}
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <div
                  key={`caf-${lvl}`}
                  className={`w-3 h-5 rounded-xs border border-stone-900 transition-all ${
                    lvl <= sobriety.caffeine
                      ? lvl >= 4
                        ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]'
                        : 'bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,0.6)]'
                      : 'bg-stone-800'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Pending drink / hand ordering rule banner */}
        {(pendingDrink || !canOrderThisHand) && (
          <div className="bg-amber-950/70 border-b border-amber-700/60 px-4 py-2 text-xs text-amber-200 flex items-center justify-between gap-2">
            {pendingDrink ? (
              <span>
                {pendingDrink.icon} <strong>Pedido en barra:</strong> {pendingDrink.name} ·{' '}
                <span className="text-amber-300 font-semibold">hará efecto en cuanto se corte el mus</span>
              </span>
            ) : (
              <span>
                ⏳ {orderDisabledReason || 'En mitad de la mano no se piden consumiciones · Espera al comienzo de la siguiente mano.'}
              </span>
            )}
          </div>
        )}

        {/* Drinks Grid */}
        <div className="p-4 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[radial-gradient(ellipse_at_top,_#292524_0%,_#0c0a09_100%)]">
          {TAVERN_DRINKS.map((drink) => {
            return (
              <div
                key={drink.id}
                className="group bg-stone-900/90 border-2 border-stone-700/80 hover:border-amber-500 rounded-xl p-3 flex flex-col justify-between shadow-lg transition-all hover:shadow-amber-950/30 hover:-translate-y-0.5"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl sm:text-3xl p-1 rounded-lg bg-stone-950 border border-stone-800 group-hover:scale-110 transition-transform">
                        {drink.icon}
                      </span>
                      <div>
                        <h3 className="text-xs sm:text-sm font-black text-stone-100 group-hover:text-amber-300 transition-colors">
                          {drink.name}
                        </h3>
                        <p className="text-[10px] text-stone-400 font-semibold italic">
                          {drink.shortDesc}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-black text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-600/40">
                      {drink.priceTag}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-stone-950 border border-stone-700 text-stone-300">
                      {drink.effectDesc}
                    </span>
                  </div>
                </div>

                <button
                  disabled={!canOrderThisHand}
                  onClick={() => {
                    if (!canOrderThisHand) return;
                    onOrderDrink(drink);
                    onClose();
                  }}
                  className={`mt-3 w-full py-1.5 px-3 rounded-lg font-black text-xs border flex items-center justify-center gap-1.5 transition-all ${
                    canOrderThisHand
                      ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 active:scale-98 text-stone-950 border-amber-400 shadow-md cursor-pointer'
                      : 'bg-stone-800 text-stone-500 border-stone-700 cursor-not-allowed opacity-70'
                  }`}
                >
                  <span>
                    {canOrderThisHand ? 'Pedir para mí' : 'Disponible en la siguiente mano'}
                  </span>
                  {canOrderThisHand && <span>➜</span>}
                </button>
              </div>
            );
          })}
        </div>

        {/* Vintage Tavern Footer Info */}
        <div className="bg-stone-950 px-4 py-2 border-t-2 border-stone-800 flex items-center justify-between text-[10px] text-stone-400">
          <div className="flex items-center gap-1.5">
            <span className="text-amber-400">💡</span>
            <span>
              <strong>Consejo de Manolo:</strong> Si te pasas con las cañas y ves reyes de más, pídete un vaso de agua o una gilda para recuperar el tino.
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold rounded text-xs border border-stone-600 cursor-pointer"
          >
            Volver al tapete
          </button>
        </div>
      </div>
    </div>
  );
};
