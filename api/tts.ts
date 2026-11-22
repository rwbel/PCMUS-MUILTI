import { cleanSpokenText, generateOrReadCachedVoice } from '../lib/ttsSynth';

interface ServerlessReq {
  method?: string;
  body?: unknown;
}

interface ServerlessRes {
  status: (code: number) => ServerlessRes;
  setHeader: (name: string, value: string) => void;
  json: (data: unknown) => void;
  send: (body: unknown) => void;
  end: () => void;
}

export default async function handler(req: ServerlessReq, res: ServerlessRes): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const body =
    typeof req.body === 'string'
      ? (JSON.parse(req.body || '{}') as Record<string, unknown>)
      : ((req.body ?? {}) as Record<string, unknown>);

  const characterId = typeof body.characterId === 'string' ? body.characterId : 'cura';
  if (characterId === 'player') {
    res.status(204).end();
    return;
  }

  const rawText = typeof body.text === 'string' ? body.text : '';
  const cleanText = cleanSpokenText(rawText).slice(0, 260);
  const gender = body.gender === 'female' ? 'female' : 'male';

  if (!cleanText) {
    res.status(400).json({ error: 'Missing text' });
    return;
  }

  try {
    const { buffer, contentType, source } = await generateOrReadCachedVoice(
      characterId,
      cleanText,
      gender
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Voice-Source', source);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).send(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TTS generation failed';
    res.status(502).json({ error: message, fallback: true });
  }
}
