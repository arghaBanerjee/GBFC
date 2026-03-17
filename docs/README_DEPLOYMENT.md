# Deployment-Ready Changes Summary

## What Changed

Your application has been updated to support deployment on **Vercel (frontend)** + **Render (backend)** with persistent data storage.

### Backend Changes (`api.py`)

1. **Database Support**: Now supports both SQLite (local dev) and PostgreSQL (production)
   - Automatically detects `DATABASE_URL` environment variable
   - Uses Postgres when deployed, SQLite locally

2. **Image Storage**: Integrated Cloudinary for persistent image uploads
   - Uses Cloudinary in production (when `CLOUDINARY_URL` is set)
   - Falls back to local storage for development

3. **CORS Configuration**: Dynamic CORS to support production frontend
   - Reads `FRONTEND_ORIGIN` environment variable
   - Allows your Vercel domain to access the API

### Frontend Changes

1. **API Base URL**: Created `frontend/src/api.js` utility
   - Reads `VITE_API_BASE_URL` from environment
   - Centralizes API calls for easy configuration

2. **Environment Template**: Added `frontend/.env.example`
   - Shows required environment variables
   - Copy to `.env.local` for local development

### New Files

1. **`requirements.txt`**: Added `psycopg2-binary` and `cloudinary`
2. **`render.yaml`**: Configuration for Render deployment
3. **`frontend/vercel.json`**: Configuration for Vercel deployment
4. **`DEPLOYMENT.md`**: Complete step-by-step deployment guide

## Local Development Still Works

All changes are backward compatible:
- Without environment variables, uses SQLite + local uploads
- Your existing local setup continues to work as-is
- No changes needed for local development

## Next Steps

1. **Read `DEPLOYMENT.md`** for complete deployment instructions
2. **Sign up** for free accounts:
   - Render.com (backend + database)
   - Vercel.com (frontend)
   - Cloudinary.com (image storage)
3. **Follow the guide** to deploy in ~15 minutes

## Environment Variables Reference

### Backend (Render)
- `DATABASE_URL` - Auto-set by Render when you add Postgres
- `CLOUDINARY_CLOUD_NAME` - From Cloudinary dashboard
- `CLOUDINARY_API_KEY` - From Cloudinary dashboard
- `CLOUDINARY_API_SECRET` - From Cloudinary dashboard
- `CLOUDINARY_URL` - Format: `cloudinary://API_KEY:API_SECRET@CLOUD_NAME`
- `FRONTEND_ORIGIN` - Your Vercel URL (e.g., `https://your-app.vercel.app`)
- `GREEN_API_INSTANCE_ID` - Green API instance ID for WhatsApp integration
- `GREEN_API_TOKEN` - Green API token for WhatsApp integration
- `WHATSAPP_GROUP_NAME` - WhatsApp group name to resolve dynamically per environment
- `WHATSAPP_GROUP_ID` - Optional WhatsApp group chat ID ending in `@g.us` used as a direct fallback
- `WHATSAPP_NOTIFICATIONS_ENABLED` - Set to `true` or `false` to toggle WhatsApp broadcasts

### Frontend (Vercel)
- `VITE_API_BASE_URL` - Your Render backend URL (e.g., `https://your-api.onrender.com`)

## Testing Locally with Production Setup

If you want to test Postgres/Cloudinary locally:

1. Install Postgres locally
2. Set environment variables in a `.env` file (not committed to git)
3. Run: `source .env && python api.py`

## Local Backend Restart

For local development, you can restart the backend with a single command from the project root:

```bash
zsh restart-backend.sh
```

The script:

- stops any existing backend process on port `8000`
- uses the project virtualenv Python at `venv/bin/python` when available
- starts `uvicorn api:app --reload`

If you want to run it as `./restart-backend.sh`, make it executable once:

```bash
chmod +x restart-backend.sh
```

## Local Backend Secrets

Local backend secrets now load automatically from:

```bash
.backend.local.env
```

This file is gitignored and should never be committed.

To set up local credentials:

1. Copy `.backend.local.env.example` to `.backend.local.env`
2. Fill in your local SMTP, email, Green API, and WhatsApp values
3. Start or restart the backend normally

The backend will automatically read `.backend.local.env` during local runs, so secrets no longer need to be hardcoded in the Python files.

For WhatsApp targeting, you can now set:

- `WHATSAPP_GROUP_NAME` to let the backend resolve the correct group ID for that environment
- `WHATSAPP_GROUP_ID` as an optional direct fallback when you already know the exact chat ID

This is useful when local and production use different WhatsApp groups.

## Cost

- **Free tier**: $0/month (with backend sleep after 15 min inactivity)
- **No sleep**: $7/month (Render Starter plan)

Both options include:
- Unlimited frontend hosting (Vercel)
- PostgreSQL database with 1GB storage (Render)
- 25GB image storage (Cloudinary)
