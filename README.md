# CollabBoard - Real-Time Collaborative Whiteboard

A real-time collaborative whiteboard application with AI integration built for the Gauntlet AI challenge.

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Canvas**: Konva.js for high-performance 2D rendering
- **State Management**: Zustand
- **Styling**: TailwindCSS
- **Database**: Supabase PostgreSQL with Realtime
- **AI**: OpenAI GPT-4 Mini
- **Deployment**: Vercel (Frontend + Serverless Functions)

## Features

### MVP Requirements ✓

1. **Infinite Board with Pan/Zoom**: Smooth pan and zoom controls using Konva.js
2. **Sticky Notes**: Editable yellow sticky notes with text
3. **Shape Types**: Rectangles, circles, and lines
4. **Object Operations**: Create, move, edit, and delete objects
5. **Real-Time Sync**: <100ms sync latency between users via Supabase Realtime
6. **Multiplayer Cursors**: See other users' cursors with name labels
7. **Presence Awareness**: Know who's online in real-time
8. **User Authentication**: Google OAuth via Supabase Auth
9. **Public Deployment**: Deployed on Vercel

### AI Agent Features

- Natural language command processing
- 6+ command types:
  - Create objects (sticky notes, shapes)
  - Move and manipulate objects
  - Change colors and text
  - Delete objects
  - Arrange in grid layout

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- OpenAI API key
- Vercel account (for deployment)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd collab-board
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new project at https://supabase.com
   - Run the SQL scripts from the build checklist to create tables:
     - `users` table
     - `boards` table
     - `board_presence` table
   - Enable Realtime for `boards` and `board_presence` tables
   - Enable Google OAuth in Authentication settings

4. **Configure environment variables**
   - Copy `.env.example` to `.env.local`
   - Fill in your Supabase credentials
   - Add your OpenAI API key

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   - Navigate to `http://localhost:5173`
   - Sign in with Google
   - Start collaborating!

### Deployment to Vercel

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```

3. **Add environment variables in Vercel dashboard**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Usage

### Manual Object Creation

- Click "+ Sticky Note" to create a yellow sticky note
- Click "+ Rectangle" to create a blue rectangle
- Click "+ Circle" to create a green circle
- Drag objects to move them
- Click "💾 Sync" to save to database

### AI Commands

Type natural language commands in the AI input field:

- "Create a yellow sticky note that says 'User Research'"
- "Create a blue rectangle at position 100, 200"
- "Move all objects to the right"
- "Arrange objects in a 3x3 grid"
- "Change the sticky note color to red"

### Pan and Zoom

- **Pan**: Click and drag the canvas background
- **Zoom**: Use mouse wheel to zoom in/out

### Multiplayer

- Open the app in multiple browser tabs or windows
- Sign in with the same or different Google accounts
- See real-time updates and cursor positions

## Performance Targets

- **60 FPS** during pan, zoom, and object manipulation
- **<100ms** object sync latency
- **<50ms** cursor sync latency
- **500+ objects** without degradation
- **5+ concurrent users** without degradation

## Architecture

### Frontend

- React components for UI
- Konva.js Stage/Layer for canvas rendering
- Zustand store for state management
- Supabase Realtime subscriptions for live updates

### Backend

- Supabase PostgreSQL for data persistence
- Supabase Realtime for WebSocket connections
- Vercel Serverless Functions for AI command execution
- OpenAI GPT-4 Mini for natural language processing

### Database Schema

- `users`: User profiles
- `boards`: Board data with JSONB objects column
- `board_presence`: Real-time cursor positions

## License

MIT

## Author

Built for the Gauntlet AI challenge
