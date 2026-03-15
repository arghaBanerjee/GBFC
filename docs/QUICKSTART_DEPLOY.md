# Quick Start - Deploy in 15 Minutes

Your app is now ready to deploy! Follow these steps:

## ✅ What's Already Done

- ✅ Backend supports Postgres (production) and SQLite (local dev)
- ✅ Image uploads use Cloudinary (production) with local fallback
- ✅ CORS configured for production frontend
- ✅ All deployment config files created

## 🚀 Deploy Now (3 Steps)

### 1. Get Free Accounts (5 min)

Sign up for these free services:
- **Cloudinary**: https://cloudinary.com/users/register/free
- **Render**: https://render.com/register
- **Vercel**: https://vercel.com/signup

### 2. Push to GitHub (2 min)

```bash
cd /Users/argha/Documents/Projects/Football
git init
git add .
git commit -m "Ready for deployment"
# Create a new repo on GitHub, then:
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 3. Deploy (8 min)

**Backend (Render):**
1. Go to Render → New → Web Service
2. Connect your GitHub repo
3. Settings:
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn api:app --host 0.0.0.0 --port $PORT`
4. Add Postgres database (New → PostgreSQL)
5. Add environment variables:
   - Get from Cloudinary dashboard: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - Format: `CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME`
6. Deploy and copy your backend URL

**Frontend (Vercel):**
1. Go to Vercel → New Project
2. Import your GitHub repo
3. Settings:
   - Root Directory: `frontend`
   - Framework: Vite
4. Add environment variable:
   - `VITE_API_BASE_URL` = (your Render backend URL)
5. Deploy and copy your frontend URL

**Final Step:**
- Go back to Render → Your service → Environment
- Add: `FRONTEND_ORIGIN` = (your Vercel URL)
- Save (triggers redeploy)

## 🎉 Done!

Visit your Vercel URL and create an admin account:
- Email: `admin@example.com`
- Password: (your choice)

## 📖 Need More Details?

See `DEPLOYMENT.md` for:
- Detailed step-by-step instructions
- Troubleshooting guide
- Custom domain setup
- Monitoring tips

## 💰 Cost

- **Free**: $0/month (backend sleeps after 15 min)
- **Always On**: $7/month (Render Starter)

Both include:
- Unlimited frontend hosting
- 1GB Postgres database
- 25GB image storage

## 🔧 Local Development

Your local setup still works exactly as before:
```bash
# Terminal 1 - Backend
source .venv/bin/activate
python api.py

# Terminal 2 - Frontend
cd frontend
npm run dev
```

No environment variables needed for local development!
