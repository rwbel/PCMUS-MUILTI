/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * server.ts - Servidor Express con endpoint de TTS (texto a voz)
 *
 * Inicia un servidor HTTP que:
 *   1. Sirve el frontend (Vite en desarrollo, archivos estáticos en producción)
 *   2. Expone POST /api/tts para generar audio de personajes vía Gemini API
 *   3. Mapea cada personaje a una voz predefinida de Gemini (CHARACTER_VOICE_MAP)
 *   4. Convierte el audio de respuesta a formato WAV si es necesario
 *
 * Endpoints:
 *   - POST /api/tts: Recibe { text, characterId, gender } y devuelve audio WAV
 *
 * Variables de entorno:
 *   - GEMINI_API_KEY: Clave de API de Google Gemini (requerida para TTS)
 *   - PORT: Puerto donde escuchar (default 3000)
 *   - NODE_ENV: 'production' para servir archivos estáticos de dist/
 */

import 'dotenv/config';
import http from 'http';
import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import {
  PUBLIC_VOICES_DIR,
  cleanSpokenText,
  generateOrReadCachedVoice,
} from './lib/ttsSynth.ts';
import { RoomManager } from './server/roomManager.ts';
import type { ClientWsMessage } from './src/types/multiplayer.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function isValidClientMessage(parsed: unknown): parsed is ClientWsMessage {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  const msg = parsed as { type?: unknown };
  return typeof msg.type === 'string' && msg.type.length > 0 && msg.type.length <= 40;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const roomManager = new RoomManager();

  app.get('/api/rooms', (_req, res) => {
    res.json({ rooms: roomManager.getPublicRoomSummaries() });
  });

  app.post('/api/tts', async (req, res) => {
    const characterId = typeof req.body?.characterId === 'string' ? req.body.characterId : 'cura';
    if (characterId === 'player') {
      res.status(204).end();
      return;
    }

    const rawText = typeof req.body?.text === 'string' ? req.body.text : '';
    const cleanText = cleanSpokenText(rawText).slice(0, 260);
    const gender = req.body?.gender === 'female' ? 'female' : 'male';

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
      res.send(buffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'TTS generation failed';
      res.status(502).json({ error: message, fallback: true });
    }
  });

  app.post('/api/tts/pregenerate', async (req, res) => {
    const rawItems: unknown[] = Array.isArray(req.body?.items) ? req.body.items : [];
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

    res.json({ ok: true, generated, cached, failed });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    // Never fall back missing audio assets to index.html
    app.use('/voices', async (req, res, next) => {
      const safeRel = req.path.replace(/^\/+/, '');
      const filePath = path.resolve(PUBLIC_VOICES_DIR, safeRel);
      if (!filePath.startsWith(PUBLIC_VOICES_DIR)) {
        res.status(403).end();
        return;
      }
      try {
        await fs.access(filePath);
        next();
      } catch {
        res.status(404).end();
      }
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.use('/voices', (_req, res) => {
      res.status(404).end();
    });
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
    maxPayload: 32 * 1024,
  });

  const aliveSockets = new WeakSet<WebSocket>();
  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      if (!aliveSockets.has(client)) {
        client.terminate();
        continue;
      }
      aliveSockets.delete(client);
      client.ping();
    }
  }, 25_000);

  wss.on('close', () => {
    clearInterval(heartbeat);
    roomManager.dispose();
  });

  wss.on('connection', (ws) => {
    aliveSockets.add(ws);
    ws.on('pong', () => {
      aliveSockets.add(ws);
    });

    ws.on('message', (data) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.toString('utf8'));
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Mensaje JSON inválido.' }));
        return;
      }
      if (!isValidClientMessage(parsed)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Formato de mensaje inválido.' }));
        return;
      }
      roomManager.handleMessage(ws, parsed);
    });

    ws.on('close', () => {
      roomManager.handleSocketDisconnect(ws);
    });
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`PCMus server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
