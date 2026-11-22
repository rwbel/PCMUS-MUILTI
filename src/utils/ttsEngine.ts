/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ttsEngine.ts - Motor de Texto-a-Voz (TTS) para PCMus Lo-Fi
 *
 * Proporciona voz a los personajes durante la partida. Tiene dos niveles:
 *   1. Servidor (Gemini API vía /api/tts): Voces expresivas por personaje
 *   2. Navegador (Web Speech API): Fallback gratuito sin API key
 *
 * Incluye caché de audio (máx. 60 entradas) para no volver a generar
 * la misma frase dos veces, y detección automática de voces españolas.
 */

import { SpeechSpeaker } from '../types/mus';
import {
  CHARACTER_VOICE_PROFILES,
  cleanSpokenText,
  getPregenerablePhrasesForCharacter,
} from './voiceProfiles';

type SpeakingListener = (speaker: SpeechSpeaker | null, durationMs?: number) => void;
export type MouthOpenLevel = 0 | 1 | 2 | 3;
type MouthLevelListener = (level: MouthOpenLevel) => void;

export const TTS_PHONEME_EVENT = 'pcmus:tts-phoneme';

export interface PhonemeTiming {
  index: number;
  phoneme: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  scaledStartMs: number;
  scaledEndMs: number;
  scaledDurationMs: number;
  mouthLevel: MouthOpenLevel;
  isSilence: boolean;
}

export interface TTSPhonemeSyncEvent {
  speaker: SpeechSpeaker | null;
  characterId?: string;
  text: string;
  isSpeaking: boolean;
  phoneme: string;
  mouthLevel: MouthOpenLevel;
  phonemeIndex: number;
  elapsedMs: number;
  durationMs: number;
  phonemeStartMs: number;
  phonemeDurationMs: number;
  playbackSpeed: number;
  timings: PhonemeTiming[];
}

export type PhonemeSyncListener = (event: TTSPhonemeSyncEvent) => void;

interface RawPhonemeToken {
  phoneme: string;
  weight: number;
  baseMouth: MouthOpenLevel;
  isPause: boolean;
  isBilabial: boolean;
}

interface QueuedSpeech {
  cleanText: string;
  characterId: string;
  options?: {
    pitch?: number;
    rate?: number;
    playbackSpeed?: number;
    gender?: 'male' | 'female';
    speakerPosition?: SpeechSpeaker;
  };
}

interface VoiceManifest {
  version: number;
  phrases: Record<string, string>;
}

const MAX_DECODED_CACHE_ENTRIES = 160;

function tokenizeSpanishPhonemes(inputText: string): RawPhonemeToken[] {
  const cleaned = cleanSpokenText(inputText).toLowerCase();
  if (!cleaned) return [];

  // Strip leading/trailing punctuation so speech spans purely over spoken tokens
  const trimmed = cleaned.replace(/^[\s¡¿"'.,;:!?…-]+|[\s"'.,;:!?…-]+$/g, '');
  if (!trimmed) return [];

  const tokens: RawPhonemeToken[] = [];
  let i = 0;

  while (i < trimmed.length) {
    const ch = trimmed[i];
    const next = trimmed[i + 1] || '';
    const next2 = trimmed[i + 2] || '';

    // Spanish digraphs
    if (ch === 'c' && next === 'h') {
      tokens.push({ phoneme: 'tʃ', weight: 1.05, baseMouth: 1, isPause: false, isBilabial: false });
      i += 2;
      continue;
    }
    if (ch === 'l' && next === 'l') {
      tokens.push({ phoneme: 'ʎ', weight: 0.95, baseMouth: 1, isPause: false, isBilabial: false });
      i += 2;
      continue;
    }
    if (ch === 'r' && next === 'r') {
      tokens.push({ phoneme: 'rː', weight: 1.35, baseMouth: 2, isPause: false, isBilabial: false });
      i += 2;
      continue;
    }
    if (ch === 'q' && next === 'u' && (next2 === 'e' || next2 === 'i' || next2 === 'é' || next2 === 'í')) {
      tokens.push({ phoneme: 'k', weight: 0.85, baseMouth: 1, isPause: false, isBilabial: false });
      i += 2;
      continue;
    }
    if (ch === 'g' && next === 'u' && (next2 === 'e' || next2 === 'i' || next2 === 'é' || next2 === 'í')) {
      tokens.push({ phoneme: 'g', weight: 0.85, baseMouth: 1, isPause: false, isBilabial: false });
      i += 2;
      continue;
    }

    // Silent 'h' in Spanish
    if (ch === 'h') {
      i += 1;
      continue;
    }

    // Internal punctuation pauses
    if (ch === ',' || ch === ';' || ch === ':') {
      tokens.push({ phoneme: 'PAU', weight: 1.15, baseMouth: 0, isPause: true, isBilabial: false });
      i += 1;
      continue;
    }
    if (ch === '.' || ch === '!' || ch === '?' || ch === '…') {
      tokens.push({ phoneme: 'PAU', weight: 1.65, baseMouth: 0, isPause: true, isBilabial: false });
      while (i + 1 < trimmed.length && '.!?…'.includes(trimmed[i + 1])) i += 1;
      i += 1;
      continue;
    }

    // Ignore spaces and quotes for continuous coarticulation
    if (/[\s¡¿"'()\-—]/.test(ch)) {
      i += 1;
      continue;
    }

    // Stressed & unstressed vowels
    if (ch === 'á') {
      tokens.push({ phoneme: 'a', weight: 1.95, baseMouth: 3, isPause: false, isBilabial: false });
      i += 1;
      continue;
    }
    if (ch === 'a') {
      tokens.push({ phoneme: 'a', weight: 1.65, baseMouth: 3, isPause: false, isBilabial: false });
      i += 1;
      continue;
    }
    if (ch === 'é' || ch === 'ó') {
      tokens.push({ phoneme: ch === 'é' ? 'e' : 'o', weight: 1.8, baseMouth: 3, isPause: false, isBilabial: false });
      i += 1;
      continue;
    }
    if (ch === 'e' || ch === 'o') {
      tokens.push({ phoneme: ch, weight: 1.5, baseMouth: 2, isPause: false, isBilabial: false });
      i += 1;
      continue;
    }
    if (ch === 'í' || ch === 'ú' || ch === 'ü') {
      const ph = ch === 'í' ? 'i' : 'u';
      tokens.push({ phoneme: ph, weight: 1.45, baseMouth: 2, isPause: false, isBilabial: false });
      i += 1;
      continue;
    }
    if (ch === 'i' || ch === 'u' || ch === 'y') {
      const ph = ch === 'y' ? 'i' : ch;
      tokens.push({ phoneme: ph, weight: 1.22, baseMouth: 2, isPause: false, isBilabial: false });
      i += 1;
      continue;
    }

    // Bilabial consonants (slight parted mouth `1` on quick transitions so short words like "Paso" animate cleanly)
    if (ch === 'p' || ch === 'b' || ch === 'v' || ch === 'm') {
      tokens.push({ phoneme: ch, weight: 0.62, baseMouth: 1, isPause: false, isBilabial: true });
      i += 1;
      continue;
    }

    // Open / lingual / fricative consonants
    if (/[a-zñ0-9]/.test(ch)) {
      const wideConsonant = ch === 'j' || ch === 'f' || ch === 'r' || ch === 'l';
      tokens.push({
        phoneme: ch,
        weight: ch === 'r' || ch === 's' ? 0.95 : 0.82,
        baseMouth: wideConsonant ? 2 : 1,
        isPause: false,
        isBilabial: false,
      });
      i += 1;
      continue;
    }

    i += 1;
  }

  return tokens;
}

class TTSEngine {
  private enabled: boolean = true;
  private spanishVoices: SpeechSynthesisVoice[] = [];
  private characterVoiceMap: Map<string, SpeechSynthesisVoice> = new Map();

  private audioCtx: AudioContext | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;
  private abortController: AbortController | null = null;
  private mouthLoopId: number | null = null;
  private mouthRafId: number | null = null;
  private speechFallbackTimer: number | null = null;
  private speechPulseTimer: number | null = null;
  private voicesReadyPromise: Promise<void> | null = null;

  private manifestMap: Record<string, string> | null = null;
  private manifestPromise: Promise<Record<string, string>> | null = null;

  private rawAudioCache: Map<string, ArrayBuffer> = new Map();
  private decodedAudioCache: Map<string, AudioBuffer> = new Map();
  private phonemeTimingCache: Map<string, PhonemeTiming[]> = new Map();
  private preloadedChars: Set<string> = new Set();

  private listeners: Set<SpeakingListener> = new Set();
  private mouthListeners: Map<SpeechSpeaker, Set<MouthLevelListener>> = new Map();
  private phonemeListeners: Map<SpeechSpeaker, Set<PhonemeSyncListener>> = new Map();
  private globalPhonemeListeners: Set<PhonemeSyncListener> = new Set();
  private activePhonemeStates: Map<SpeechSpeaker, TTSPhonemeSyncEvent> = new Map();
  private activeSpeaker: SpeechSpeaker | null = null;

  private speechQueue: QueuedSpeech[] = [];
  private isProcessingSpeech: boolean = false;
  private currentUtteranceFinish: (() => void) | null = null;
  private idleWaiters: Array<() => void> = [];

  private requestCounter: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      void this.loadVoiceManifest();
      const unlockAudio = () => {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
        window.removeEventListener('pointerdown', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
      };
      window.addEventListener('pointerdown', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
      if ('speechSynthesis' in window) {
        this.loadVoices();
        window.speechSynthesis.onvoiceschanged = () => {
          this.loadVoices();
        };
      }
    }
  }

  private loadVoiceManifest(): Promise<Record<string, string>> {
    if (this.manifestMap) return Promise.resolve(this.manifestMap);
    if (this.manifestPromise) return this.manifestPromise;
    if (typeof window === 'undefined') return Promise.resolve({});

    this.manifestPromise = fetch('/voices/manifest.json')
      .then((res) => (res.ok ? (res.json() as Promise<VoiceManifest>) : null))
      .then((data) => {
        this.manifestMap = data?.phrases || {};
        return this.manifestMap;
      })
      .catch(() => {
        this.manifestMap = {};
        return {};
      });

    return this.manifestPromise;
  }

  public subscribeSpeaking(listener: SpeakingListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribeMouthLevel(speaker: SpeechSpeaker, listener: MouthLevelListener): () => void {
    let set = this.mouthListeners.get(speaker);
    if (!set) {
      set = new Set();
      this.mouthListeners.set(speaker, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
      if (set && set.size === 0) {
        this.mouthListeners.delete(speaker);
      }
    };
  }

  public subscribePhonemeSync(speaker: SpeechSpeaker, listener: PhonemeSyncListener): () => void {
    let set = this.phonemeListeners.get(speaker);
    if (!set) {
      set = new Set();
      this.phonemeListeners.set(speaker, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
      if (set && set.size === 0) {
        this.phonemeListeners.delete(speaker);
      }
    };
  }

  public subscribeAllPhonemeSync(listener: PhonemeSyncListener): () => void {
    this.globalPhonemeListeners.add(listener);
    return () => {
      this.globalPhonemeListeners.delete(listener);
    };
  }

  public getActivePhonemeState(speaker: SpeechSpeaker): TTSPhonemeSyncEvent | null {
    return this.activePhonemeStates.get(speaker) ?? null;
  }

  private emitMouthLevel(speaker: SpeechSpeaker | null, level: MouthOpenLevel) {
    if (!speaker) return;
    const set = this.mouthListeners.get(speaker);
    if (!set) return;
    set.forEach((cb) => cb(level));
  }

  private dispatchPhonemeSync(event: TTSPhonemeSyncEvent) {
    if (event.speaker) {
      if (event.isSpeaking) {
        this.activePhonemeStates.set(event.speaker, event);
      } else {
        this.activePhonemeStates.delete(event.speaker);
      }

      const speakerListeners = this.phonemeListeners.get(event.speaker);
      if (speakerListeners) {
        speakerListeners.forEach((cb) => cb(event));
      }
      this.emitMouthLevel(event.speaker, event.isSpeaking ? event.mouthLevel : 0);
    }

    this.globalPhonemeListeners.forEach((cb) => cb(event));

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent<TTSPhonemeSyncEvent>(TTS_PHONEME_EVENT, { detail: event }));
    }
  }

  private notifySpeaker(speaker: SpeechSpeaker | null, durationMs?: number) {
    if (this.activeSpeaker && this.activeSpeaker !== speaker) {
      const prevSpeaker = this.activeSpeaker;
      const prevState = this.activePhonemeStates.get(prevSpeaker);
      if (prevState) {
        this.dispatchPhonemeSync({
          ...prevState,
          isSpeaking: false,
          phoneme: 'SIL',
          mouthLevel: 0,
          phonemeIndex: -1,
          elapsedMs: prevState.durationMs,
          phonemeStartMs: prevState.durationMs,
          phonemeDurationMs: 0,
        });
      } else {
        this.emitMouthLevel(prevSpeaker, 0);
      }
    }
    this.activeSpeaker = speaker;
    if (!speaker) {
      this.mouthListeners.forEach((set) => set.forEach((cb) => cb(0)));
    }
    this.listeners.forEach((cb) => cb(speaker, durationMs));
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.audioCtx = new Ctx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  private loadVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const allVoices = window.speechSynthesis.getVoices();
    if (allVoices.length === 0) return;

    const esVoices = allVoices.filter((v) => v.lang.toLowerCase().startsWith('es'));
    const nonRobotic = esVoices.filter((v) => {
      const lower = v.name.toLowerCase();
      return !lower.includes('espeak') && !lower.includes('mbrola');
    });
    const pool = nonRobotic.length > 0 ? nonRobotic : esVoices;

    const naturalKeywords = ['neural', 'wavenet', 'azure', 'premium', 'enhanced', 'natural', 'siri', 'google'];
    const scoreVoice = (v: SpeechSynthesisVoice) => {
      const lower = v.name.toLowerCase();
      let score = v.lang.toLowerCase() === 'es-es' ? 30 : 10;
      if (naturalKeywords.some((kw) => lower.includes(kw))) score += 20;
      if (!lower.includes('compact')) score += 6;
      return score;
    };

    this.spanishVoices = [...pool].sort((a, b) => scoreVoice(b) - scoreVoice(a));
    this.assignDistinctCharacterVoices();
  }

  private ensureVoicesLoaded(): Promise<void> {
    if (this.spanishVoices.length > 0 || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return Promise.resolve();
    }
    this.loadVoices();
    if (this.spanishVoices.length > 0) return Promise.resolve();
    if (this.voicesReadyPromise) return this.voicesReadyPromise;

    this.voicesReadyPromise = new Promise<void>((resolve) => {
      const finish = () => {
        this.loadVoices();
        resolve();
      };
      const onChanged = () => {
        this.loadVoices();
        if (this.spanishVoices.length > 0) {
          window.speechSynthesis.removeEventListener('voiceschanged', onChanged);
          finish();
        }
      };
      window.speechSynthesis.addEventListener('voiceschanged', onChanged);
      window.setTimeout(() => {
        window.speechSynthesis.removeEventListener('voiceschanged', onChanged);
        finish();
      }, 350);
    }).finally(() => {
      this.voicesReadyPromise = null;
    });

    return this.voicesReadyPromise;
  }

  private assignDistinctCharacterVoices() {
    this.characterVoiceMap.clear();
    if (this.spanishVoices.length === 0) return;

    const usedNames = new Set<string>();
    const femaleHints = [
      'monica', 'paulina', 'helena', 'laura', 'lucia', 'sofia', 'victoria',
      'paloma', 'carmen', 'conchita', 'female', 'elena', 'ines', 'marisol',
      'angelina', 'mujer', 'google español', 'ximena', 'elvira'
    ];
    const maleHints = [
      'jorge', 'pablo', 'diego', 'carlos', 'alvaro', 'enrique', 'male',
      'miguel', 'antonio', 'luis', 'david', 'raul', 'tomas', 'hombre', 'sergio'
    ];

    for (const [charId, profile] of Object.entries(CHARACTER_VOICE_PROFILES)) {
      const isFemale = profile.gender === 'female';
      const sameGenderHints = isFemale ? femaleHints : maleHints;
      const oppositeHints = isFemale ? maleHints : femaleHints;

      let picked = this.spanishVoices.find(
        (v) =>
          !usedNames.has(v.name) &&
          !oppositeHints.some((kw) => v.name.toLowerCase().includes(kw)) &&
          profile.preferredVoiceKeywords.some((kw) => v.name.toLowerCase().includes(kw))
      );

      if (!picked) {
        picked = this.spanishVoices.find(
          (v) =>
            !usedNames.has(v.name) &&
            sameGenderHints.some((kw) => v.name.toLowerCase().includes(kw))
        );
      }

      if (!picked) {
        picked = this.spanishVoices.find(
          (v) =>
            sameGenderHints.some((kw) => v.name.toLowerCase().includes(kw))
        );
      }

      if (!picked) {
        picked = this.spanishVoices.find(
          (v) => !oppositeHints.some((kw) => v.name.toLowerCase().includes(kw))
        );
      }

      if (picked) {
        this.characterVoiceMap.set(charId, picked);
        usedNames.add(picked.name);
      }
    }
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  private clearTimersAndLoops() {
    if (this.mouthLoopId !== null) {
      window.clearInterval(this.mouthLoopId);
      this.mouthLoopId = null;
    }
    if (this.mouthRafId !== null) {
      window.cancelAnimationFrame(this.mouthRafId);
      this.mouthRafId = null;
    }
    if (this.speechFallbackTimer !== null) {
      window.clearTimeout(this.speechFallbackTimer);
      this.speechFallbackTimer = null;
    }
    if (this.speechPulseTimer !== null) {
      window.clearInterval(this.speechPulseTimer);
      this.speechPulseTimer = null;
    }
  }

  private stopCurrentPlayback() {
    this.clearTimersAndLoops();
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.currentAudio) {
      this.currentAudio.onloadedmetadata = null;
      this.currentAudio.onplay = null;
      this.currentAudio.onplaying = null;
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Calculates the exact duration (ms) of every phoneme in an utterance,
   * aligned against the decoded waveform's true active acoustic bounds when available
   * and scaled by playbackSpeed (0.5x..2.0x).
   */
  public computePhonemeTimings(
    text: string,
    totalDurationMs: number,
    audioBuffer?: AudioBuffer | null,
    playbackSpeed: number = 1.0
  ): PhonemeTiming[] {
    const safeTotalMs = Math.max(1, Math.round(totalDurationMs));
    const speed = Math.max(0.5, Math.min(2.0, playbackSpeed));
    const rawTokens = tokenizeSpanishPhonemes(text);

    const applyScaledTimings = (rawSegments: Array<{
      phoneme: string;
      startMs: number;
      endMs: number;
      mouthLevel: MouthOpenLevel;
      isSilence: boolean;
    }>): PhonemeTiming[] => {
      const scaledTotalMs = Math.max(1, Math.round(safeTotalMs / speed));
      return rawSegments.map((seg, idx) => {
        const scaledStartMs = idx === 0 ? 0 : Math.min(scaledTotalMs, Math.round(seg.startMs / speed));
        const scaledEndMs =
          idx === rawSegments.length - 1
            ? scaledTotalMs
            : Math.max(scaledStartMs + 1, Math.min(scaledTotalMs, Math.round(seg.endMs / speed)));
        return {
          index: idx,
          phoneme: seg.phoneme,
          startMs: seg.startMs,
          endMs: seg.endMs,
          durationMs: Math.max(1, seg.endMs - seg.startMs),
          scaledStartMs,
          scaledEndMs,
          scaledDurationMs: Math.max(1, scaledEndMs - scaledStartMs),
          mouthLevel: seg.mouthLevel,
          isSilence: seg.isSilence,
        };
      });
    };

    if (rawTokens.length === 0) {
      return applyScaledTimings([
        { phoneme: 'SIL', startMs: 0, endMs: safeTotalMs, mouthLevel: 0, isSilence: true },
      ]);
    }

    // 1. Analyze true acoustic energy at 10ms resolution (100 Hz) if decoded buffer is provided
    let speechStartMs = 0;
    let speechEndMs = safeTotalMs;
    let binRms: number[] | null = null;
    let refPeak = 0.08;

    if (audioBuffer && audioBuffer.length > 0 && audioBuffer.sampleRate > 0) {
      const channel = audioBuffer.getChannelData(0);
      const stepSamples = Math.max(1, Math.floor(audioBuffer.sampleRate / 100)); // 10ms bins
      const bins: number[] = [];
      let maxRms = 0;
      const nonZeroBins: number[] = [];

      for (let s = 0; s < channel.length; s += stepSamples) {
        const end = Math.min(channel.length, s + stepSamples);
        let sumSq = 0;
        for (let k = s; k < end; k++) {
          const val = channel[k];
          sumSq += val * val;
        }
        const rms = Math.sqrt(sumSq / Math.max(1, end - s));
        bins.push(rms);
        if (rms > maxRms) maxRms = rms;
        if (rms > 0.003) nonZeroBins.push(rms);
      }

      if (bins.length > 0 && maxRms > 0.004) {
        binRms = bins;
        nonZeroBins.sort((a, b) => a - b);
        refPeak =
          nonZeroBins.length > 0
            ? Math.max(0.025, nonZeroBins[Math.floor(nonZeroBins.length * 0.88)])
            : Math.max(0.025, maxRms * 0.8);

        const gate = Math.max(0.004, refPeak * 0.05);
        let firstActive = bins.findIndex((v) => v >= gate);
        let lastActive = -1;
        for (let b = bins.length - 1; b >= 0; b--) {
          if (bins[b] >= gate) {
            lastActive = b;
            break;
          }
        }

        if (firstActive >= 0 && lastActive >= firstActive) {
          const detectedStart = Math.max(0, firstActive * 10 - 10);
          const detectedEnd = Math.min(safeTotalMs, (lastActive + 1) * 10 + 15);
          if (detectedEnd - detectedStart >= Math.min(90, safeTotalMs)) {
            speechStartMs = detectedStart;
            speechEndMs = detectedEnd;
          }
        }
      }
    }

    const leadingSilMs = speechStartMs >= 20 ? speechStartMs : 0;
    const trailingSilMs = safeTotalMs - speechEndMs >= 20 ? safeTotalMs - speechEndMs : 0;
    const activeStartMs = leadingSilMs;
    const activeEndMs = safeTotalMs - trailingSilMs;
    const activeWindowMs = Math.max(1, activeEndMs - activeStartMs);

    // 2. Distribute exact integer millisecond durations across tokens using Largest Remainder Method
    // If phrase is very compressed (e.g. 240ms) with many tokens, cap token durations cleanly >= 1ms
    const totalWeight = rawTokens.reduce((acc, t) => acc + t.weight, 0) || rawTokens.length;
    const exactSlices = rawTokens.map((t, idx) => {
      const raw = (t.weight / totalWeight) * activeWindowMs;
      const floored = Math.floor(raw);
      return { idx, floored, frac: raw - floored };
    });

    let allocatedSum = exactSlices.reduce((acc, s) => acc + s.floored, 0);
    let remainder = activeWindowMs - allocatedSum;

    // Ensure every phoneme has at least 1ms if total window permits
    if (activeWindowMs >= rawTokens.length) {
      for (const s of exactSlices) {
        if (s.floored === 0) {
          s.floored = 1;
          remainder -= 1;
        }
      }
      if (remainder < 0) {
        const sortedDesc = [...exactSlices].sort((a, b) => b.floored - a.floored);
        for (const s of sortedDesc) {
          if (remainder >= 0) break;
          if (s.floored > 1) {
            s.floored -= 1;
            remainder += 1;
          }
        }
      }
    }

    if (remainder > 0) {
      const byFrac = [...exactSlices].sort((a, b) => b.frac - a.frac);
      let cursor = 0;
      while (remainder > 0) {
        byFrac[cursor % byFrac.length].floored += 1;
        remainder -= 1;
        cursor += 1;
      }
    }

    const durations = exactSlices.map((s) => Math.max(0, s.floored));

    // 3. Assemble raw timeline segments + fuse acoustic RMS energy into phoneme mouth aperture
    const rawSegments: Array<{
      phoneme: string;
      startMs: number;
      endMs: number;
      mouthLevel: MouthOpenLevel;
      isSilence: boolean;
    }> = [];

    if (leadingSilMs > 0) {
      rawSegments.push({
        phoneme: 'SIL',
        startMs: 0,
        endMs: leadingSilMs,
        mouthLevel: 0,
        isSilence: true,
      });
    }

    let cursorMs = activeStartMs;
    for (let idx = 0; idx < rawTokens.length; idx++) {
      const dur = durations[idx];
      if (dur <= 0) continue;
      const start = cursorMs;
      const end = idx === rawTokens.length - 1 ? activeEndMs : Math.min(activeEndMs, cursorMs + dur);
      cursorMs = end;

      const tok = rawTokens[idx];
      let mouthLevel: MouthOpenLevel = tok.baseMouth;

      if (binRms && binRms.length > 0) {
        const binStart = Math.min(binRms.length - 1, Math.max(0, Math.floor(start / 10)));
        const binEnd = Math.min(binRms.length - 1, Math.max(binStart, Math.floor(Math.max(start, end - 1) / 10)));
        let peakInWindow = 0;
        for (let b = binStart; b <= binEnd; b++) {
          if (binRms[b] > peakInWindow) peakInWindow = binRms[b];
        }
        const norm = peakInWindow / refPeak;

        if (tok.isPause) {
          mouthLevel = norm >= 0.28 ? 1 : 0;
        } else if (tok.isBilabial) {
          mouthLevel = norm < 0.05 ? 0 : 1;
        } else if (norm < 0.05) {
          mouthLevel = 0;
        } else if (norm >= 0.55) {
          mouthLevel = Math.max(tok.baseMouth, 3) as MouthOpenLevel;
        } else if (norm >= 0.24) {
          mouthLevel = Math.max(tok.baseMouth, 2) as MouthOpenLevel;
        } else {
          mouthLevel = Math.max(1, tok.baseMouth) as MouthOpenLevel;
        }
      }

      rawSegments.push({
        phoneme: tok.phoneme,
        startMs: start,
        endMs: end,
        mouthLevel,
        isSilence: tok.isPause,
      });
    }

    if (trailingSilMs > 0) {
      rawSegments.push({
        phoneme: 'SIL',
        startMs: activeEndMs,
        endMs: safeTotalMs,
        mouthLevel: 0,
        isSilence: true,
      });
    }

    return applyScaledTimings(rawSegments);
  }

  /**
   * Preloads all static pre-downloaded neural audio files for the active table characters + Manolo
   * directly into RAM so speaking is 0ms instant with zero runtime generation delay.
   */
  public async pregenerateForCharacters(characterIds: string[]) {
    if (typeof window === 'undefined') return;
    const uniqueIds = Array.from(new Set(characterIds.filter((id) => id && id !== 'player')));
    if (uniqueIds.length === 0) return;

    const manifest = await this.loadVoiceManifest();

    const filesToPreload: Array<{ cacheKey: string; url: string }> = [];
    const fallbackApiItems: Array<{ characterId: string; text: string; gender: 'male' | 'female' }> = [];

    for (const charId of uniqueIds) {
      if (this.preloadedChars.has(charId)) continue;
      this.preloadedChars.add(charId);

      const profile = CHARACTER_VOICE_PROFILES[charId];
      const gender = profile?.gender || 'male';
      const phrases = getPregenerablePhrasesForCharacter(charId);

      for (const raw of phrases) {
        const clean = cleanSpokenText(raw);
        if (!clean) continue;
        const cacheKey = `${charId}:${clean}`;
        if (this.rawAudioCache.has(cacheKey)) continue;

        const staticUrl = manifest[cacheKey];
        if (staticUrl) {
          filesToPreload.push({ cacheKey, url: staticUrl });
        } else {
          fallbackApiItems.push({ characterId: charId, text: clean, gender });
        }
      }
    }

    // Fetch static pre-downloaded MP3 files into RAM in small parallel batches
    for (let i = 0; i < filesToPreload.length; i += 6) {
      const batch = filesToPreload.slice(i, i + 6);
      await Promise.all(
        batch.map(async ({ cacheKey, url }) => {
          if (this.rawAudioCache.has(cacheKey)) return;
          try {
            const res = await fetch(url);
            if (!res.ok) return;
            const ct = res.headers.get('Content-Type') || '';
            const buf = await res.arrayBuffer();
            if (this.isValidAudioBuffer(buf, ct)) {
              this.cacheAudioBuffer(cacheKey, buf);
            }
          } catch {
            // Non-fatal preload
          }
        })
      );
    }

    // Any extra phrase not in static manifest gets generated via server multi-engine endpoint
    if (fallbackApiItems.length > 0) {
      try {
        await fetch('/api/tts/pregenerate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: fallbackApiItems.slice(0, 36) }),
        });
      } catch {
        // Non-fatal
      }
    }
  }

  private isValidAudioBuffer(buf: ArrayBuffer, contentType: string = ''): boolean {
    if (!buf || buf.byteLength < 128) return false;
    const ct = contentType.toLowerCase();
    if (ct.includes('text/html') || ct.includes('application/json') || ct.startsWith('text/')) {
      return false;
    }
    const hdr = new Uint8Array(buf.slice(0, 4));
    const isWav = hdr[0] === 0x52 && hdr[1] === 0x49 && hdr[2] === 0x46 && hdr[3] === 0x46; // RIFF
    const isId3 = hdr[0] === 0x49 && hdr[1] === 0x44 && hdr[2] === 0x33; // ID3
    const isMp3Sync = hdr[0] === 0xff && (hdr[1] & 0xe0) === 0xe0; // MPEG frame sync
    const isOgg = hdr[0] === 0x4f && hdr[1] === 0x67 && hdr[2] === 0x67 && hdr[3] === 0x53; // OggS
    return isWav || isId3 || isMp3Sync || isOgg;
  }

  private cacheAudioBuffer(cacheKey: string, buf: ArrayBuffer) {
    if (this.rawAudioCache.size > 400) {
      const firstKey = this.rawAudioCache.keys().next().value;
      if (firstKey) this.rawAudioCache.delete(firstKey);
    }
    this.rawAudioCache.set(cacheKey, buf);
  }

  private async decodeAudioBufferSafe(
    arrayBuffer: ArrayBuffer,
    cacheKey?: string
  ): Promise<AudioBuffer | null> {
    if (cacheKey && this.decodedAudioCache.has(cacheKey)) {
      return this.decodedAudioCache.get(cacheKey)!;
    }

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return null;

      // Never allow audio decoding to stall playback past 180ms
      const decoded = await Promise.race<AudioBuffer | null>([
        ctx.decodeAudioData(arrayBuffer.slice(0)).catch(() => null),
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 180)),
      ]);

      if (decoded && cacheKey) {
        if (this.decodedAudioCache.size >= MAX_DECODED_CACHE_ENTRIES) {
          const first = this.decodedAudioCache.keys().next().value;
          if (first) this.decodedAudioCache.delete(first);
        }
        this.decodedAudioCache.set(cacheKey, decoded);
      }
      return decoded;
    } catch {
      return null;
    }
  }

  private findPhonemeAtRawTime(timings: PhonemeTiming[], rawElapsedMs: number): PhonemeTiming | null {
    if (timings.length === 0) return null;
    for (let i = 0; i < timings.length; i++) {
      const t = timings[i];
      if (rawElapsedMs >= t.startMs && rawElapsedMs < t.endMs) {
        return t;
      }
    }
    return timings[timings.length - 1];
  }

  private findPhonemeAtScaledTime(timings: PhonemeTiming[], scaledElapsedMs: number): PhonemeTiming | null {
    if (timings.length === 0) return null;
    for (let i = 0; i < timings.length; i++) {
      const t = timings[i];
      if (scaledElapsedMs >= t.scaledStartMs && scaledElapsedMs < t.scaledEndMs) {
        return t;
      }
    }
    return timings[timings.length - 1];
  }

  private playAudioWithPitchPreservedSpeedAndSync(
    arrayBuffer: ArrayBuffer,
    cleanText: string,
    characterId: string,
    token: number,
    playbackSpeed: number,
    speakerPosition?: SpeechSpeaker,
    mimeType: string = 'audio/mpeg',
    cacheKey?: string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const speed = Math.max(0.5, Math.min(2.0, playbackSpeed));
      let settled = false;
      let audioSafetyTimer: number | null = null;

      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        if (audioSafetyTimer !== null) {
          window.clearTimeout(audioSafetyTimer);
          audioSafetyTimer = null;
        }
        if (token === this.requestCounter) {
          this.clearTimersAndLoops();
          if (this.currentObjectUrl === url) {
            URL.revokeObjectURL(url);
            this.currentObjectUrl = null;
          }
          this.currentAudio = null;
          if (speakerPosition) {
            this.dispatchPhonemeSync({
              speaker: speakerPosition,
              characterId,
              text: cleanText,
              isSpeaking: false,
              phoneme: 'SIL',
              mouthLevel: 0,
              phonemeIndex: -1,
              elapsedMs: 0,
              durationMs: 0,
              phonemeStartMs: 0,
              phonemeDurationMs: 0,
              playbackSpeed: speed,
              timings: [],
            });
          }
          this.notifySpeaker(null);
        }
        this.currentUtteranceFinish = null;
        resolve(ok);
      };

      // Sniff WAV vs MP3 header cleanly
      const view = new Uint8Array(arrayBuffer.slice(0, 4));
      const isWav = view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46;
      const blob = new Blob([arrayBuffer], { type: isWav ? 'audio/wav' : mimeType });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = 0.98;
      // Preserve natural voice timbre while scaling speed 0.5x..1.5x
      audio.preservesPitch = true;
      (audio as unknown as { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true;
      (audio as unknown as { mozPreservesPitch?: boolean }).mozPreservesPitch = true;
      audio.defaultPlaybackRate = speed;
      audio.playbackRate = speed;

      this.currentAudio = audio;
      this.currentObjectUrl = url;
      this.currentUtteranceFinish = () => finish(true);

      const startPlayback = async () => {
        try {
          const decodedBuffer = await this.decodeAudioBufferSafe(arrayBuffer, cacheKey);

          if (token !== this.requestCounter || !this.enabled) {
            finish(true);
            return;
          }

          const getRawDurationMs = () => {
            if (decodedBuffer && decodedBuffer.duration > 0) {
              return Math.round(decodedBuffer.duration * 1000);
            }
            if (Number.isFinite(audio.duration) && audio.duration > 0) {
              return Math.round(audio.duration * 1000);
            }
            return Math.max(480, cleanText.length * 72 + 240);
          };

          let rawDurMs = getRawDurationMs();
          let timings = this.computePhonemeTimings(cleanText, rawDurMs, decodedBuffer, speed);
          if (cacheKey && decodedBuffer) {
            if (this.phonemeTimingCache.size > 400) {
              const first = this.phonemeTimingCache.keys().next().value;
              if (first) this.phonemeTimingCache.delete(first);
            }
            this.phonemeTimingCache.set(`${cacheKey}@${speed.toFixed(2)}`, timings);
          }

          let trackingStarted = false;
          let playStartedPerf = 0;
          let lastEmittedIndex = -2;
          let lastEmittedMouth: MouthOpenLevel = 0;
          let didSeekLeadingSilence = false;

          const firstSpoken = timings.find((t) => !t.isSilence && t.mouthLevel > 0);
          const leadingOffsetMs = firstSpoken && firstSpoken.startMs > 45 ? Math.max(0, firstSpoken.startMs - 20) : 0;
          const activePhonemes = timings.filter((t) => !t.isSilence);
          const lastSpoken = activePhonemes.length > 0 ? activePhonemes[activePhonemes.length - 1] : null;
          const activeSpanEndMs = lastSpoken ? Math.min(rawDurMs, lastSpoken.endMs + 180) : rawDurMs;

          const trySeekPastLeadingSilence = () => {
            if (didSeekLeadingSilence || leadingOffsetMs <= 0) return;
            try {
              if (audio.readyState >= 1 && (!Number.isFinite(audio.duration) || leadingOffsetMs / 1000 < audio.duration - 0.15)) {
                audio.currentTime = leadingOffsetMs / 1000;
                didSeekLeadingSilence = true;
              }
            } catch {
              // Ignore seek errors on unbuffered elements
            }
          };

          const startRealtimeSync = () => {
            if (token !== this.requestCounter || settled) return;
            audio.playbackRate = speed;

            const updatedRawDurMs = getRawDurationMs();
            if (!decodedBuffer && updatedRawDurMs !== rawDurMs) {
              rawDurMs = updatedRawDurMs;
              timings = this.computePhonemeTimings(cleanText, rawDurMs, null, speed);
            }

            trySeekPastLeadingSilence();

            const effectivePlayRawMs = Math.max(250, activeSpanEndMs - (didSeekLeadingSilence ? leadingOffsetMs : 0));
            const scaledDurationMs = Math.max(250, Math.round(effectivePlayRawMs / speed));
            this.notifySpeaker(speakerPosition ?? null, scaledDurationMs);

            if (audioSafetyTimer !== null) window.clearTimeout(audioSafetyTimer);
            audioSafetyTimer = window.setTimeout(() => finish(true), scaledDurationMs + 900);

            if (trackingStarted) return;
            trackingStarted = true;
            playStartedPerf = performance.now();

            const syncTick = () => {
              if (settled || token !== this.requestCounter) return;
              if (audio.ended) {
                finish(true);
                return;
              }
              if (audio.paused) return;

              // Prefer exact media clock (`audio.currentTime`), fallback gracefully if driver clock lags
              const mediaMs = audio.currentTime * 1000;
              const startBase = didSeekLeadingSilence ? leadingOffsetMs : 0;
              const fallbackMs = startBase + (performance.now() - playStartedPerf) * speed;
              const rawElapsedMs =
                mediaMs > startBase + 2
                  ? mediaMs
                  : Math.min(rawDurMs, fallbackMs > startBase + 80 ? fallbackMs : Math.max(mediaMs, startBase));
              const scaledElapsedMs = Math.min(scaledDurationMs, Math.max(0, Math.round((rawElapsedMs - startBase) / speed)));

              if (decodedBuffer && rawElapsedMs >= activeSpanEndMs) {
                finish(true);
                return;
              }

              const currentPhoneme = this.findPhonemeAtRawTime(timings, rawElapsedMs);
              if (currentPhoneme) {
                if (
                  currentPhoneme.index !== lastEmittedIndex ||
                  currentPhoneme.mouthLevel !== lastEmittedMouth
                ) {
                  lastEmittedIndex = currentPhoneme.index;
                  lastEmittedMouth = currentPhoneme.mouthLevel;

                  this.dispatchPhonemeSync({
                    speaker: speakerPosition ?? null,
                    characterId,
                    text: cleanText,
                    isSpeaking: true,
                    phoneme: currentPhoneme.phoneme,
                    mouthLevel: currentPhoneme.mouthLevel,
                    phonemeIndex: currentPhoneme.index,
                    elapsedMs: scaledElapsedMs,
                    durationMs: scaledDurationMs,
                    phonemeStartMs: currentPhoneme.scaledStartMs,
                    phonemeDurationMs: currentPhoneme.scaledDurationMs,
                    playbackSpeed: speed,
                    timings,
                  });
                }
              }
            };

            // Emit immediate initial state synchronously, then track via both rAF + 16ms backup interval
            syncTick();

            const rafLoop = () => {
              if (settled || token !== this.requestCounter) return;
              syncTick();
              this.mouthRafId = window.requestAnimationFrame(rafLoop);
            };
            this.mouthRafId = window.requestAnimationFrame(rafLoop);
            this.mouthLoopId = window.setInterval(syncTick, 16);
          };

          audio.onloadedmetadata = () => {
            if (token !== this.requestCounter || settled) return;
            const newRawDur = getRawDurationMs();
            if (newRawDur !== rawDurMs && !decodedBuffer) {
              rawDurMs = newRawDur;
              timings = this.computePhonemeTimings(cleanText, rawDurMs, null, speed);
            }
            trySeekPastLeadingSilence();
            const scaledDur = Math.max(250, Math.round((rawDurMs - (didSeekLeadingSilence ? leadingOffsetMs : 0)) / speed));
            this.notifySpeaker(speakerPosition ?? null, scaledDur);
          };

          audio.onplay = startRealtimeSync;
          audio.onplaying = startRealtimeSync;
          audio.onended = () => finish(true);
          audio.onerror = () => finish(false);

          audioSafetyTimer = window.setTimeout(() => finish(true), 12000);
          await audio.play();
          startRealtimeSync();
        } catch {
          finish(false);
        }
      };

      void startPlayback();
    });
  }

  private async speakFallbackWebSpeech(
    cleanText: string,
    characterId: string,
    token: number,
    playbackSpeed: number,
    options?: { pitch?: number; rate?: number; gender?: 'male' | 'female'; speakerPosition?: SpeechSpeaker }
  ): Promise<boolean> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return false;
    }

    await this.ensureVoicesLoaded();
    if (token !== this.requestCounter || !this.enabled) return false;
    if (this.spanishVoices.length === 0) {
      return false;
    }

    return new Promise<boolean>((resolve) => {
      try {
        const profile = CHARACTER_VOICE_PROFILES[characterId];
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'es-ES';

        const assignedVoice = this.characterVoiceMap.get(characterId);
        utterance.voice = assignedVoice || this.spanishVoices[0];

        const basePitch = options?.pitch ?? profile?.webSpeechPitch ?? 1.0;
        utterance.pitch = Math.max(0.8, Math.min(1.14, basePitch));

        const baseRate = options?.rate ?? profile?.webSpeechRate ?? 1.0;
        const clampedSpeed = Math.max(0.5, Math.min(2.0, playbackSpeed));
        const finalRate =
          clampedSpeed < 1.0
            ? 0.5 + ((clampedSpeed - 0.5) / 0.5) * (baseRate - 0.5)
            : clampedSpeed > 1.0
            ? baseRate + ((clampedSpeed - 1.0) / 1.0) * (2.0 - baseRate)
            : baseRate;
        utterance.rate = Math.max(0.5, Math.min(2.0, Number(finalRate.toFixed(2))));
        utterance.volume = 0.96;

        const rawEstimatedMs = Math.max(480, Math.min(9500, cleanText.length * 68 + 160));
        const timings = this.computePhonemeTimings(cleanText, rawEstimatedMs, null, utterance.rate);
        const scaledTotalMs = timings.length > 0 ? timings[timings.length - 1].scaledEndMs : rawEstimatedMs;

        let started = false;
        let settled = false;
        let startPerf = performance.now();
        let lastEmittedIndex = -2;
        const speakerPos = options?.speakerPosition ?? null;

        const finishSpeech = (ok: boolean = true) => {
          if (settled) return;
          settled = true;
          if (token === this.requestCounter) {
            this.clearTimersAndLoops();
            if (speakerPos) {
              this.dispatchPhonemeSync({
                speaker: speakerPos,
                characterId,
                text: cleanText,
                isSpeaking: false,
                phoneme: 'SIL',
                mouthLevel: 0,
                phonemeIndex: -1,
                elapsedMs: scaledTotalMs,
                durationMs: scaledTotalMs,
                phonemeStartMs: scaledTotalMs,
                phonemeDurationMs: 0,
                playbackSpeed: utterance.rate,
                timings: [],
              });
            }
            this.notifySpeaker(null);
          }
          this.currentUtteranceFinish = null;
          resolve(ok);
        };

        this.currentUtteranceFinish = () => finishSpeech(true);

        const beginPhonemeTicker = () => {
          if (started || settled || token !== this.requestCounter) return;
          started = true;
          startPerf = performance.now();
          this.notifySpeaker(speakerPos, scaledTotalMs);

          const tick = () => {
            if (settled || token !== this.requestCounter) return;
            const elapsedMs = Math.min(scaledTotalMs, Math.round(performance.now() - startPerf));
            const current = this.findPhonemeAtScaledTime(timings, elapsedMs);
            if (current && current.index !== lastEmittedIndex) {
              lastEmittedIndex = current.index;
              this.dispatchPhonemeSync({
                speaker: speakerPos,
                characterId,
                text: cleanText,
                isSpeaking: true,
                phoneme: current.phoneme,
                mouthLevel: current.mouthLevel,
                phonemeIndex: current.index,
                elapsedMs,
                durationMs: scaledTotalMs,
                phonemeStartMs: current.scaledStartMs,
                phonemeDurationMs: current.scaledDurationMs,
                playbackSpeed: utterance.rate,
                timings,
              });
            }
          };

          tick();
          this.speechPulseTimer = window.setInterval(tick, 20);
        };

        utterance.onstart = beginPhonemeTicker;
        utterance.onend = () => finishSpeech(true);
        utterance.onerror = () => finishSpeech(false);

        this.speechFallbackTimer = window.setTimeout(() => {
          finishSpeech(true);
        }, scaledTotalMs + 1600);

        window.speechSynthesis.speak(utterance);
        window.setTimeout(() => {
          if (!started && !settled && token === this.requestCounter) {
            beginPhonemeTicker();
          }
        }, 120);
      } catch {
        this.currentUtteranceFinish = null;
        resolve(false);
      }
    });
  }

  private resolveIdleWaiters() {
    if (this.idleWaiters.length === 0) return;
    const waiters = this.idleWaiters.splice(0, this.idleWaiters.length);
    waiters.forEach((fn) => fn());
  }

  public isSpeaking(): boolean {
    return this.isProcessingSpeech || this.speechQueue.length > 0;
  }

  public waitForSpeechIdle(maxWaitMs: number = 12000): Promise<void> {
    if (!this.enabled || typeof window === 'undefined' || !this.isSpeaking()) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        resolve();
      };
      const timer = window.setTimeout(() => {
        const idx = this.idleWaiters.indexOf(finish);
        if (idx >= 0) this.idleWaiters.splice(idx, 1);
        finish();
      }, maxWaitMs);
      this.idleWaiters.push(finish);
    });
  }

  private async playSingleItem(item: QueuedSpeech): Promise<void> {
    if (!this.enabled || typeof window === 'undefined') return;
    const { cleanText, characterId, options } = item;
    const token = ++this.requestCounter;
    const profile = CHARACTER_VOICE_PROFILES[characterId];
    const gender: 'male' | 'female' = options?.gender || profile?.gender || 'male';
    const playbackSpeed = Math.max(0.5, Math.min(2.0, options?.playbackSpeed ?? 1.0));
    const cacheKey = `${characterId}:${cleanText}`;

    // 1. Check in-RAM preloaded audio buffer first (0ms latency)
    let buf = this.rawAudioCache.get(cacheKey);
    let contentType = 'audio/mpeg';

    // 2. Check static pre-downloaded file from /voices/manifest.json
    if (!buf) {
      try {
        const manifest = await this.loadVoiceManifest();
        const staticUrl = manifest[cacheKey];
        if (staticUrl) {
          this.abortController = new AbortController();
          const staticRes = await fetch(staticUrl, { signal: this.abortController.signal });
          if (staticRes.ok) {
            const ct = staticRes.headers.get('Content-Type') || '';
            const fetched = await staticRes.arrayBuffer();
            if (this.isValidAudioBuffer(fetched, ct)) {
              buf = fetched;
              contentType = ct || 'audio/mpeg';
              this.cacheAudioBuffer(cacheKey, buf);
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }

    // 3. Fallback to backend multi-engine neural synthesis for unseen dynamic lines
    if (!buf) {
      try {
        this.abortController = new AbortController();
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText, characterId, gender }),
          signal: this.abortController.signal,
        });

        if (res.status === 204) return;
        if (!res.ok) {
          throw new Error(`TTS HTTP ${res.status}`);
        }

        const ct = res.headers.get('Content-Type') || '';
        const fetched = await res.arrayBuffer();
        if (!this.isValidAudioBuffer(fetched, ct)) {
          throw new Error('Invalid audio payload');
        }
        buf = fetched;
        contentType = ct || 'audio/mpeg';
        this.cacheAudioBuffer(cacheKey, buf);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }

    if (buf && token === this.requestCounter && this.enabled) {
      const played = await this.playAudioWithPitchPreservedSpeedAndSync(
        buf,
        cleanText,
        characterId,
        token,
        playbackSpeed,
        options?.speakerPosition,
        contentType,
        cacheKey
      );
      if (played) return;
    }

    if (token !== this.requestCounter || !this.enabled) return;

    // 4. Emergency Web Speech fallback only if offline & audio failed
    const spoke = await this.speakFallbackWebSpeech(
      cleanText,
      characterId,
      token,
      playbackSpeed,
      options
    );
    if (!spoke && token === this.requestCounter && this.enabled) {
      if (options?.speakerPosition) {
        await this.runTimedPhonemeFallback(
          cleanText,
          characterId,
          token,
          playbackSpeed,
          options.speakerPosition
        );
      } else {
        this.notifySpeaker(null);
      }
    }
  }

  private runTimedPhonemeFallback(
    cleanText: string,
    characterId: string,
    token: number,
    playbackSpeed: number,
    speakerPos: SpeechSpeaker
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const speed = Math.max(0.5, Math.min(2.0, playbackSpeed));
      const rawEstimatedMs = Math.max(480, Math.min(6000, cleanText.length * 64 + 140));
      const timings = this.computePhonemeTimings(cleanText, rawEstimatedMs, null, speed);
      const scaledTotalMs = timings.length > 0 ? timings[timings.length - 1].scaledEndMs : rawEstimatedMs;

      let settled = false;
      const startPerf = performance.now();
      let lastEmittedIndex = -2;

      const finish = () => {
        if (settled) return;
        settled = true;
        if (token === this.requestCounter) {
          this.clearTimersAndLoops();
          this.dispatchPhonemeSync({
            speaker: speakerPos,
            characterId,
            text: cleanText,
            isSpeaking: false,
            phoneme: 'SIL',
            mouthLevel: 0,
            phonemeIndex: -1,
            elapsedMs: scaledTotalMs,
            durationMs: scaledTotalMs,
            phonemeStartMs: scaledTotalMs,
            phonemeDurationMs: 0,
            playbackSpeed: speed,
            timings: [],
          });
          this.notifySpeaker(null);
        }
        this.currentUtteranceFinish = null;
        resolve();
      };

      this.currentUtteranceFinish = finish;
      this.notifySpeaker(speakerPos, scaledTotalMs);

      const tick = () => {
        if (settled || token !== this.requestCounter || !this.enabled) {
          finish();
          return;
        }
        const elapsedMs = Math.round(performance.now() - startPerf);
        if (elapsedMs >= scaledTotalMs) {
          finish();
          return;
        }
        const current = this.findPhonemeAtScaledTime(timings, elapsedMs);
        if (current && current.index !== lastEmittedIndex) {
          lastEmittedIndex = current.index;
          this.dispatchPhonemeSync({
            speaker: speakerPos,
            characterId,
            text: cleanText,
            isSpeaking: true,
            phoneme: current.phoneme,
            mouthLevel: current.mouthLevel,
            phonemeIndex: current.index,
            elapsedMs,
            durationMs: scaledTotalMs,
            phonemeStartMs: current.scaledStartMs,
            phonemeDurationMs: current.scaledDurationMs,
            playbackSpeed: speed,
            timings,
          });
        }
      };

      tick();
      this.mouthLoopId = window.setInterval(tick, 20);
      this.speechFallbackTimer = window.setTimeout(finish, scaledTotalMs + 60);
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingSpeech) return;
    this.isProcessingSpeech = true;

    try {
      while (this.speechQueue.length > 0 && this.enabled) {
        const nextItem = this.speechQueue.shift();
        if (!nextItem) break;
        await this.playSingleItem(nextItem);
        if (this.speechQueue.length > 0 && this.enabled) {
          await new Promise((r) => window.setTimeout(r, 90));
        }
      }
    } finally {
      this.isProcessingSpeech = false;
      this.notifySpeaker(null);
      this.resolveIdleWaiters();
    }
  }

  public speak(
    text: string,
    characterId: string = 'cura',
    options?: {
      pitch?: number;
      rate?: number;
      playbackSpeed?: number;
      gender?: 'male' | 'female';
      speakerPosition?: SpeechSpeaker;
    }
  ) {
    // Player has NO voice ("El jugador no tiene voz. puede ser cualquiera.")
    if (
      !this.enabled ||
      typeof window === 'undefined' ||
      characterId === 'player' ||
      options?.speakerPosition === 'player'
    ) {
      return;
    }

    const cleanText = cleanSpokenText(text);
    if (!cleanText) return;

    if (this.speechQueue.length >= 12) {
      this.speechQueue.shift();
    }
    this.speechQueue.push({ cleanText, characterId, options });

    if (!this.isProcessingSpeech) {
      void this.processQueue();
    }
  }

  public stop() {
    this.speechQueue = [];
    this.requestCounter++;
    this.stopCurrentPlayback();
    if (this.currentUtteranceFinish) {
      this.currentUtteranceFinish();
      this.currentUtteranceFinish = null;
    }
    this.isProcessingSpeech = false;
    this.activePhonemeStates.forEach((state, speaker) => {
      this.dispatchPhonemeSync({
        ...state,
        speaker,
        isSpeaking: false,
        phoneme: 'SIL',
        mouthLevel: 0,
        phonemeIndex: -1,
        phonemeDurationMs: 0,
      });
    });
    this.activePhonemeStates.clear();
    this.notifySpeaker(null);
    this.resolveIdleWaiters();
  }
}

export const ttsEngine = new TTSEngine();

