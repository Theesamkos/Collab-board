import { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Tool definitions ─────────────────────────────────────────────────────────
const tools: OpenAI.ChatCompletionTool[] = [
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
      description: 'Move an existing object to a new position on the board.',
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
      description: 'Delete a specific object from the board by its ID.',
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
      description: 'Update the text content or color of an existing sticky note.',
      parameters: {
        type: 'object',
        properties: {
          objectId: { type: 'string', description: 'ID of the sticky note.' },
          text:  { type: 'string', description: 'New text content.' },
          color: { type: 'string', description: 'New background color (optional).' },
        },
        required: ['objectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clearBoard',
      description: 'Remove ALL objects from the board, leaving it completely empty.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'changeColor',
      description: 'Change the fill color of any object on the board.',
      parameters: {
        type: 'object',
        properties: {
          objectId: { type: 'string', description: 'ID of the object.' },
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
          spacing: { type: 'number', description: 'Gap between objects in pixels (default 240).' },
        },
        required: [],
      },
    },
  },
];

// ── Handler ──────────────────────────────────────────────────────────────────
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

  try {
    const systemPrompt = `You are an AI assistant for a collaborative whiteboard app.
Translate the user's natural language command into one or more tool calls.

Rules:
- When positions aren't specified, spread objects across the canvas (x: 80–700, y: 80–500). Avoid stacking.
- Default sizes: sticky notes 200×150px, rectangles 200×140px, circles radius 60px.
- Use hex color values directly (e.g. yellow → #FFDD57, red → #EF4444, blue → #3B82F6, green → #22C55E, purple → #8B5CF6, orange → #F97316, pink → #EC4899).
- To create several objects, emit multiple tool calls in one response.
- When the user refers to "all sticky notes" or "all rectangles", find the matching IDs in the board state.
- Prefer updateStickyNote over delete + create when editing existing notes.
- For "clear the board" or "delete everything", use the clearBoard tool — never call deleteObject for each item.
- Never invent objectIds; only use IDs present in the board state.

Current board state (JSON):
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

    // Parse and return tool calls — the frontend will execute them locally
    const toolCalls = rawCalls.map((tc) => {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments); } catch { /* leave empty */ }
      return { name: tc.function.name, args };
    });

    return res.status(200).json({
      success: true,
      toolCalls,
      // Pass through any text reply if the model chose not to call a tool
      message: rawCalls.length === 0 ? (message.content ?? '') : undefined,
    });

  } catch (err) {
    console.error('AI command error:', err);
    return res.status(500).json({ error: 'AI service error', details: String(err) });
  }
}
