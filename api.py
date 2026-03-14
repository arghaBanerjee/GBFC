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
                password VARCHAR(255) NOT NULL,
                user_type VARCHAR(50) DEFAULT 'member',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_deleted BOOLEAN DEFAULT FALSE,
                deleted_at TIMESTAMP,
                deleted_by VARCHAR(255)
            )
            """)
            # Add user_type column if it doesn't exist (for existing databases)
            try:
                cur.execute("""
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name='users' AND column_name='user_type'
                        ) THEN
                            ALTER TABLE users ADD COLUMN user_type VARCHAR(50) DEFAULT 'member';
                        END IF;
                    END $$;
                """)
                conn.commit()
            except Exception as e:
                print(f"Warning: Could not add user_type column: {e}")
                conn.rollback()
            
            # Add created_at column if it doesn't exist (for existing databases)
            try:
                cur.execute("""
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name='users' AND column_name='created_at'
                        ) THEN
                            ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                        END IF;
                    END $$;
                """)
                conn.commit()
            except Exception as e:
                print(f"Warning: Could not add created_at column: {e}")
                conn.rollback()
            
            # Add is_deleted column if it doesn't exist (for existing databases)
            try:
                cur.execute("""
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name='users' AND column_name='is_deleted'
                        ) THEN
                            ALTER TABLE users ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
                        END IF;
                    END $$;
                """)
                conn.commit()
            except Exception as e:
                print(f"Warning: Could not add is_deleted column: {e}")
                conn.rollback()
            
            # Add deleted_at column if it doesn't exist (for existing databases)
            try:
                cur.execute("""
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name='users' AND column_name='deleted_at'
                        ) THEN
                            ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP;
                        END IF;
                    END $$;
                """)
                conn.commit()
            except Exception as e:
                print(f"Warning: Could not add deleted_at column: {e}")
                conn.rollback()
            
            # Add deleted_by column if it doesn't exist (for existing databases)
            try:
                cur.execute("""
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name='users' AND column_name='deleted_by'
                        ) THEN
                            ALTER TABLE users ADD COLUMN deleted_by VARCHAR(255);
                        END IF;
                    END $$;
                """)
                conn.commit()
            except Exception as e:
                print(f"Warning: Could not add deleted_by column: {e}")
                conn.rollback()
            
            # Add user_full_name to forum_posts if it doesn't exist
            try:
                cur.execute("""
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name='forum_posts' AND column_name='user_full_name'
                        ) THEN
                            ALTER TABLE forum_posts ADD COLUMN user_full_name VARCHAR(255);
                        END IF;
                    END $$;
                """)
                conn.commit()
            except Exception as e:
                print(f"Warning: Could not add user_full_name to forum_posts: {e}")
                conn.rollback()
            
            # Add user_full_name to forum_comments if it doesn't exist
            try:
                cur.execute("""
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name='forum_comments' AND column_name='user_full_name'
                        ) THEN
                            ALTER TABLE forum_comments ADD COLUMN user_full_name VARCHAR(255);
                        END IF;
                    END $$;
                """)
                conn.commit()
            except Exception as e:
                print(f"Warning: Could not add user_full_name to forum_comments: {e}")
                conn.rollback()
            
            # Add user_full_name to event_comments if it doesn't exist
            try:
                cur.execute("""
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name='event_comments' AND column_name='user_full_name'
                        ) THEN
                            ALTER TABLE event_comments ADD COLUMN user_full_name VARCHAR(255);
                        END IF;
                    END $$;
                """)
                conn.commit()
            except Exception as e:
                print(f"Warning: Could not add user_full_name to event_comments: {e}")
                conn.rollback()
            
            # Add user_full_name to practice_availability if it doesn't exist
            try:
                cur.execute("""
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name='practice_availability' AND column_name='user_full_name'
                        ) THEN
                            ALTER TABLE practice_availability ADD COLUMN user_full_name VARCHAR(255);
                        END IF;
                    END $$;
                """)
                conn.commit()
            except Exception as e:
                print(f"Warning: Could not add user_full_name to practice_availability: {e}")
                conn.rollback()
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
                user_full_name VARCHAR(255),
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS practice_availability (
                id SERIAL PRIMARY KEY,
                date VARCHAR(50) NOT NULL,
                user_email VARCHAR(255),
                user_full_name VARCHAR(255),
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
                user_full_name VARCHAR(255),
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
                user_full_name VARCHAR(255),
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_email VARCHAR(255),
                type VARCHAR(50) NOT NULL,
                message TEXT NOT NULL,
                read BOOLEAN DEFAULT FALSE,
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
                password TEXT NOT NULL,
                user_type TEXT DEFAULT 'member',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_deleted BOOLEAN DEFAULT 0,
                deleted_at TIMESTAMP,
                deleted_by TEXT
            )
            """)
            try:
                cur.execute("ALTER TABLE users ADD COLUMN password TEXT")
            except sqlite3.OperationalError:
                pass
            # Add user_type column if it doesn't exist
            try:
                cur.execute("ALTER TABLE users ADD COLUMN user_type TEXT DEFAULT 'member'")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e).lower():
                    print(f"Warning: Could not add user_type column: {e}")
            # Add created_at column if it doesn't exist (without default due to SQLite limitation)
            try:
                cur.execute("ALTER TABLE users ADD COLUMN created_at TIMESTAMP")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e).lower():
                    print(f"Warning: Could not add created_at column: {e}")
            # Update NULL created_at values for existing users
            try:
                cur.execute("UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL")
            except sqlite3.OperationalError:
                pass
            # Add is_deleted column if it doesn't exist
            try:
                cur.execute("ALTER TABLE users ADD COLUMN is_deleted BOOLEAN DEFAULT 0")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e).lower():
                    print(f"Warning: Could not add is_deleted column: {e}")
            # Add deleted_at column if it doesn't exist
            try:
                cur.execute("ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e).lower():
                    print(f"Warning: Could not add deleted_at column: {e}")
            # Add deleted_by column if it doesn't exist
            try:
                cur.execute("ALTER TABLE users ADD COLUMN deleted_by TEXT")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e).lower():
                    print(f"Warning: Could not add deleted_by column: {e}")
            # Add user_full_name to forum_posts if it doesn't exist
            try:
                cur.execute("ALTER TABLE forum_posts ADD COLUMN user_full_name TEXT")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e).lower():
                    print(f"Warning: Could not add user_full_name to forum_posts: {e}")
            # Add user_full_name to forum_comments if it doesn't exist
            try:
                cur.execute("ALTER TABLE forum_comments ADD COLUMN user_full_name TEXT")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e).lower():
                    print(f"Warning: Could not add user_full_name to forum_comments: {e}")
            # Add user_full_name to event_comments if it doesn't exist
            try:
                cur.execute("ALTER TABLE event_comments ADD COLUMN user_full_name TEXT")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e).lower():
                    print(f"Warning: Could not add user_full_name to event_comments: {e}")
            # Add user_full_name to practice_availability if it doesn't exist
            try:
                cur.execute("ALTER TABLE practice_availability ADD COLUMN user_full_name TEXT")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e).lower():
                    print(f"Warning: Could not add user_full_name to practice_availability: {e}")
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
                user_full_name TEXT,
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(event_id) REFERENCES events(id)
            );
            CREATE TABLE IF NOT EXISTS practice_availability (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                user_email TEXT,
                user_full_name TEXT,
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
                user_full_name TEXT,
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
                user_full_name TEXT,
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(post_id) REFERENCES forum_posts(id)
            );
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT,
                type TEXT NOT NULL,
                message TEXT NOT NULL,
                read INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    user_type: str = "member"
    created_at: Optional[str] = None

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
    user_email: str
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

class AdminPracticeAvailability(BaseModel):
    date: str
    user_email: str
    status: str  # 'available', 'tentative', 'not_available', or 'delete' to remove

class PracticeSessionCreate(BaseModel):
    date: str
    time: Optional[str] = None
    location: Optional[str] = None

class PracticeSessionOut(BaseModel):
    date: str
    time: Optional[str] = None
    location: Optional[str] = None

# --- Helper Functions ---
def is_admin(current_user: dict) -> bool:
    """Check if user is admin based on user_type or super admin email"""
    # Fetch user_type from database
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT user_type, is_deleted FROM users WHERE email = {PLACEHOLDER}", (current_user["email"],))
        row = cur.fetchone()
        if row:
            row_dict = dict(row)
            # Check if user is deleted
            if row_dict.get("is_deleted"):
                return False
            user_type = row_dict.get("user_type") or "member"
        else:
            user_type = "member"
    
    # Check if user_type is 'admin' OR email is 'super@admin.com'
    return user_type == "admin" or current_user.get("email") == "super@admin.com"

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
            
            # Check if email already exists
            cur.execute(
                f"SELECT id, is_deleted FROM users WHERE email = {PLACEHOLDER}",
                (user.email,)
            )
            existing = cur.fetchone()
            
            if existing:
                existing_dict = dict(existing)
                if existing_dict.get('is_deleted'):
                    # Reactivate deleted account
                    cur.execute(
                        f"UPDATE users SET is_deleted = FALSE, deleted_at = NULL, "
                        f"full_name = {PLACEHOLDER}, password = {PLACEHOLDER}, user_type = 'member' "
                        f"WHERE email = {PLACEHOLDER}",
                        (user.full_name, hash_password(user.password), user.email)
                    )
                    conn.commit()
                    return UserOut(id=existing_dict['id'], email=user.email, full_name=user.full_name, user_type='member')
                else:
                    # Active user already exists
                    raise HTTPException(status_code=400, detail="Email already registered")
            
            # Create new user
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
            return UserOut(id=user_id, email=user.email, full_name=user.full_name, user_type='member')
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT * FROM users WHERE email = {PLACEHOLDER} AND (is_deleted = FALSE OR is_deleted IS NULL)", (form_data.username,))
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
    # Fetch user_type from database
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT user_type, is_deleted FROM users WHERE email = {PLACEHOLDER}", (current_user["email"],))
        row = cur.fetchone()
        if row:
            row_dict = dict(row)
            # Check if user is deleted
            if row_dict.get("is_deleted"):
                raise HTTPException(status_code=401, detail="Account has been deleted")
            user_type = row_dict.get("user_type") or "member"
        else:
            user_type = "member"
    
    return UserOut(
        id=current_user["id"], 
        email=current_user["email"], 
        full_name=current_user["full_name"],
        user_type=user_type
    )

@app.post("/api/logout")
def logout(current_user: dict = Depends(get_current_user), token: str = Depends(oauth2_scheme)):
    SESSIONS.pop(token, None)
    return {"message": "Logged out"}

@app.get("/api/users", response_model=List[UserOut])
def get_all_users(current_user: dict = Depends(get_current_user)):
    # Admin only
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admins only")
    
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, email, full_name, user_type, created_at FROM users WHERE (is_deleted = FALSE OR is_deleted IS NULL) ORDER BY id DESC")
        users = []
        for row in cur.fetchall():
            user_dict = dict(row)
            # Convert datetime to ISO string if needed, or set to None
            if user_dict.get("created_at"):
                if hasattr(user_dict["created_at"], 'isoformat'):
                    user_dict["created_at"] = user_dict["created_at"].isoformat()
                else:
                    user_dict["created_at"] = str(user_dict["created_at"])
            else:
                user_dict["created_at"] = None
            # Ensure user_type has a default
            if not user_dict.get("user_type"):
                user_dict["user_type"] = "member"
            users.append(UserOut(**user_dict))
        return users

@app.patch("/api/users/{email}/type")
def update_user_type(email: str, data: dict, current_user: dict = Depends(get_current_user)):
    # Admin only
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admins only")
    
    user_type = data.get("user_type")
    if user_type not in ["member", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid user type. Must be 'member' or 'admin'")
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Check if user exists
        cur.execute(f"SELECT id FROM users WHERE email = {PLACEHOLDER}", (email,))
        user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update user type
        cur.execute(f"UPDATE users SET user_type = {PLACEHOLDER} WHERE email = {PLACEHOLDER}", (user_type, email))
        conn.commit()
        
        return {"message": f"User type updated to {user_type}"}

@app.put("/api/users/{email}/name")
def update_user_name(email: str, data: dict, current_user: dict = Depends(get_current_user)):
    # Admin only
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admins only")
    
    # Prevent editing super admin account
    if email == "super@admin.com":
        raise HTTPException(status_code=403, detail="Cannot edit super admin account")
    
    # Validate input
    full_name = data.get("full_name", "").strip()
    if not full_name:
        raise HTTPException(status_code=400, detail="Full name cannot be empty")
    
    if len(full_name) > 100:
        raise HTTPException(status_code=400, detail="Full name must be 100 characters or less")
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Check if user exists
        cur.execute(f"SELECT id FROM users WHERE email = {PLACEHOLDER}", (email,))
        user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update user's full name
        cur.execute(
            f"UPDATE users SET full_name = {PLACEHOLDER} WHERE email = {PLACEHOLDER}",
            (full_name, email)
        )
        conn.commit()
        
        return {"message": "User name updated successfully"}

@app.delete("/api/users/{email}")
def delete_user(email: str, current_user: dict = Depends(get_current_user)):
    # Admin only
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admins only")
    
    # Prevent deleting super admin account
    if email == "super@admin.com":
        raise HTTPException(status_code=403, detail="Cannot delete super admin account")
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Check if user exists and is not already deleted
        cur.execute(f"SELECT id, is_deleted FROM users WHERE email = {PLACEHOLDER}", (email,))
        user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_dict = dict(user)
        if user_dict.get('is_deleted'):
            raise HTTPException(status_code=400, detail="User already deleted")
        
        # Soft delete: Mark user as deleted and record who deleted them
        # Also remove user's likes to prevent confusion when account is reactivated
        
        # Delete forum post likes
        cur.execute(f"DELETE FROM forum_likes WHERE user_email = {PLACEHOLDER}", (email,))
        
        # Delete event likes
        cur.execute(f"DELETE FROM event_likes WHERE user_email = {PLACEHOLDER}", (email,))
        
        # Delete only FUTURE practice availability (preserve historical records)
        if USE_POSTGRES:
            cur.execute(
                f"DELETE FROM practice_availability WHERE user_email = {PLACEHOLDER} AND date > CURRENT_DATE",
                (email,)
            )
        else:
            cur.execute(
                f"DELETE FROM practice_availability WHERE user_email = {PLACEHOLDER} AND date > date('now')",
                (email,)
            )
        
        # Mark user as deleted
        if USE_POSTGRES:
            cur.execute(
                f"UPDATE users SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP, "
                f"deleted_by = {PLACEHOLDER} WHERE email = {PLACEHOLDER}",
                (current_user["email"], email)
            )
        else:
            cur.execute(
                f"UPDATE users SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, "
                f"deleted_by = {PLACEHOLDER} WHERE email = {PLACEHOLDER}",
                (current_user["email"], email)
            )
        
        conn.commit()
        return {"message": "User deleted successfully. Historical posts/comments preserved, likes removed."}

# --- Events endpoints ---
@app.get("/api/events", response_model=List[EventOut])
def get_events():
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM events ORDER BY date ASC")
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
                f"SELECT * FROM event_comments WHERE event_id = {PLACEHOLDER} ORDER BY created_at ASC",
                (event["id"],),
            )
            comments = []
            for comment_row in cur.fetchall():
                comment_dict = dict(comment_row)
                # Use stored user_full_name, fallback to users table if not set (for old comments)
                full_name = comment_dict.get("user_full_name")
                if not full_name:
                    cur.execute(f"SELECT full_name FROM users WHERE email = {PLACEHOLDER}", (comment_dict["user_email"],))
                    user_row = cur.fetchone()
                    full_name = user_row["full_name"] if user_row else comment_dict["user_email"]
                comment_dict["full_name"] = full_name
                comments.append(comment_dict)
            event["comments"] = comments
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
    # Admin only
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admins only")
    
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO events (name, date, time, location, type, description, image_url, youtube_url) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (event.name, event.date, event.time, event.location, event.type, event.description, event.image_url, event.youtube_url),
        )
        conn.commit()
        
        # Notify all users about new match
        time_info = f" at {event.time}" if event.time else ""
        location_info = f" at {event.location}" if event.location else ""
        notify_all_users(
            "match",
            f"New Football Match on {event.date}{time_info}{location_info}",
            exclude_email=current_user["email"]
        )
        
        return EventOut(id=cur.lastrowid, **event.model_dump())

@app.put("/api/events/{event_id}", response_model=EventOut)
def update_event(event_id: int, event: EventCreate, current_user: dict = Depends(get_current_user)):
    # Admin only
    if not is_admin(current_user):
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
    # Admin only
    if not is_admin(current_user):
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
    # Admin only
    if not is_admin(current_user):
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
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admins only")
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}) ON CONFLICT (date) DO UPDATE SET time = EXCLUDED.time, location = EXCLUDED.location",
            (session.date, session.time, session.location),
        )
        conn.commit()
        
        # Notify all users about new practice session
        time_info = f" at {session.time}" if session.time else ""
        location_info = f" at {session.location}" if session.location else ""
        notify_all_users(
            "practice",
            f"New Practice Session Added on {session.date}{time_info}{location_info}",
            exclude_email=current_user["email"]
        )
        
        return PracticeSessionOut(**session.model_dump())

@app.put("/api/practice/sessions/{date_str}", response_model=PracticeSessionOut)
def update_practice_session(date_str: str, session: PracticeSessionCreate, current_user: dict = Depends(get_current_user)):
    if not is_admin(current_user):
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
    # Validate comment length (max 100 characters for security)
    if len(comment["comment"]) > 100:
        raise HTTPException(status_code=400, detail="Comment must be 100 characters or less")
    
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO event_comments (event_id, user_email, user_full_name, comment) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (event_id, current_user["email"], current_user["full_name"], comment["comment"]),
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
            # Use stored user_full_name, fallback to email if not set (for old posts)
            post_full_name = post.get("user_full_name")
            if not post_full_name:
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
                # Use stored user_full_name, fallback to users table if not set (for old comments)
                c_full_name = cd.get("user_full_name")
                if not c_full_name:
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
                    user_email=post["user_email"],
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
    # Validate content length (max 500 characters for security)
    if len(post.content) > 500:
        raise HTTPException(status_code=400, detail="Post content must be 500 characters or less")
    
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO forum_posts (user_email, user_full_name, content) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (current_user["email"], current_user["full_name"], post.content),
        )
        conn.commit()
        
        # Notify all users about new forum post
        notify_all_users(
            "forum_post",
            f"New post added by {current_user['full_name']}",
            exclude_email=current_user["email"]
        )
        
        return ForumPostOut(
            id=cur.lastrowid,
            user_full_name=current_user["full_name"],
            user_email=current_user["email"],
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
    if not is_admin(current_user):
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

        # Use stored user_full_name, fallback to users table if not set (for old posts)
        post_full_name = post.get("user_full_name")
        if not post_full_name:
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
            # Use stored user_full_name, fallback to users table if not set (for old comments)
            c_full_name = cd.get("user_full_name")
            if not c_full_name:
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
            user_email=post["user_email"],
            content=payload.content,
            created_at=post_created_at,
            likes_count=likes,
            comments=comments,
        )


@app.delete("/api/forum/{post_id}")
def delete_forum_post(post_id: int, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT user_email FROM forum_posts WHERE id = {PLACEHOLDER}", (post_id,))
        post = cur.fetchone()
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        # Allow deletion if user owns the post OR is admin
        if post["user_email"] != current_user["email"] and not is_admin(current_user):
            raise HTTPException(status_code=403, detail="You can only delete your own posts")

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
    # Validate comment length (max 100 characters for security)
    if len(comment.comment) > 100:
        raise HTTPException(status_code=400, detail="Comment must be 100 characters or less")
    
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO forum_comments (post_id, user_email, user_full_name, comment) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (post_id, current_user["email"], current_user["full_name"], comment.comment),
        )
        conn.commit()
        return ForumCommentOut(id=cur.lastrowid, user_full_name=current_user["full_name"], comment=comment.comment, created_at=datetime.utcnow().isoformat())

@app.delete("/api/practice/{date_str}")
def delete_practice(date_str: str, current_user: dict = Depends(get_current_user)):
    # Admin only
    if not is_admin(current_user):
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
        # Only return availability records for current user
        # This prevents reactivated users from seeing old user's selections
        cur.execute(
            f"SELECT date, status, user_full_name FROM practice_availability WHERE user_email = {PLACEHOLDER}",
            (current_user["email"],),
        )
        result = {}
        for row in cur.fetchall():
            row_dict = dict(row)
            # Only include if user_full_name matches current user's name
            # This ensures reactivated users don't see previous user's selections
            stored_name = row_dict.get("user_full_name")
            # IMPORTANT: Only show if stored name exactly matches current user's name
            # Do NOT show if stored_name is None (old records before migration)
            if stored_name and stored_name == current_user["full_name"]:
                result[row_dict["date"]] = row_dict["status"]
        return result

@app.post("/api/practice/availability")
def set_my_practice_availability(avail: PracticeAvailability, current_user: dict = Depends(get_current_user)):
    # Parse the date string to compare with today
    from datetime import datetime, date
    try:
        practice_date = datetime.strptime(avail.date, '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Check if user is trying to modify past practice availability
    today = date.today()
    if practice_date < today:
        # Only admins can modify past practice availability
        if not is_admin(current_user):
            raise HTTPException(
                status_code=403, 
                detail="Cannot modify past practice availability. Historical records are locked."
            )
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        # If status is 'none', delete the availability record (deselection)
        if avail.status == 'none':
            cur.execute(
                f"DELETE FROM practice_availability WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
                (avail.date, current_user["email"])
            )
            conn.commit()
            return {"message": "Availability removed"}
        
        # Otherwise, insert or update the availability
        if USE_POSTGRES:
            cur.execute(
                f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}) ON CONFLICT (date, user_email) DO UPDATE SET status = EXCLUDED.status, user_full_name = EXCLUDED.user_full_name",
                (avail.date, current_user["email"], current_user["full_name"], avail.status),
            )
        else:
            # SQLite doesn't support ON CONFLICT with multiple updates in the same way
            cur.execute(
                f"INSERT OR REPLACE INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (avail.date, current_user["email"], current_user["full_name"], avail.status),
            )
        conn.commit()
        return {"message": "Availability set"}

@app.post("/api/admin/practice/availability")
def admin_set_practice_availability(avail: AdminPracticeAvailability, current_user: dict = Depends(get_current_user)):
    # Only admins can use this endpoint
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admins only")
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        # If status is 'delete', remove the availability record
        if avail.status == 'delete':
            cur.execute(
                f"DELETE FROM practice_availability WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
                (avail.date, avail.user_email)
            )
            conn.commit()
            return {"message": "Availability removed"}
        
        # Get user's full name
        cur.execute(f"SELECT full_name FROM users WHERE email = {PLACEHOLDER}", (avail.user_email,))
        user_row = cur.fetchone()
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_full_name = user_row["full_name"]
        
        # Set or update availability
        if USE_POSTGRES:
            cur.execute(
                f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}) ON CONFLICT (date, user_email) DO UPDATE SET status = EXCLUDED.status, user_full_name = EXCLUDED.user_full_name",
                (avail.date, avail.user_email, user_full_name, avail.status),
            )
        else:
            cur.execute(
                f"INSERT OR REPLACE INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (avail.date, avail.user_email, user_full_name, avail.status),
            )
        conn.commit()
        return {"message": "Availability set by admin"}

@app.get("/api/practice/availability/{date_str}")
def get_practice_availability_summary(date_str: str):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT user_email, user_full_name, status FROM practice_availability WHERE date = {PLACEHOLDER}",
            (date_str,),
        )
        rows = [dict(r) for r in cur.fetchall()]

        # Use stored user_full_name to show original username at time of booking
        # This prevents showing reactivated user's new name on historical records
        available = []
        tentative = []
        not_available = []
        
        for r in rows:
            # Use stored user_full_name (snapshot from booking time)
            name = r.get("user_full_name")
            
            # If user_full_name is not set (old records before migration)
            # We cannot reliably identify the original user because:
            # - Email might now belong to a reactivated user with different name
            # - Current name in users table might be wrong for historical record
            # Best to show a placeholder indicating historical data
            # Note: No spaces so frontend split(' ')[0] doesn't truncate it
            if not name:
                name = "[OldData]"
            
            if r["status"] == "available":
                available.append(name)
            elif r["status"] == "tentative":
                tentative.append(name)
            elif r["status"] == "not_available":
                not_available.append(name)

        # Return with email mapping for admin delete functionality
        return {
            "available": available,
            "tentative": tentative,
            "not_available": not_available,
            "user_emails": {r["user_full_name"] or r["user_email"]: r["user_email"] for r in rows}
        }

# --- Notifications ---
def create_notification(user_email: str, notif_type: str, message: str):
    """Helper function to create a notification for a user"""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO notifications (user_email, type, message) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (user_email, notif_type, message)
        )
        conn.commit()

def notify_all_users(notif_type: str, message: str, exclude_email: str = None):
    """Create notification for all users except the one who triggered it"""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT email FROM users")
        users = cur.fetchall()
        for user in users:
            email = user["email"] if USE_POSTGRES else user[0]
            if email != exclude_email:
                create_notification(email, notif_type, message)

@app.get("/api/notifications")
def get_notifications(current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT * FROM notifications WHERE user_email = {PLACEHOLDER} ORDER BY created_at DESC LIMIT 50",
            (current_user["email"],)
        )
        rows = cur.fetchall()
        notifications = []
        for row in rows:
            notifications.append({
                "id": row["id"] if USE_POSTGRES else row[0],
                "type": row["type"] if USE_POSTGRES else row[2],
                "message": row["message"] if USE_POSTGRES else row[3],
                "read": row["read"] if USE_POSTGRES else bool(row[4]),
                "created_at": row["created_at"] if USE_POSTGRES else row[5],
            })
        return notifications

@app.post("/api/notifications/mark-read")
def mark_notifications_read(current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cur = conn.cursor()
        if USE_POSTGRES:
            cur.execute(
                f"UPDATE notifications SET read = TRUE WHERE user_email = {PLACEHOLDER}",
                (current_user["email"],)
            )
        else:
            cur.execute(
                f"UPDATE notifications SET read = 1 WHERE user_email = {PLACEHOLDER}",
                (current_user["email"],)
            )
        conn.commit()
        return {"message": "Notifications marked as read"}

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
