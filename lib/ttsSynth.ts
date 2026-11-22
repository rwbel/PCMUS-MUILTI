import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { GoogleGenAI } from '@google/genai';

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

export const PUBLIC_VOICES_DIR = path.resolve(process.cwd(), 'public', 'voices');
export const VOICE_CACHE_DIR = process.env.VERCEL
  ? path.join('/tmp', 'pcmus-voice-cache', 'v4')
  : path.resolve(process.cwd(), '.voice-cache', 'v4');

export interface ServerVoiceProfile {
  primaryEngine: 'edge' | 'google' | 'tiktok';
  edgeVoice: string;
  edgePitch: string;
  edgeRate: string;
  tiktokVoice?: string;
  geminiVoiceName: string;
}

// Perfiles canónicos alineados 1:1 con src/utils/voiceProfiles.ts y public/voices/
export const CHARACTER_VOICE_MAP: Record<string, ServerVoiceProfile> = {
  cura:       { primaryEngine: 'edge',   edgeVoice: 'es-ES-AlvaroNeural', edgePitch: '-8Hz',  edgeRate: '-7%', geminiVoiceName: 'Charon' },
  guardia:    { primaryEngine: 'edge',   edgeVoice: 'es-ES-AlvaroNeural', edgePitch: '-14Hz', edgeRate: '+1%', geminiVoiceName: 'Fenrir' },
  tuno:       { primaryEngine: 'edge',   edgeVoice: 'es-ES-AlvaroNeural', edgePitch: '+5Hz',  edgeRate: '+6%', geminiVoiceName: 'Puck'   },
  taxista:    { primaryEngine: 'tiktok', edgeVoice: 'es-ES-AlvaroNeural', edgePitch: '-4Hz',  edgeRate: '+9%', tiktokVoice: 'es_002',        geminiVoiceName: 'Orus' },
  camarero:   { primaryEngine: 'edge',   edgeVoice: 'es-ES-AlvaroNeural', edgePitch: '-2Hz',  edgeRate: '+3%', geminiVoiceName: 'Puck'   },
  tabernera:  { primaryEngine: 'edge',   edgeVoice: 'es-ES-ElviraNeural', edgePitch: '-7Hz',  edgeRate: '-3%', geminiVoiceName: 'Kore'   },
  flamenca:   { primaryEngine: 'edge',   edgeVoice: 'es-ES-XimenaNeural', edgePitch: '+2Hz',  edgeRate: '+3%', geminiVoiceName: 'Aoede'  },
  cientifica: { primaryEngine: 'google', edgeVoice: 'es-ES-ElviraNeural', edgePitch: '0Hz',   edgeRate: '0%',  geminiVoiceName: 'Zephyr' },
  chulapa:    { primaryEngine: 'tiktok', edgeVoice: 'es-ES-XimenaNeural', edgePitch: '+6Hz',  edgeRate: '+6%', tiktokVoice: 'es_female_fp1', geminiVoiceName: 'Leda' },
};

export function hashPhraseKey(characterId: string, cleanText: string): string {
  return crypto
    .createHash('sha256')
    .update(`${characterId}:${cleanText}`)
    .digest('hex')
    .slice(0, 24);
}

async function synthesizeWithEdge(
  text: string,
  voiceName: string,
  pitch: string,
  rate: string
): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text, { pitch, rate });
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Edge TTS timeout')), 12000);
      audioStream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      audioStream.on('end', () => {
        clearTimeout(timeout);
        resolve();
      });
      audioStream.on('error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
    const out = Buffer.concat(chunks);
    if (out.length < 128) throw new Error('Empty Edge TTS audio');
    return out;
  } finally {
    try {
      tts.close();
    } catch {
      // ignore close errors
    }
  }
}

async function synthesizeWithGoogle(text: string): Promise<Buffer> {
  const chunks: string[] = [];
  let remaining = text.trim();
  while (remaining.length > 180) {
    let splitIdx = remaining.lastIndexOf(' ', 180);
    if (splitIdx <= 40) splitIdx = 180;
    chunks.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }
  if (remaining) chunks.push(remaining);

  const buffers: Buffer[] = [];
  for (const part of chunks) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(part)}&tl=es&client=tw-ob`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Google TTS HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 128) throw new Error('Empty Google TTS audio');
    buffers.push(buf);
  }
  return Buffer.concat(buffers);
}

async function synthesizeWithTikTok(text: string, voice: string): Promise<Buffer> {
  const res = await fetch('https://tiktok-tts.weilnet.workers.dev/api/generation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`TikTok TTS HTTP ${res.status}`);
  const payload = (await res.json()) as { data?: string; success?: boolean };
  if (!payload?.data) throw new Error('Empty TikTok TTS audio');
  const buf = Buffer.from(payload.data, 'base64');
  if (buf.length < 128) throw new Error('Invalid TikTok TTS buffer');
  return buf;
}

function pcm16ToWav(pcmBuffer: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([header, pcmBuffer]);
}

function parseSampleRate(mimeType: string): number {
  const match = mimeType.match(/rate=(\d+)/i);
  return match ? Number(match[1]) : 24000;
}

export async function synthesizeCharacterSpeech(
  characterId: string,
  cleanText: string,
  options?: { geminiApiKey?: string; fallbackGender?: 'male' | 'female' }
): Promise<{ buffer: Buffer; contentType: string; engine: string; ext: string }> {
  const profile: ServerVoiceProfile = CHARACTER_VOICE_MAP[characterId] || {
    primaryEngine: 'edge',
    edgeVoice: options?.fallbackGender === 'female' ? 'es-ES-ElviraNeural' : 'es-ES-AlvaroNeural',
    edgePitch: '0Hz',
    edgeRate: '0%',
    geminiVoiceName: options?.fallbackGender === 'female' ? 'Kore' : 'Puck',
  };

  if (profile.primaryEngine === 'edge') {
    const buffer = await synthesizeWithEdge(
      cleanText,
      profile.edgeVoice,
      profile.edgePitch,
      profile.edgeRate
    );
    return { buffer, contentType: 'audio/mpeg', engine: 'edge', ext: 'mp3' };
  }

  if (profile.primaryEngine === 'google') {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const buffer = await synthesizeWithGoogle(cleanText);
        return { buffer, contentType: 'audio/mpeg', engine: 'google', ext: 'mp3' };
      } catch {
        if (attempt < 2) await new Promise((r) => setTimeout(r, 350));
      }
    }
    const buffer = await synthesizeWithEdge(
      cleanText,
      profile.edgeVoice,
      profile.edgePitch,
      profile.edgeRate
    );
    return { buffer, contentType: 'audio/mpeg', engine: 'edge-fallback', ext: 'mp3' };
  }

  if (profile.primaryEngine === 'tiktok' && profile.tiktokVoice) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const buffer = await synthesizeWithTikTok(cleanText, profile.tiktokVoice);
        return { buffer, contentType: 'audio/mpeg', engine: 'tiktok', ext: 'mp3' };
      } catch {
        if (attempt < 2) await new Promise((r) => setTimeout(r, 350));
      }
    }
    const buffer = await synthesizeWithEdge(
      cleanText,
      profile.edgeVoice,
      profile.edgePitch,
      profile.edgeRate
    );
    return { buffer, contentType: 'audio/mpeg', engine: 'edge-fallback', ext: 'mp3' };
  }

  const apiKey = options?.geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const buffer = await synthesizeWithEdge(
      cleanText,
      profile.edgeVoice,
      profile.edgePitch,
      profile.edgeRate
    );
    return { buffer, contentType: 'audio/mpeg', engine: 'edge-fallback', ext: 'mp3' };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'pc-mus-tts',
      },
    },
  });

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash-lite-tts',
    contents: [
      {
        role: 'user',
        parts: [{ text: cleanText }],
      },
    ],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        languageCode: 'es-ES',
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: profile.geminiVoiceName,
          },
        },
      },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts || [];
  const audioPart = parts.find((p) => p.inlineData?.data);
  const inlineData = audioPart?.inlineData;

  if (!inlineData?.data) {
    throw new Error('Empty TTS response');
  }

  const rawAudio = Buffer.from(inlineData.data, 'base64');
  const mimeType = inlineData.mimeType || 'audio/wav';
  const isRiffWav =
    rawAudio.length >= 12 &&
    rawAudio.subarray(0, 4).toString('ascii') === 'RIFF' &&
    rawAudio.subarray(8, 12).toString('ascii') === 'WAVE';

  const wavBuffer = isRiffWav
    ? rawAudio
    : mimeType.toLowerCase().includes('l16') || mimeType.toLowerCase().includes('pcm') || !mimeType.includes('mp3')
      ? pcm16ToWav(rawAudio, parseSampleRate(mimeType))
      : rawAudio;

  return {
    buffer: wavBuffer,
    contentType: isRiffWav || !mimeType.includes('mp3') ? 'audio/wav' : mimeType,
    engine: 'gemini',
    ext: isRiffWav || !mimeType.includes('mp3') ? 'wav' : 'mp3',
  };
}

async function readExistingAudio(
  characterId: string,
  cleanText: string
): Promise<{ buffer: Buffer; contentType: string; source: string } | null> {
  const safeId = characterId.replace(/[^a-z0-9_-]/gi, '') || 'cura';
  const hash = hashPhraseKey(safeId, cleanText);

  const candidates: Array<{ filePath: string; contentType: string; source: string }> = [
    { filePath: path.join(PUBLIC_VOICES_DIR, safeId, `${hash}.mp3`), contentType: 'audio/mpeg', source: 'preloaded-static' },
    { filePath: path.join(PUBLIC_VOICES_DIR, safeId, `${hash}.wav`), contentType: 'audio/wav', source: 'preloaded-static' },
    { filePath: path.join(VOICE_CACHE_DIR, safeId, `${hash}.mp3`), contentType: 'audio/mpeg', source: 'disk-cache' },
    { filePath: path.join(VOICE_CACHE_DIR, safeId, `${hash}.wav`), contentType: 'audio/wav', source: 'disk-cache' },
  ];

  for (const item of candidates) {
    try {
      const buf = await fs.readFile(item.filePath);
      if (buf.length > 128) {
        return { buffer: buf, contentType: item.contentType, source: item.source };
      }
    } catch {
      // miss
    }
  }
  return null;
}

export async function generateOrReadCachedVoice(
  characterId: string,
  cleanText: string,
  gender: 'male' | 'female'
): Promise<{ buffer: Buffer; contentType: string; cached: boolean; source: string }> {
  const existing = await readExistingAudio(characterId, cleanText);
  if (existing) {
    return {
      buffer: existing.buffer,
      contentType: existing.contentType,
      cached: true,
      source: existing.source,
    };
  }

  const synth = await synthesizeCharacterSpeech(characterId, cleanText, {
    geminiApiKey: process.env.GEMINI_API_KEY,
    fallbackGender: gender,
  });

  const safeId = characterId.replace(/[^a-z0-9_-]/gi, '') || 'cura';
  const hash = hashPhraseKey(safeId, cleanText);
  const cachePath = path.join(VOICE_CACHE_DIR, safeId, `${hash}.${synth.ext}`);

  try {
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, synth.buffer);
  } catch {
    // Ignore read-only cache dir errors
  }

  return {
    buffer: synth.buffer,
    contentType: synth.contentType,
    cached: false,
    source: synth.engine,
  };
}
