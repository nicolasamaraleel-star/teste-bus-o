import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

interface CachedTrack {
  audioDataUrl: string;
  lyrics: string;
}

const trackCache = new Map<number, CachedTrack>();

const LINE_MUSIC_PROMPTS: Record<number, string> = {
  1: 'Generate an energetic 30-second instrumental retro arcade synth-funk action loop at 128 BPM with punchy bassline, bright brassy synth leads, and upbeat drums for a bustling city bus beat-em-up stage.',
  2: 'Generate an intense 30-second instrumental industrial arcade electro-rock action track at 136 BPM with driving bass, gritty synth riffs, and punchy drums for an industrial express bus fight.',
  3: 'Generate a dramatic 30-second instrumental final-boss arcade synthwave track at 144 BPM with heroic synth chords, fast arpeggios, and heavy drums for a terminal station showdown.',
};

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  app.post('/api/images/edit', async (req, res) => {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const imageBase64 =
      typeof req.body?.imageBase64 === 'string' ? req.body.imageBase64.trim() : '';
    const mimeType =
      typeof req.body?.mimeType === 'string' && req.body.mimeType.startsWith('image/')
        ? req.body.mimeType
        : 'image/jpeg';
    const aspectRatio =
      typeof req.body?.aspectRatio === 'string' ? req.body.aspectRatio : '16:9';

    if (!prompt) {
      res.status(400).json({ error: 'Descreva o quadro que deseja criar ou editar.' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(400).json({
        error:
          'Chave Gemini API não configurada no servidor (Settings > Secrets).',
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> =
        [];
      if (imageBase64) {
        const cleanBase64 = imageBase64.includes(',')
          ? imageBase64.split(',')[1] ?? ''
          : imageBase64;
        if (cleanBase64) {
          parts.push({
            inlineData: {
              data: cleanBase64,
              mimeType,
            },
          });
        }
      }
      parts.push({
        text: `${prompt}. Vibrant 2D cel-shaded arcade beat-em-up comic illustration style with bold dark ink outlines, matching a Brazilian city bus setting.`,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-nano-banana-2.1',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio,
            imageSize: '1K',
          },
        },
      });

      let imageUrl = '';
      let note = '';
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data && !imageUrl) {
          const outMime = part.inlineData.mimeType ?? 'image/png';
          imageUrl = `data:${outMime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          note += part.text;
        }
      }

      if (!imageUrl) {
        res.status(502).json({
          error: note || 'O modelo não retornou uma imagem. Tente outro comando.',
        });
        return;
      }

      res.json({ imageUrl, note });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao gerar imagem.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/music/line', async (req, res) => {
    const lineNumber = Number(req.body?.lineNumber) || 1;
    const cached = trackCache.get(lineNumber);
    if (cached) {
      res.json({ available: true, ...cached });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(200).json({
        available: false,
        fallback: 'procedural',
        reason: 'missing_key',
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = LINE_MUSIC_PROMPTS[lineNumber] || LINE_MUSIC_PROMPTS[1];
      const response = await ai.models.generateContentStream({
        model: 'lyria-3-clip-preview',
        contents: prompt,
      });

      const audioChunks: Buffer[] = [];
      let lyrics = '';
      let mimeType = 'audio/mpeg';

      for await (const chunk of response) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;
        for (const part of parts) {
          if (part.inlineData?.data) {
            if (audioChunks.length === 0 && part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            audioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
          }
          if (part.text) {
            lyrics += part.text;
          }
        }
      }

      if (audioChunks.length === 0) {
        res.status(200).json({
          available: false,
          fallback: 'procedural',
          reason: 'empty_audio',
        });
        return;
      }

      const audioBase64 = Buffer.concat(audioChunks).toString('base64');
      const audioDataUrl = `data:${mimeType};base64,${audioBase64}`;
      const result = { audioDataUrl, lyrics };
      trackCache.set(lineNumber, result);
      res.json({ available: true, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lyria request failed';
      res.status(200).json({
        available: false,
        fallback: 'procedural',
        reason: msg,
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

createApp().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
