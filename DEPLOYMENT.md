# Deployment Guide - Glasgow Bengali FC

This guide will help you deploy the application using **Vercel (Frontend)** + **Render (Backend)** with **Postgres** and **Cloudinary**.

## Prerequisites

1. GitHub account
2. Vercel account (free) - https://vercel.com
3. Render account (free) - https://render.com
4. Cloudinary account (free) - https://cloudinary.com

## Step 1: Setup Cloudinary

1. Sign up for a free Cloudinary account at https://cloudinary.com
2. Go to your Dashboard
3. Copy these values (you'll need them later):
   - Cloud Name
   - API Key
   - API Secret

## Step 2: Push Code to GitHub

```bash
cd /Users/argha/Documents/Projects/Football
git init
git add .
git commit -m "Initial commit - Glasgow Bengali FC"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

## Step 3: Deploy Backend on Render

1. Go to https://render.com and sign in
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `glasgow-bengali-fc-api`
   - **Root Directory**: Leave empty (uses repo root)
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn api:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: Free

5. Add a PostgreSQL database:
   - In your service dashboard, click "New +" → "PostgreSQL"
   - **Name**: `glasgow-bengali-fc-db`
   - **Database**: `football_club`
   - **User**: `football_club_user`
   - **Instance Type**: Free
   - Click "Create Database"

6. Link database to your web service:
   - Go back to your web service
   - Click "Environment" tab
   - Render automatically adds `DATABASE_URL` when you create a Postgres database in the same project

7. Add environment variables in the "Environment" tab:
   - `CLOUDINARY_CLOUD_NAME` = (your Cloudinary cloud name)
   - `CLOUDINARY_API_KEY` = (your Cloudinary API key)
   - `CLOUDINARY_API_SECRET` = (your Cloudinary API secret)
   - `CLOUDINARY_URL` = `cloudinary://API_KEY:API_SECRET@CLOUD_NAME`
   - `FRONTEND_ORIGIN` = (leave empty for now, we'll add it after deploying frontend)

8. Click "Create Web Service"
9. Wait for deployment to complete
10. Copy your backend URL (e.g., `https://glasgow-bengali-fc-api.onrender.com`)

## Step 4: Deploy Frontend on Vercel

1. Go to https://vercel.com and sign in
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

5. Add environment variable:
   - Click "Environment Variables"
   - Add: `VITE_API_BASE_URL` = (your Render backend URL from Step 3)
   - Example: `https://glasgow-bengali-fc-api.onrender.com`

6. Click "Deploy"
7. Wait for deployment to complete
8. Copy your frontend URL (e.g., `https://glasgow-bengali-fc.vercel.app`)

## Step 5: Update Backend CORS

1. Go back to Render dashboard
2. Open your web service
3. Go to "Environment" tab
4. Add/Update environment variable:
   - `FRONTEND_ORIGIN` = (your Vercel URL from Step 4)
   - Example: `https://glasgow-bengali-fc.vercel.app`

5. Save changes (this will trigger a redeploy)

## Step 6: Create Admin Account

1. Visit your deployed frontend URL
2. Click "Sign up"
3. Create an account with:
   - **Email**: `admin@example.com`
   - **Full Name**: Admin User (or your name)
   - **Password**: (choose a secure password)

4. Log in with these credentials
5. You should now see the "Admin" menu item

## Important Notes

### Free Tier Limitations

**Render Free Tier:**
- Backend "sleeps" after 15 minutes of inactivity
- First request after sleep takes ~30 seconds to wake up
- 750 hours/month free (enough for 24/7 if you only have one service)

**Vercel Free Tier:**
- Frontend never sleeps
- Unlimited bandwidth
- 100GB bandwidth/month

**Cloudinary Free Tier:**
- 25GB storage
- 25GB bandwidth/month
- More than enough for a community club app

### Database Backups

Render's free Postgres tier does NOT include automatic backups. For production use, consider:
1. Upgrading to a paid Render plan ($7/month with backups)
2. Setting up manual backup scripts
3. Using a managed database service

### Custom Domain (Optional)

**Vercel:**
1. Go to your project settings
2. Click "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

**Render:**
1. Go to your web service settings
2. Click "Custom Domain"
3. Add your domain
4. Update DNS records as instructed

## Troubleshooting

### Backend won't start
- Check Render logs for errors
- Verify all environment variables are set correctly
- Ensure `DATABASE_URL` is automatically set by Render

### Frontend can't connect to backend
- Verify `VITE_API_BASE_URL` is set correctly in Vercel
- Check that `FRONTEND_ORIGIN` is set in Render backend
- Look for CORS errors in browser console

### Images not uploading
- Verify Cloudinary credentials are correct
- Check that `CLOUDINARY_URL` is properly formatted
- Look at Render logs for upload errors

### Database connection errors
- Ensure Postgres database is created and linked
- Check that `DATABASE_URL` environment variable exists
- Verify database is in the same Render region as your web service

## Monitoring

- **Render**: Check logs in your service dashboard
- **Vercel**: Check deployment logs and analytics
- **Cloudinary**: Monitor usage in your dashboard

## Cost Estimate

With the free tiers:
- **Total cost**: $0/month
- Suitable for up to ~1000 active users
- ~10GB image storage
- Backend may sleep during low activity

To eliminate sleep and add backups:
- Render Starter plan: $7/month
- Total: $7/month

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Render/Vercel logs
3. Verify all environment variables are set correctly
