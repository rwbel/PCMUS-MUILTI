/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * characters.ts - Definición de personajes y señas tradicionales del Mus (con assets resueltos para cliente)
 */

import { Character } from '../types/mus';
import {
  AUTHENTIC_MUS_SIGNS,
  CHARACTER_DATA,
  FACE_RIGS,
  getSignAnimationClass,
  PLAYABLE_CHARACTER_IDS,
  type PlayableCharacterId,
} from '../shared/characterData';
import { resolveImageAsset } from './assetLoader';

export { AUTHENTIC_MUS_SIGNS, FACE_RIGS, getSignAnimationClass, PLAYABLE_CHARACTER_IDS };
export type { PlayableCharacterId };

export const CHARACTERS: Record<string, Character> = Object.fromEntries(
  Object.entries(CHARACTER_DATA).map(([key, char]) => [
    key,
    {
      ...char,
      avatar: resolveImageAsset(char.avatar),
      seatedAvatar: char.seatedAvatar ? resolveImageAsset(char.seatedAvatar) : undefined,
      seatedLeft: char.seatedLeft ? resolveImageAsset(char.seatedLeft) : undefined,
      seatedRight: char.seatedRight ? resolveImageAsset(char.seatedRight) : undefined,
      seatedTop: char.seatedTop ? resolveImageAsset(char.seatedTop) : undefined,
    },
  ])
);
