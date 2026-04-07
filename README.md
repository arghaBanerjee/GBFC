# Glasgow Bengali Football Club

A modern web application for the Glasgow Bengali Football Club with a React frontend and FastAPI backend.

## Features

- User authentication (signup/login)
- Matches (past/upcoming) with likes and comments
- Calendar availability with admin-managed events
- Forum with rich text posts, likes, and comments
- Admin panel for managing matches, calendar events,expenses, reports
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

## Documentation

- **[Quick Deployment Guide](docs/QUICKSTART_DEPLOY.md)** - 15-minute deployment guide
- **[Detailed Deployment Guide](docs/DEPLOYMENT.md)** - Comprehensive deployment instructions
- **[Testing Documentation](docs/TESTING.md)** - Test suite and testing guidelines
- **[Email Setup Guide](docs/EMAIL_SETUP.md)** - Email configuration for forgot password feature

## Deployment

See **[docs/QUICKSTART_DEPLOY.md](docs/QUICKSTART_DEPLOY.md)** for a 15-minute deployment guide, or **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for detailed instructions.

**Deploy to:**
- **Frontend**: Vercel (free)
- **Backend**: Render (free tier available)
- **Database**: PostgreSQL on Render
- **Images**: Cloudinary (free tier)

## Project Structure

```
Football/
|-- api.py              # FastAPI backend
|-- requirements.txt    # Python dependencies
|-- render.yaml         # Render deployment config
|-- run_all_tests.py    # Master test runner
|-- docs/               # Documentation
|   |-- DEPLOYMENT.md           # Detailed deployment guide
|   |-- QUICKSTART_DEPLOY.md    # Quick deployment guide
|   |-- TESTING.md              # Testing documentation
|   |-- EMAIL_SETUP.md          # Email configuration guide
|   |-- README_DEPLOYMENT.md    # Deployment README
|   |-- README_REACT.md         # React setup guide
|-- tests/              # Test directory
|   |-- test_database_compatibility.py
|   |-- test_payment_request_comprehensive.py
|   |-- test_payment_notifications.py
|   |-- test_practice_session_id_foundation.py
|   |-- test_forum_crud.py
|-- frontend/
    |-- src/
    |   |-- pages/      # React pages
    |   |   |-- Calendar.jsx    # Calendar component (formerly Practice.jsx)
    |   |   |-- Matches.jsx     # Matches component (formerly Events.jsx)
    |   |   |-- Forum.jsx       # Forum discussions
    |   |   |-- Admin.jsx       # Admin panel
    |   |   |-- UserActions.jsx # User actions (/user/*)
    |   |   |-- Profile.jsx     # User profile
    |   |   |-- About.jsx       # About page
    |   |   |-- Home.jsx        # Home page
    |   |   |-- Login.jsx       # Login page
    |   |   |-- Signup.jsx      # Signup page
    |   |   |-- ResetPassword.jsx # Password reset
    |   |-- App.jsx     # Main app component
    |   |-- api.js      # API utility
    |-- vercel.json     # Vercel deployment config
    |-- package.json    # Node dependencies
```

## Development Notes

- Backend automatically uses SQLite for local development
- Production deployment uses PostgreSQL for data persistence
- Images stored locally in dev, Cloudinary in production
- Authentication uses bearer tokens (enhance with JWT for production)
