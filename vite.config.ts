import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';

// ── Dev-only API plugin ───────────────────────────────────────────────────────
// In production the same logic lives in api/ai-command.ts (Vercel serverless).
// In dev, Vite doesn't run Vercel functions, so we handle /api/ai-command here.
//
// loadEnv with prefix='' loads ALL vars from .env/.env.local (not just VITE_*).
// This is the only way to read non-VITE_ vars in a configureServer plugin.
function devApiPlugin(openaiApiKey: string) {
  return {
    name: 'dev-api',
    configureServer(server: any) {
      server.middlewares.use(
        '/api/ai-command',
        async (req: IncomingMessage, res: ServerResponse) => {
          const send = (status: number, body: object) => {
            res.statusCode = status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(body));
          };

          if (req.method !== 'POST') {
            return send(405, { error: 'Method not allowed' });
          }

          // Collect request body
          let raw = '';
          req.on('data', (chunk) => { raw += chunk; });
          req.on('end', async () => {
            try {
              const { command, boardId, boardState } = raw ? JSON.parse(raw) : {};

              if (!command || typeof command !== 'string') {
                return send(400, { error: 'Missing or invalid command' });
              }
              if (!boardId || typeof boardId !== 'string') {
                return send(400, { error: 'Missing or invalid boardId' });
              }

              const apiKey = openaiApiKey;
              if (!apiKey) {
                return send(500, { error: 'OPENAI_API_KEY not set in .env.local' });
              }

              // Dynamic import so OpenAI is only loaded when the route is hit
              const { default: OpenAI } = await import('openai');
              const openai = new OpenAI({ apiKey });

              const tools: any[] = [
                {
                  type: 'function',
                  function: {
                    name: 'createStickyNote',
                    description: 'Create a sticky note on the whiteboard with text content.',
                    parameters: {
                      type: 'object',
                      properties: {
                        text:  { type: 'string' },
                        x:     { type: 'number' },
                        y:     { type: 'number' },
                        color: { type: 'string', description: 'hex or name (yellow, pink, blue…)' },
                      },
                      required: ['text'],
                    },
                  },
                },
                {
                  type: 'function',
                  function: {
                    name: 'createRectangle',
                    description: 'Create a rectangle shape.',
                    parameters: {
                      type: 'object',
                      properties: {
                        x: { type: 'number' }, y: { type: 'number' },
                        width: { type: 'number' }, height: { type: 'number' },
                        color: { type: 'string' },
                      },
                      required: [],
                    },
                  },
                },
                {
                  type: 'function',
                  function: {
                    name: 'createCircle',
                    description: 'Create a circle shape.',
                    parameters: {
                      type: 'object',
                      properties: {
                        x: { type: 'number' }, y: { type: 'number' },
                        radius: { type: 'number' }, color: { type: 'string' },
                      },
                      required: [],
                    },
                  },
                },
                {
                  type: 'function',
                  function: {
                    name: 'moveObject',
                    description: 'Move an object to a new position.',
                    parameters: {
                      type: 'object',
                      properties: {
                        objectId: { type: 'string' },
                        x: { type: 'number' }, y: { type: 'number' },
                      },
                      required: ['objectId', 'x', 'y'],
                    },
                  },
                },
                {
                  type: 'function',
                  function: {
                    name: 'deleteObject',
                    description: 'Delete a specific object by ID.',
                    parameters: {
                      type: 'object',
                      properties: { objectId: { type: 'string' } },
                      required: ['objectId'],
                    },
                  },
                },
                {
                  type: 'function',
                  function: {
                    name: 'updateStickyNote',
                    description: 'Update text or color of an existing sticky note.',
                    parameters: {
                      type: 'object',
                      properties: {
                        objectId: { type: 'string' },
                        text: { type: 'string' }, color: { type: 'string' },
                      },
                      required: ['objectId'],
                    },
                  },
                },
                {
                  type: 'function',
                  function: {
                    name: 'clearBoard',
                    description: 'Remove ALL objects from the board.',
                    parameters: { type: 'object', properties: {}, required: [] },
                  },
                },
                {
                  type: 'function',
                  function: {
                    name: 'changeColor',
                    description: 'Change the fill color of any object.',
                    parameters: {
                      type: 'object',
                      properties: {
                        objectId: { type: 'string' }, color: { type: 'string' },
                      },
                      required: ['objectId', 'color'],
                    },
                  },
                },
                {
                  type: 'function',
                  function: {
                    name: 'arrangeInGrid',
                    description: 'Rearrange all objects in a tidy grid layout.',
                    parameters: {
                      type: 'object',
                      properties: {
                        columns: { type: 'number' }, spacing: { type: 'number' },
                      },
                      required: [],
                    },
                  },
                },
              ];

              const systemPrompt = `You are an AI assistant for a collaborative whiteboard app.
Translate the user's natural language command into one or more tool calls.

Rules:
- Spread objects across the canvas (x: 80–700, y: 80–500). Avoid stacking.
- Default sizes: sticky notes 200×150px, rectangles 200×140px, circles radius 60px.
- Use hex color values (yellow→#FFDD57, red→#EF4444, blue→#3B82F6, green→#22C55E, purple→#8B5CF6, orange→#F97316, pink→#EC4899).
- Emit multiple tool calls in one response when creating several objects.
- When the user refers to "all sticky notes" etc, find matching IDs in the board state.
- Prefer updateStickyNote over delete + create when editing.
- For "clear the board", use clearBoard — not individual deleteObject calls.
- Never invent objectIds; only use IDs from the board state below.

Current board state:
${JSON.stringify(boardState ?? [], null, 2)}`;

              const aiResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user',   content: command },
                ],
                tools,
                tool_choice: 'auto',
                temperature: 0.2,
              });

              const message = aiResponse.choices[0].message;
              const rawCalls = message.tool_calls ?? [];

              const toolCalls = rawCalls.map((tc: any) => {
                let args: Record<string, unknown> = {};
                try { args = JSON.parse(tc.function.arguments); } catch { /* leave empty */ }
                return { name: tc.function.name, args };
              });

              return send(200, {
                success: true,
                toolCalls,
                message: rawCalls.length === 0 ? (message.content ?? '') : undefined,
              });

            } catch (err) {
              console.error('[dev-api] ai-command error:', err);
              return send(500, { error: 'AI service error', details: String(err) });
            }
          });
        }
      );
    },
  };
}

// ── Vite config ───────────────────────────────────────────────────────────────
// Use the function form so we can call loadEnv before plugins are resolved.
export default defineConfig(({ mode }) => {
  // Load all vars from .env / .env.local (empty prefix = no filtering)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), devApiPlugin(env.OPENAI_API_KEY ?? '')],
  };
});
