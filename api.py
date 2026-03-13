from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
from typing import List, Optional
import sqlite3
import hashlib
import uuid
import json
import os
import shutil
from contextlib import contextmanager
import cloudinary
import cloudinary.uploader
from urllib.parse import urlparse

# --- Database helpers (supports both SQLite and Postgres) ---
DATABASE_URL = os.environ.get("DATABASE_URL")  # Render provides this
USE_POSTGRES = DATABASE_URL is not None

if USE_POSTGRES:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    # Fix for Render's postgres:// URL (needs postgresql://)
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
else:
    DB_PATH = "football_club.db"
    UPLOAD_DIR = "uploads"
    os.makedirs(UPLOAD_DIR, exist_ok=True)

# SQL placeholder - PostgreSQL uses %s, SQLite uses ?
PLACEHOLDER = "%s" if USE_POSTGRES else "?"

# Cloudinary configuration
CLOUDINARY_URL = os.environ.get("CLOUDINARY_URL")
if CLOUDINARY_URL:
    cloudinary.config(
        cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
        api_key=os.environ.get("CLOUDINARY_API_KEY"),
        api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    )

@contextmanager
def get_connection():
    if USE_POSTGRES:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        try:
            yield conn
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

def dict_factory(cursor, row):
    """Helper for SQLite to return dict-like rows"""
    if USE_POSTGRES:
        return row
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

def init_db():
    with get_connection() as conn:
        if USE_POSTGRES:
            cur = conn.cursor()
            # Postgres uses SERIAL instead of AUTOINCREMENT
            cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL
            )
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                date VARCHAR(50) NOT NULL,
                time VARCHAR(50),
                location TEXT,
                type VARCHAR(50) NOT NULL CHECK(type IN ('past', 'upcoming')),
                description TEXT,
                image_url TEXT,
                youtube_url TEXT
            )
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS event_media (
                id SERIAL PRIMARY KEY,
                event_id INTEGER REFERENCES events(id),
                media_url TEXT
            )
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS event_likes (
                id SERIAL PRIMARY KEY,
                event_id INTEGER REFERENCES events(id),
                user_email VARCHAR(255)
            )
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS event_comments (
                id SERIAL PRIMARY KEY,
                event_id INTEGER REFERENCES events(id),
                user_email VARCHAR(255),
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS practice_availability (
                id SERIAL PRIMARY KEY,
                date VARCHAR(50) NOT NULL,
                user_email VARCHAR(255),
                status VARCHAR(50) NOT NULL CHECK(status IN ('available', 'tentative', 'not_available')),
                UNIQUE(date, user_email)
            )
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS practice_sessions (
                date VARCHAR(50) PRIMARY KEY,
                time VARCHAR(50),
                location TEXT
            )
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS forum_posts (
                id SERIAL PRIMARY KEY,
                user_email VARCHAR(255),
                content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS forum_likes (
                id SERIAL PRIMARY KEY,
                post_id INTEGER REFERENCES forum_posts(id),
                user_email VARCHAR(255),
                UNIQUE(post_id, user_email)
            )
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS forum_comments (
                id SERIAL PRIMARY KEY,
                post_id INTEGER REFERENCES forum_posts(id),
                user_email VARCHAR(255),
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """)
            conn.commit()
        else:
            # SQLite version (for local development)
            cur = conn.cursor()
            try:
                cur.execute("ALTER TABLE users DROP COLUMN password_hash")
            except sqlite3.OperationalError:
                pass
            cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                full_name TEXT NOT NULL,
                password TEXT NOT NULL
            )
            """)
            try:
                cur.execute("ALTER TABLE users ADD COLUMN password TEXT")
            except sqlite3.OperationalError:
                pass
            cur.executescript("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                date TEXT NOT NULL,
                time TEXT,
                location TEXT,
                type TEXT NOT NULL CHECK(type IN ('past', 'upcoming')),
                description TEXT,
                image_url TEXT,
                youtube_url TEXT
            );
            CREATE TABLE IF NOT EXISTS event_media (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER,
                media_url TEXT,
                FOREIGN KEY(event_id) REFERENCES events(id)
            );
            CREATE TABLE IF NOT EXISTS event_likes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER,
                user_email TEXT,
                FOREIGN KEY(event_id) REFERENCES events(id)
            );
            CREATE TABLE IF NOT EXISTS event_comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER,
                user_email TEXT,
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(event_id) REFERENCES events(id)
            );
            CREATE TABLE IF NOT EXISTS practice_availability (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                user_email TEXT,
                status TEXT NOT NULL CHECK(status IN ('available', 'tentative', 'not_available')),
                UNIQUE(date, user_email)
            );
            CREATE TABLE IF NOT EXISTS practice_sessions (
                date TEXT PRIMARY KEY,
                time TEXT,
                location TEXT
            );
            CREATE TABLE IF NOT EXISTS forum_posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT,
                content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS forum_likes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER,
                user_email TEXT,
                UNIQUE(post_id, user_email),
                FOREIGN KEY(post_id) REFERENCES forum_posts(id)
            );
            CREATE TABLE IF NOT EXISTS forum_comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER,
                user_email TEXT,
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(post_id) REFERENCES forum_posts(id)
            );
            """)
            try:
                cur.execute("ALTER TABLE events ADD COLUMN image_url TEXT")
            except sqlite3.OperationalError:
                pass
            try:
                cur.execute("ALTER TABLE events ADD COLUMN youtube_url TEXT")
            except sqlite3.OperationalError:
                pass
            conn.commit()

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

# --- Pydantic models ---
class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str

class Token(BaseModel):
    access_token: str
    token_type: str

class EventOut(BaseModel):
    id: int
    name: str
    date: str
    time: Optional[str]
    location: Optional[str]
    type: str
    description: Optional[str]
    image_url: Optional[str] = None
    youtube_url: Optional[str] = None
    likes: Optional[List[dict]] = []
    comments: Optional[List[dict]] = []

class EventCreate(BaseModel):
    name: str
    date: str
    time: Optional[str]
    location: Optional[str]
    type: str
    description: Optional[str]
    image_url: Optional[str] = None
    youtube_url: Optional[str] = None

class EventComment(BaseModel):
    id: int
    user_email: str
    comment: str
    created_at: str

class ForumCommentOut(BaseModel):
    id: int
    user_full_name: str
    comment: str
    created_at: str

class ForumPostOut(BaseModel):
    id: int
    user_full_name: str
    content: str
    created_at: str
    likes_count: int
    likes: List[dict] = []
    comments: List[ForumCommentOut]

class ForumPostCreate(BaseModel):
    content: str

class ForumPostUpdate(BaseModel):
    content: str

class ForumComment(BaseModel):
    comment: str

class PracticeAvailability(BaseModel):
    date: str
    status: str

class PracticeSessionCreate(BaseModel):
    date: str
    time: Optional[str] = None
    location: Optional[str] = None

class PracticeSessionOut(BaseModel):
    date: str
    time: Optional[str] = None
    location: Optional[str] = None

# --- FastAPI app ---
app = FastAPI(title="Glasgow Bengali FC API", version="1.0")

# CORS configuration - MUST be before startup event
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "https://glasgow-bengali-fc.vercel.app",  # Production frontend
]
if FRONTEND_ORIGIN not in allowed_origins:
    allowed_origins.append(FRONTEND_ORIGIN)

print(f"Configuring CORS with allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_db()
    print("Database initialized successfully")

# Simple in-memory session token store (use JWT in production)
SESSIONS = {}

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_current_user(token: str = Depends(oauth2_scheme)):
    if token not in SESSIONS:
        raise HTTPException(status_code=401, detail="Invalid token")
    return SESSIONS[token]

# --- Auth endpoints ---
@app.post("/api/signup", response_model=UserOut)
def signup(user: UserCreate):
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                f"INSERT INTO users (email, full_name, password) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (user.email, user.full_name, hash_password(user.password)),
            )
            conn.commit()
            if USE_POSTGRES:
                # PostgreSQL doesn't support lastrowid, need to fetch the inserted row
                cur.execute(f"SELECT id FROM users WHERE email = {PLACEHOLDER}", (user.email,))
                user_id = cur.fetchone()['id']
            else:
                user_id = cur.lastrowid
            return UserOut(id=user_id, email=user.email, full_name=user.full_name)
    except (sqlite3.IntegrityError if not USE_POSTGRES else Exception) as e:
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(status_code=400, detail=f"Email already registered")
        raise HTTPException(status_code=400, detail=f"Database constraint failed: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@app.post("/api/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT * FROM users WHERE email = {PLACEHOLDER}", (form_data.username,))
        user = cur.fetchone()
        if not user:
            print(f"Login failed: no user found for email {form_data.username}")
            raise HTTPException(status_code=401, detail="Invalid email or password")
        # Debug: compare stored hash with computed hash
        input_hash = hash_password(form_data.password)
        stored_hash = user["password"]
        print(f"Login attempt for {form_data.username}: input_hash={input_hash}, stored_hash={stored_hash}")
        if not verify_password(form_data.password, user["password"]):
            print("Login failed: password mismatch")
            raise HTTPException(status_code=401, detail="Invalid email or password")
        token = str(uuid.uuid4())
        SESSIONS[token] = {"email": user["email"], "full_name": user["full_name"], "id": user["id"]}
        return {"access_token": token, "token_type": "bearer"}

@app.get("/api/me", response_model=UserOut)
def me(current_user: dict = Depends(get_current_user)):
    return UserOut(id=current_user["id"], email=current_user["email"], full_name=current_user["full_name"])

@app.post("/api/logout")
def logout(current_user: dict = Depends(get_current_user), token: str = Depends(oauth2_scheme)):
    SESSIONS.pop(token, None)
    return {"message": "Logged out"}

# --- Events endpoints ---
@app.get("/api/events", response_model=List[EventOut])
def get_events():
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM events ORDER BY date DESC")
        events = []
        for row in cur.fetchall():
            event = dict(row)
            # likes with full names
            cur.execute(
                f"SELECT el.user_email, u.full_name FROM event_likes el JOIN users u ON el.user_email = u.email WHERE el.event_id = {PLACEHOLDER}",
                (event["id"],)
            )
            event["likes"] = [dict(r) for r in cur.fetchall()]
            # comments
            cur.execute(
                f"SELECT ec.*, u.full_name FROM event_comments ec JOIN users u ON ec.user_email = u.email WHERE ec.event_id = {PLACEHOLDER} ORDER BY ec.created_at ASC",
                (event["id"],),
            )
            event["comments"] = [dict(r) for r in cur.fetchall()]
            events.append(EventOut(**event))
        return events

@app.get("/api/events/{event_id}", response_model=EventOut)
def get_event(event_id: int):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT * FROM events WHERE id = {PLACEHOLDER}", (event_id,))
        event = cur.fetchone()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        return EventOut(**dict(event))

@app.post("/api/events", response_model=EventOut)
def create_event(event: EventCreate, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO events (name, date, time, location, type, description, image_url, youtube_url) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (event.name, event.date, event.time, event.location, event.type, event.description, event.image_url, event.youtube_url),
        )
        conn.commit()
        return EventOut(id=cur.lastrowid, **event.model_dump())

@app.put("/api/events/{event_id}", response_model=EventOut)
def update_event(event_id: int, event: EventCreate, current_user: dict = Depends(get_current_user)):
    # Simple admin check (email-based)
    if current_user.get("email") != "admin@example.com":
        raise HTTPException(status_code=403, detail="Admins only")
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE events SET name={PLACEHOLDER}, date={PLACEHOLDER}, time={PLACEHOLDER}, location={PLACEHOLDER}, type={PLACEHOLDER}, description={PLACEHOLDER}, image_url={PLACEHOLDER}, youtube_url={PLACEHOLDER} WHERE id={PLACEHOLDER}",
            (event.name, event.date, event.time, event.location, event.type, event.description, event.image_url, event.youtube_url, event_id),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Event not found")
        return EventOut(id=event_id, **event.model_dump())

@app.delete("/api/events/{event_id}")
def delete_event(event_id: int, current_user: dict = Depends(get_current_user)):
    # Simple admin check (email-based)
    if current_user.get("email") != "admin@example.com":
        raise HTTPException(status_code=403, detail="Admins only")
    with get_connection() as conn:
        cur = conn.cursor()
        # Delete related records first to avoid foreign key constraint violations
        cur.execute(f"DELETE FROM event_likes WHERE event_id={PLACEHOLDER}", (event_id,))
        cur.execute(f"DELETE FROM event_comments WHERE event_id={PLACEHOLDER}", (event_id,))
        cur.execute(f"DELETE FROM events WHERE id={PLACEHOLDER}", (event_id,))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Event not found")
        return {"message": "Event deleted"}

@app.post("/api/upload-image")
async def upload_image(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    # Simple admin check (email-based)
    if current_user.get("email") != "admin@example.com":
        raise HTTPException(status_code=403, detail="Admins only")
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    if CLOUDINARY_URL:
        # Upload to Cloudinary (production)
        file_content = await file.read()
        result = cloudinary.uploader.upload(file_content, folder="football_club/events")
        return {"image_url": result["secure_url"]}
    else:
        # Save locally (development)
        file_id = str(uuid.uuid4())
        ext = os.path.splitext(file.filename)[1]
        filename = f"{file_id}{ext}"
        path = os.path.join(UPLOAD_DIR, filename)
        with open(path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"image_url": f"http://localhost:8000/{UPLOAD_DIR}/{filename}"}

@app.post("/api/forum/upload-image")
async def upload_forum_image(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    if CLOUDINARY_URL:
        # Upload to Cloudinary (production)
        file_content = await file.read()
        result = cloudinary.uploader.upload(file_content, folder="football_club/forum")
        return {"image_url": result["secure_url"]}
    else:
        # Save locally (development)
        file_id = str(uuid.uuid4())
        ext = os.path.splitext(file.filename)[1]
        filename = f"{file_id}{ext}"
        path = os.path.join(UPLOAD_DIR, filename)
        with open(path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"image_url": f"http://localhost:8000/{UPLOAD_DIR}/{filename}"}

@app.get("/uploads/{filename}")
def get_uploaded_file(filename: str):
    path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)

# --- Practice Sessions (admin-managed) ---
@app.get("/api/practice/sessions", response_model=List[PracticeSessionOut])
def list_practice_sessions():
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT date, time, location FROM practice_sessions ORDER BY date ASC")
        return [PracticeSessionOut(**dict(r)) for r in cur.fetchall()]

@app.post("/api/practice/sessions", response_model=PracticeSessionOut)
def create_practice_session(session: PracticeSessionCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("email") != "admin@example.com":
        raise HTTPException(status_code=403, detail="Admins only")
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}) ON CONFLICT (date) DO UPDATE SET time = EXCLUDED.time, location = EXCLUDED.location",
            (session.date, session.time, session.location),
        )
        conn.commit()
        return PracticeSessionOut(**session.model_dump())

@app.put("/api/practice/sessions/{date_str}", response_model=PracticeSessionOut)
def update_practice_session(date_str: str, session: PracticeSessionCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("email") != "admin@example.com":
        raise HTTPException(status_code=403, detail="Admins only")
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE practice_sessions SET time = {PLACEHOLDER}, location = {PLACEHOLDER} WHERE date = {PLACEHOLDER}",
            (session.time, session.location, date_str),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Practice session not found")
        return PracticeSessionOut(date=date_str, time=session.time, location=session.location)

# --- Likes/Comments for Events ---
@app.post("/api/events/{event_id}/like")
def like_event(event_id: int, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO event_likes (event_id, user_email) VALUES ({PLACEHOLDER}, {PLACEHOLDER}) ON CONFLICT DO NOTHING",
            (event_id, current_user["email"]),
        )
        conn.commit()
        return {"message": "Liked"}

@app.delete("/api/events/{event_id}/like")
def unlike_event(event_id: int, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"DELETE FROM event_likes WHERE event_id = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
            (event_id, current_user["email"]),
        )
        conn.commit()
        return {"message": "Unliked"}

@app.get("/api/events/likes/me")
def get_my_event_likes(current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT event_id FROM event_likes WHERE user_email = {PLACEHOLDER}",
            (current_user["email"],),
        )
        return [row["event_id"] for row in cur.fetchall()]

@app.get("/api/events/{event_id}/comments", response_model=List[EventComment])
def get_event_comments(event_id: int):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT * FROM event_comments WHERE event_id = {PLACEHOLDER} ORDER BY created_at ASC",
            (event_id,),
        )
        comments = []
        for row in cur.fetchall():
            comment_dict = dict(row)
            # Convert datetime to ISO string if needed
            if hasattr(comment_dict.get("created_at"), 'isoformat'):
                comment_dict["created_at"] = comment_dict["created_at"].isoformat()
            comments.append(EventComment(**comment_dict))
        return comments

@app.post("/api/events/{event_id}/comments", response_model=EventComment)
def create_event_comment(event_id: int, comment: dict, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO event_comments (event_id, user_email, comment) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (event_id, current_user["email"], comment["comment"]),
        )
        conn.commit()
        return EventComment(id=cur.lastrowid, user_email=current_user["email"], comment=comment["comment"], created_at=datetime.utcnow().isoformat())

# --- Forum endpoints ---
@app.get("/api/forum", response_model=List[ForumPostOut])
def get_forum_posts():
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM forum_posts ORDER BY created_at DESC")
        posts = []
        for row in cur.fetchall():
            post = dict(row)
            cur.execute(f"SELECT full_name FROM users WHERE email = {PLACEHOLDER}", (post["user_email"],))
            user_row = cur.fetchone()
            post_full_name = user_row["full_name"] if user_row else post["user_email"]
            # likes with full names
            cur.execute(
                f"SELECT fl.user_email, u.full_name FROM forum_likes fl JOIN users u ON fl.user_email = u.email WHERE fl.post_id = {PLACEHOLDER}",
                (post["id"],)
            )
            likes_list = [dict(r) for r in cur.fetchall()]
            likes_count = len(likes_list)
            # comments
            cur.execute(
                f"SELECT * FROM forum_comments WHERE post_id = {PLACEHOLDER} ORDER BY created_at ASC",
                (post["id"],),
            )
            comments = []
            for c in cur.fetchall():
                cd = dict(c)
                cur.execute(f"SELECT full_name FROM users WHERE email = {PLACEHOLDER}", (cd["user_email"],))
                cu = cur.fetchone()
                c_full_name = cu["full_name"] if cu else cd["user_email"]
                # Convert datetime to ISO string if needed
                created_at_str = cd["created_at"].isoformat() if hasattr(cd["created_at"], 'isoformat') else cd["created_at"]
                comments.append(
                    ForumCommentOut(
                        id=cd["id"],
                        user_full_name=c_full_name,
                        comment=cd["comment"],
                        created_at=created_at_str,
                    )
                )
            # Convert datetime to ISO string if needed
            post_created_at = post["created_at"].isoformat() if hasattr(post["created_at"], 'isoformat') else post["created_at"]
            posts.append(
                ForumPostOut(
                    id=post["id"],
                    user_full_name=post_full_name,
                    content=post["content"],
                    created_at=post_created_at,
                    likes_count=likes_count,
                    likes=likes_list,
                    comments=comments,
                )
            )
        return posts

@app.post("/api/forum", response_model=ForumPostOut)
def create_forum_post(post: ForumPostCreate, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO forum_posts (user_email, content) VALUES ({PLACEHOLDER}, {PLACEHOLDER})",
            (current_user["email"], post.content),
        )
        conn.commit()
        return ForumPostOut(
            id=cur.lastrowid,
            user_full_name=current_user["full_name"],
            content=post.content,
            created_at=datetime.utcnow().isoformat(),
            likes_count=0,
            comments=[],
        )

@app.put("/api/forum/{post_id}", response_model=ForumPostOut)
def admin_update_forum_post(
    post_id: int,
    payload: ForumPostUpdate,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("email") != "admin@example.com":
        raise HTTPException(status_code=403, detail="Admins only")

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT * FROM forum_posts WHERE id = {PLACEHOLDER}", (post_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Post not found")

        cur.execute(f"UPDATE forum_posts SET content = {PLACEHOLDER} WHERE id = {PLACEHOLDER}", (payload.content, post_id))
        conn.commit()

        post = dict(row)
        post["content"] = payload.content

        cur.execute(f"SELECT full_name FROM users WHERE email = {PLACEHOLDER}", (post["user_email"],))
        user_row = cur.fetchone()
        post_full_name = user_row["full_name"] if user_row else post["user_email"]

        cur.execute(f"SELECT COUNT(*) as cnt FROM forum_likes WHERE post_id = {PLACEHOLDER}", (post_id,))
        likes = cur.fetchone()["cnt"]

        cur.execute(
            f"SELECT * FROM forum_comments WHERE post_id = {PLACEHOLDER} ORDER BY created_at ASC",
            (post_id,),
        )
        comments = []
        for c in cur.fetchall():
            cd = dict(c)
            cur.execute(f"SELECT full_name FROM users WHERE email = {PLACEHOLDER}", (cd["user_email"],))
            cu = cur.fetchone()
            c_full_name = cu["full_name"] if cu else cd["user_email"]
            # Convert datetime to ISO string if needed
            created_at_str = cd["created_at"].isoformat() if hasattr(cd["created_at"], 'isoformat') else cd["created_at"]
            comments.append(
                ForumCommentOut(
                    id=cd["id"],
                    user_full_name=c_full_name,
                    comment=cd["comment"],
                    created_at=created_at_str,
                )
            )

        # Convert datetime to ISO string if needed
        post_created_at = post["created_at"].isoformat() if hasattr(post["created_at"], 'isoformat') else post["created_at"]
        return ForumPostOut(
            id=post_id,
            user_full_name=post_full_name,
            content=payload.content,
            created_at=post_created_at,
            likes_count=likes,
            comments=comments,
        )


@app.delete("/api/forum/{post_id}")
def admin_delete_forum_post(post_id: int, current_user: dict = Depends(get_current_user)):
    if current_user.get("email") != "admin@example.com":
        raise HTTPException(status_code=403, detail="Admins only")

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT id FROM forum_posts WHERE id = {PLACEHOLDER}", (post_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Post not found")

        cur.execute(f"DELETE FROM forum_likes WHERE post_id = {PLACEHOLDER}", (post_id,))
        cur.execute(f"DELETE FROM forum_comments WHERE post_id = {PLACEHOLDER}", (post_id,))
        cur.execute(f"DELETE FROM forum_posts WHERE id = {PLACEHOLDER}", (post_id,))
        conn.commit()
        return {"message": "Post deleted"}

@app.post("/api/forum/{post_id}/like")
def like_forum_post(post_id: int, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO forum_likes (post_id, user_email) VALUES ({PLACEHOLDER}, {PLACEHOLDER}) ON CONFLICT DO NOTHING",
            (post_id, current_user["email"]),
        )
        conn.commit()
        return {"message": "Liked"}

@app.delete("/api/forum/{post_id}/like")
def unlike_forum_post(post_id: int, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"DELETE FROM forum_likes WHERE post_id = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
            (post_id, current_user["email"]),
        )
        conn.commit()
        return {"message": "Unliked"}

@app.get("/api/forum/likes/me")
def get_my_forum_likes(current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT post_id FROM forum_likes WHERE user_email = {PLACEHOLDER}",
            (current_user["email"],),
        )
        return [row["post_id"] for row in cur.fetchall()]

@app.post("/api/forum/{post_id}/comments", response_model=ForumCommentOut)
def create_forum_comment(post_id: int, comment: ForumComment, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO forum_comments (post_id, user_email, comment) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (post_id, current_user["email"], comment.comment),
        )
        conn.commit()
        return ForumCommentOut(id=cur.lastrowid, user_full_name=current_user["full_name"], comment=comment.comment, created_at=datetime.utcnow().isoformat())

@app.delete("/api/practice/{date_str}")
def delete_practice(date_str: str, current_user: dict = Depends(get_current_user)):
    # Simple admin check (email-based)
    if current_user.get("email") != "admin@example.com":
        raise HTTPException(status_code=403, detail="Admins only")
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"DELETE FROM practice_sessions WHERE date = {PLACEHOLDER}", (date_str,))
        conn.commit()
        return {"message": "Practice session deleted"}

# --- Practice endpoints ---
@app.get("/api/practice/availability")
def get_my_practice_availability(current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT date, status FROM practice_availability WHERE user_email = {PLACEHOLDER}",
            (current_user["email"],),
        )
        return {row["date"]: row["status"] for row in cur.fetchall()}

@app.post("/api/practice/availability")
def set_my_practice_availability(avail: PracticeAvailability, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO practice_availability (date, user_email, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}) ON CONFLICT (date, user_email) DO UPDATE SET status = EXCLUDED.status",
            (avail.date, current_user["email"], avail.status),
        )
        conn.commit()
        return {"message": "Availability set"}

@app.get("/api/practice/availability/{date_str}")
def get_practice_availability_summary(date_str: str):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT email, full_name FROM users ORDER BY full_name ASC")
        users = [dict(r) for r in cur.fetchall()]
        email_to_name = {u["email"]: u["full_name"] for u in users}
        all_emails = [u["email"] for u in users]

        cur.execute(
            f"SELECT user_email, status FROM practice_availability WHERE date = {PLACEHOLDER}",
            (date_str,),
        )
        rows = [dict(r) for r in cur.fetchall()]

        available = [email_to_name.get(r["user_email"], r["user_email"]) for r in rows if r["status"] == "available"]
        tentative = [email_to_name.get(r["user_email"], r["user_email"]) for r in rows if r["status"] == "tentative"]
        not_available = [email_to_name.get(r["user_email"], r["user_email"]) for r in rows if r["status"] == "not_available"]

        voted_emails = {r["user_email"] for r in rows}
        no_vote = [email_to_name.get(e, e) for e in all_emails if e not in voted_emails]

        return {
            "available": available,
            "tentative": tentative,
            "not_available": not_available,
            "no_vote": no_vote,
        }

# --- About Us ---
@app.get("/api/about")
def get_about():
    # Static data for now; can be moved to DB later
    return {
        "club_name": "Glasgow Bengali Football Club",
        "summary": "A community-driven Bengali football club in Glasgow, bringing players, families, and fans together every week.",
        "committee": [
            {"name": "Arif Rahman", "role": "President", "image": "https://images.pexels.com/photos/2182970/pexels-photo-2182970.jpeg"},
            {"name": "Sara Khan", "role": "Treasurer", "image": "https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg"},
            {"name": "Jamal Ahmed", "role": "Coach", "image": "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg"},
        ],
        "members": [
            {"name": "Riaz Uddin", "intro": "Midfielder, joined 2022"},
            {"name": "Nadia Islam", "intro": "Forward, joined 2023"},
            {"name": "Tariq Mehmood", "intro": "Defender, joined 2021"},
        ],
    }

if __name__ == "__main__":
    init_db()
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
