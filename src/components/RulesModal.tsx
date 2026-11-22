/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * RulesModal.tsx - Reglamento Oficial de Mus (Bizkaia)
 *
 * Muestra las reglas del juego en un modal scrollable con secciones:
 *   - Normas generales: partida a 4 juegos, 40 piedras, prioridad de Mano
 *   - Baraja de 8 Reyes y 8 Ases (3=Rey, 2=As)
 *   - Los 4 lances: Grande, Chica, Pares, Juego/Punto con jerarquías
 *   - Señas tradicionales con iconos y significados
 *   - El Órdago: apuesta del juego completo en un solo lance
 *
 * Basado en el Reglamento Oficial de Mus de Bizkaia y Txapeldunes.
 */

import React from 'react';
import { AUTHENTIC_MUS_SIGNS } from '../utils/characters';

interface RulesModalProps {
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-md max-h-[85vh] bg-stone-900 border border-amber-600/40 rounded-3xl p-5 shadow-2xl flex flex-col overflow-hidden text-stone-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎴</span>
            <h2 className="text-lg font-bold font-serif-vintage text-amber-300">
              Reglamento Oficial de Mus (Bizkaia y Txapeldunes)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs text-stone-300 leading-relaxed">
          {/* Normas Generales Bizkaia */}
          <section className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-3">
            <h3 className="text-sm font-bold text-emerald-300 font-serif-vintage mb-1 flex items-center gap-1.5">
              <span>🏆</span> Normas Oficiales de Bizkaia
            </h3>
            <ul className="list-disc list-inside space-y-1 text-stone-300 text-[11px]">
              <li><strong>Partida a 4 JUEGOS:</strong> Cada juego se compone de 8 amarrakos (40 piedras).</li>
              <li><strong>Prioridad de Mano:</strong> En empates ganan las 31 de mano, los duples con par mayor (o de mano), y la grande/chica de mano.</li>
              <li><strong>Descarte obligatorio:</strong> Ningún jugador puede quedarse con las 4 cartas, obligado pedir mínimo una (Art. IV).</li>
              <li><strong>1ª Mano sin señas:</strong> Arranca con Mus corrido y sin señas; quien corta se convierte en la Mano.</li>
              <li><strong>"La boca hace ley":</strong> Nunca se puede mentir al cantar cartas o pares.</li>
            </ul>
          </section>

          {/* 8 Reyes y 8 Ases */}
          <section className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-3">
            <h3 className="text-sm font-bold text-amber-200 font-serif-vintage mb-1 flex items-center gap-1.5">
              <span>👑</span> Baraja de 8 Reyes y 8 Ases
            </h3>
            <p className="text-stone-300 text-[11px]">
              Se juega con 40 cartas de la baraja española tradicional:
            </p>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-stone-300 text-[11px]">
              <li><strong className="text-amber-400">Los 3 equivalen a Reyes:</strong> valor 10 y jerarquía máxima.</li>
              <li><strong className="text-sky-300">Los 2 equivalen a Ases:</strong> valor 1 y jerarquía mínima.</li>
            </ul>
          </section>

          {/* Los 4 Lances */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-amber-200 font-serif-vintage">
              Los 4 Lances del Mus Oficial
            </h3>
            
            <div className="bg-stone-800/60 p-2.5 rounded-xl border border-stone-700">
              <strong className="text-amber-400 block mb-0.5">1. La Grande</strong>
              Gana la mejor combinación de cartas más altas (Reyes &gt; Caballos &gt; Sotas &gt; 7 &gt; 6...).
            </div>

            <div className="bg-stone-800/60 p-2.5 rounded-xl border border-stone-700">
              <strong className="text-amber-400 block mb-0.5">2. La Chica</strong>
              Gana la mejor combinación de cartas más bajas (Ases/2 &gt; 4 &gt; 5 &gt; 6...).
            </div>

            <div className="bg-stone-800/60 p-2.5 rounded-xl border border-stone-700">
              <strong className="text-amber-400 block mb-0.5">3. Los Pares</strong>
              Primero se pregunta si se llevan pares. Si ambas parejas tienen, se envida.
              <span className="block mt-0.5 text-stone-400">
                Jerarquía: <strong>Duples</strong> (póker o doble pareja) &gt; <strong>Medias</strong> (trío) &gt; <strong>Par simple</strong>.
              </span>
            </div>

            <div className="bg-stone-800/60 p-2.5 rounded-xl border border-stone-700">
              <strong className="text-amber-400 block mb-0.5">4. El Juego o Punto</strong>
              Se suman las 4 cartas. Si la suma supera 30, ¡hay juego!
              <span className="block mt-0.5 text-stone-400">
                Jerarquía de Juego: <strong>31</strong> (la mejor) &gt; 32 &gt; 40 &gt; 37 &gt; 36 &gt; 35 &gt; 34 &gt; 33.
              </span>
              <span className="block mt-0.5 text-stone-400">
                Si nadie tiene juego, se disputa <strong>Punto</strong> (el que más se acerque a 30). Si hay envite al Punto y no se quiere, se cobran <strong>2 piedras</strong> (1 de punto + 1 de miedo: <em>punto y miedo</em>).
              </span>
            </div>
          </section>

          {/* Señas Tradicionales */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-amber-200 font-serif-vintage">
              Señas Tradicionales
            </h3>
            <p className="text-[11px] text-stone-400">
              Pásalas con el botón de señas a tu compañero para coordinar las apuestas.
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {AUTHENTIC_MUS_SIGNS.map(sign => (
                <div key={sign.id} className="p-2 rounded-xl bg-stone-800/80 border border-stone-700 flex items-start gap-1.5">
                  <span className="text-lg">{sign.icon}</span>
                  <div>
                    <span className="font-bold text-[11px] text-amber-300 block">{sign.name}</span>
                    <span className="text-[10px] text-stone-400 leading-tight block">{sign.meaning}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Órdago */}
          <section className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-3">
            <h3 className="text-sm font-bold text-rose-300 font-serif-vintage mb-1">
              🔥 ¡El Órdago!
            </h3>
            <p className="text-[11px] text-stone-300">
              Se juega todo el chico en un solo lance. Si el rival acepta el órdago, se levantan inmediatamente las cartas de ese lance y el ganador se anota la victoria del chico completo. Si las piedras envidadas más las de cualquiera de las dos parejas igualan o superan 40, el envite se convierte automáticamente en órdago.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-stone-800">
          <button
            onClick={onClose}
            className="w-full min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors shadow-lg shadow-amber-950/40"
          >
            Entendido, ¡a la mesa!
          </button>
        </div>
      </div>
    </div>
  );
};
