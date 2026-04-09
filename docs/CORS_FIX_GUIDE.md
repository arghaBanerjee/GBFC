# CORS Fix Guide for Glasgow Bengali FC

## Problem
The frontend (Vercel) is getting CORS errors when trying to access the backend API (Render):
```
Access to fetch at 'https://gbfc.onrender.com/api/user-actions/pending-payments' from origin 'https://glasgow-bengali-fc.vercel.app' has been blocked by CORS policy
```

## Solution Steps

### 1. Backend CORS Configuration ✅
The backend (`api.py`) already includes the correct CORS configuration:
```python
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173", 
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "https://glasgow-bengali-fc.vercel.app",  # Production frontend
    "https://gbfc.onrender.com",  # Backend domain
    "https://www.glasgow-bengali-fc.vercel.app",  # WWW subdomain
]
```

### 2. Frontend Environment Configuration
The frontend needs to use the correct production API URL:

#### For Local Development:
```bash
# frontend/.env
VITE_API_BASE_URL=http://localhost:8000
```

#### For Production (Vercel):
Set environment variable in Vercel dashboard:
```
VITE_API_BASE_URL=https://gbfc.onrender.com
```

### 3. Deploy Backend Changes
After updating the CORS configuration in `api.py`:

```bash
# Deploy backend to Render
git add api.py
git commit -m "Fix CORS configuration for production domains"
git push origin main
```

The backend will automatically redeploy on Render with the new CORS settings.

### 4. Deploy Frontend Changes
Ensure the frontend has the correct environment variables:

```bash
# Check frontend environment
cd frontend
npm run build
```

### 5. Verify Configuration
After deployment:

1. **Backend Logs**: Check Render dashboard logs for CORS configuration message:
   ```
   Configuring CORS with allowed origins: [...]
   ```

2. **Test API Access**: Test the API endpoint directly:
   ```bash
   curl -H "Origin: https://glasgow-bengali-fc.vercel.app" \
        -H "Access-Control-Request-Method: GET" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -X OPTIONS \
        https://gbfc.onrender.com/api/user-actions/pending-payments
   ```

3. **Frontend Console**: Check browser console for CORS errors

## Troubleshooting

### If CORS Still Fails:
1. **Clear Browser Cache**: CORS headers are cached, clear browser cache
2. **Check Backend Logs**: Ensure backend deployed successfully
3. **Verify Environment Variables**: Check Vercel environment variables
4. **Test Different Endpoint**: Try a simpler endpoint like `/api/events`

### Common Issues:
- **Backend Not Redeployed**: Changes to `api.py` require backend redeployment
- **Wrong Environment Variable**: Frontend might still be using localhost URL
- **Caching**: Browser or CDN caching old CORS headers

## Environment Variables Setup

### Vercel (Frontend):
1. Go to Vercel dashboard → Project → Settings → Environment Variables
2. Add: `VITE_API_BASE_URL` = `https://gbfc.onrender.com`
3. Redeploy the frontend

### Render (Backend):
1. Go to Render dashboard → Service → Environment
2. Ensure `FRONTEND_ORIGIN` is set if needed
3. Redeploy the backend

## Testing Commands

```bash
# Test CORS preflight request
curl -I -H "Origin: https://glasgow-bengali-fc.vercel.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://gbfc.onrender.com/api/user-actions/pending-payments

# Should return:
# Access-Control-Allow-Origin: https://glasgow-bengali-fc.vercel.app
# Access-Control-Allow-Methods: *
# Access-Control-Allow-Headers: *
```

## Quick Fix Checklist
- [ ] Backend CORS includes `https://glasgow-bengali-fc.vercel.app`
- [ ] Backend deployed to Render
- [ ] Frontend `VITE_API_BASE_URL` set to `https://gbfc.onrender.com`
- [ ] Frontend deployed to Vercel
- [ ] Browser cache cleared
- [ ] Test API endpoint directly
