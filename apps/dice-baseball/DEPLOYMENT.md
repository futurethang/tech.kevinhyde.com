# 🚀 Dice Baseball V2 - Deployment Guide

## Overview

This guide walks through deploying Dice Baseball V2 with:
- **Database**: Supabase (PostgreSQL with Auth)
- **Backend**: Railway or Render (Node.js + WebSocket)
- **Frontend**: GitHub Pages (React PWA)
- **MLB Data**: Real player stats from MLB API

## Prerequisites

- GitHub account
- Supabase account (free tier works)
- Railway or Render account (free tier for testing)
- Node.js 18+ installed locally

---

## Step 1: Supabase Setup (15 minutes)

### 1.1 Create Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose:
   - Name: `dice-baseball`
   - Database Password: (generate strong password, save it!)
   - Region: Choose closest to your users
4. Click "Create Project" (takes 2-3 minutes to provision)

### 1.2 Run Database Migrations

1. In Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy and run each migration file in order:
   ```sql
   -- Run these one at a time:
   supabase/migrations/001_initial_schema.sql
   supabase/migrations/002_row_level_security.sql
   supabase/migrations/003_stored_procedures.sql
   ```
4. Verify tables created: Settings → Database → Tables

### 1.3 Configure Authentication

1. Go to Authentication → Providers
2. Enable "Email" provider
3. Settings → Auth → JWT:
   - Copy the JWT Secret (save for backend)

### 1.4 Get Your Keys

1. Go to Settings → API
2. Copy and save:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon key**: For frontend (safe to expose)
   - **service_role key**: For backend (keep secret!)

---

## Step 2: Backend Deployment (20 minutes)

### 2.1 Prepare Backend

1. Create `.env` file in `backend/`:
```bash
NODE_ENV=production
PORT=3000

# From Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...  # service_role key
SUPABASE_JWT_SECRET=your-jwt-secret-from-supabase

# Update after deployment
CORS_ORIGIN=https://tech.kevinhyde.com
```

2. Test locally:
```bash
cd backend
npm install
npm run dev
```

### 2.2 Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo
3. Select your repository and `backend` directory
4. Add environment variables (from .env above)
5. Settings:
   - Root Directory: `/apps/dice-baseball/backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
6. Deploy! Note your URL: `https://dice-baseball.up.railway.app`

**Alternative: Deploy to Render**

1. Go to [render.com](https://render.com)
2. New → Web Service
3. Connect GitHub repo
4. Configure:
   - Name: `dice-baseball-backend`
   - Root Directory: `apps/dice-baseball/backend`
   - Build: `npm install && npm run build`
   - Start: `npm start`
5. Add environment variables
6. Deploy!

### 2.3 Seed MLB Player Data

Once deployed, trigger initial MLB data sync:

```bash
# Option 1: Use the deployed endpoint (if you add one)
curl https://your-backend.railway.app/api/admin/sync-mlb-demo

# Option 2: Run locally against production database
cd backend
npm run sync:demo  # Syncs 10 demo players
# or
npm run sync:full   # Syncs all ~750 MLB players (takes ~10 min)
```

---

## Step 3: Frontend Deployment (10 minutes)

### 3.1 Update Frontend Config

1. Create `.env.production` in `frontend/`:
```bash
VITE_API_URL=https://dice-baseball.up.railway.app/api
VITE_WS_URL=wss://dice-baseball.up.railway.app
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...  # anon key (safe for frontend)
```

2. Build the frontend:
```bash
cd frontend
npm install
npm run build
```

### 3.2 Deploy to GitHub Pages

Since this is part of the monorepo:

1. The GitHub Actions workflow should handle it automatically
2. On push to main, it will:
   - Build the frontend
   - Copy to `dist/apps/dice-baseball/`
   - Deploy to GitHub Pages

3. Access at: `https://tech.kevinhyde.com/apps/dice-baseball/`

**Manual Deployment Option:**
```bash
# From repository root
npm run build:dice-baseball
npm run deploy  # Deploys entire site to GitHub Pages
```

---

## Step 4: Configure Production

### 4.1 Update CORS

In backend, ensure CORS allows your frontend:

```javascript
// backend/src/server.ts
const corsOptions = {
  origin: [
    'https://tech.kevinhyde.com',
    'http://localhost:5173' // for local dev
  ],
  credentials: true
};
```

### 4.2 Set Up Monitoring

**Railway/Render:**
- Check logs regularly
- Set up health check endpoint: `/api/health`
- Configure alerts for crashes

**Supabase:**
- Monitor database size (free tier: 500MB)
- Check API request counts
- Review slow queries in logs

### 4.3 Schedule MLB Data Sync

Add a cron job (Railway or external service):
```javascript
// Run daily at 5 AM UTC
0 5 * * * -> POST https://your-backend/api/admin/sync-mlb
```

---

## Step 5: Testing

### 5.1 Quick Smoke Test

1. **Visit the app**: `https://tech.kevinhyde.com/apps/dice-baseball/`
2. **Create account**: Register with email/password
3. **Browse players**: Check MLB players loaded
4. **Create team**: Build a roster
5. **Start game**: Create and share join code
6. **Join from another browser**: Test multiplayer
7. **Play a few innings**: Verify WebSocket works

### 5.2 Monitoring Checklist

- [ ] Frontend loads without errors
- [ ] Can register/login
- [ ] MLB players appear in database
- [ ] Can create and save teams
- [ ] WebSocket connects for games
- [ ] Game state persists across refreshes
- [ ] Stats update after games

---

## Environment Variables Reference

### Backend Production
```bash
NODE_ENV=production
PORT=3000
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=service_role_key_here
SUPABASE_JWT_SECRET=jwt_secret_here
CORS_ORIGIN=https://tech.kevinhyde.com
```

### Frontend Production
```bash
VITE_API_URL=https://your-backend.railway.app/api
VITE_WS_URL=wss://your-backend.railway.app
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=anon_key_here
```

---

## Troubleshooting

### Database Issues

**"Permission denied" errors:**
- Check RLS policies are enabled
- Verify using correct Supabase keys
- Ensure auth tokens are valid

**"Table not found" errors:**
- Run migrations in order
- Check migration succeeded in Supabase logs

### Backend Issues

**WebSocket not connecting:**
- Ensure Railway/Render supports WebSockets
- Check CORS configuration
- Verify WSS protocol in frontend

**"Missing environment variable" errors:**
- Double-check all env vars are set
- Restart service after adding vars

### Frontend Issues

**API calls failing:**
- Check browser console for CORS errors
- Verify API URL is correct
- Ensure backend is running

**"Unauthorized" errors:**
- Check JWT token is being sent
- Verify token hasn't expired
- Ensure Supabase auth is configured

---

## Next Steps

Once deployed:

1. **Add custom domain** (optional)
2. **Set up CI/CD** with GitHub Actions
3. **Add error tracking** (Sentry)
4. **Implement analytics** (Plausible, Umami)
5. **Create admin dashboard** for stats
6. **Add more features**:
   - Tournaments
   - Seasons/leagues
   - Trading cards
   - Achievements

---

## Support

- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Railway Docs**: [docs.railway.app](https://docs.railway.app)
- **Render Docs**: [render.com/docs](https://render.com/docs)
- **MLB API Docs**: [statsapi.mlb.com](http://statsapi.mlb.com)

---

## Quick Commands

```bash
# Local Development
cd backend && npm run dev
cd frontend && npm run dev

# Sync MLB Data
cd backend
npm run sync:demo   # 10 players
npm run sync:full   # All players

# Build for Production
cd backend && npm run build
cd frontend && npm run build

# Run Tests
cd backend && npm test

# Check Deployment
curl https://your-backend/api/health
```

---

**Ready to play ball! ⚾**