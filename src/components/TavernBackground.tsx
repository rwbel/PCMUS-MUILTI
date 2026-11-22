/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TavernBackground.tsx - Fondo decorativo de la taberna
 *
 * Escena estática de fondo con elementos interactivos y decorativos:
 *   - Pared de taberna con lámparas colgantes y luz cálida
 *   - Camarero Manolo detrás de la barra con pastel (clickeable para comentarios)
 *   - Jukebox/gigola para encender/apagar la música jazz (clickeable)
 *   - Cartel del torneo y tabla de puntuación
 *   - Puerta de servicios y diana en la pared
 *   - Burbuja de diálogo del camarero cuando habla
 *
 * Los elementos clickeables notifican al padre mediante callbacks.
 */

import React from 'react';
import { PlayerSpeech } from '../types/mus';

interface TavernBackgroundProps {
  onWaiterClick?: () => void;
  onJukeboxClick?: () => void;
  onTorneoPosterClick?: () => void;
  waiterSpeech?: PlayerSpeech | null;
  isMusicPlaying?: boolean;
}

export const TavernBackground: React.FC<TavernBackgroundProps> = ({
  onWaiterClick,
  onJukeboxClick,
  onTorneoPosterClick,
  waiterSpeech,
  isMusicPlaying = false
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
      {/* Warm Tavern Wall (Yellow/ochre cartoon tint as in PC-Mus) */}
      <div className="absolute inset-0 bg-[#eab308]/20 bg-gradient-to-b from-[#ca8a04]/40 via-stone-900/80 to-stone-950" />

      {/* Ceiling Hanging Lamps with Warm Light Cones */}
      <div className="absolute top-0 inset-x-0 flex justify-around px-4 pointer-events-none z-10">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center">
            {/* Cord */}
            <div className="w-0.5 h-3 bg-stone-700" />
            {/* Lamp shade */}
            <div className="w-8 h-3.5 bg-gradient-to-b from-stone-600 to-stone-800 rounded-t-lg border border-stone-500 shadow-md relative">
              {/* Glowing bulb */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.9)] animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Background Decor Layer (Pointer events enabled for interactive items) */}
      <div className="absolute top-2 inset-x-0 h-28 sm:h-32 flex justify-between px-2 sm:px-6 pointer-events-auto">
        {/* Left Side: Bar Counter + Bartender Manolo holding hot pie */}
        <div className="relative flex items-end">
          {/* Waiter speech bubble (PC-Mus style "Vaya presencia de pastel, vaya presencia") */}
          {waiterSpeech && (
            <div className="absolute -top-7 left-12 z-40 transition-all pointer-events-none animate-in fade-in zoom-in-95">
              <div className="comic-bubble comic-bubble-tail-bottom px-2.5 py-1 min-w-[120px] max-w-[170px] text-stone-950 shadow-2xl">
                <p className="text-[10px] sm:text-[11px] font-black leading-tight text-stone-950">
                  {waiterSpeech.text}
                </p>
              </div>
            </div>
          )}

          {/* Bartender & Counter */}
          <button
            onClick={onWaiterClick}
            className="group flex flex-col items-center cursor-pointer transition-transform hover:scale-105 active:scale-95"
            title="Toca al camarero Manolo para escuchar un chascarrillo"
          >
            {/* Waiter Figure */}
            <div className="relative flex items-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-stone-900 bg-amber-100 shadow-lg relative">
                {/* Cartoon Waiter Avatar (Manolo) */}
                <div className="w-full h-full bg-[#fde047] flex flex-col items-center justify-center relative">
                  {/* Hair & Face */}
                  <div className="w-8 h-8 rounded-full bg-[#fde68a] border border-stone-800 flex flex-col items-center justify-center relative">
                    {/* Mustache */}
                    <div className="w-4 h-1.5 bg-stone-900 rounded-full mt-1.5" />
                    {/* Nose */}
                    <div className="w-2 h-2.5 bg-[#f59e0b] rounded-full -mt-2.5 border border-stone-800" />
                    {/* Eyes */}
                    <div className="flex gap-1 -mt-3">
                      <div className="w-1 h-1 rounded-full bg-stone-900" />
                      <div className="w-1 h-1 rounded-full bg-stone-900" />
                    </div>
                  </div>
                  {/* White shirt with red collar */}
                  <div className="w-8 h-3 bg-white border-t-2 border-red-600 rounded-t -mt-1" />
                </div>
              </div>

              {/* Plate with smoking hot pastel / pie */}
              <div className="relative -ml-2 -mt-1">
                {/* Animated Steam */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-0.5 pointer-events-none">
                  <span className="text-[10px] animate-pie-steam select-none text-white/80">~</span>
                  <span className="text-[8px] animate-pie-steam select-none text-white/70" style={{ animationDelay: '0.4s' }}>~</span>
                </div>
                {/* Pastel */}
                <div className="w-7 h-4 bg-amber-600 rounded-full border border-amber-800 shadow flex items-center justify-center">
                  <div className="w-5 h-2 bg-amber-400 rounded-full border-t border-amber-300" />
                </div>
              </div>
            </div>

            {/* Wooden Bar Counter with Chrome Rail */}
            <div className="w-20 sm:w-24 h-5 bg-gradient-to-r from-amber-800 to-amber-900 border-t-2 border-amber-500 rounded-t shadow-md relative -mt-1">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-stone-300 via-white to-stone-300 shadow-sm" />
            </div>
          </button>
        </div>

        {/* Center Decor: Yellow Torneo Poster + Restroom Door */}
        <div className="flex items-center gap-2 sm:gap-4 self-center">
          {/* Torneo Poster (Clickable to open Torneo sheet) */}
          <button
            onClick={onTorneoPosterClick}
            className="w-11 sm:w-14 h-14 bg-gradient-to-b from-[#fef08a] to-[#fde047] border-2 border-stone-800 rounded p-1 shadow-md hover:scale-105 active:scale-95 transition-transform cursor-pointer text-left flex flex-col justify-between"
            title="Abrir Libreta del Torneo y Tanteo"
          >
            <div className="text-[7px] sm:text-[8px] font-black uppercase text-red-700 tracking-tighter leading-none border-b border-red-800/40 pb-0.5">
              TORNEO
            </div>
            <div className="space-y-0.5">
              <div className="w-full h-0.5 bg-red-600/50" />
              <div className="w-4/5 h-0.5 bg-red-600/50" />
              <div className="w-full h-0.5 bg-red-600/50" />
            </div>
            <span className="text-[6px] font-bold text-stone-800 block text-center">
              TABLA 📋
            </span>
          </button>

          {/* Wooden WC Restroom Door (from screenshot) */}
          <div className="w-9 sm:w-11 h-16 bg-[#b45309] border-2 border-stone-900 rounded-t flex flex-col items-center justify-between p-1 shadow-md opacity-80">
            {/* WC Man/Woman Icon */}
            <div className="w-4 h-4 bg-white/90 border border-stone-800 rounded-sm flex items-center justify-center text-[8px]">
              🚹
            </div>
            {/* Door handle */}
            <div className="self-end w-1.5 h-1 bg-stone-300 border border-stone-600 rounded-sm mb-4 mr-0.5" />
          </div>
        </div>

        {/* Right Side: Retro Neon Jukebox + Dartboard */}
        <div className="flex items-end gap-1.5 sm:gap-2">
          {/* Retro Jukebox (Clickable to toggle music) */}
          <button
            onClick={onJukeboxClick}
            className="flex flex-col items-center cursor-pointer transition-transform hover:scale-105 active:scale-95"
            title="Gramola / Jukebox: Toca para encender o apagar la música jazz"
          >
            {/* Musical notes if playing */}
            {isMusicPlaying && (
              <span className="text-xs text-amber-300 animate-bounce leading-none mb-0.5">
                ♪ ♫
              </span>
            )}
            <div className="w-11 sm:w-13 h-16 sm:h-18 rounded-t-2xl bg-gradient-to-b from-[#0284c7] via-[#0369a1] to-[#075985] border-2 border-stone-900 shadow-xl p-1 flex flex-col justify-between items-center relative overflow-hidden">
              {/* Neon Arch */}
              <div className="w-8 h-4 rounded-t-full border-2 border-amber-300/80 bg-cyan-900/60 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
              {/* Speaker grill */}
              <div className="w-full space-y-0.5 px-1">
                <div className="w-full h-0.5 bg-black/60 rounded" />
                <div className="w-full h-0.5 bg-black/60 rounded" />
                <div className="w-full h-0.5 bg-black/60 rounded" />
              </div>
              <span className="text-[6px] text-amber-200 font-mono font-bold tracking-tighter">
                {isMusicPlaying ? 'JAZZ ON' : 'ROCKOLA'}
              </span>
            </div>
          </button>

          {/* Dartboard / Diana on Wall (Concentric yellow/red rings from screenshot) */}
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-stone-900 bg-gradient-to-tr from-red-600 via-amber-400 to-amber-500 shadow-md flex items-center justify-center p-0.5 opacity-80 mb-2">
            <div className="w-5 h-5 rounded-full border border-stone-800 bg-amber-200 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-red-700" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
