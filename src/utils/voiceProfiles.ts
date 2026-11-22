/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PlayerSobrietyState } from '../types/mus';
import { CHARACTERS } from './characters';
import { TAVERN_DRINKS } from './drinks';

export type NeuralEngineId = 'edge' | 'tiktok' | 'google' | 'polly';

export interface CharacterVoiceProfile {
  id: string;
  gender: 'male' | 'female';
  age: number;
  size: 'compact' | 'medium' | 'large';
  personality: string;
  primaryEngine: NeuralEngineId;
  edgeVoice: string;
  edgePitch: string;
  edgeRate: string;
  tiktokVoice?: string;
  pollyVoice?: string;
  geminiVoiceName: string;
  geminiStyleCue: string;
  /** Subtle natural pitch adjustment for emergency Web Speech fallback */
  webSpeechPitch: number;
  /** Natural base speaking rate */
  webSpeechRate: number;
  preferredVoiceKeywords: string[];
}

export const CHARACTER_VOICE_PROFILES: Record<string, CharacterVoiceProfile> = {
  cura: {
    id: 'cura',
    gender: 'male',
    age: 62,
    size: 'medium',
    personality: 'Eclesiástico, sereno, cálido y pausado',
    primaryEngine: 'edge',
    edgeVoice: 'es-ES-AlvaroNeural',
    edgePitch: '-8Hz',
    edgeRate: '-7%',
    tiktokVoice: 'es_002',
    pollyVoice: 'Enrique',
    geminiVoiceName: 'Charon',
    geminiStyleCue:
      'Voz masculina española natural de hombre mayor (unos 62 años), tono grave cálido y sereno, ritmo pausado.',
    webSpeechPitch: 0.88,
    webSpeechRate: 0.93,
    preferredVoiceKeywords: ['jorge', 'diego', 'carlos', 'alvaro', 'enrique', 'male'],
  },
  guardia: {
    id: 'guardia',
    gender: 'male',
    age: 48,
    size: 'large',
    personality: 'Marcial, firme, disciplinado y contundente',
    primaryEngine: 'edge',
    edgeVoice: 'es-ES-AlvaroNeural',
    edgePitch: '-14Hz',
    edgeRate: '+1%',
    tiktokVoice: 'es_002',
    pollyVoice: 'Enrique',
    geminiVoiceName: 'Fenrir',
    geminiStyleCue:
      'Voz masculina española natural de hombre corpulento (unos 48 años), tono muy grave, firme y marcial.',
    webSpeechPitch: 0.85,
    webSpeechRate: 1.0,
    preferredVoiceKeywords: ['enrique', 'jorge', 'diego', 'alvaro', 'carlos', 'male'],
  },
  tuno: {
    id: 'tuno',
    gender: 'male',
    age: 24,
    size: 'compact',
    personality: 'Joven, bohemio, pícaro y alegre',
    primaryEngine: 'edge',
    edgeVoice: 'es-ES-AlvaroNeural',
    edgePitch: '+5Hz',
    edgeRate: '+6%',
    tiktokVoice: 'es_002',
    pollyVoice: 'Enrique',
    geminiVoiceName: 'Puck',
    geminiStyleCue:
      'Voz masculina española natural de chico joven (unos 24 años), timbre claramente masculino pero ágil, alegre y pícaro.',
    webSpeechPitch: 0.96,
    webSpeechRate: 1.06,
    preferredVoiceKeywords: ['diego', 'pablo', 'jorge', 'david', 'mateo', 'male'],
  },
  taxista: {
    id: 'taxista',
    gender: 'male',
    age: 56,
    size: 'large',
    personality: 'Castizo madrileño, rápido y socarrón',
    primaryEngine: 'tiktok',
    edgeVoice: 'es-ES-AlvaroNeural',
    edgePitch: '-4Hz',
    edgeRate: '+9%',
    tiktokVoice: 'es_002',
    pollyVoice: 'Enrique',
    geminiVoiceName: 'Orus',
    geminiStyleCue:
      'Voz masculina madrileña natural de hombre maduro (unos 56 años), tono grave y coloquial, ritmo rápido y castizo.',
    webSpeechPitch: 0.89,
    webSpeechRate: 1.08,
    preferredVoiceKeywords: ['alvaro', 'raul', 'carlos', 'jorge', 'diego', 'male'],
  },
  camarero: {
    id: 'camarero',
    gender: 'male',
    age: 52,
    size: 'medium',
    personality: 'Hospitalario, campechano y bromista',
    primaryEngine: 'edge',
    edgeVoice: 'es-ES-AlvaroNeural',
    edgePitch: '-2Hz',
    edgeRate: '+3%',
    tiktokVoice: 'es_002',
    pollyVoice: 'Enrique',
    geminiVoiceName: 'Puck',
    geminiStyleCue:
      'Voz masculina española natural de camarero castizo (unos 52 años), trato amable, cálido y hospitalario.',
    webSpeechPitch: 0.93,
    webSpeechRate: 1.02,
    preferredVoiceKeywords: ['antonio', 'carlos', 'jorge', 'pablo', 'diego', 'male'],
  },
  tabernera: {
    id: 'tabernera',
    gender: 'female',
    age: 60,
    size: 'large',
    personality: 'Madura, cálida, firme y experimentada',
    primaryEngine: 'edge',
    edgeVoice: 'es-ES-ElviraNeural',
    edgePitch: '-7Hz',
    edgeRate: '-3%',
    tiktokVoice: 'es_female_f6',
    pollyVoice: 'Conchita',
    geminiVoiceName: 'Kore',
    geminiStyleCue:
      'Voz femenina española natural de mujer madura (unos 60 años), tono cálido, firme y con aplomo.',
    webSpeechPitch: 0.93,
    webSpeechRate: 0.97,
    preferredVoiceKeywords: ['conchita', 'carmen', 'paloma', 'monica', 'helena', 'female'],
  },
  flamenca: {
    id: 'flamenca',
    gender: 'female',
    age: 34,
    size: 'medium',
    personality: 'Apasionada, expresiva y con acento andaluz',
    primaryEngine: 'edge',
    edgeVoice: 'es-ES-XimenaNeural',
    edgePitch: '+2Hz',
    edgeRate: '+3%',
    tiktokVoice: 'es_female_fp1',
    pollyVoice: 'Lucia',
    geminiVoiceName: 'Aoede',
    geminiStyleCue:
      'Voz femenina andaluza natural de mujer de unos 34 años, expresiva, cálida y con salero natural.',
    webSpeechPitch: 1.03,
    webSpeechRate: 1.04,
    preferredVoiceKeywords: ['carmen', 'lucia', 'sofia', 'laura', 'elena', 'female'],
  },
  cientifica: {
    id: 'cientifica',
    gender: 'female',
    age: 41,
    size: 'medium',
    personality: 'Serena, precisa, intelectual e irónica',
    primaryEngine: 'google',
    edgeVoice: 'es-ES-ElviraNeural',
    edgePitch: '0Hz',
    edgeRate: '0%',
    tiktokVoice: 'es_female_f6',
    pollyVoice: 'Conchita',
    geminiVoiceName: 'Zephyr',
    geminiStyleCue:
      'Voz femenina española natural de mujer de unos 41 años, clara, serena y bien articulada.',
    webSpeechPitch: 1.0,
    webSpeechRate: 1.0,
    preferredVoiceKeywords: ['elena', 'helena', 'laura', 'victoria', 'monica', 'female'],
  },
  chulapa: {
    id: 'chulapa',
    gender: 'female',
    age: 29,
    size: 'compact',
    personality: 'Joven, madrileña, pizpireta y rápida',
    primaryEngine: 'tiktok',
    edgeVoice: 'es-ES-XimenaNeural',
    edgePitch: '+6Hz',
    edgeRate: '+6%',
    tiktokVoice: 'es_female_fp1',
    pollyVoice: 'Lucia',
    geminiVoiceName: 'Leda',
    geminiStyleCue:
      'Voz femenina madrileña natural de chica joven (unos 29 años), viva, clara y espontánea.',
    webSpeechPitch: 1.08,
    webSpeechRate: 1.08,
    preferredVoiceKeywords: ['lucia', 'ines', 'sofia', 'paulina', 'laura', 'female'],
  },
};

export function cleanSpokenText(text: string): string {
  return text
    .replace(/\[.*?\]/g, '')
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}🌱✋🔥👀😉👄👅😏🤨🙄🎴🎷🔇☕★✓✕📋♪♫🥃🍺🍷🥤🫒💫⚡👞🤝]/gu,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export const COMMON_GAME_SPOKEN_PHRASES = [
  'Paso',
  '¡Quiero!',
  'No quiero',
  '¡¡ÓRDAGO!!',
  '¡Envido dos!',
  '¡Envido cinco!',
  '¡Dos más de reenvío!',
  '¡Mus!',
  '¡Corto el mus!',
  'Pares sí',
  'Pares no',
  'Juego sí',
  'Juego no',
  'Me pido una',
  'Me pido 2',
  'Me pido 3',
  'Me pido 4',
  '¡Envido 3!',
  '¡Envido 4!',
  '¡Envido 6!',
  '¡Envido 10!',
  '¡3 más de reenvío!',
  '¡4 más de reenvío!',
  '¡Maldita sea, qué vista tienes!',
];

const NPC_DRINK_ORDER_PHRASES = [
  '¡Manolo, ponme una cañita bien tirada para mí!',
  'Me pido una caña fresquita, Manolo.',
  '¡Manolo, échame un chiquito de Valdepeñas!',
  'Para mí un chato de tinto, Manolo.',
  '¡Manolo, un carajillo bien cargado para mí!',
  'Me voy a pedir un carajillo de Soberano, Manolo.',
  '¡Manolo, un café solo para despejarme!',
  'Ponme un café de puchero bien negro, Manolo.',
  '¡Manolo, un vaso de agua fresca para mí!',
  'Me pido un agua del grifo para mantener la cabeza fría.',
  '¡Manolo, ponme una gilda con aceitunas para picar!',
  'Me pido unas aceitunas de Campo Real, Manolo.',
];

export function getPregenerablePhrasesForCharacter(characterId: string): string[] {
  const char = CHARACTERS[characterId];
  if (!char) return [];

  if (characterId === 'camarero') {
    const npcNames = Object.values(CHARACTERS)
      .filter((c) => c.id !== 'camarero')
      .map((c) => c.name);

    const dynamicWaiter = [
      '¡Voz activada, que hable la taberna!',
      '¡Vaya presencia de pastel, vaya presencia!',
      '¡¡SILENCIO EN LA SALA, HAN TIRADO UN ÓRDAGO!!',
      '¡Cortas el primer mus y te conviertes en la Mano!',
      '¡Regla oficial de Bizkaia (Art. IV)! En el descarte es obligatorio pedir al menos 1 carta.',
      '¡Atardecer madrileño! Luces cálidas y cañitas bien tiradas.',
      '¡Noche cerrada en la taberna! A ver quién aguanta el órdago.',
      '¡Madrugada clandestina! Café solo y partida de campeonato.',
      '¡Tarde soleada en Malasaña! Tapas de tortilla y Mus corrido.',
      '¡Durante esta mano ya no se sirven más rondas! Espera al comienzo de la siguiente.',
      '¡¡Torneo de Bizkaia finalizado!! Txapeldun: Nosotros con 4 juegos.',
      '¡¡Torneo de Bizkaia finalizado!! Txapeldun: Ellos con 4 juegos.',
      ...(['Nosotros', 'Ellos'] as const).flatMap((team) =>
        [1, 2, 3].map(
          (n) => `¡${team} se anotan su ${n}º juego de 8 amarrakos! Tantos a cero para el siguiente juego.`
        )
      ),
      ...npcNames.map((n) => `¡${n} corta el primer mus y se convierte en la Mano!`),
      ...TAVERN_DRINKS.flatMap((d) => d.waiterLines),
      ...TAVERN_DRINKS.flatMap((d) =>
        d.waiterLines.map((line) => `${line} (Hará efecto en cuanto se corte el mus).`)
      ),
      ...npcNames.flatMap((n) => TAVERN_DRINKS.map((d) => `¡Marchando ${d.name} para ${n}!`)),
    ];

    return Array.from(
      new Set(
        [
          ...char.quotes.mus,
          ...char.quotes.noMus,
          ...char.quotes.envido,
          ...char.quotes.quiero,
          ...char.quotes.noQuiero,
          ...char.quotes.ordago,
          ...char.quotes.win,
          ...char.quotes.lose,
          ...(char.quotes.signReaction ?? []),
          ...(char.quotes.banter ?? []),
          ...dynamicWaiter,
        ]
          .map(cleanSpokenText)
          .filter(Boolean)
      )
    );
  }

  return Array.from(
    new Set(
      [
        ...COMMON_GAME_SPOKEN_PHRASES,
        ...NPC_DRINK_ORDER_PHRASES,
        ...char.quotes.mus,
        ...char.quotes.noMus,
        ...char.quotes.envido,
        ...char.quotes.quiero,
        ...char.quotes.noQuiero,
        ...char.quotes.ordago,
        ...(char.quotes.signReaction ?? []),
      ]
        .map(cleanSpokenText)
        .filter(Boolean)
    )
  );
}

/**
 * Computes audio playback rate from individual character sobriety:
 * - Alcohol slows audio progressively down to 0.5x at level 5 (-0.1x per level).
 * - Caffeine speeds audio progressively up to 2.0x at level 5 (+0.2x per level).
 * - Sober (0/0) stays 1.0x.
 */
export function getPlaybackRateForSobriety(
  sobriety?: Pick<PlayerSobrietyState, 'alcohol' | 'caffeine'>
): number {
  if (!sobriety) return 1.0;
  const alc = Math.max(0, Math.min(5, sobriety.alcohol || 0));
  const caf = Math.max(0, Math.min(5, sobriety.caffeine || 0));
  const speed = 1.0 - alc * 0.1 + caf * 0.2;
  return Math.max(0.5, Math.min(2.0, Number(speed.toFixed(2))));
}
