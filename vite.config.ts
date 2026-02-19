import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

// ── Dev-only API plugin ───────────────────────────────────────────────────────
// In production the same logic lives in api/ai-command.ts (Vercel serverless).
// In dev, Vite doesn't run Vercel functions, so we handle /api/ai-command here.
//
// Uses claude-sonnet-4-6 via @langchain/anthropic.
// Set LANGCHAIN_TRACING_V2=true + LANGCHAIN_API_KEY in .env.local to enable
// LangSmith observability for every agent invocation.
function devApiPlugin(anthropicApiKey: string) {
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

          if (req.method !== 'POST') return send(405, { error: 'Method not allowed' });

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
              if (!anthropicApiKey) {
                return send(500, { error: 'ANTHROPIC_API_KEY not set in .env.local' });
              }

              // Dynamic import — only loaded when the route is hit
              const { ChatAnthropic } = await import('@langchain/anthropic');
              const { HumanMessage, SystemMessage } = await import('@langchain/core/messages');

              // ── Tool definitions (OpenAI-compatible format; LangChain converts for Anthropic) ─
              const tools: any[] = [
                {
                  type: 'function',
                  function: {
                    name: 'createStickyNote',
                    description: 'Create a sticky note on the whiteboard with text content.',
                    parameters: {
                      type: 'object',
                      properties: {
                        text:  { type: 'string', description: 'Text written on the sticky note.' },
                        x:     { type: 'number', description: 'Left edge X position in canvas pixels.' },
                        y:     { type: 'number', description: 'Top edge Y position in canvas pixels.' },
                        color: { type: 'string', description: 'Background color: hex (#FFDD57) or name (yellow, pink, blue…).' },
                      },
                      required: ['text'],
                    },
                  },
                },
                {
                  type: 'function',
                  function: {
                    name: 'createRectangle',
                    description: 'Create a rectangle shape on the whiteboard.',
                    parameters: {
                      type: 'object',
                      properties: {
                        x:      { type: 'number', description: 'Left edge X position.' },
                        y:      { type: 'number', description: 'Top edge Y position.' },
                        width:  { type: 'number', description: 'Width in pixels.' },
                        height: { type: 'number', description: 'Height in pixels.' },
                        color:  { type: 'string', description: 'Fill color: hex or name.' },
                      },
                      required: [],
                    },
                  },
                },
                {
                  type: 'function',
                  function: {
                    name: 'createCircle',
                    description: 'Create a circle shape on the whiteboard.',
                    parameters: {
                      type: 'object',
                      properties: {
                        x:      { type: 'number', description: 'Center X position.' },
                        y:      { type: 'number', description: 'Center Y position.' },
                        radius: { type: 'number', description: 'Radius in pixels.' },
                        color:  { type: 'string', description: 'Fill color: hex or name.' },
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
                        objectId: { type: 'string', description: 'ID of the object to move.' },
                        x: { type: 'number', description: 'New X position.' },
                        y: { type: 'number', description: 'New Y position.' },
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
                      properties: {
                        objectId: { type: 'string', description: 'ID of the object to delete.' },
                      },
                      required: ['objectId'],
                    },
                  },
                },
                {
                  type: 'function',
                  function: {
                    name: 'updateStickyNote',
                    description: 'Update the text or color of an existing sticky note.',
                    parameters: {
                      type: 'object',
                      properties: {
                        objectId: { type: 'string' },
                        text:     { type: 'string', description: 'New text content.' },
                        color:    { type: 'string', description: 'New background color.' },
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
                        objectId: { type: 'string' },
                        color:    { type: 'string', description: 'New color: hex or name.' },
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
                        columns: { type: 'number', description: 'Number of columns (default 3).' },
                        spacing: { type: 'number', description: 'Pixel gap between objects (default 240).' },
                      },
                      required: [],
                    },
                  },
                },
              ];

              // ── System prompt with live board state ──────────────────────────
              const systemPrompt = `You are an AI assistant for a collaborative whiteboard app called CollabBoard.
Translate the user's natural language command into one or more tool calls.

Rules:
- Spread objects across the canvas (x: 80–700, y: 80–500). Avoid stacking.
- Default sizes: sticky notes 200×150px, rectangles 200×140px, circles radius 60px.
- Use hex color values (yellow→#FFDD57, red→#EF4444, blue→#3B82F6, green→#22C55E, purple→#8B5CF6, orange→#F97316, pink→#EC4899).
- Emit multiple tool calls in one response when creating several objects.
- When the user refers to "all sticky notes" etc, find matching IDs in the board state.
- Prefer updateStickyNote over delete + create when editing text.
- For "clear the board", use clearBoard — not individual deleteObject calls.
- Never invent objectIds; only use IDs present in the board state below.

Current board state:
${JSON.stringify(boardState ?? [], null, 2)}`;

              // ── Invoke claude-sonnet-4-6 with tool binding ───────────────────
              const model = new ChatAnthropic({
                model: 'claude-sonnet-4-6',
                temperature: 0,
                apiKey: anthropicApiKey,
              });

              // bindTools accepts OpenAI-format definitions; LangChain converts for Anthropic
              const modelWithTools = model.bindTools(tools);

              const response = await modelWithTools.invoke([
                new SystemMessage(systemPrompt),
                new HumanMessage(command),
              ]);

              // Extract tool calls from the LangChain response
              const toolCalls = (response.tool_calls ?? []).map((tc: any) => ({
                name: tc.name,
                args: tc.args ?? {},
              }));

              return send(200, {
                success: true,
                toolCalls,
                message: toolCalls.length === 0 ? String(response.content ?? '') : undefined,
              });

            } catch (err) {
              console.error('[dev-api] ai-command error:', err);
              return send(500, { error: 'AI service error', details: String(err) });
            }
          });
        },
      );
    },
  };
}

// ── Vite config ───────────────────────────────────────────────────────────────
export default defineConfig(({ mode }) => {
  // Load ALL vars from .env / .env.local (empty prefix = no filtering).
  // This lets us read ANTHROPIC_API_KEY, LANGCHAIN_* without a VITE_ prefix,
  // keeping those secrets out of the browser bundle.
  const env = loadEnv(mode, process.cwd(), '');

  // Forward LangSmith env vars into the Node process so LangChain picks them up
  if (env.LANGCHAIN_TRACING_V2) {
    process.env.LANGCHAIN_TRACING_V2 = env.LANGCHAIN_TRACING_V2;
    process.env.LANGCHAIN_API_KEY    = env.LANGCHAIN_API_KEY ?? '';
    process.env.LANGCHAIN_PROJECT    = env.LANGCHAIN_PROJECT ?? 'collab-board';
  }

  return {
    plugins: [react(), devApiPlugin(env.ANTHROPIC_API_KEY ?? '')],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
