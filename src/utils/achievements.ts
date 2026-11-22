import { Card } from '../types/mus';
import { evaluateJuego, evaluatePares } from './musRules';

export type AchievementCategory = 'Partida' | 'Jugadas' | 'Picardía' | 'Taberna';
export type AchievementRarity = 'bronce' | 'plata' | 'oro' | 'leyenda';

export interface AchievementStats {
  gamesPlayed: number;
  gamesWon: number;
  shutoutWins: number;
  juegosWon: number;
  handsPlayed: number;
  ordagosWon: number;
  ordagosCalledByPlayer: number;
  puntoMiedoWon: number;
  treintaYUnaCount: number;
  laRealCount: number;
  pokerReyesCount: number;
  duplesCount: number;
  signsSent: number;
  signsCaught: number;
  drinksOrdered: number;
  waterSavedDrunk: number;
  drunkOrWiredHands: number;
  maxAlcoholReached: number;
  maxCaffeineReached: number;
  totalPiedrasWon: number;
  partnersWonWith: string[];
}

export interface AchievementStore {
  version: 1;
  unlocked: Record<string, string>; // achievementId -> ISO timestamp
  stats: AchievementStats;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  target?: number;
  getProgress: (stats: AchievementStats) => number;
}

const STORAGE_KEY = 'pcmus_achievements_v1';

export function createDefaultStats(): AchievementStats {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    shutoutWins: 0,
    juegosWon: 0,
    handsPlayed: 0,
    ordagosWon: 0,
    ordagosCalledByPlayer: 0,
    puntoMiedoWon: 0,
    treintaYUnaCount: 0,
    laRealCount: 0,
    pokerReyesCount: 0,
    duplesCount: 0,
    signsSent: 0,
    signsCaught: 0,
    drinksOrdered: 0,
    waterSavedDrunk: 0,
    drunkOrWiredHands: 0,
    maxAlcoholReached: 0,
    maxCaffeineReached: 0,
    totalPiedrasWon: 0,
    partnersWonWith: [],
  };
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'primer_mus',
    title: '¡Mus corrido!',
    description: 'Juega tu primera mano completa en el Café Bar El Madroño.',
    icon: '🎴',
    category: 'Partida',
    rarity: 'bronce',
    target: 1,
    getProgress: (s) => s.handsPlayed,
  },
  {
    id: 'primer_chico',
    title: 'Ocho Amarrakos',
    description: 'Gana tu primer juego (chico) de 40 piedras.',
    icon: '🪨',
    category: 'Partida',
    rarity: 'bronce',
    target: 1,
    getProgress: (s) => s.juegosWon,
  },
  {
    id: 'txapeldun',
    title: 'Txapeldun de Malasaña',
    description: 'Gana una partida completa (4 juegos).',
    icon: '🏆',
    category: 'Partida',
    rarity: 'oro',
    target: 1,
    getProgress: (s) => s.gamesWon,
  },
  {
    id: 'capote_limpio',
    title: 'Zapatero y a dormir',
    description: 'Gana una partida completa dejando a los rivales a cero (4 - 0).',
    icon: '👞',
    category: 'Partida',
    rarity: 'oro',
    target: 1,
    getProgress: (s) => s.shutoutWins,
  },
  {
    id: 'leyenda_bar',
    title: 'Leyenda de El Madroño',
    description: 'Gana 5 partidas completas en el torneo del bar.',
    icon: '👑',
    category: 'Partida',
    rarity: 'leyenda',
    target: 5,
    getProgress: (s) => s.gamesWon,
  },
  {
    id: 'cosecha_piedras',
    title: 'Coleccionista de Amarrakos',
    description: 'Suma 200 piedras entre todas tus partidas.',
    icon: '🫘',
    category: 'Partida',
    rarity: 'plata',
    target: 200,
    getProgress: (s) => s.totalPiedrasWon,
  },
  {
    id: 'ordago_ganado',
    title: 'Sin temblar el pulso',
    description: 'Gana un Órdago aceptado sobre el tapete.',
    icon: '🔥',
    category: 'Jugadas',
    rarity: 'plata',
    target: 1,
    getProgress: (s) => s.ordagosWon,
  },
  {
    id: 'rey_del_ordago',
    title: 'El Rey del Órdago',
    description: 'Gana 5 órdagos aceptados en tu carrera musística.',
    icon: '💥',
    category: 'Jugadas',
    rarity: 'oro',
    target: 5,
    getProgress: (s) => s.ordagosWon,
  },
  {
    id: 'punto_y_miedo',
    title: 'Punto y Miedo',
    description: 'Haz recular a los rivales en un envite al Punto y cobra las 2 piedras.',
    icon: '😰',
    category: 'Jugadas',
    rarity: 'plata',
    target: 1,
    getProgress: (s) => s.puntoMiedoWon,
  },
  {
    id: 'treinta_y_una',
    title: '¡Treinta y Una!',
    description: 'Reúne la jugada reina de 31 puntos en tu mano.',
    icon: '✨',
    category: 'Jugadas',
    rarity: 'plata',
    target: 1,
    getProgress: (s) => s.treintaYUnaCount,
  },
  {
    id: 'poker_reyes',
    title: 'Cuatro Reyes',
    description: 'Consigue cuatro Reyes (3s o 12s) en la misma mano.',
    icon: '🤴',
    category: 'Jugadas',
    rarity: 'oro',
    target: 1,
    getProgress: (s) => s.pokerReyesCount,
  },
  {
    id: 'la_real',
    title: 'La Real',
    description: 'Consigue la mítica mano de tres sietes y una sota (31 Real).',
    icon: '💎',
    category: 'Jugadas',
    rarity: 'leyenda',
    target: 1,
    getProgress: (s) => s.laRealCount,
  },
  {
    id: 'complicidad',
    title: 'Guiño de Taberna',
    description: 'Pasa 10 señas tradicionales a tu compañero.',
    icon: '😉',
    category: 'Picardía',
    rarity: 'bronce',
    target: 10,
    getProgress: (s) => s.signsSent,
  },
  {
    id: 'ojo_lince',
    title: 'Ojo de Lince',
    description: 'Caza una seña secreta a los rivales en plena partida.',
    icon: '👀',
    category: 'Picardía',
    rarity: 'plata',
    target: 1,
    getProgress: (s) => s.signsCaught,
  },
  {
    id: 'perro_viejo',
    title: 'Perro Viejo',
    description: 'Caza 5 señas a las parejas rivales.',
    icon: '🦅',
    category: 'Picardía',
    rarity: 'oro',
    target: 5,
    getProgress: (s) => s.signsCaught,
  },
  {
    id: 'ojo_de_pez',
    title: 'Visión Ojo de Pez',
    description: 'Juega una mano con nivel 4 o 5 de alcohol o cafeína.',
    icon: '🥴',
    category: 'Taberna',
    rarity: 'plata',
    target: 1,
    getProgress: (s) => s.drunkOrWiredHands,
  },
  {
    id: 'agua_bendita',
    title: 'Manolo, un agua',
    description: 'Pide agua o una tapa para despejarte estando borracho (alcohol ≥ 3).',
    icon: '🥤',
    category: 'Taberna',
    rarity: 'bronce',
    target: 1,
    getProgress: (s) => s.waterSavedDrunk,
  },
  {
    id: 'amigo_de_todos',
    title: 'Alma de El Madroño',
    description: 'Gana al menos un juego con 4 compañeros distintos.',
    icon: '🤝',
    category: 'Taberna',
    rarity: 'leyenda',
    target: 4,
    getProgress: (s) => s.partnersWonWith.length,
  },
];

export function loadAchievementStore(): AchievementStore {
  const defaults: AchievementStore = {
    version: 1,
    unlocked: {},
    stats: createDefaultStats(),
  };

  if (typeof window === 'undefined' || !window.localStorage) {
    return defaults;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<AchievementStore> | null;
    if (!parsed || typeof parsed !== 'object') return defaults;

    const mergedStats: AchievementStats = {
      ...createDefaultStats(),
      ...(parsed.stats && typeof parsed.stats === 'object' ? parsed.stats : {}),
      partnersWonWith: Array.isArray(parsed.stats?.partnersWonWith)
        ? parsed.stats.partnersWonWith.filter((x): x is string => typeof x === 'string')
        : [],
    };

    const cleanUnlocked: Record<string, string> = {};
    if (parsed.unlocked && typeof parsed.unlocked === 'object') {
      for (const [key, val] of Object.entries(parsed.unlocked)) {
        if (typeof val === 'string') {
          cleanUnlocked[key] = val;
        }
      }
    }

    return {
      version: 1,
      unlocked: cleanUnlocked,
      stats: mergedStats,
    };
  } catch {
    return defaults;
  }
}

export function saveAchievementStore(store: AchievementStore): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota / private mode errors
  }
}

export function resetAchievementStore(): AchievementStore {
  const fresh: AchievementStore = {
    version: 1,
    unlocked: {},
    stats: createDefaultStats(),
  };
  saveAchievementStore(fresh);
  return fresh;
}

export function evaluateAndUnlockAchievements(
  store: AchievementStore,
  updater: (prevStats: AchievementStats) => AchievementStats
): { nextStore: AchievementStore; newlyUnlocked: AchievementDefinition[] } {
  const nextStats = updater(store.stats);
  const nextUnlocked = { ...store.unlocked };
  const newlyUnlocked: AchievementDefinition[] = [];
  const nowIso = new Date().toISOString();

  for (const ach of ACHIEVEMENTS) {
    if (nextUnlocked[ach.id]) continue;
    const target = ach.target ?? 1;
    if (ach.getProgress(nextStats) >= target) {
      nextUnlocked[ach.id] = nowIso;
      newlyUnlocked.push(ach);
    }
  }

  const nextStore: AchievementStore = {
    version: 1,
    unlocked: nextUnlocked,
    stats: nextStats,
  };
  saveAchievementStore(nextStore);
  return { nextStore, newlyUnlocked };
}

export function detectHandAchievementFlags(hand: Card[]): {
  has31: boolean;
  hasLaReal: boolean;
  hasPokerReyes: boolean;
  hasDuples: boolean;
} {
  if (!hand || hand.length < 4) {
    return { has31: false, hasLaReal: false, hasPokerReyes: false, hasDuples: false };
  }
  const juegoEval = evaluateJuego(hand);
  const paresEval = evaluatePares(hand);
  const sevens = hand.filter((c) => c.rank === 7).length;
  const sotas = hand.filter((c) => c.rank === 10).length;
  const reyes = hand.filter((c) => c.hierarchy === 12).length;

  return {
    has31: juegoEval.hasJuego && juegoEval.totalSum === 31,
    hasLaReal: sevens === 3 && sotas === 1,
    hasPokerReyes: reyes === 4,
    hasDuples: paresEval.type === 'duples',
  };
}
