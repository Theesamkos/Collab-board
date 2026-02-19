/**
 * Vercel Serverless Function — /api/ai-command
 *
 * Accepts a natural-language whiteboard command and returns an array of
 * tool calls to execute client-side.
 *
 * Model:        claude-sonnet-4-6  (via @langchain/anthropic)
 * Observability: LangSmith  (set LANGCHAIN_TRACING_V2=true + LANGCHAIN_API_KEY)
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

// ── Tool definitions (OpenAI-compatible format; LangChain converts for Anthropic) ─
const TOOLS: any[] = [
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

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { command, boardId, boardState } = req.body ?? {};

  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid command' });
  }
  if (!boardId || typeof boardId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid boardId' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    // LangSmith tracing is configured via env vars:
    //   LANGCHAIN_TRACING_V2=true
    //   LANGCHAIN_API_KEY=<langsmith_key>
    //   LANGCHAIN_PROJECT=collab-board
    // LangChain reads these automatically — no extra code needed.

    const model = new ChatAnthropic({
      model: 'claude-sonnet-4-6',
      temperature: 0,
      apiKey,
    });

    const modelWithTools = model.bindTools(TOOLS);

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

    const response = await modelWithTools.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(command),
    ]);

    const toolCalls = (response.tool_calls ?? []).map((tc: any) => ({
      name: tc.name,
      args: tc.args ?? {},
    }));

    return res.status(200).json({
      success: true,
      toolCalls,
      message: toolCalls.length === 0 ? String(response.content ?? '') : undefined,
    });

  } catch (err) {
    console.error('[api/ai-command] error:', err);
    return res.status(500).json({ error: 'AI service error', details: String(err) });
  }
}
