# Glasgow Bengali Football Club – React + FastAPI

A modern web app for the Glasgow Bengali Football Club with a React frontend and FastAPI backend.

## Features

- User authentication (signup/login)
- Events (past/upcoming) with likes and comments
- Practice availability calendar (Thursdays)
- Forum with posts, likes, and comments
- About Us page with committee and member list
- Responsive UI inspired by Webflow

## Tech Stack

- **Backend**: FastAPI + PostgreSQL (production) / SQLite (local dev)
- **Frontend**: React 18 + Vite + React Router
- **Image Storage**: Cloudinary (production) / Local (dev)
- **Styling**: Plain CSS with modern responsive design

## Quick Start

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

The React app will run on `http://localhost:5173` and proxy API requests to the backend.

### 4. Open the app

Visit `http://localhost:5173` in your browser.

## Development Notes

- Backend automatically uses SQLite for local development
- Production deployment uses PostgreSQL for data persistence
- Authentication uses simple bearer tokens stored in `localStorage`
- The frontend includes all pages: Home, Events, Practice, Forum, About Us, Login, Signup
- To stop both servers: `Ctrl+C` in each terminal

## Deployment

This app is deployment-ready for Vercel (frontend) + Render (backend).

See:
- **`QUICKSTART_DEPLOY.md`** - 15-minute deployment guide
- **`DEPLOYMENT.md`** - Detailed step-by-step instructions

**Features for production:**
- PostgreSQL database with persistent storage
- Cloudinary for image uploads
- Dynamic CORS configuration
- Environment-based configuration
