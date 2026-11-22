import { cleanSpokenText, generateOrReadCachedVoice } from '../../lib/ttsSynth';

interface ServerlessReq {
  method?: string;
  body?: unknown;
}

interface ServerlessRes {
  status: (code: number) => ServerlessRes;
  setHeader: (name: string, value: string) => void;
  json: (data: unknown) => void;
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

  const rawItems: unknown[] = Array.isArray(body.items) ? body.items : [];
  const items = rawItems
    .filter(
      (it: unknown): it is { characterId: string; text: string; gender?: 'male' | 'female' } =>
        !!it &&
        typeof it === 'object' &&
        typeof (it as { characterId?: unknown }).characterId === 'string' &&
        (it as { characterId: string }).characterId !== 'player' &&
        typeof (it as { text?: unknown }).text === 'string' &&
        (it as { text: string }).text.trim().length > 0
    )
    .slice(0, 48);

  let generated = 0;
  let cached = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i += 3) {
    const batch = items.slice(i, i + 3);
    await Promise.all(
      batch.map(async (item) => {
        try {
          const cleanText = cleanSpokenText(item.text).slice(0, 260);
          if (!cleanText) return;
          const result = await generateOrReadCachedVoice(
            item.characterId,
            cleanText,
            item.gender === 'female' ? 'female' : 'male'
          );
          if (result.cached) cached++;
          else generated++;
        } catch {
          failed++;
        }
      })
    );
  }

  res.status(200).json({ ok: true, generated, cached, failed });
}
