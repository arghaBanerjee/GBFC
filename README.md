# Glasgow Bengali Football Club

A modern web application for the Glasgow Bengali Football Club with a React frontend and FastAPI backend.

## Features

- User authentication (signup/login)
- Events (past/upcoming) with likes and comments
- Practice availability calendar with admin-managed sessions
- Forum with rich text posts, likes, and comments
- Admin panel for managing events, practice sessions, and forum posts
- About Us page with committee and member information
- Responsive modern UI

## Tech Stack

- **Backend**: FastAPI + PostgreSQL (production) / SQLite (local dev)
- **Frontend**: React 18 + Vite + React Router
- **Image Storage**: Cloudinary (production) / Local (dev)
- **Deployment**: Vercel (frontend) + Render (backend)

## Quick Start (Local Development)

### 1. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 2. Start the FastAPI backend

```bash
python api.py
```

The API will run on `http://localhost:8000`.

### 3. Install frontend dependencies and start React dev server

```bash
cd frontend
npm install
npm run dev
```

The React app will run on `http://localhost:5173`.

### 4. Open the app

Visit `http://localhost:5173` in your browser.

### 5. Create admin account

- Sign up with email: `admin@example.com`
- Choose any password
- Log in to access the Admin panel

## Deployment

See **`QUICKSTART_DEPLOY.md`** for a 15-minute deployment guide, or **`DEPLOYMENT.md`** for detailed instructions.

**Deploy to:**
- **Frontend**: Vercel (free)
- **Backend**: Render (free tier available)
- **Database**: PostgreSQL on Render
- **Images**: Cloudinary (free tier)

## Project Structure

```
Football/
├── api.py              # FastAPI backend
├── requirements.txt    # Python dependencies
├── render.yaml         # Render deployment config
├── frontend/
│   ├── src/
│   │   ├── pages/      # React pages
│   │   ├── App.jsx     # Main app component
│   │   └── api.js      # API utility
│   ├── vercel.json     # Vercel deployment config
│   └── package.json    # Node dependencies
├── DEPLOYMENT.md       # Detailed deployment guide
└── QUICKSTART_DEPLOY.md # Quick deployment guide
```

## Development Notes

- Backend automatically uses SQLite for local development
- Production deployment uses PostgreSQL for data persistence
- Images stored locally in dev, Cloudinary in production
- Authentication uses bearer tokens (enhance with JWT for production)
