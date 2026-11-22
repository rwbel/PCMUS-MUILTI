/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AnimatedCharacter.tsx - Personaje animado con rig facial SVG
 *
 * Renderiza un personaje del Mus en su asiento de la mesa con:
 *   - Sprite del personaje (imagen sentada según posición: izquierda/derecha/arriba)
 *   - Rig facial SVG (ojos, boca, cejas) que se anima según expresión
 *   - Señas tradicionales (labio, lengua, cejas, guiño, etc.) cuando habla
 *   - Indicadores de estado: borracho, cafeinado, Mano de la partida
 *   - Burbuja de cómic con el texto que dice el personaje
 *   - Botón "¡Cazar Seña!" para oponentes (solo el jugador puede usarlo)
 *
 * El rig facial usa coordenadas definidas en FACE_RIGS (characters.ts)
 * para posicionar ojos y boca correctamente sobre el sprite.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Character,
  DrinkItem,
  FaceRig,
  PlayerPosition,
  PlayerSpeech,
  PlayerSobrietyState,
} from '../types/mus';
import { FACE_RIGS } from '../utils/characters';
import {
  MouthOpenLevel,
  TTS_PHONEME_EVENT,
  TTSPhonemeSyncEvent,
  ttsEngine,
} from '../utils/ttsEngine';
import { getPlaybackRateForSobriety } from '../utils/voiceProfiles';

export type CharacterPose = 'left' | 'right' | 'top';

export type EyeSpriteExpression =
  | 'normal'
  | 'blink'
  | 'look_left'
  | 'look_right'
  | 'wink'
  | 'closed'
  | 'brows_up'
  | 'drunk'
  | 'caffeine';

export type MouthSpriteExpression =
  | 'idle'
  | 'talk1'
  | 'talk2'
  | 'talk3'
  | 'ordago'
  | 'bite_lip'
  | 'tongue'
  | 'smirk'
  | 'drunk';

export interface CharacterSignEventDetail {
  position: PlayerPosition | 'camarero';
  signType: string;
  durationMs?: number;
}

export interface DrinkEffectEventDetail {
  position: PlayerPosition;
  drink: DrinkItem;
  alcohol: number;
  caffeine: number;
}

const FACE_SPRITE_MODULES = import.meta.glob<string>('/src/assets/images/face/*.png', {
  eager: true,
  import: 'default',
});

if (typeof window !== 'undefined') {
  for (const src of Object.values(FACE_SPRITE_MODULES)) {
    const img = new window.Image();
    img.src = src;
    if (typeof img.decode === 'function') {
      img.decode().catch(() => {});
    }
  }
}

function resolveFaceSprite(fileName: string): string {
  const fullPath = `/src/assets/images/face/${fileName}`;
  return FACE_SPRITE_MODULES[fullPath] || fullPath;
}

interface AnimatedCharacterProps {
  position: PlayerPosition | 'camarero';
  pose: CharacterPose;
  character: Character;
  isTurn: boolean;
  isMano: boolean;
  activeSpeech?: PlayerSpeech | null;
  isAudioSpeaking?: boolean;
  isVoiceEnabled?: boolean;
  sobriety: PlayerSobrietyState;
  roleLabel?: string;
  playerDisplayName?: string;
  isHuman?: boolean;
  isConnected?: boolean;
  onCatchSign?: () => void;
  canCatchSign?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const TALK_SEQUENCE: MouthSpriteExpression[] = ['talk1', 'talk2', 'talk3', 'talk2'];

export const AnimatedCharacter: React.FC<AnimatedCharacterProps> = ({
  position,
  pose,
  character,
  isTurn,
  isMano,
  activeSpeech,
  isAudioSpeaking = false,
  isVoiceEnabled = true,
  sobriety,
  roleLabel,
  playerDisplayName,
  isHuman = false,
  isConnected = true,
  onCatchSign,
  canCatchSign = false,
  onClick,
  className = '',
  style,
}) => {
  const isWaiter = position === 'camarero';
  const isLeft = pose === 'left';
  const isRight = pose === 'right';
  const isTop = pose === 'top';

  const spriteSrc = isWaiter
    ? character.seatedTop || character.avatar
    : isLeft
    ? character.seatedLeft || character.seatedAvatar
    : isRight
    ? character.seatedRight || character.seatedAvatar
    : character.seatedTop || character.seatedAvatar;

  const rigKey = isWaiter ? 'camarero_top' : `${character.id}_${pose}`;
  const rig: FaceRig = FACE_RIGS[rigKey] || {
    cx: 50,
    eyeY: 19,
    eyeDx: 4.5,
    eyeW: isTop ? 17 : 12,
    mouthX: 50,
    mouthY: 27,
    mouthW: isTop ? 15 : 11,
    skin: '#efb38e',
  };

  // Exact pixel-mapped widths derived from rig calibration (with safe fallback)
  const eyeWidthPct = rig.eyeW ?? (isTop || isWaiter ? rig.eyeDx * 3.2 : rig.eyeDx * 2.9);
  const mouthWidthPct = rig.mouthW ?? eyeWidthPct * 0.9;

  // Dynamic facial animation states
  const [isBlinking, setIsBlinking] = useState(false);
  const [glanceDir, setGlanceDir] = useState<'look_left' | 'look_right' | null>(null);
  const [talkFrameIdx, setTalkFrameIdx] = useState(0);
  const [audioMouthLevel, setAudioMouthLevel] = useState<MouthOpenLevel>(0);
  const [phonemeSync, setPhonemeSync] = useState<{
    isSpeaking: boolean;
    mouthLevel: MouthOpenLevel;
    phoneme: string;
  }>(() => {
    if (position === 'player') {
      return { isSpeaking: false, mouthLevel: 0, phoneme: 'SIL' };
    }
    const active = ttsEngine.getActivePhonemeState(position);
    return active && active.isSpeaking
      ? { isSpeaking: true, mouthLevel: active.mouthLevel, phoneme: active.phoneme }
      : { isSpeaking: false, mouthLevel: 0, phoneme: 'SIL' };
  });
  const [isMutedTalking, setIsMutedTalking] = useState(false);
  const [eventSignType, setEventSignType] = useState<string | null>(null);
  const [drinkReaction, setDrinkReaction] = useState<'alcohol' | 'caffeine' | 'remedy' | null>(null);

  const prevTotalDrinksRef = useRef(sobriety.totalDrinks);
  const eventSignTimerRef = useRef<number | null>(null);
  const drinkReactionTimerRef = useRef<number | null>(null);

  const effectiveSobriety: PlayerSobrietyState = isWaiter
    ? { alcohol: 0, caffeine: 0, totalDrinks: 0 }
    : sobriety;
  const charSpeechSpeed = getPlaybackRateForSobriety(effectiveSobriety);

  // Drink / emotional state reactions (visible on first drink, amplified with more rounds; never on waiter)
  const hasAnyAlcohol = !isWaiter && effectiveSobriety.alcohol >= 1;
  const hasAnyCaffeine = !isWaiter && effectiveSobriety.caffeine >= 1;
  const isMildDrunk = hasAnyAlcohol;
  const isDrunk = !isWaiter && effectiveSobriety.alcohol >= 2;
  const isHeavilyDrunk = !isWaiter && effectiveSobriety.alcohol >= 4;
  const isSlightlyWired = hasAnyCaffeine && !isDrunk;
  const isCaffeinated = !isWaiter && effectiveSobriety.caffeine >= 2 && !isDrunk;

  const effectiveSignType = eventSignType || activeSpeech?.signType || null;
  const isOrdago = activeSpeech?.actionType === 'ordago';
  const isPhonemeDriven = isVoiceEnabled && phonemeSync.isSpeaking;
  const isTalking = isVoiceEnabled ? phonemeSync.isSpeaking || isAudioSpeaking : isMutedTalking;

  // 1. Custom event listener: silent or explicit Señas ('pcmus:character-sign')
  useEffect(() => {
    const onCharacterSign = (ev: Event) => {
      const customEv = ev as CustomEvent<CharacterSignEventDetail>;
      const detail = customEv.detail;
      if (!detail || detail.position !== position) return;

      setEventSignType(detail.signType);
      if (eventSignTimerRef.current) window.clearTimeout(eventSignTimerRef.current);
      eventSignTimerRef.current = window.setTimeout(() => {
        setEventSignType(null);
      }, detail.durationMs ?? 2400);
    };

    window.addEventListener('pcmus:character-sign', onCharacterSign);
    return () => {
      window.removeEventListener('pcmus:character-sign', onCharacterSign);
      if (eventSignTimerRef.current) window.clearTimeout(eventSignTimerRef.current);
    };
  }, [position]);

  // 2. Custom event listener + sobriety delta detector for Drink Effects ('pcmus:drink-effect')
  useEffect(() => {
    const triggerBurst = (kind: 'alcohol' | 'caffeine' | 'remedy') => {
      setDrinkReaction(kind);
      if (drinkReactionTimerRef.current) window.clearTimeout(drinkReactionTimerRef.current);
      drinkReactionTimerRef.current = window.setTimeout(() => {
        setDrinkReaction(null);
      }, 1900);
    };

    const onDrinkEffect = (ev: Event) => {
      if (isWaiter) return;
      const customEv = ev as CustomEvent<DrinkEffectEventDetail>;
      const detail = customEv.detail;
      if (!detail?.drink || detail.position !== position) return;
      triggerBurst(detail.drink.category);
    };

    window.addEventListener('pcmus:drink-effect', onDrinkEffect);
    return () => {
      window.removeEventListener('pcmus:drink-effect', onDrinkEffect);
      if (drinkReactionTimerRef.current) window.clearTimeout(drinkReactionTimerRef.current);
    };
  }, [isWaiter, position]);

  useEffect(() => {
    if (isWaiter) {
      prevTotalDrinksRef.current = 0;
      return;
    }
    if (effectiveSobriety.totalDrinks > prevTotalDrinksRef.current) {
      const id = effectiveSobriety.lastDrinkId;
      const inferredKind: 'alcohol' | 'caffeine' | 'remedy' =
        id === 'cafe'
          ? 'caffeine'
          : id === 'agua' || id === 'tapa'
          ? 'remedy'
          : effectiveSobriety.caffeine > effectiveSobriety.alcohol && id === 'carajillo'
          ? 'caffeine'
          : 'alcohol';
      setDrinkReaction(inferredKind);
      if (drinkReactionTimerRef.current) window.clearTimeout(drinkReactionTimerRef.current);
      drinkReactionTimerRef.current = window.setTimeout(() => {
        setDrinkReaction(null);
      }, 1900);
    }
    prevTotalDrinksRef.current = effectiveSobriety.totalDrinks;
  }, [isWaiter, effectiveSobriety.totalDrinks, effectiveSobriety.lastDrinkId, effectiveSobriety.alcohol, effectiveSobriety.caffeine]);

  // 3. Natural periodic human blinking (randomized per character so nobody blinks in lockstep)
  useEffect(() => {
    let blinkTimeout: number | null = null;
    let openTimeout: number | null = null;
    let cancelled = false;

    const scheduleNextBlink = () => {
      const delay = isCaffeinated
        ? 3600 + Math.random() * 2600
        : isDrunk
        ? 1800 + Math.random() * 1900
        : 2400 + Math.random() * 2600;

      blinkTimeout = window.setTimeout(() => {
        if (cancelled) return;
        setIsBlinking(true);
        openTimeout = window.setTimeout(() => {
          if (cancelled) return;
          setIsBlinking(false);
          scheduleNextBlink();
        }, isDrunk ? 210 : 135);
      }, delay);
    };

    scheduleNextBlink();
    return () => {
      cancelled = true;
      if (blinkTimeout) window.clearTimeout(blinkTimeout);
      if (openTimeout) window.clearTimeout(openTimeout);
    };
  }, [character.id, isDrunk, isCaffeinated]);

  // 4. Subtle natural eye glances while idling or observing turns
  useEffect(() => {
    let glanceTimer: number | null = null;
    let clearTimer: number | null = null;
    let cancelled = false;

    const scheduleGlance = () => {
      const delay = 4200 + Math.random() * 4800;
      glanceTimer = window.setTimeout(() => {
        if (cancelled) return;
        const dir: 'look_left' | 'look_right' = Math.random() > 0.5 ? 'look_left' : 'look_right';
        setGlanceDir(dir);
        clearTimer = window.setTimeout(() => {
          if (cancelled) return;
          setGlanceDir(null);
          scheduleGlance();
        }, 780 + Math.random() * 420);
      }, delay);
    };

    scheduleGlance();
    return () => {
      cancelled = true;
      if (glanceTimer) window.clearTimeout(glanceTimer);
      if (clearTimer) window.clearTimeout(clearTimer);
    };
  }, [character.id]);

  // 5. Real-time synchronous phoneme & audio lip-sync (with muted duration fallback)
  useEffect(() => {
    if (position === 'player') return;

    const applyPhonemeSync = (ev: TTSPhonemeSyncEvent) => {
      if (ev.speaker !== position) return;
      setPhonemeSync({
        isSpeaking: ev.isSpeaking,
        mouthLevel: ev.isSpeaking ? ev.mouthLevel : 0,
        phoneme: ev.phoneme,
      });
      setAudioMouthLevel(ev.isSpeaking ? ev.mouthLevel : 0);
    };

    const onPhonemeDomEvent = (domEv: Event) => {
      const detail = (domEv as CustomEvent<TTSPhonemeSyncEvent>).detail;
      if (detail) applyPhonemeSync(detail);
    };

    window.addEventListener(TTS_PHONEME_EVENT, onPhonemeDomEvent);
    const unsubPhoneme = ttsEngine.subscribePhonemeSync(position, applyPhonemeSync);
    const unsubMouth = ttsEngine.subscribeMouthLevel(position, (level) => {
      setAudioMouthLevel(level);
    });

    return () => {
      window.removeEventListener(TTS_PHONEME_EVENT, onPhonemeDomEvent);
      unsubPhoneme();
      unsubMouth();
    };
  }, [position]);

  useEffect(() => {
    if (!isAudioSpeaking && !phonemeSync.isSpeaking) {
      setAudioMouthLevel(0);
    }
  }, [isAudioSpeaking, phonemeSync.isSpeaking]);

  useEffect(() => {
    if (isVoiceEnabled || !activeSpeech?.text) {
      setIsMutedTalking(false);
      return;
    }
    setIsMutedTalking(true);
    const baseMs = Math.min(2000, Math.max(450, activeSpeech.text.length * 42));
    const estMs = Math.max(250, Math.round(baseMs / charSpeechSpeed));
    const timer = window.setTimeout(() => {
      setIsMutedTalking(false);
    }, estMs);
    return () => window.clearTimeout(timer);
  }, [isVoiceEnabled, activeSpeech?.timestamp, activeSpeech?.text, charSpeechSpeed]);

  useEffect(() => {
    if (!isTalking || isOrdago || isPhonemeDriven || (isVoiceEnabled && isAudioSpeaking)) {
      setTalkFrameIdx(0);
      return;
    }
    const frameIntervalMs = Math.max(55, Math.round(125 / charSpeechSpeed));
    const interval = window.setInterval(() => {
      setTalkFrameIdx((prev) => (prev + 1) % TALK_SEQUENCE.length);
    }, frameIntervalMs);
    return () => window.clearInterval(interval);
  }, [isTalking, isOrdago, isPhonemeDriven, isVoiceEnabled, isAudioSpeaking, charSpeechSpeed]);

  // Sign interpretation flags
  const showLabio = effectiveSignType === '👄';
  const showLengua = effectiveSignType === '👅';
  const showCejas = effectiveSignType === '🤨';
  const showSmirk = effectiveSignType === '😏';
  const showGuino = effectiveSignType === '😉';
  const showCiego = effectiveSignType === '😌';

  const gender: 'male' | 'female' = character.gender === 'female' ? 'female' : 'male';

  // Resolve Eye Sprite Expression
  let eyeExpression: EyeSpriteExpression = 'normal';
  if (showCiego) {
    eyeExpression = 'closed';
  } else if (showGuino) {
    eyeExpression = 'wink';
  } else if (showCejas) {
    eyeExpression = 'brows_up';
  } else if (isBlinking) {
    eyeExpression = 'blink';
  } else if (drinkReaction === 'caffeine') {
    eyeExpression = 'caffeine';
  } else if (drinkReaction === 'alcohol') {
    eyeExpression = 'drunk';
  } else if (drinkReaction === 'remedy') {
    eyeExpression = 'closed';
  } else if (isCaffeinated || isSlightlyWired) {
    eyeExpression = 'caffeine';
  } else if (isMildDrunk) {
    eyeExpression = 'drunk';
  } else if (glanceDir) {
    eyeExpression = glanceDir;
  }

  // Resolve Mouth Sprite Expression
  let mouthExpression: MouthSpriteExpression = 'idle';
  if (showLabio) {
    mouthExpression = 'bite_lip';
  } else if (showLengua) {
    mouthExpression = 'tongue';
  } else if (showSmirk) {
    mouthExpression = 'smirk';
  } else if (isOrdago && isTalking) {
    if (isPhonemeDriven) {
      mouthExpression =
        phonemeSync.mouthLevel >= 2 ? 'ordago' : phonemeSync.mouthLevel === 1 ? 'talk1' : 'idle';
    } else if (isVoiceEnabled && isAudioSpeaking) {
      mouthExpression =
        audioMouthLevel >= 2 ? 'ordago' : audioMouthLevel === 1 ? 'talk1' : 'idle';
    } else {
      mouthExpression = 'ordago';
    }
  } else if (isTalking) {
    if (isPhonemeDriven) {
      mouthExpression =
        phonemeSync.mouthLevel === 3
          ? 'talk3'
          : phonemeSync.mouthLevel === 2
          ? 'talk2'
          : phonemeSync.mouthLevel === 1
          ? 'talk1'
          : 'idle';
    } else if (isVoiceEnabled && isAudioSpeaking) {
      mouthExpression =
        audioMouthLevel === 3
          ? 'talk3'
          : audioMouthLevel === 2
          ? 'talk2'
          : audioMouthLevel === 1
          ? 'talk1'
          : 'idle';
    } else {
      mouthExpression = TALK_SEQUENCE[talkFrameIdx];
    }
  } else if (drinkReaction === 'alcohol' || isMildDrunk) {
    mouthExpression = 'drunk';
  }

  const eyeSpriteSrc = resolveFaceSprite(`eyes_${gender}_${eyeExpression}.png`);
  const mouthSpriteSrc = resolveFaceSprite(`mouth_${gender}_${mouthExpression}.png`);

  // Subtle animation classes on eye/mouth layers during active señas (always animated, including ciego)
  const hasEyeSign = showCejas || showGuino || showCiego;
  const hasMouthSign = showLabio || showLengua || showSmirk;

  const eyeMotionClass = showCejas
    ? 'animate-sign-eyebrows'
    : showGuino
    ? 'animate-sign-wink'
    : showCiego
    ? 'animate-sign-closed'
    : '';
  const mouthMotionClass = showLabio
    ? 'animate-sign-lip'
    : showLengua
    ? 'animate-sign-tongue'
    : showSmirk
    ? 'animate-sign-smirk'
    : '';

  // Substance modulation wrappers (nested cleanly so base sign animation never gets overridden)
  const signAlcoholClass = hasAnyAlcohol
    ? effectiveSobriety.alcohol >= 3
      ? 'animate-sign-alcohol-heavy'
      : 'animate-sign-alcohol-sway'
    : '';
  const signCaffeineClass = hasAnyCaffeine
    ? effectiveSobriety.caffeine >= 3
      ? 'animate-sign-caffeine-heavy'
      : 'animate-sign-caffeine-twitch'
    : '';

  const spriteFilter = (() => {
    if (isHeavilyDrunk) {
      return 'saturate(1.45) hue-rotate(-14deg) brightness(0.96) drop-shadow(0 5px 8px rgba(0,0,0,0.45))';
    }
    if (isDrunk || drinkReaction === 'alcohol') {
      return 'saturate(1.28) hue-rotate(-8deg) drop-shadow(0 5px 8px rgba(0,0,0,0.42))';
    }
    if (isCaffeinated || drinkReaction === 'caffeine') {
      return 'contrast(1.14) saturate(1.22) brightness(1.06) drop-shadow(0 4px 10px rgba(34,211,238,0.4))';
    }
    if (isOrdago) {
      return 'contrast(1.1) saturate(1.2) drop-shadow(0 0 10px rgba(239,68,68,0.6))';
    }
    if (isTurn) {
      return 'brightness(1.04) drop-shadow(0 0 10px rgba(251,191,36,0.55))';
    }
    return 'drop-shadow(0 4px 8px rgba(0,0,0,0.45))';
  })();

  const bodyMotionClass = isHeavilyDrunk
    ? 'animate-drunk-sway-heavy'
    : isDrunk
    ? 'animate-drunk-sway'
    : isCaffeinated
    ? 'animate-caffeine-jitter'
    : isTalking
    ? 'animate-character-talking'
    : 'animate-idle-breathing';

  // Speech bubble placement anchored in line with each character's head/face
  const bubblePosClass = isWaiter
    ? 'left-[76%] top-[14%]'
    : isTop
    ? 'left-[65%] top-[13%]'
    : isLeft
    ? 'left-[60%] top-[15%]'
    : 'left-[63%] top-[15%]';

  const bubbleTailClass = 'comic-bubble-tail-left';

  // Layer depth belongs ONLY on the character body so sibling nameplates (z-35),
  // catch-sign buttons (z-45) and speech bubbles (z-60) stay above the table (z-25).
  const bodyZClass = isWaiter ? 'z-15' : isTop ? 'z-20' : 'z-21';
  const hasPositionClass = /\b(absolute|fixed|relative|sticky)\b/.test(className);
  const aspectClass = isWaiter ? 'aspect-square' : 'aspect-[440/580]';
  const mirrorTransform = isRight ? 'translate(-50%, -50%) scaleX(-1)' : 'translate(-50%, -50%)';

  return (
    <div
      onClick={onClick}
      data-active-sign={effectiveSignType || undefined}
      className={`${hasPositionClass ? '' : 'relative'} select-none ${
        onClick ? 'cursor-pointer pointer-events-auto' : 'pointer-events-none'
      } ${className}`}
      style={style}
    >
      {/* Animated Body Container (exact PNG aspect ratio 440:580 players / 1:1 waiter for 1:1 facial alignment) */}
      <div
        className={`relative w-full ${aspectClass} ${bodyZClass} transition-transform duration-300 ${bodyMotionClass} ${
          isTurn && !isWaiter ? 'scale-[1.03]' : ''
        }`}
      >
        <img
          src={spriteSrc}
          alt={character.name}
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain object-bottom pointer-events-none select-none"
          style={{ filter: spriteFilter }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.opacity = '0';
          }}
        />

        {/* Alcohol Flushed Cheeks Blush (soft cheek tint anchored to rig geometry) */}
        {(isDrunk || drinkReaction === 'alcohol') && (
          <div className="absolute inset-0 pointer-events-none animate-drunk-blush">
            <div
              className="absolute rounded-full blur-[2px]"
              style={{
                left: `${rig.cx - eyeWidthPct * 0.34}%`,
                top: `${rig.eyeY + 4.4}%`,
                width: `${eyeWidthPct * 0.34}%`,
                height: `${eyeWidthPct * 0.2}%`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: isHeavilyDrunk ? 'rgba(239, 68, 68, 0.52)' : 'rgba(239, 68, 68, 0.34)',
              }}
            />
            <div
              className="absolute rounded-full blur-[2px]"
              style={{
                left: `${rig.cx + eyeWidthPct * 0.34}%`,
                top: `${rig.eyeY + 4.4}%`,
                width: `${eyeWidthPct * 0.34}%`,
                height: `${eyeWidthPct * 0.2}%`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: isHeavilyDrunk ? 'rgba(239, 68, 68, 0.52)' : 'rgba(239, 68, 68, 0.34)',
              }}
            />
          </div>
        )}

        {/* LAYERED PNG EYES SPRITE (No clipPath: always displays human pair of eyes matching face rig) */}
        <div
          className="absolute pointer-events-none select-none"
          data-eye-expression={eyeExpression}
          style={{
            left: `${rig.cx}%`,
            top: `${rig.eyeY}%`,
            width: `${eyeWidthPct}%`,
            transform: mirrorTransform,
          }}
        >
          <div className={hasEyeSign ? signAlcoholClass : ''}>
            <div className={hasEyeSign ? signCaffeineClass : ''}>
              <img
                src={eyeSpriteSrc}
                alt=""
                draggable={false}
                className={`w-full h-auto block pointer-events-none select-none ${eyeMotionClass}`}
              />
            </div>
          </div>
        </div>

        {/* LAYERED PNG MOUTH SPRITE (Lip-sync, Señas, Alcohol grin, Órdago) */}
        <div
          className="absolute pointer-events-none select-none"
          data-mouth-expression={mouthExpression}
          data-phoneme={isPhonemeDriven ? phonemeSync.phoneme : undefined}
          style={{
            left: `${rig.mouthX}%`,
            top: `${rig.mouthY}%`,
            width: `${mouthWidthPct}%`,
            transform: mirrorTransform,
          }}
        >
          <div className={hasMouthSign ? signAlcoholClass : ''}>
            <div className={hasMouthSign ? signCaffeineClass : ''}>
              <img
                src={mouthSpriteSrc}
                alt=""
                draggable={false}
                className={`w-full h-auto block pointer-events-none select-none ${mouthMotionClass}`}
              />
            </div>
          </div>
        </div>

        {/* Subtle Drunk / Caffeine Visual Indicators */}
        {isHeavilyDrunk && !isWaiter && (
          <div className="absolute -top-2 right-[18%] text-sm animate-bounce pointer-events-none drop-shadow">
            💫
          </div>
        )}
        {isCaffeinated && !isDrunk && !isWaiter && (
          <div className="absolute -top-2 left-[20%] text-xs animate-pulse pointer-events-none drop-shadow">
            ⚡
          </div>
        )}
      </div>

      {/* MANO Badge (above character head & table) */}
      {isMano && !isWaiter && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-stone-950 text-[8px] font-black px-2 py-0.5 rounded-full shadow-lg border border-stone-900 flex items-center gap-0.5 z-35 whitespace-nowrap pointer-events-none">
          <span>★</span>
          <span>MANO</span>
        </div>
      )}

      {/* Seat Nameplate (shows player's chosen name + human/AI marker in multiplayer) */}
      {!isWaiter && playerDisplayName && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 z-35 pointer-events-none px-2 py-0.5 rounded-md border shadow-md whitespace-nowrap flex items-center gap-1 text-[9px] font-bold ${
            isTop ? 'top-[2%]' : 'top-[54%]'
          } ${
            isTurn
              ? 'bg-amber-400 text-stone-950 border-stone-950'
              : 'bg-stone-950/90 text-stone-100 border-stone-700'
          }`}
        >
          {isHuman && (
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                isConnected ? 'bg-emerald-400' : 'bg-rose-500'
              }`}
            />
          )}
          <span className="max-w-[96px] truncate">{playerDisplayName}</span>
          {roleLabel && (
            <span className="opacity-70 text-[8px] hidden sm:inline">
              · {isHuman ? roleLabel : `${roleLabel} IA`}
            </span>
          )}
        </div>
      )}

      {/* Catch Opponent Seña Button */}
      {canCatchSign && onCatchSign && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCatchSign();
          }}
          className="absolute top-[42%] left-1/2 -translate-x-1/2 bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-xl animate-bounce border-2 border-white whitespace-nowrap cursor-pointer z-45 pointer-events-auto"
        >
          ¡Cazar Seña! 👀
        </button>
      )}

      {/* Authentic Comic Speech Bubble (always crisp & top-most) */}
      {activeSpeech && (
        <div
          className={`absolute z-60 pointer-events-none animate-in fade-in zoom-in-95 ${bubblePosClass}`}
        >
          <div
            className={`comic-bubble ${bubbleTailClass} px-2.5 py-1.5 ${
              isRight
                ? 'min-w-[88px] max-w-[125px] sm:max-w-[148px]'
                : 'min-w-[105px] max-w-[155px] sm:max-w-[185px]'
            } text-center text-stone-950 font-bold`}
            style={{
              borderColor: isOrdago ? '#b91c1c' : '#000000',
              borderWidth: isOrdago ? '3px' : '2.5px',
              backgroundColor: isOrdago ? '#fef2f2' : '#ffffff',
            }}
          >
            <p className="text-[10px] sm:text-[11px] leading-tight font-extrabold tracking-tight">
              {activeSpeech.text}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};