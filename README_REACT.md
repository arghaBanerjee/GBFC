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

- **Backend**: FastAPI + SQLite
- **Frontend**: React 18 + Vite + React Router
- **Styling**: Plain CSS (matches previous Streamlit design)

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

- The backend reuses the original SQLite database schema from the Streamlit version.
- Authentication uses simple bearer tokens stored in `localStorage` (for demo purposes only).
- The frontend includes all pages: Home, Events, Practice, Forum, About Us, Login, Signup.
- To stop both servers: `Ctrl+C` in each terminal.

## Production Considerations

- Replace in‑memory session store with proper JWT or database-backed sessions.
- Use HTTPS and secure cookies.
- Add more robust validation and error handling.
- Set up a proper build/deploy pipeline for the React app.
