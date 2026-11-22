import React, { useState } from 'react';
import {
  ACHIEVEMENTS,
  AchievementCategory,
  AchievementRarity,
  AchievementStore,
} from '../utils/achievements';

interface AchievementsModalProps {
  store: AchievementStore;
  onReset: () => void;
  onClose: () => void;
}

const CATEGORIES: Array<'Todos' | AchievementCategory> = [
  'Todos',
  'Partida',
  'Jugadas',
  'Picardía',
  'Taberna',
];

const RARITY_STYLES: Record<
  AchievementRarity,
  { badge: string; label: string; border: string }
> = {
  bronce: {
    label: 'Bronce',
    badge: 'bg-amber-900/80 text-amber-200 border-amber-700',
    border: 'border-amber-700/60',
  },
  plata: {
    label: 'Plata',
    badge: 'bg-slate-700/90 text-slate-100 border-slate-400',
    border: 'border-slate-400/60',
  },
  oro: {
    label: 'Oro',
    badge: 'bg-amber-500/25 text-amber-200 border-amber-400',
    border: 'border-amber-400/75',
  },
  leyenda: {
    label: 'Leyenda',
    badge: 'bg-fuchsia-950/90 text-fuchsia-200 border-fuchsia-400',
    border: 'border-fuchsia-400/75',
  },
};

function formatUnlockDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  store,
  onReset,
  onClose,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'Todos' | AchievementCategory>('Todos');
  const [confirmReset, setConfirmReset] = useState(false);

  const unlockedCount = ACHIEVEMENTS.filter((a) => Boolean(store.unlocked[a.id])).length;
  const totalCount = ACHIEVEMENTS.length;
  const pct = Math.round((unlockedCount / totalCount) * 100);

  const filtered =
    selectedCategory === 'Todos'
      ? ACHIEVEMENTS
      : ACHIEVEMENTS.filter((a) => a.category === selectedCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl max-h-[88vh] bg-stone-900 border-2 border-amber-500/60 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col overflow-hidden text-stone-100">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-stone-800 pb-3 mb-3 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              <h2 className="text-lg sm:text-xl font-black font-serif-vintage text-amber-300">
                Vitrina de Logros y Hazañas
              </h2>
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Guardados localmente en este ordenador a lo largo de todas tus partidas.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 shrink-0 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center cursor-pointer transition-colors"
            aria-label="Cerrar logros"
          >
            ✕
          </button>
        </div>

        {/* Overall Progress + Lifetime Stats */}
        <div className="bg-stone-950/75 border border-stone-800 rounded-2xl p-3 mb-3 space-y-2.5 shrink-0">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-amber-200">
              Progreso de colección: <span className="font-mono-numbers">{unlockedCount}/{totalCount}</span>
            </span>
            <span className="font-black text-amber-400 font-mono-numbers">{pct}%</span>
          </div>
          <div className="w-full h-2.5 bg-stone-800 rounded-full overflow-hidden border border-stone-700">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1 text-center">
            <div className="bg-stone-900/90 rounded-xl px-2 py-1.5 border border-stone-800">
              <div className="text-xs font-black text-amber-300 font-mono-numbers">{store.stats.gamesWon}</div>
              <div className="text-[9px] text-stone-400 uppercase">Partidas</div>
            </div>
            <div className="bg-stone-900/90 rounded-xl px-2 py-1.5 border border-stone-800">
              <div className="text-xs font-black text-emerald-300 font-mono-numbers">{store.stats.juegosWon}</div>
              <div className="text-[9px] text-stone-400 uppercase">Juegos</div>
            </div>
            <div className="bg-stone-900/90 rounded-xl px-2 py-1.5 border border-stone-800">
              <div className="text-xs font-black text-sky-300 font-mono-numbers">{store.stats.totalPiedrasWon}</div>
              <div className="text-[9px] text-stone-400 uppercase">Piedras</div>
            </div>
            <div className="bg-stone-900/90 rounded-xl px-2 py-1.5 border border-stone-800">
              <div className="text-xs font-black text-rose-300 font-mono-numbers">{store.stats.ordagosWon}</div>
              <div className="text-[9px] text-stone-400 uppercase">Órdagos</div>
            </div>
            <div className="bg-stone-900/90 rounded-xl px-2 py-1.5 border border-stone-800">
              <div className="text-xs font-black text-amber-200 font-mono-numbers">{store.stats.signsCaught}</div>
              <div className="text-[9px] text-stone-400 uppercase">Pilladas</div>
            </div>
            <div className="bg-stone-900/90 rounded-xl px-2 py-1.5 border border-stone-800">
              <div className="text-xs font-black text-stone-200 font-mono-numbers">{store.stats.handsPlayed}</div>
              <div className="text-[9px] text-stone-400 uppercase">Manos</div>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-1.5 mb-3 shrink-0">
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  active
                    ? 'bg-amber-500 text-stone-950 border-amber-300 shadow'
                    : 'bg-stone-800/90 text-stone-300 border-stone-700 hover:bg-stone-700'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Achievement List */}
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filtered.map((ach) => {
            const unlockedAt = store.unlocked[ach.id];
            const isUnlocked = Boolean(unlockedAt);
            const target = ach.target ?? 1;
            const current = Math.min(target, ach.getProgress(store.stats));
            const progressPct = Math.round((current / target) * 100);
            const rarity = RARITY_STYLES[ach.rarity];

            return (
              <div
                key={ach.id}
                className={`rounded-2xl p-3 border transition-all flex flex-col justify-between gap-2 ${
                  isUnlocked
                    ? `bg-gradient-to-br from-amber-950/50 via-stone-900 to-stone-950 ${rarity.border} shadow-md`
                    : 'bg-stone-950/60 border-stone-800/90 opacity-75'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-11 h-11 rounded-xl shrink-0 flex items-center justify-center text-2xl border ${
                      isUnlocked
                        ? 'bg-amber-500/20 border-amber-400/60 shadow-inner'
                        : 'bg-stone-900 border-stone-800 grayscale opacity-60'
                    }`}
                  >
                    {isUnlocked ? ach.icon : '🔒'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <h3
                        className={`text-xs font-black truncate ${
                          isUnlocked ? 'text-amber-200' : 'text-stone-300'
                        }`}
                      >
                        {ach.title}
                      </h3>
                      <span
                        className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border shrink-0 ${rarity.badge}`}
                      >
                        {rarity.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-400 leading-snug mt-0.5">
                      {ach.description}
                    </p>
                  </div>
                </div>

                {/* Progress / Date Footer */}
                <div className="pt-1 border-t border-stone-800/70 flex items-center justify-between gap-2 text-[10px]">
                  {isUnlocked ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <span>✓</span>
                      <span>Desbloqueado {formatUnlockDate(unlockedAt)}</span>
                    </span>
                  ) : target > 1 ? (
                    <div className="w-full flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-stone-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500/80 transition-all"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <span className="text-stone-400 font-mono-numbers shrink-0">
                        {current}/{target}
                      </span>
                    </div>
                  ) : (
                    <span className="text-stone-500 italic">Pendiente de conseguir</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-3 mt-3 border-t border-stone-800 flex items-center justify-between gap-2 shrink-0">
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="text-[11px] text-stone-400 hover:text-rose-300 px-2.5 py-1.5 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Reiniciar logros locales
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  onReset();
                  setConfirmReset(false);
                }}
                className="text-[11px] font-bold bg-rose-700 hover:bg-rose-600 text-white px-2.5 py-1 rounded-lg cursor-pointer"
              >
                Confirmar borrado
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="text-[11px] text-stone-300 bg-stone-800 hover:bg-stone-700 px-2.5 py-1 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          )}

          <button
            onClick={onClose}
            className="min-h-[38px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs uppercase tracking-wider cursor-pointer transition-colors shadow"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
