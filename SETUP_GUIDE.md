# CollabBoard Setup Guide

Follow these steps to get CollabBoard up and running.

## Step 1: Install Dependencies ✓

Dependencies are already installed! If you need to reinstall:

```bash
npm install --legacy-peer-deps
```

## Step 2: Set Up Supabase

### 2.1 Create Supabase Project

1. Go to https://supabase.com
2. Sign up or log in
3. Click "New Project"
4. Project name: `collab-board`
5. Create a strong database password (save it!)
6. Region: Choose closest to you
7. Wait for project creation (2-3 minutes)

### 2.2 Run SQL Setup Script

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `supabase-setup.sql`
4. Paste into the SQL editor
5. Click **Run** (or press Cmd/Ctrl + Enter)
6. Verify no errors appear

### 2.3 Enable Realtime

1. Go to **Database → Replication**
2. Find `boards` table → Toggle "Enable"
3. Find `board_presence` table → Toggle "Enable"
4. Both should show as "Replicating"

### 2.4 Enable Google Authentication

1. Go to **Authentication → Providers**
2. Click on **Google**
3. Toggle "Enable"

**For testing (easiest):**
- Leave the OAuth fields empty
- Supabase will use test credentials
- This works for development

**For production:**
- Get Google OAuth credentials from https://console.cloud.google.com
- Add Client ID and Client Secret
- Add authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`

### 2.5 Get API Credentials

1. Go to **Project Settings → API**
2. Copy these values (you'll need them next):
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (long string)
   - **service_role** key (long string - KEEP SECRET!)

## Step 3: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and fill in your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

3. Get an OpenAI API key:
   - Go to https://platform.openai.com/api-keys
   - Create a new API key
   - Add it to `.env.local`:
   ```
   OPENAI_API_KEY=sk-xxxxx
   ```

4. Add Supabase service role key to `.env.local`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

## Step 4: Run Development Server

```bash
npm run dev
```

The app should now be running at `http://localhost:5173`

## Step 5: Test the Application

1. **Sign In**
   - Click "Sign in with Google"
   - Complete Google OAuth flow
   - You should be redirected to the board

2. **Create Objects**
   - Click "+ Sticky Note" to create a note
   - Click "+ Rectangle" to create a shape
   - Click "+ Circle" to create a circle
   - Drag objects to move them

3. **Test Sync**
   - Click "💾 Sync" to save to database
   - Refresh the page
   - Objects should persist

4. **Test Multiplayer**
   - Open app in a second browser tab
   - Sign in (can use same account)
   - Create an object in one tab
   - Click Sync
   - Object should appear in other tab
   - Move your mouse - cursor should appear in other tab

5. **Test AI Commands**
   - Type: "Create a yellow sticky note that says Hello"
   - Click "Send"
   - Sticky note should appear

## Step 6: Deploy to Vercel

### 6.1 Create GitHub Repository

```bash
git add .
git commit -m "Initial commit - CollabBoard MVP"
gh repo create collab-board --private --source=. --remote=origin --push
```

Or manually:
1. Go to https://github.com/new
2. Create new repository named `collab-board`
3. Follow instructions to push existing repository

### 6.2 Deploy to Vercel

1. Go to https://vercel.com
2. Click "New Project"
3. Import your GitHub repository
4. Configure project:
   - Framework Preset: Vite
   - Root Directory: ./
   - Build Command: `npm run build`
   - Output Directory: `dist`

5. Add Environment Variables:
   - `VITE_SUPABASE_URL`: Your Supabase URL
   - `VITE_SUPABASE_ANON_KEY`: Your anon key
   - `OPENAI_API_KEY`: Your OpenAI key
   - `SUPABASE_SERVICE_ROLE_KEY`: Your service role key

6. Click "Deploy"

7. Wait 2-3 minutes for deployment

8. Visit your deployment URL and test!

## Troubleshooting

### "Missing Supabase credentials" error
- Check that `.env.local` exists and has correct values
- Restart dev server after creating `.env.local`

### Google sign-in not working
- Check that Google provider is enabled in Supabase
- For production, verify OAuth credentials are correct

### Objects not syncing
- Check Supabase Dashboard → Database → Replication
- Ensure `boards` and `board_presence` tables are enabled
- Check browser console for errors

### AI commands not working
- Verify `OPENAI_API_KEY` is set correctly
- Check that you have API credits in OpenAI account
- In production, verify environment variables are set in Vercel

### Cursor not showing
- Ensure `board_presence` table replication is enabled
- Check browser console for WebSocket errors
- Try refreshing the page

## Need Help?

Check the main README.md for architecture details and usage instructions.
