from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
from typing import List, Optional
import sqlite3
import hashlib
import uuid
import secrets
import json
import os
import shutil
from contextlib import contextmanager
import cloudinary
import cloudinary.uploader
from urllib.parse import urlparse
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
from io import BytesIO
from apscheduler.schedulers.background import BackgroundScheduler
from local_env import load_local_env

load_local_env()

from whatsapp_notifier import (
    find_group_chat_id,
    get_instance_state,
    keep_whatsapp_instance_alive,
    resolve_group_chat_id,
    send_group_message,
    whatsapp_is_configured,
)

# --- Database helpers (supports both SQLite and Postgres) ---
DATABASE_URL = os.environ.get("DATABASE_URL")  # Render provides this
USE_POSTGRES = DATABASE_URL is not None

# Test database configuration - use separate database for testing
TEST_MODE = os.environ.get("TEST_MODE", "false").lower() == "true"

if USE_POSTGRES:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    # Fix for Render's postgres:// URL (needs postgresql://)
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
else:
    # Use test database if in test mode, otherwise use production database
    DB_PATH = "test_football_club.db" if TEST_MODE else "football_club.db"
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

# ========== FORGOT PASSWORD FEATURE - Email Configuration ==========
# These environment variables configure the email service for password recovery
# Set these in your environment or .env file to enable email functionality
# See EMAIL_SETUP.md for detailed configuration instructions
# ====================================================================
SMTP_SERVER = os.environ.get("SMTP_SERVER")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
FROM_EMAIL = os.environ.get("FROM_EMAIL") or SMTP_USERNAME or ""
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
WHATSAPP_NOTIFICATIONS_ENABLED = os.environ.get("WHATSAPP_NOTIFICATIONS_ENABLED", "false").lower() == "true"

whatsapp_scheduler = BackgroundScheduler()

NOTIFICATION_TARGET_OPTIONS = {"all_active_users", "admin_users", "available_players"}
NOTIFICATION_TYPE_DEFAULTS = {
    "practice": {
        "display_name": "New Practice Added",
        "description": "Sent when a new practice session is created.",
        "app_enabled": True,
        "email_enabled": False,
        "whatsapp_enabled": True,
        "target_audience": "all_active_users",
        "app_template": "New Practice Session Added on {{date}}{{time_suffix}}{{location_suffix}}. Please vote your Availability.",
        "email_subject": "New practice session on {{date}}",
        "email_template": "A new practice session has been added for {{date}}{{time_suffix}}{{location_suffix}}.\n\nPlease open the app and update your availability.",
        "whatsapp_template": "🏃 *NEW PRACTICE SESSION*\n\n📅 {{date}}\n{{time_line}}{{location_line}}\nPlease update your availability in the app.",
    },
    "match": {
        "display_name": "New Match Added",
        "description": "Sent when a new football match is created.",
        "app_enabled": True,
        "email_enabled": False,
        "whatsapp_enabled": True,
        "target_audience": "all_active_users",
        "app_template": "New Football Match on {{date}}{{time_suffix}}{{location_suffix}}",
        "email_subject": "New match scheduled for {{date}}",
        "email_template": "{{event_name}}\n\nA new football match has been scheduled for {{date}}{{time_suffix}}{{location_suffix}}.",
        "whatsapp_template": "⚽ *NEW MATCH*\n\n{{event_name}}\n📅 {{date}}\n{{time_line}}{{location_line}}\nCheck the app for full details.",
    },
    "forum_post": {
        "display_name": "New Forum Post Added",
        "description": "Sent when a new forum post is created.",
        "app_enabled": True,
        "email_enabled": False,
        "whatsapp_enabled": False,
        "target_audience": "all_active_users",
        "app_template": "New post added by {{author_name}}",
        "email_subject": "New forum post from {{author_name}}",
        "email_template": "A new forum post was added by {{author_name}}.\n\n{{content_preview}}",
        "whatsapp_template": "💬 *NEW FORUM POST*\n\nBy {{author_name}}\n\n{{content_preview}}\n\nOpen the app to join the conversation.",
    },
    "payment_request": {
        "display_name": "Practice Payment Requested",
        "description": "Sent when payment is requested for a practice session.",
        "app_enabled": True,
        "email_enabled": False,
        "whatsapp_enabled": True,
        "target_audience": "available_players",
        "app_template": "Payment requested by Admin for the Session on {{date}}{{time_suffix}}{{location_comma_suffix}}",
        "email_subject": "Practice payment requested for {{date}}",
        "email_template": "Payment has been requested for the practice session on {{date}}{{time_suffix}}{{location_comma_suffix}}.\n\nPlease confirm your payment in the app.",
        "whatsapp_template": "💷 *PRACTICE PAYMENT REQUEST*\n\n📅 {{date}}\n{{time_line}}{{location_line}}\nAvailable players should confirm payment in the app.",
    },
    "session_capacity_reached": {
        "display_name": "Session Capacity Reached",
        "description": "Sent when the final available slot is taken for a practice session.",
        "app_enabled": True,
        "email_enabled": False,
        "whatsapp_enabled": True,
        "target_audience": "all_active_users",
        "app_template": "Practice session capacity reached for {{date}}{{time_suffix}}{{location_comma_suffix}}. Maximum capacity is {{maximum_capacity}} players, so no more Available selections are allowed right now.",
        "email_subject": "Practice session capacity reached for {{date}}",
        "email_template": "The practice session on {{date}}{{time_suffix}}{{location_comma_suffix}} has reached its maximum capacity of {{maximum_capacity}} players. No more Available selections are allowed right now. We will notify players if slots become available before the session.",
        "whatsapp_template": "⛔ *PRACTICE SESSION FULL*\n\n📅 {{date}}\n{{time_line}}{{location_line}}👥 Maximum capacity reached: {{maximum_capacity}}\nNo more *Available* selections are allowed right now. We will notify everyone if slots open up before the session.",
    },
    "practice_slot_available": {
        "display_name": "Practice Slot Available",
        "description": "Sent when upcoming practice slots are still available within 72 hours of the session.",
        "app_enabled": True,
        "email_enabled": False,
        "whatsapp_enabled": True,
        "target_audience": "all_active_users",
        "app_template": "There are {{remaining_slots}} practice slots available for {{date}}{{time_suffix}}{{location_comma_suffix}}. Maximum capacity: {{maximum_capacity}}.",
        "email_subject": "Practice slots available for {{date}}",
        "email_template": "There are {{remaining_slots}} slots available for the practice session on {{date}}{{time_suffix}}{{location_comma_suffix}}. Maximum capacity: {{maximum_capacity}}.",
        "whatsapp_template": "✅ *PRACTICE SLOTS AVAILABLE*\n\n📅 {{date}}\n{{time_line}}{{location_line}}👥 Slots available: {{remaining_slots}} of {{maximum_capacity}}\nBook your place in the app if you want to join.",
    },
}

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
                last_login TIMESTAMP,
                birthday DATE,
                bank_name VARCHAR(255),
                sort_code VARCHAR(20),
                account_number VARCHAR(20),
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
            
            # Add last_login column if it doesn't exist (for existing databases)
            try:
                cur.execute("""
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name='users' AND column_name='last_login'
                        ) THEN
                            ALTER TABLE users ADD COLUMN last_login TIMESTAMP;
                        END IF;
                    END $$;
                """)
                conn.commit()
            except Exception as e:
                print(f"Warning: Could not add last_login column: {e}")
                conn.rollback()
            
            # Add birthday column if it doesn't exist (for existing databases)
            try:
                cur.execute("""
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name='users' AND column_name='birthday'
                        ) THEN
                            ALTER TABLE users ADD COLUMN birthday DATE;
                        END IF;
                    END $$;
                """)
                conn.commit()
            except Exception as e:
                print(f"Warning: Could not add birthday column: {e}")
                conn.rollback()

            try:
                cur.execute("""
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name='users' AND column_name='bank_name'
                        ) THEN
                            ALTER TABLE users ADD COLUMN bank_name VARCHAR(255);
                        END IF;
                    END $$;
                """)
                conn.commit()
            except Exception as e:
                print(f"Warning: Could not add bank_name column: {e}")
                conn.rollback()

            try:
                cur.execute("""
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name='users' AND column_name='sort_code'
                        ) THEN
                            ALTER TABLE users ADD COLUMN sort_code VARCHAR(20);
                        END IF;
                    END $$;
                """)
                conn.commit()
            except Exception as e:
                print(f"Warning: Could not add sort_code column: {e}")
                conn.rollback()

            try:
                cur.execute("""
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name='users' AND column_name='account_number'
                        ) THEN
                            ALTER TABLE users ADD COLUMN account_number VARCHAR(20);
                        END IF;
                    END $$;
                """)
                conn.commit()
            except Exception as e:
                print(f"Warning: Could not add account_number column: {e}")
                conn.rollback()
            
            # Add session_cost column to practice_sessions if it doesn't exist
            try:
                cur.execute("""
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name='practice_sessions' AND column_name='session_cost'
                        ) THEN
                            ALTER TABLE practice_sessions ADD COLUMN session_cost DECIMAL(10, 2);
                        END IF;
                    END $$;
                """)
                conn.commit()
            except Exception as e:
                print(f"Warning: Could not add session_cost column: {e}")
                conn.rollback()
            
            # Add paid_by column to practice_sessions if it doesn't exist
            try:
                cur.execute("""
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name='practice_sessions' AND column_name='paid_by'
                        ) THEN
                            ALTER TABLE practice_sessions ADD COLUMN paid_by VARCHAR(255);
                        END IF;
                    END $$;
                """)
                conn.commit()
            except Exception as e:
                print(f"Warning: Could not add paid_by column: {e}")
                conn.rollback()
            
            # Add payment_requested column to practice_sessions if it doesn't exist
            try:
                cur.execute("""
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name='practice_sessions' AND column_name='payment_requested'
                        ) THEN
                            ALTER TABLE practice_sessions ADD COLUMN payment_requested BOOLEAN DEFAULT FALSE;
                        END IF;
                    END $$;
                """)
                conn.commit()
            except Exception as e:
                print(f"Warning: Could not add payment_requested column: {e}")
                conn.rollback()

            try:
                cur.execute("""
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name='practice_sessions' AND column_name='maximum_capacity'
                        ) THEN
                            ALTER TABLE practice_sessions ADD COLUMN maximum_capacity INTEGER DEFAULT 100;
                        END IF;
                    END $$;
                """)
                conn.commit()
            except Exception as e:
                print(f"Warning: Could not add maximum_capacity column: {e}")
                conn.rollback()

            try:
                cur.execute("UPDATE practice_sessions SET maximum_capacity = 100 WHERE maximum_capacity IS NULL")
                conn.commit()
            except Exception as e:
                print(f"Warning: Could not backfill maximum_capacity values: {e}")
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
            
            # Add related_date to notifications if it doesn't exist
            try:
                cur.execute("""
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name='notifications' AND column_name='related_date'
                        ) THEN
                            ALTER TABLE notifications ADD COLUMN related_date DATE;
                        END IF;
                    END $$;
                """)
                conn.commit()
            except Exception as e:
                print(f"Warning: Could not add related_date to notifications: {e}")
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
                location TEXT,
                session_cost DECIMAL(10, 2),
                paid_by VARCHAR(255),
                payment_requested BOOLEAN DEFAULT FALSE,
                maximum_capacity INTEGER DEFAULT 100
            )
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS practice_payments (
                id SERIAL PRIMARY KEY,
                date VARCHAR(50) NOT NULL,
                user_email VARCHAR(255) NOT NULL,
                paid BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(date, user_email)
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
                related_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id SERIAL PRIMARY KEY,
                user_email VARCHAR(255) NOT NULL,
                token VARCHAR(255) UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used BOOLEAN DEFAULT FALSE,
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
                last_login TIMESTAMP,
                birthday DATE,
                bank_name TEXT,
                sort_code TEXT,
                account_number TEXT,
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
            # Add last_login column if it doesn't exist
            try:
                cur.execute("ALTER TABLE users ADD COLUMN last_login TIMESTAMP")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e).lower():
                    print(f"Warning: Could not add last_login column: {e}")
            # Add birthday column if it doesn't exist
            try:
                cur.execute("ALTER TABLE users ADD COLUMN birthday DATE")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e).lower():
                    print(f"Warning: Could not add birthday column: {e}")
            try:
                cur.execute("ALTER TABLE users ADD COLUMN bank_name TEXT")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e).lower():
                    print(f"Warning: Could not add bank_name column: {e}")
            try:
                cur.execute("ALTER TABLE users ADD COLUMN sort_code TEXT")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e).lower():
                    print(f"Warning: Could not add sort_code column: {e}")
            try:
                cur.execute("ALTER TABLE users ADD COLUMN account_number TEXT")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e).lower():
                    print(f"Warning: Could not add account_number column: {e}")
            # Add session_cost column to practice_sessions if it doesn't exist
            try:
                cur.execute("ALTER TABLE practice_sessions ADD COLUMN session_cost REAL")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e).lower():
                    print(f"Warning: Could not add session_cost column: {e}")
            # Add paid_by column to practice_sessions if it doesn't exist
            try:
                cur.execute("ALTER TABLE practice_sessions ADD COLUMN paid_by TEXT")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e).lower():
                    print(f"Warning: Could not add paid_by column: {e}")
            # Add payment_requested column to practice_sessions if it doesn't exist
            try:
                cur.execute("ALTER TABLE practice_sessions ADD COLUMN payment_requested INTEGER DEFAULT 0")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e).lower():
                    print(f"Warning: Could not add payment_requested column: {e}")
            try:
                cur.execute("ALTER TABLE practice_sessions ADD COLUMN maximum_capacity INTEGER DEFAULT 100")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e).lower():
                    print(f"Warning: Could not add maximum_capacity column: {e}")
            try:
                cur.execute("UPDATE practice_sessions SET maximum_capacity = 100 WHERE maximum_capacity IS NULL")
            except sqlite3.OperationalError as e:
                print(f"Warning: Could not backfill maximum_capacity values: {e}")
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
                location TEXT,
                session_cost REAL,
                paid_by TEXT,
                payment_requested INTEGER DEFAULT 0,
                maximum_capacity INTEGER DEFAULT 100
            );
            CREATE TABLE IF NOT EXISTS practice_payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                user_email TEXT NOT NULL,
                paid INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(date, user_email)
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
                related_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT NOT NULL,
                token TEXT UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS notification_settings (
                notif_type TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                description TEXT,
                app_enabled INTEGER DEFAULT 1,
                email_enabled INTEGER DEFAULT 0,
                whatsapp_enabled INTEGER DEFAULT 0,
                target_audience TEXT NOT NULL DEFAULT 'all_active_users',
                app_template TEXT NOT NULL,
                email_subject TEXT NOT NULL,
                email_template TEXT NOT NULL,
                whatsapp_template TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
            try:
                cur.execute("ALTER TABLE notifications ADD COLUMN related_date DATE")
            except sqlite3.OperationalError:
                pass
            conn.commit()

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def generate_password_reset_token() -> str:
    return secrets.token_urlsafe(32)

def build_password_reset_link(token: str) -> str:
    return f"{FRONTEND_URL.rstrip('/')}/reset-password?token={token}"

# ========== FORGOT PASSWORD FEATURE - Email Sending Function ==========
# This function sends emails using SMTP (Simple Mail Transfer Protocol)
# Used by the forgot password endpoint to send recovery emails to users
# Returns True if email sent successfully, False otherwise
# =======================================================================
def send_email(to_email: str, subject: str, body: str) -> bool:
    """Send email using SMTP"""
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        print("Email not configured. Set SMTP_USERNAME and SMTP_PASSWORD environment variables.")
        return False
    
    try:
        msg = MIMEMultipart()
        msg['From'] = FROM_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject
        
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False

def send_whatsapp_notification(message: str) -> bool:
    if not WHATSAPP_NOTIFICATIONS_ENABLED:
        return False
    result = send_group_message(message)
    if not result.get("success"):
        print(f"Failed to send WhatsApp message: {result.get('error', 'Unknown error')}")
        return False
    return True

def render_notification_template(template: str, context: dict) -> str:
    rendered = template or ""
    for key, value in context.items():
        rendered = rendered.replace(f"{{{{{key}}}}}", "" if value is None else str(value))
    return rendered

def build_notification_context(payload: dict) -> dict:
    date_value = payload.get("date") or ""
    time_value = payload.get("time") or ""
    location_value = payload.get("location") or ""
    content_value = (payload.get("content") or "").strip()
    content_preview = content_value[:180] + ("..." if len(content_value) > 180 else "")
    return {
        "date": date_value,
        "time": time_value,
        "location": location_value,
        "maximum_capacity": payload.get("maximum_capacity") if payload.get("maximum_capacity") is not None else "",
        "available_count": payload.get("available_count") if payload.get("available_count") is not None else "",
        "remaining_slots": payload.get("remaining_slots") if payload.get("remaining_slots") is not None else "",
        "event_name": payload.get("event_name") or payload.get("name") or "",
        "author_name": payload.get("author_name") or "",
        "content": content_value,
        "content_preview": content_preview,
        "time_suffix": f" at {time_value}" if time_value else "",
        "location_suffix": f" at {location_value}" if location_value else "",
        "location_comma_suffix": f", {location_value}" if location_value else "",
        "time_line": f"🕐 {time_value}\n" if time_value else "",
        "location_line": f"📍 {location_value}\n" if location_value else "",
    }

def seed_notification_settings():
    with get_connection() as conn:
        cur = conn.cursor()
        for notif_type, defaults in NOTIFICATION_TYPE_DEFAULTS.items():
            if USE_POSTGRES:
                cur.execute(
                    f"""
                    INSERT INTO notification_settings (
                        notif_type, display_name, description, app_enabled, email_enabled, whatsapp_enabled,
                        target_audience, app_template, email_subject, email_template, whatsapp_template
                    ) VALUES (
                        {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER},
                        {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}
                    )
                    ON CONFLICT (notif_type) DO NOTHING
                    """,
                    (
                        notif_type,
                        defaults["display_name"],
                        defaults["description"],
                        defaults["app_enabled"],
                        defaults["email_enabled"],
                        defaults["whatsapp_enabled"],
                        defaults["target_audience"],
                        defaults["app_template"],
                        defaults["email_subject"],
                        defaults["email_template"],
                        defaults["whatsapp_template"],
                    ),
                )
            else:
                cur.execute(
                    """
                    INSERT OR IGNORE INTO notification_settings (
                        notif_type, display_name, description, app_enabled, email_enabled, whatsapp_enabled,
                        target_audience, app_template, email_subject, email_template, whatsapp_template
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        notif_type,
                        defaults["display_name"],
                        defaults["description"],
                        1 if defaults["app_enabled"] else 0,
                        1 if defaults["email_enabled"] else 0,
                        1 if defaults["whatsapp_enabled"] else 0,
                        defaults["target_audience"],
                        defaults["app_template"],
                        defaults["email_subject"],
                        defaults["email_template"],
                        defaults["whatsapp_template"],
                    ),
                )
        conn.commit()

def get_notification_settings_map() -> dict:
    seed_notification_settings()
    settings_map = {}
    for notif_type, defaults in NOTIFICATION_TYPE_DEFAULTS.items():
        settings_map[notif_type] = {
            "notif_type": notif_type,
            "display_name": defaults["display_name"],
            "description": defaults["description"],
            "app_enabled": defaults["app_enabled"],
            "email_enabled": defaults["email_enabled"],
            "whatsapp_enabled": defaults["whatsapp_enabled"],
            "target_audience": defaults["target_audience"],
            "app_template": defaults["app_template"],
            "email_subject": defaults["email_subject"],
            "email_template": defaults["email_template"],
            "whatsapp_template": defaults["whatsapp_template"],
            "updated_at": None,
        }
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM notification_settings ORDER BY display_name ASC")
        rows = cur.fetchall()
        for row in rows:
            row_dict = dict(row)
            settings_map[row_dict["notif_type"]] = {
                **settings_map.get(row_dict["notif_type"], {}),
                **row_dict,
            }
        return settings_map

def get_notification_setting(notif_type: str) -> dict:
    setting = get_notification_settings_map().get(notif_type)
    if not setting:
        raise HTTPException(status_code=404, detail="Notification type not found")
    return setting

def resolve_notification_recipients(target_audience: str, payload: dict) -> list:
    with get_connection() as conn:
        cur = conn.cursor()
        if target_audience == "admin_users":
            cur.execute(
                f"SELECT email, full_name FROM users WHERE (is_deleted = FALSE OR is_deleted IS NULL) AND user_type = {PLACEHOLDER}",
                ("admin",),
            )
        elif target_audience == "available_players":
            if not payload.get("date"):
                return []
            cur.execute(
                f"""
                SELECT u.email, u.full_name
                FROM practice_availability pa
                JOIN users u ON pa.user_email = u.email
                WHERE pa.date = {PLACEHOLDER}
                  AND pa.status = {PLACEHOLDER}
                  AND (u.is_deleted = FALSE OR u.is_deleted IS NULL)
                """,
                (payload["date"], "available"),
            )
        else:
            cur.execute("SELECT email, full_name FROM users WHERE (is_deleted = FALSE OR is_deleted IS NULL)")
        return [dict(row) for row in cur.fetchall()]

def deliver_notification(notif_type: str, payload: dict, related_date: str = None, exclude_email: str = None):
    guarded_notif_types = {"practice", "match", "practice_slot_available", "session_capacity_reached"}
    effective_date = related_date or payload.get("date")
    if notif_type in guarded_notif_types and effective_date:
        try:
            notification_date = datetime.strptime(effective_date, "%Y-%m-%d").date()
            if notification_date < datetime.now().date():
                return
        except ValueError:
            pass

    setting = get_notification_setting(notif_type)
    context = build_notification_context(payload)
    recipients = resolve_notification_recipients(setting["target_audience"], payload)
    if exclude_email:
        recipients = [recipient for recipient in recipients if recipient["email"] != exclude_email]

    if setting["app_enabled"]:
        app_message = render_notification_template(setting["app_template"], context)
        for recipient in recipients:
            create_notification(recipient["email"], notif_type, app_message, related_date)

    if setting["email_enabled"]:
        subject = render_notification_template(setting["email_subject"], context)
        email_body = render_notification_template(setting["email_template"], context)
        for recipient in recipients:
            send_email(recipient["email"], subject, email_body)

    if setting["whatsapp_enabled"]:
        whatsapp_message = render_notification_template(setting["whatsapp_template"], context)
        send_whatsapp_notification(whatsapp_message)

def normalize_maximum_capacity(value) -> int:
    if value is None or value == "":
        return 100
    try:
        normalized = int(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Maximum capacity must be a whole number")
    if normalized <= 0:
        raise HTTPException(status_code=400, detail="Maximum capacity must be greater than 0")
    return normalized

def get_available_count_for_session(cur, date_str: str) -> int:
    cur.execute(
        f"SELECT COUNT(*) as count FROM practice_availability WHERE date = {PLACEHOLDER} AND status = {PLACEHOLDER}",
        (date_str, "available"),
    )
    row = cur.fetchone()
    if not row:
        return 0
    row_dict = dict(row)
    return int(row_dict.get("count", 0))

def get_practice_session_with_capacity(cur, date_str: str) -> Optional[dict]:
    cur.execute(
        f"""
        SELECT 
            ps.date,
            ps.time,
            ps.location,
            ps.session_cost,
            ps.paid_by,
            ps.payment_requested,
            COALESCE(ps.maximum_capacity, 100) as maximum_capacity,
            u.full_name as paid_by_name,
            u.bank_name as paid_by_bank_name,
            u.sort_code as paid_by_sort_code,
            u.account_number as paid_by_account_number
        FROM practice_sessions ps
        LEFT JOIN users u ON ps.paid_by = u.email AND (u.is_deleted = FALSE OR u.is_deleted IS NULL)
        WHERE ps.date = {PLACEHOLDER}
        """,
        (date_str,),
    )
    row = cur.fetchone()
    if not row:
        return None
    session = dict(row)
    available_count = get_available_count_for_session(cur, date_str)
    maximum_capacity = normalize_maximum_capacity(session.get("maximum_capacity"))
    session["maximum_capacity"] = maximum_capacity
    session["available_count"] = available_count
    session["remaining_slots"] = max(maximum_capacity - available_count, 0)
    session["capacity_reached"] = available_count >= maximum_capacity
    return session

def notify_practice_slots_available():
    now = datetime.now()
    window_end = now + timedelta(hours=72)
    with get_connection() as conn:
        cur = conn.cursor()
        if USE_POSTGRES:
            cur.execute(
                f"""
                SELECT date
                FROM practice_sessions
                WHERE date::timestamp >= {PLACEHOLDER}
                  AND date::timestamp <= {PLACEHOLDER}
                ORDER BY date ASC
                LIMIT 1
                """,
                (now.date().isoformat(), window_end.date().isoformat()),
            )
        else:
            cur.execute(
                f"""
                SELECT date
                FROM practice_sessions
                WHERE date >= {PLACEHOLDER}
                  AND date <= {PLACEHOLDER}
                ORDER BY date ASC
                LIMIT 1
                """,
                (now.date().isoformat(), window_end.date().isoformat()),
            )
        row = cur.fetchone()
        if not row:
            return

        row_dict = dict(row)
        session = get_practice_session_with_capacity(cur, row_dict["date"])
        if not session:
            return
        if session["remaining_slots"] <= 0:
            return

        deliver_notification(
            "practice_slot_available",
            {
                "date": session["date"],
                "time": session.get("time"),
                "location": session.get("location"),
                "maximum_capacity": session["maximum_capacity"],
                "available_count": session["available_count"],
                "remaining_slots": session["remaining_slots"],
            },
            related_date=session["date"],
        )

def serialize_notification_setting(row: dict) -> dict:
    return {
        "notif_type": row["notif_type"],
        "display_name": row["display_name"],
        "description": row.get("description"),
        "app_enabled": bool(row["app_enabled"]),
        "email_enabled": bool(row["email_enabled"]),
        "whatsapp_enabled": bool(row["whatsapp_enabled"]),
        "target_audience": row["target_audience"],
        "app_template": row["app_template"],
        "email_subject": row["email_subject"],
        "email_template": row["email_template"],
        "whatsapp_template": row["whatsapp_template"],
        "updated_at": row.get("updated_at").isoformat() if hasattr(row.get("updated_at"), "isoformat") else row.get("updated_at"),
    }

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
    last_login: Optional[str] = None
    birthday: Optional[str] = None
    bank_name: Optional[str] = None
    sort_code: Optional[str] = None
    account_number: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class WhatsAppMessageRequest(BaseModel):
    message: str

class WhatsAppGroupLookupRequest(BaseModel):
    group_name: str

class NotificationSettingOut(BaseModel):
    notif_type: str
    display_name: str
    description: Optional[str] = None
    app_enabled: bool
    email_enabled: bool
    whatsapp_enabled: bool
    target_audience: str
    app_template: str
    email_subject: str
    email_template: str
    whatsapp_template: str
    updated_at: Optional[str] = None

class NotificationSettingUpdate(BaseModel):
    display_name: str
    description: Optional[str] = None
    app_enabled: bool
    email_enabled: bool
    whatsapp_enabled: bool
    target_audience: str
    app_template: str
    email_subject: str
    email_template: str
    whatsapp_template: str

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
    session_cost: Optional[float] = None
    paid_by: Optional[str] = None
    maximum_capacity: int = 100

class PracticeSessionOut(BaseModel):
    date: str
    time: Optional[str] = None
    location: Optional[str] = None
    session_cost: Optional[float] = None
    paid_by: Optional[str] = None
    maximum_capacity: int = 100
    available_count: Optional[int] = 0
    remaining_slots: Optional[int] = 100
    capacity_reached: Optional[bool] = False
    paid_by_name: Optional[str] = None
    paid_by_bank_name: Optional[str] = None
    paid_by_sort_code: Optional[str] = None
    paid_by_account_number: Optional[str] = None
    payment_requested: Optional[bool] = False

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
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN")
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "https://glasgow-bengali-fc.vercel.app",  # Production frontend
    "https://gbfc.onrender.com",  # Backend domain (for potential same-origin requests)
    "https://www.glasgow-bengali-fc.vercel.app",  # WWW subdomain
]
if FRONTEND_ORIGIN and FRONTEND_ORIGIN not in allowed_origins:
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
    seed_notification_settings()
    print("Database initialized successfully")
    if whatsapp_is_configured() and not whatsapp_scheduler.running:
        whatsapp_scheduler.add_job(keep_whatsapp_instance_alive, "interval", minutes=30, id="whatsapp_keepalive", replace_existing=True)
        whatsapp_scheduler.add_job(notify_practice_slots_available, "cron", hour=9, minute=0, id="practice_slot_available_daily", replace_existing=True)
        whatsapp_scheduler.start()
        print("WhatsApp keep-alive scheduler started")
    elif not whatsapp_scheduler.running:
        whatsapp_scheduler.add_job(notify_practice_slots_available, "cron", hour=9, minute=0, id="practice_slot_available_daily", replace_existing=True)
        whatsapp_scheduler.start()
        print("Notification scheduler started")

@app.on_event("shutdown")
async def shutdown_event():
    if whatsapp_scheduler.running:
        whatsapp_scheduler.shutdown(wait=False)

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
                    if USE_POSTGRES:
                        cur.execute(
                            f"UPDATE users SET is_deleted = FALSE, deleted_at = NULL, "
                            f"full_name = {PLACEHOLDER}, password = {PLACEHOLDER}, user_type = 'member', "
                            f"last_login = CURRENT_TIMESTAMP WHERE email = {PLACEHOLDER}",
                            (user.full_name, hash_password(user.password), user.email)
                        )
                    else:
                        cur.execute(
                            f"UPDATE users SET is_deleted = 0, deleted_at = NULL, "
                            f"full_name = {PLACEHOLDER}, password = {PLACEHOLDER}, user_type = 'member', "
                            f"last_login = CURRENT_TIMESTAMP WHERE email = {PLACEHOLDER}",
                            (user.full_name, hash_password(user.password), user.email)
                        )
                    conn.commit()
                    return UserOut(id=existing_dict['id'], email=user.email, full_name=user.full_name, user_type='member')
                else:
                    # Active user already exists
                    raise HTTPException(status_code=400, detail="Email already registered")
            
            # Create new user with initial last_login timestamp
            if USE_POSTGRES:
                cur.execute(
                    f"INSERT INTO users (email, full_name, password, last_login) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, CURRENT_TIMESTAMP)",
                    (user.email, user.full_name, hash_password(user.password)),
                )
            else:
                cur.execute(
                    f"INSERT INTO users (email, full_name, password, last_login) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, CURRENT_TIMESTAMP)",
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
        
        # Update last_login timestamp
        if USE_POSTGRES:
            cur.execute(
                f"UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE email = {PLACEHOLDER}",
                (form_data.username,)
            )
        else:
            cur.execute(
                f"UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE email = {PLACEHOLDER}",
                (form_data.username,)
            )
        conn.commit()
        
        token = str(uuid.uuid4())
        SESSIONS[token] = {"email": user["email"], "full_name": user["full_name"], "id": user["id"]}
        return {"access_token": token, "token_type": "bearer"}

@app.post("/api/login", response_model=Token)
def login_alias(form_data: OAuth2PasswordRequestForm = Depends()):
    return login(form_data)

# ========== FORGOT PASSWORD FEATURE - API Endpoint ==========
# This endpoint handles password recovery requests
# Frontend: Login.jsx (button currently hidden - see comments there)
# To enable: Configure email settings (see EMAIL_SETUP.md)
# PostgreSQL Compatible: Uses PLACEHOLDER for queries
# ============================================================
@app.post("/api/forgot-password")
def forgot_password(data: ForgotPasswordRequest):
    email = data.email.strip().lower()
    generic_message = {"message": "If this email is registered, a password reset link has been sent."}

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT email, full_name FROM users WHERE email = {PLACEHOLDER} AND (is_deleted = FALSE OR is_deleted IS NULL)",
            (email,)
        )
        user = cur.fetchone()

        if not user:
            return generic_message

        user_dict = dict(user)
        token = generate_password_reset_token()
        expires_at = datetime.utcnow() + timedelta(hours=1)

        cur.execute(
            f"DELETE FROM password_reset_tokens WHERE user_email = {PLACEHOLDER} OR expires_at < CURRENT_TIMESTAMP OR used = {PLACEHOLDER}",
            (email, True if USE_POSTGRES else 1)
        )
        cur.execute(
            f"INSERT INTO password_reset_tokens (user_email, token, expires_at, used) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (email, token, expires_at, False if USE_POSTGRES else 0)
        )
        conn.commit()

        reset_link = build_password_reset_link(token)
        subject = "Glasgow Bengali FC - Reset Your Password"
        body = f"""Hello {user_dict['full_name']},

We received a request to reset your Glasgow Bengali FC account password.

Use the secure link below to set a new password:
{reset_link}

This link will expire in 1 hour.

If you did not request this, please ignore this email.

Best regards,
Glasgow Bengali FC Team"""

        email_sent = send_email(email, subject, body)

        if not email_sent:
            raise HTTPException(
                status_code=503,
                detail="Email service is not configured. Please contact the administrator."
            )

        return generic_message

@app.post("/api/reset-password")
def reset_password(data: ResetPasswordRequest):
    token = data.token.strip()
    new_password = data.new_password

    if not token:
        raise HTTPException(status_code=400, detail="Reset token is required")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if len(new_password) > 128:
        raise HTTPException(status_code=400, detail="Password must be less than 128 characters")
    if not any(char.isalpha() for char in new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one letter")
    if not any(char.isdigit() for char in new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT user_email, expires_at, used FROM password_reset_tokens WHERE token = {PLACEHOLDER}",
            (token,)
        )
        token_row = cur.fetchone()

        if not token_row:
            raise HTTPException(status_code=400, detail="Invalid or expired reset link")

        token_dict = dict(token_row)
        expires_at = token_dict["expires_at"]
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00")).replace(tzinfo=None)

        if token_dict.get("used") or expires_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Invalid or expired reset link")

        cur.execute(
            f"UPDATE users SET password = {PLACEHOLDER} WHERE email = {PLACEHOLDER}",
            (hash_password(new_password), token_dict["user_email"])
        )
        cur.execute(
            f"UPDATE password_reset_tokens SET used = {PLACEHOLDER} WHERE token = {PLACEHOLDER}",
            (True if USE_POSTGRES else 1, token)
        )
        cur.execute(
            f"DELETE FROM password_reset_tokens WHERE user_email = {PLACEHOLDER} AND token != {PLACEHOLDER}",
            (token_dict["user_email"], token)
        )
        conn.commit()

        return {"message": "Password reset successful"}

@app.get("/api/me", response_model=UserOut)
def me(current_user: dict = Depends(get_current_user)):
    # Fetch user details from database including created_at and last_login
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT full_name, user_type, is_deleted, created_at, last_login, birthday, bank_name, sort_code, account_number FROM users WHERE email = {PLACEHOLDER}", 
            (current_user["email"],)
        )
        row = cur.fetchone()
        if row:
            row_dict = dict(row)
            # Check if user is deleted
            if row_dict.get("is_deleted"):
                raise HTTPException(status_code=401, detail="Account has been deleted")
            
            full_name = row_dict.get("full_name") or current_user["full_name"]
            user_type = row_dict.get("user_type") or "member"
            
            # Convert datetime fields to ISO string
            created_at = None
            if row_dict.get("created_at"):
                if hasattr(row_dict["created_at"], 'isoformat'):
                    created_at = row_dict["created_at"].isoformat()
                else:
                    created_at = str(row_dict["created_at"])
            
            last_login = None
            if row_dict.get("last_login"):
                if hasattr(row_dict["last_login"], 'isoformat'):
                    last_login = row_dict["last_login"].isoformat()
                else:
                    last_login = str(row_dict["last_login"])
            
            # Convert birthday date to ISO string
            birthday = None
            if row_dict.get("birthday"):
                if hasattr(row_dict["birthday"], 'isoformat'):
                    birthday = row_dict["birthday"].isoformat()
                else:
                    birthday = str(row_dict["birthday"])
            bank_name = row_dict.get("bank_name")
            sort_code = row_dict.get("sort_code")
            account_number = row_dict.get("account_number")
        else:
            full_name = current_user["full_name"]
            user_type = "member"
            created_at = None
            last_login = None
            birthday = None
            bank_name = None
            sort_code = None
            account_number = None
    
    return UserOut(
        id=current_user["id"], 
        email=current_user["email"], 
        full_name=full_name, 
        user_type=user_type,
        created_at=created_at,
        last_login=last_login,
        birthday=birthday,
        bank_name=bank_name,
        sort_code=sort_code,
        account_number=account_number
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
        cur.execute("SELECT id, email, full_name, user_type, created_at, last_login, birthday, bank_name, sort_code, account_number FROM users WHERE (is_deleted = FALSE OR is_deleted IS NULL) ORDER BY id DESC")
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
            # Convert last_login datetime to ISO string if needed, or set to None
            if user_dict.get("last_login"):
                if hasattr(user_dict["last_login"], 'isoformat'):
                    user_dict["last_login"] = user_dict["last_login"].isoformat()
                else:
                    user_dict["last_login"] = str(user_dict["last_login"])
            else:
                user_dict["last_login"] = None
            # Convert birthday date to ISO string if needed, or set to None
            if user_dict.get("birthday"):
                if hasattr(user_dict["birthday"], 'isoformat'):
                    user_dict["birthday"] = user_dict["birthday"].isoformat()
                else:
                    user_dict["birthday"] = str(user_dict["birthday"])
            else:
                user_dict["birthday"] = None
            user_dict["bank_name"] = user_dict.get("bank_name") or None
            user_dict["sort_code"] = user_dict.get("sort_code") or None
            user_dict["account_number"] = user_dict.get("account_number") or None
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

@app.put("/api/profile/name")
def update_own_name(data: dict, current_user: dict = Depends(get_current_user)):
    """Allow user to update their own name"""
    # Validate input
    full_name = data.get("full_name", "").strip()
    if not full_name:
        raise HTTPException(status_code=400, detail="Full name cannot be empty")
    
    if len(full_name) > 100:
        raise HTTPException(status_code=400, detail="Full name must be 100 characters or less")
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Update user's own full name
        cur.execute(
            f"UPDATE users SET full_name = {PLACEHOLDER} WHERE email = {PLACEHOLDER}",
            (full_name, current_user["email"])
        )
        conn.commit()
        
        # Return updated user info
        return {"full_name": full_name, "email": current_user["email"]}

@app.put("/api/profile/password")
def update_own_password(data: dict, current_user: dict = Depends(get_current_user)):
    """Allow user to update their own password"""
    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Current and new passwords are required")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Verify current password
        cur.execute(
            f"SELECT password FROM users WHERE email = {PLACEHOLDER}",
            (current_user["email"],)
        )
        user = cur.fetchone()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if not verify_password(current_password, user["password"]):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
        
        # Update password
        cur.execute(
            f"UPDATE users SET password = {PLACEHOLDER} WHERE email = {PLACEHOLDER}",
            (hash_password(new_password), current_user["email"])
        )
        conn.commit()
        
        return {"message": "Password updated successfully"}

@app.put("/api/profile/birthday")
def update_own_birthday(data: dict, current_user: dict = Depends(get_current_user)):
    """Allow user to update their own birthday"""
    birthday = data.get("birthday", "").strip()
    
    # Birthday is optional, allow empty string to clear it
    if birthday and birthday != "":
        # Validate date format (YYYY-MM-DD)
        try:
            from datetime import datetime
            datetime.strptime(birthday, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Update user's birthday (or set to NULL if empty)
        if birthday and birthday != "":
            cur.execute(
                f"UPDATE users SET birthday = {PLACEHOLDER} WHERE email = {PLACEHOLDER}",
                (birthday, current_user["email"])
            )
        else:
            cur.execute(
                f"UPDATE users SET birthday = NULL WHERE email = {PLACEHOLDER}",
                (current_user["email"],)
            )
        conn.commit()
        
        return {"message": "Birthday updated successfully", "birthday": birthday if birthday else None}

@app.put("/api/profile/bank-details")
def update_own_bank_details(data: dict, current_user: dict = Depends(get_current_user)):
    bank_name = (data.get("bank_name") or "").strip()
    sort_code = (data.get("sort_code") or "").strip()
    account_number = (data.get("account_number") or "").strip()

    if bank_name and len(bank_name) > 100:
        raise HTTPException(status_code=400, detail="Bank name must be 100 characters or less")

    if sort_code:
        normalized_sort_code = sort_code.replace("-", "").replace(" ", "")
        if not normalized_sort_code.isdigit() or len(normalized_sort_code) != 6:
            raise HTTPException(status_code=400, detail="Sort code must be 6 digits")
        sort_code = f"{normalized_sort_code[0:2]}-{normalized_sort_code[2:4]}-{normalized_sort_code[4:6]}"
    else:
        sort_code = None

    if account_number:
        normalized_account_number = account_number.replace(" ", "")
        if not normalized_account_number.isdigit() or len(normalized_account_number) < 6 or len(normalized_account_number) > 8:
            raise HTTPException(status_code=400, detail="Account number must be 6 to 8 digits")
        account_number = normalized_account_number
    else:
        account_number = None

    if any([bank_name, sort_code, account_number]) and not all([bank_name, sort_code, account_number]):
        raise HTTPException(status_code=400, detail="Bank name, sort code, and account number must all be provided together")

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE users SET bank_name = {PLACEHOLDER}, sort_code = {PLACEHOLDER}, account_number = {PLACEHOLDER} WHERE email = {PLACEHOLDER}",
            (bank_name or None, sort_code, account_number, current_user["email"])
        )
        conn.commit()

    return {
        "message": "Bank details updated successfully",
        "bank_name": bank_name or None,
        "sort_code": sort_code,
        "account_number": account_number,
    }

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
                f"DELETE FROM practice_availability WHERE user_email = {PLACEHOLDER} AND date::date > CURRENT_DATE",
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
        
        # Get the inserted event ID (PostgreSQL compatible)
        if USE_POSTGRES:
            cur.execute(
                f"SELECT id FROM events WHERE name = {PLACEHOLDER} AND date = {PLACEHOLDER} ORDER BY id DESC LIMIT 1",
                (event.name, event.date)
            )
            event_id = cur.fetchone()['id']
        else:
            event_id = cur.lastrowid
        
        deliver_notification(
            "match",
            {
                "date": event.date,
                "time": event.time,
                "location": event.location,
                "event_name": event.name,
            }
        )
        
        return EventOut(id=event_id, **event.model_dump())

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
        cur.execute(f"SELECT date FROM practice_sessions ORDER BY date ASC")
        sessions = []
        for row in cur.fetchall():
            row_dict = dict(row)
            session = get_practice_session_with_capacity(cur, row_dict["date"])
            if session:
                sessions.append(PracticeSessionOut(**session))
        return sessions

@app.post("/api/practice/sessions", response_model=PracticeSessionOut)
def create_practice_session(session: PracticeSessionCreate, current_user: dict = Depends(get_current_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admins only")
    maximum_capacity = normalize_maximum_capacity(session.maximum_capacity)
    with get_connection() as conn:
        cur = conn.cursor()
        if USE_POSTGRES:
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by, maximum_capacity) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}) ON CONFLICT (date) DO UPDATE SET time = EXCLUDED.time, location = EXCLUDED.location, session_cost = EXCLUDED.session_cost, paid_by = EXCLUDED.paid_by, maximum_capacity = EXCLUDED.maximum_capacity",
                (session.date, session.time, session.location, session.session_cost, session.paid_by, maximum_capacity),
            )
        else:
            cur.execute(
                f"INSERT OR REPLACE INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested, maximum_capacity) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, COALESCE((SELECT payment_requested FROM practice_sessions WHERE date = {PLACEHOLDER}), 0), {PLACEHOLDER})",
                (session.date, session.time, session.location, session.session_cost, session.paid_by, session.date, maximum_capacity),
            )
        conn.commit()
        
        deliver_notification(
            "practice",
            {
                "date": session.date,
                "time": session.time,
                "location": session.location,
                "maximum_capacity": maximum_capacity,
            },
            related_date=session.date
        )

        created_session = get_practice_session_with_capacity(cur, session.date)
        return PracticeSessionOut(**created_session)

@app.put("/api/practice/sessions/{date_str}", response_model=PracticeSessionOut)
def update_practice_session(date_str: str, session: PracticeSessionCreate, current_user: dict = Depends(get_current_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admins only")
    maximum_capacity = normalize_maximum_capacity(session.maximum_capacity)
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE practice_sessions SET time = {PLACEHOLDER}, location = {PLACEHOLDER}, session_cost = {PLACEHOLDER}, paid_by = {PLACEHOLDER}, maximum_capacity = {PLACEHOLDER} WHERE date = {PLACEHOLDER}",
            (session.time, session.location, session.session_cost, session.paid_by, maximum_capacity, date_str),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Practice session not found")
        updated_session = get_practice_session_with_capacity(cur, date_str)
        return PracticeSessionOut(**updated_session)

@app.post("/api/practice/sessions/{date_str}/request-payment")
def request_payment(date_str: str, current_user: dict = Depends(get_current_user)):
    """Admin endpoint to enable payment request for a practice session"""
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admins only")
    
    from datetime import datetime, date
    try:
        session_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        if session_date >= date.today():
            raise HTTPException(status_code=400, detail="Payment request can only be enabled after the practice session date has passed")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Check if session exists and get session details
        cur.execute(
            f"SELECT payment_requested, time, location FROM practice_sessions WHERE date = {PLACEHOLDER}", 
            (date_str,)
        )
        session = cur.fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="Practice session not found")
        
        # Check if payment already requested
        if session["payment_requested"]:
            raise HTTPException(status_code=400, detail="Payment request has already been enabled for this session")
        
        session_time = session["time"] or "TBD"
        session_location = session["location"] or "TBD"
        
        # Enable payment request
        cur.execute(
            f"UPDATE practice_sessions SET payment_requested = {PLACEHOLDER} WHERE date = {PLACEHOLDER}",
            (True if USE_POSTGRES else 1, date_str),
        )
        conn.commit()
        
        # Get all available users for this session
        cur.execute(
            f"SELECT user_email FROM practice_availability WHERE date = {PLACEHOLDER} AND status = {PLACEHOLDER}",
            (date_str, "available")
        )
        available_users = cur.fetchall()
        
        deliver_notification(
            "payment_request",
            {
                "date": date_str,
                "time": session["time"],
                "location": session["location"],
            },
            related_date=date_str
        )
        
        return {"message": "Payment requested successfully"}

@app.get("/api/practice/sessions/{date_str}/payments")
def get_session_payments(date_str: str, current_user: dict = Depends(get_current_user)):
    """Get payment status for all users in a practice session"""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT user_email, paid FROM practice_payments WHERE date = {PLACEHOLDER}",
            (date_str,),
        )
        payments = {}
        for row in cur.fetchall():
            row_dict = dict(row)
            payments[row_dict["user_email"]] = row_dict["paid"]
        return payments

@app.post("/api/practice/{date}/payment")
def confirm_payment_by_date(date: str, data: dict, current_user: dict = Depends(get_current_user)):
    """User endpoint to confirm or unconfirm payment for a practice session (used by User Actions page)"""
    paid = data.get("paid", False)
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Check if payment is requested for this session
        cur.execute(
            f"SELECT payment_requested FROM practice_sessions WHERE date = {PLACEHOLDER}", 
            (date,)
        )
        session = cur.fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="Practice session not found")
        if not session["payment_requested"]:
            raise HTTPException(status_code=400, detail="Payment request has not been enabled for this session")
        
        # Check if user is available for this session
        cur.execute(
            f"SELECT status FROM practice_availability WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
            (date, current_user["email"]),
        )
        availability = cur.fetchone()
        if not availability or availability["status"] != "available":
            raise HTTPException(status_code=400, detail="You must be marked as available for this session to confirm payment")
        
        # Insert or update payment confirmation
        if USE_POSTGRES:
            cur.execute(
                f"INSERT INTO practice_payments (date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}) ON CONFLICT (date, user_email) DO UPDATE SET paid = EXCLUDED.paid",
                (date, current_user["email"], paid),
            )
        else:
            cur.execute(
                f"INSERT OR REPLACE INTO practice_payments (date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (date, current_user["email"], 1 if paid else 0),
            )
        
        conn.commit()
        return {"message": "Payment confirmation updated"}

@app.post("/api/practice/sessions/{date_str}/payment")
def confirm_payment(date_str: str, data: dict, current_user: dict = Depends(get_current_user)):
    """User endpoint to confirm or unconfirm payment for a practice session"""
    paid = data.get("paid", False)
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Check if payment is requested for this session and get session details
        cur.execute(
            f"SELECT payment_requested, time, location FROM practice_sessions WHERE date = {PLACEHOLDER}", 
            (date_str,)
        )
        session = cur.fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="Practice session not found")
        if not session["payment_requested"]:
            raise HTTPException(status_code=400, detail="Payment request has not been enabled for this session")
        
        session_time = session["time"] or "TBD"
        session_location = session["location"] or "TBD"
        
        # Check if user is available for this session
        cur.execute(
            f"SELECT status FROM practice_availability WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
            (date_str, current_user["email"]),
        )
        availability = cur.fetchone()
        if not availability or availability["status"] != "available":
            raise HTTPException(status_code=400, detail="You must be marked as available for this session to confirm payment")
        
        # Insert or update payment status
        cur.execute(
            f"INSERT INTO practice_payments (date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}) ON CONFLICT (date, user_email) DO UPDATE SET paid = EXCLUDED.paid",
            (date_str, current_user["email"], paid if USE_POSTGRES else (1 if paid else 0)),
        )
        conn.commit()
        
        # If user confirmed payment (checked the box), notify all admins
        if paid:
            user_full_name = current_user.get("full_name", current_user["email"])
            notification_message = f"{user_full_name} confirmed payment for the Session on {date_str} at {session_time}, {session_location}"
            
            # Get all admin users
            cur.execute(
                f"SELECT email FROM users WHERE user_type = {PLACEHOLDER} AND (is_deleted = FALSE OR is_deleted IS NULL)",
                ("admin",)
            )
            admin_users = cur.fetchall()
            
            # Send notification to all admins
            for admin_row in admin_users:
                admin_email = admin_row["email"]
                create_notification(admin_email, "payment_confirmed", notification_message, date_str)
        
        return {"message": "Payment status updated successfully", "paid": paid}

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
        
        deliver_notification(
            "forum_post",
            {
                "author_name": current_user["full_name"],
                "content": post.content,
            }
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

@app.post("/api/practice/{date}/availability")
def set_practice_availability_by_date(date: str, status: dict, current_user: dict = Depends(get_current_user)):
    """Set availability for a specific date (used by User Actions page)"""
    from datetime import datetime
    try:
        practice_date = datetime.strptime(date, '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Check if payment has been requested for this session
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT payment_requested FROM practice_sessions WHERE date = {PLACEHOLDER}", (date,))
        session = cur.fetchone()
        
        if session and session["payment_requested"]:
            raise HTTPException(
                status_code=403, 
                detail="Cannot modify availability after payment request has been enabled."
            )
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        availability_status = status.get("status")
        cur.execute(
            f"SELECT status FROM practice_availability WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
            (date, current_user["email"]),
        )
        existing_row = cur.fetchone()
        previous_status = dict(existing_row).get("status") if existing_row else None

        session_details = get_practice_session_with_capacity(cur, date)
        if not session_details:
            raise HTTPException(status_code=404, detail="Practice session not found")

        is_new_available_vote = availability_status == 'available' and previous_status != 'available'
        if is_new_available_vote and session_details["capacity_reached"]:
            raise HTTPException(status_code=403, detail="Maximum capacity has been reached for this session. No more Available selections are allowed right now.")
        
        # If status is 'none', delete the availability record (deselection)
        if availability_status == 'none':
            cur.execute(
                f"DELETE FROM practice_availability WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
                (date, current_user["email"])
            )
            conn.commit()
            return {"message": "Availability removed"}
        
        # Otherwise, insert or update the availability
        if USE_POSTGRES:
            cur.execute(
                f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}) ON CONFLICT (date, user_email) DO UPDATE SET status = EXCLUDED.status, user_full_name = EXCLUDED.user_full_name",
                (date, current_user["email"], current_user["full_name"], availability_status),
            )
        else:
            cur.execute(
                f"INSERT OR REPLACE INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (date, current_user["email"], current_user["full_name"], availability_status),
            )
        conn.commit()
        updated_session = get_practice_session_with_capacity(cur, date)
        if is_new_available_vote and updated_session and updated_session["capacity_reached"]:
            deliver_notification(
                "session_capacity_reached",
                {
                    "date": updated_session["date"],
                    "time": updated_session.get("time"),
                    "location": updated_session.get("location"),
                    "maximum_capacity": updated_session["maximum_capacity"],
                    "available_count": updated_session["available_count"],
                    "remaining_slots": updated_session["remaining_slots"],
                },
                related_date=date,
                exclude_email=current_user["email"],
            )
        return {"message": "Availability set"}

@app.post("/api/practice/availability")
def set_my_practice_availability(avail: PracticeAvailability, current_user: dict = Depends(get_current_user)):
    # Parse the date string to compare with today
    from datetime import datetime, date
    try:
        practice_date = datetime.strptime(avail.date, '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Check if payment has been requested for this session
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT payment_requested FROM practice_sessions WHERE date = {PLACEHOLDER}", (avail.date,))
        session = cur.fetchone()
        
        if session and session["payment_requested"]:
            raise HTTPException(
                status_code=403, 
                detail="Cannot modify availability after payment request has been enabled."
            )
    
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT status FROM practice_availability WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
            (avail.date, current_user["email"]),
        )
        existing_row = cur.fetchone()
        previous_status = dict(existing_row).get("status") if existing_row else None

        session_details = get_practice_session_with_capacity(cur, avail.date)
        if not session_details:
            raise HTTPException(status_code=404, detail="Practice session not found")

        is_new_available_vote = avail.status == 'available' and previous_status != 'available'
        if is_new_available_vote and session_details["capacity_reached"]:
            raise HTTPException(status_code=403, detail="Maximum capacity has been reached for this session. No more Available selections are allowed right now.")
        
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
        updated_session = get_practice_session_with_capacity(cur, avail.date)
        if is_new_available_vote and updated_session and updated_session["capacity_reached"]:
            deliver_notification(
                "session_capacity_reached",
                {
                    "date": updated_session["date"],
                    "time": updated_session.get("time"),
                    "location": updated_session.get("location"),
                    "maximum_capacity": updated_session["maximum_capacity"],
                    "available_count": updated_session["available_count"],
                    "remaining_slots": updated_session["remaining_slots"],
                },
                related_date=avail.date,
                exclude_email=current_user["email"],
            )
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

        cur.execute(
            f"SELECT status FROM practice_availability WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
            (avail.date, avail.user_email),
        )
        existing_row = cur.fetchone()
        previous_status = dict(existing_row).get("status") if existing_row else None

        session = get_practice_session_with_capacity(cur, avail.date)
        if not session:
            raise HTTPException(status_code=404, detail="Practice session not found")

        is_new_available_vote = avail.status == "available" and previous_status != "available"
        if is_new_available_vote and session["capacity_reached"]:
            raise HTTPException(status_code=403, detail="Maximum capacity has been reached for this session. No more Available selections are allowed right now.")
        
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

        updated_session = get_practice_session_with_capacity(cur, avail.date)
        if is_new_available_vote and updated_session and updated_session["capacity_reached"]:
            deliver_notification(
                "session_capacity_reached",
                {
                    "date": updated_session["date"],
                    "time": updated_session.get("time"),
                    "location": updated_session.get("location"),
                    "maximum_capacity": updated_session["maximum_capacity"],
                    "available_count": updated_session["available_count"],
                    "remaining_slots": updated_session["remaining_slots"],
                },
                related_date=avail.date,
            )
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

        session = get_practice_session_with_capacity(cur, date_str)
        maximum_capacity = session["maximum_capacity"] if session else 100
        available_count = len(available)
        remaining_slots = max(maximum_capacity - available_count, 0)

        # Return with email mapping for admin delete functionality
        return {
            "available": available,
            "tentative": tentative,
            "not_available": not_available,
            "user_emails": {r["user_full_name"] or r["user_email"]: r["user_email"] for r in rows},
            "maximum_capacity": maximum_capacity,
            "available_count": available_count,
            "remaining_slots": remaining_slots,
            "capacity_reached": available_count >= maximum_capacity,
        }

# --- Notifications ---
def create_notification(user_email: str, notif_type: str, message: str, related_date: str = None):
    """Helper function to create a notification for a user"""
    with get_connection() as conn:
        cur = conn.cursor()
        if related_date:
            cur.execute(
                f"INSERT INTO notifications (user_email, type, message, related_date) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (user_email, notif_type, message, related_date)
            )
        else:
            cur.execute(
                f"INSERT INTO notifications (user_email, type, message) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (user_email, notif_type, message)
            )
        conn.commit()

def notify_all_users(notif_type: str, message: str, exclude_email: str = None, related_date: str = None):
    """Create notification for all users except the one who triggered it"""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT email FROM users WHERE (is_deleted = FALSE OR is_deleted IS NULL)")
        users = cur.fetchall()
        for user in users:
            email = user["email"] if USE_POSTGRES else user[0]
            if email != exclude_email:
                create_notification(email, notif_type, message, related_date)

@app.get("/api/admin/notification-settings", response_model=List[NotificationSettingOut])
def list_notification_settings(current_user: dict = Depends(get_current_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admins only")
    settings_map = get_notification_settings_map()
    return [serialize_notification_setting(setting) for setting in settings_map.values()]

@app.get("/api/admin/notification-settings/meta")
def notification_settings_meta(current_user: dict = Depends(get_current_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admins only")
    return {
        "target_audiences": [
            {"value": "all_active_users", "label": "All active users"},
            {"value": "admin_users", "label": "Admin users"},
            {"value": "available_players", "label": "Only players marked available for the related practice"},
        ],
        "notification_types": [
            {"value": notif_type, "label": defaults["display_name"]}
            for notif_type, defaults in NOTIFICATION_TYPE_DEFAULTS.items()
        ],
    }

@app.put("/api/admin/notification-settings/{notif_type}", response_model=NotificationSettingOut)
def update_notification_setting(notif_type: str, payload: NotificationSettingUpdate, current_user: dict = Depends(get_current_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admins only")
    if notif_type not in NOTIFICATION_TYPE_DEFAULTS:
        raise HTTPException(status_code=404, detail="Notification type not found")
    if payload.target_audience not in NOTIFICATION_TARGET_OPTIONS:
        raise HTTPException(status_code=400, detail="Invalid target audience")

    with get_connection() as conn:
        cur = conn.cursor()
        if USE_POSTGRES:
            cur.execute(
                f"""
                UPDATE notification_settings
                SET display_name = {PLACEHOLDER},
                    description = {PLACEHOLDER},
                    app_enabled = {PLACEHOLDER},
                    email_enabled = {PLACEHOLDER},
                    whatsapp_enabled = {PLACEHOLDER},
                    target_audience = {PLACEHOLDER},
                    app_template = {PLACEHOLDER},
                    email_subject = {PLACEHOLDER},
                    email_template = {PLACEHOLDER},
                    whatsapp_template = {PLACEHOLDER},
                    updated_at = CURRENT_TIMESTAMP
                WHERE notif_type = {PLACEHOLDER}
                """,
                (
                    payload.display_name,
                    payload.description,
                    payload.app_enabled,
                    payload.email_enabled,
                    payload.whatsapp_enabled,
                    payload.target_audience,
                    payload.app_template,
                    payload.email_subject,
                    payload.email_template,
                    payload.whatsapp_template,
                    notif_type,
                ),
            )
        else:
            cur.execute(
                """
                UPDATE notification_settings
                SET display_name = ?,
                    description = ?,
                    app_enabled = ?,
                    email_enabled = ?,
                    whatsapp_enabled = ?,
                    target_audience = ?,
                    app_template = ?,
                    email_subject = ?,
                    email_template = ?,
                    whatsapp_template = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE notif_type = ?
                """,
                (
                    payload.display_name,
                    payload.description,
                    1 if payload.app_enabled else 0,
                    1 if payload.email_enabled else 0,
                    1 if payload.whatsapp_enabled else 0,
                    payload.target_audience,
                    payload.app_template,
                    payload.email_subject,
                    payload.email_template,
                    payload.whatsapp_template,
                    notif_type,
                ),
            )
        conn.commit()

    return serialize_notification_setting(get_notification_setting(notif_type))

@app.post("/api/admin/notification-settings/{notif_type}/reset", response_model=NotificationSettingOut)
def reset_notification_setting(notif_type: str, current_user: dict = Depends(get_current_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admins only")
    defaults = NOTIFICATION_TYPE_DEFAULTS.get(notif_type)
    if not defaults:
        raise HTTPException(status_code=404, detail="Notification type not found")

    with get_connection() as conn:
        cur = conn.cursor()
        if USE_POSTGRES:
            cur.execute(
                f"""
                UPDATE notification_settings
                SET display_name = {PLACEHOLDER},
                    description = {PLACEHOLDER},
                    app_enabled = {PLACEHOLDER},
                    email_enabled = {PLACEHOLDER},
                    whatsapp_enabled = {PLACEHOLDER},
                    target_audience = {PLACEHOLDER},
                    app_template = {PLACEHOLDER},
                    email_subject = {PLACEHOLDER},
                    email_template = {PLACEHOLDER},
                    whatsapp_template = {PLACEHOLDER},
                    updated_at = CURRENT_TIMESTAMP
                WHERE notif_type = {PLACEHOLDER}
                """,
                (
                    defaults["display_name"],
                    defaults["description"],
                    defaults["app_enabled"],
                    defaults["email_enabled"],
                    defaults["whatsapp_enabled"],
                    defaults["target_audience"],
                    defaults["app_template"],
                    defaults["email_subject"],
                    defaults["email_template"],
                    defaults["whatsapp_template"],
                    notif_type,
                ),
            )
        else:
            cur.execute(
                """
                UPDATE notification_settings
                SET display_name = ?,
                    description = ?,
                    app_enabled = ?,
                    email_enabled = ?,
                    whatsapp_enabled = ?,
                    target_audience = ?,
                    app_template = ?,
                    email_subject = ?,
                    email_template = ?,
                    whatsapp_template = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE notif_type = ?
                """,
                (
                    defaults["display_name"],
                    defaults["description"],
                    1 if defaults["app_enabled"] else 0,
                    1 if defaults["email_enabled"] else 0,
                    1 if defaults["whatsapp_enabled"] else 0,
                    defaults["target_audience"],
                    defaults["app_template"],
                    defaults["email_subject"],
                    defaults["email_template"],
                    defaults["whatsapp_template"],
                    notif_type,
                ),
            )
        conn.commit()

    return serialize_notification_setting(get_notification_setting(notif_type))

@app.get("/api/admin/whatsapp/status")
def whatsapp_status(current_user: dict = Depends(get_current_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admins only")
    state = get_instance_state()
    target_group = resolve_group_chat_id()
    return {
        "configured": whatsapp_is_configured(),
        "enabled": WHATSAPP_NOTIFICATIONS_ENABLED,
        "state": state,
        "target_group": target_group,
    }

@app.post("/api/admin/whatsapp/test")
def send_test_whatsapp_message(data: WhatsAppMessageRequest, current_user: dict = Depends(get_current_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admins only")
    message = data.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
    result = send_group_message(message)
    if not result.get("success"):
        raise HTTPException(status_code=503, detail=result.get("error", "Failed to send WhatsApp message"))
    return result

@app.post("/api/admin/whatsapp/find-group")
def lookup_whatsapp_group(data: WhatsAppGroupLookupRequest, current_user: dict = Depends(get_current_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admins only")
    group_name = data.group_name.strip()
    if not group_name:
        raise HTTPException(status_code=400, detail="Group name is required")
    result = find_group_chat_id(group_name)
    if not result.get("success"):
        raise HTTPException(status_code=503, detail=result.get("error", "Failed to fetch WhatsApp chats"))
    return result

@app.get("/api/notifications")
def get_notifications(current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Check if related_date column exists before querying
        if USE_POSTGRES:
            cur.execute("""
                SELECT column_name FROM information_schema.columns 
                WHERE table_name='notifications' AND column_name='related_date'
            """)
            has_related_date = cur.fetchone() is not None
        else:
            cur.execute("PRAGMA table_info(notifications)")
            columns = [col[1] for col in cur.fetchall()]
            has_related_date = 'related_date' in columns
        
        # Build query based on column existence
        if has_related_date:
            cur.execute(
                f"SELECT id, type, message, read, related_date, created_at FROM notifications WHERE user_email = {PLACEHOLDER} ORDER BY created_at DESC LIMIT 50",
                (current_user["email"],)
            )
        else:
            cur.execute(
                f"SELECT id, type, message, read, created_at FROM notifications WHERE user_email = {PLACEHOLDER} ORDER BY created_at DESC LIMIT 50",
                (current_user["email"],)
            )
        
        rows = cur.fetchall()
        notifications = []
        for row in rows:
            # Extract related_date if column exists
            if has_related_date:
                if USE_POSTGRES:
                    related_date = row["related_date"] if USE_POSTGRES else row[4]
                else:
                    related_date = row[4]
                
                if related_date and isinstance(related_date, str):
                    # If it's a string with timestamp, extract just the date part
                    related_date = related_date.split(' ')[0] if ' ' in related_date else related_date
            else:
                related_date = None
            
            if USE_POSTGRES:
                notifications.append({
                    "id": row["id"],
                    "type": row["type"],
                    "message": row["message"],
                    "read": row["read"],
                    "related_date": related_date,
                    "created_at": row["created_at"],
                })
            else:
                notifications.append({
                    "id": row[0],
                    "type": row[1],
                    "message": row[2],
                    "read": bool(row[3]),
                    "related_date": related_date,
                    "created_at": row[5] if has_related_date else row[4],
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

# --- Reports ---
@app.get("/api/reports/booking")
def generate_booking_report(from_date: str, to_date: str, current_user: dict = Depends(get_current_user)):
    """Generate Booking Report Excel file"""
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admins only")
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Get practice sessions with payment info in date range
        cur.execute(f"""
            SELECT 
                ps.date,
                ps.time,
                ps.location,
                ps.session_cost,
                ps.paid_by,
                u.full_name as paid_by_name
            FROM practice_sessions ps
            LEFT JOIN users u ON ps.paid_by = u.email AND (u.is_deleted = FALSE OR u.is_deleted IS NULL)
            WHERE ps.date >= {PLACEHOLDER} AND ps.date <= {PLACEHOLDER}
            ORDER BY ps.date ASC
        """, (from_date, to_date))
        
        sessions = cur.fetchall()
        
        # Create Excel workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Booking Report"
        
        # Header styling
        header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
        header_font = Font(bold=True, color="FFFFFF")
        header_alignment = Alignment(horizontal="center", vertical="center")
        
        # Headers
        headers = ["Practice Session Date", "Time", "Place", "Total Cost (£)", "Paid By"]
        for col_num, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_num, value=header)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = header_alignment
        
        # Data rows
        for row_num, session in enumerate(sessions, 2):
            if USE_POSTGRES:
                ws.cell(row=row_num, column=1, value=session["date"])
                ws.cell(row=row_num, column=2, value=session["time"] or "TBD")
                ws.cell(row=row_num, column=3, value=session["location"] or "TBD")
                ws.cell(row=row_num, column=4, value=float(session["session_cost"]) if session["session_cost"] else 0.0)
                ws.cell(row=row_num, column=5, value=session["paid_by_name"] or session["paid_by"] or "Not Set")
            else:
                ws.cell(row=row_num, column=1, value=session[0])
                ws.cell(row=row_num, column=2, value=session[1] or "TBD")
                ws.cell(row=row_num, column=3, value=session[2] or "TBD")
                ws.cell(row=row_num, column=4, value=float(session[3]) if session[3] else 0.0)
                ws.cell(row=row_num, column=5, value=session[5] or session[4] or "Not Set")
        
        # Adjust column widths
        ws.column_dimensions['A'].width = 20
        ws.column_dimensions['B'].width = 15
        ws.column_dimensions['C'].width = 25
        ws.column_dimensions['D'].width = 15
        ws.column_dimensions['E'].width = 25
        
        # Save to BytesIO
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        
        filename = f"Booking_Report_{from_date}_to_{to_date}.xlsx"
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

@app.get("/api/reports/player-payment")
def generate_player_payment_report(from_date: str, to_date: str, current_user: dict = Depends(get_current_user)):
    """Generate Player Payment Report Excel file"""
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admins only")
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Get all practice sessions in date range with availability and payment data
        cur.execute(f"""
            SELECT 
                ps.date,
                ps.time,
                ps.location,
                ps.session_cost,
                pa.user_email,
                u.full_name,
                pa.status,
                pp.paid,
                pp.created_at as payment_date
            FROM practice_sessions ps
            LEFT JOIN practice_availability pa ON ps.date = pa.date
            LEFT JOIN users u ON pa.user_email = u.email AND (u.is_deleted = FALSE OR u.is_deleted IS NULL)
            LEFT JOIN practice_payments pp ON ps.date = pp.date AND pa.user_email = pp.user_email
            WHERE ps.date >= {PLACEHOLDER} AND ps.date <= {PLACEHOLDER}
                AND pa.status IS NOT NULL
            ORDER BY ps.date ASC, u.full_name ASC
        """, (from_date, to_date))
        
        rows = cur.fetchall()
        
        # Create Excel workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Player Payment Report"
        
        # Header styling
        header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
        header_font = Font(bold=True, color="FFFFFF")
        header_alignment = Alignment(horizontal="center", vertical="center")
        
        # Headers
        headers = ["Practice Session Date", "Time", "Place", "Player Name", "Availability", 
                   "Individual Amount (£)", "Paid", "Payment Acknowledgement Date"]
        for col_num, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_num, value=header)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = header_alignment
        
        # Data rows
        row_num = 2
        for row in rows:
            if USE_POSTGRES:
                date = row["date"]
                time = row["time"] or "TBD"
                location = row["location"] or "TBD"
                session_cost = row["session_cost"]
                user_email = row["user_email"]
                full_name = row["full_name"] or user_email
                status = row["status"]
                paid = row["paid"]
                payment_date = row["payment_date"]
            else:
                date = row[0]
                time = row[1] or "TBD"
                location = row[2] or "TBD"
                session_cost = row[3]
                user_email = row[4]
                full_name = row[5] or user_email
                status = row[6]
                paid = row[7]
                payment_date = row[8]
            
            ws.cell(row=row_num, column=1, value=date)
            ws.cell(row=row_num, column=2, value=time)
            ws.cell(row=row_num, column=3, value=location)
            ws.cell(row=row_num, column=4, value=full_name)
            ws.cell(row=row_num, column=5, value=status.capitalize() if status else "")
            
            # Individual amount only for available users
            if status == "available" and session_cost:
                # Get count of available users for this session
                cur.execute(f"""
                    SELECT COUNT(*) as count 
                    FROM practice_availability 
                    WHERE date = {PLACEHOLDER} AND status = 'available'
                """, (date,))
                count_row = cur.fetchone()
                available_count = count_row["count"] if USE_POSTGRES else count_row[0]
                
                if available_count > 0:
                    individual_amount = float(session_cost) / available_count
                    ws.cell(row=row_num, column=6, value=round(individual_amount, 2))
                else:
                    ws.cell(row=row_num, column=6, value="")
            else:
                ws.cell(row=row_num, column=6, value="")
            
            # Paid status only for available users
            if status == "available":
                if paid is not None:
                    paid_value = "Yes" if (paid if USE_POSTGRES else bool(paid)) else "No"
                    ws.cell(row=row_num, column=7, value=paid_value)
                else:
                    ws.cell(row=row_num, column=7, value="No")
            else:
                ws.cell(row=row_num, column=7, value="")
            
            # Payment acknowledgement date only for available users who paid
            if status == "available" and paid and payment_date:
                # Format date
                if isinstance(payment_date, str):
                    ws.cell(row=row_num, column=8, value=payment_date.split(' ')[0])
                else:
                    ws.cell(row=row_num, column=8, value=str(payment_date).split(' ')[0])
            else:
                ws.cell(row=row_num, column=8, value="")
            
            row_num += 1
        
        # Adjust column widths
        ws.column_dimensions['A'].width = 20
        ws.column_dimensions['B'].width = 15
        ws.column_dimensions['C'].width = 25
        ws.column_dimensions['D'].width = 25
        ws.column_dimensions['E'].width = 15
        ws.column_dimensions['F'].width = 20
        ws.column_dimensions['G'].width = 10
        ws.column_dimensions['H'].width = 25
        
        # Save to BytesIO
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        
        filename = f"Player_Payment_Report_{from_date}_to_{to_date}.xlsx"
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

# --- User Actions ---
@app.get("/api/user-actions/upcoming-sessions")
def get_upcoming_sessions(current_user: dict = Depends(get_current_user)):
    """Get all upcoming practice sessions for user to set availability"""
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Get all future practice sessions ordered by date (most recent first)
        if USE_POSTGRES:
            cur.execute(
                """
                SELECT ps.date, ps.time, ps.location, ps.session_cost, ps.paid_by,
                       COALESCE(ps.maximum_capacity, 100) as maximum_capacity,
                       pa.status as user_status
                FROM practice_sessions ps
                LEFT JOIN practice_availability pa 
                    ON ps.date = pa.date AND pa.user_email = %s
                WHERE ps.date::date >= CURRENT_DATE
                ORDER BY ps.date ASC
                """,
                (current_user["email"],)
            )
        else:
            cur.execute(
                """
                SELECT ps.date, ps.time, ps.location, ps.session_cost, ps.paid_by,
                       COALESCE(ps.maximum_capacity, 100) as maximum_capacity,
                       pa.status as user_status
                FROM practice_sessions ps
                LEFT JOIN practice_availability pa 
                    ON ps.date = pa.date AND pa.user_email = ?
                WHERE ps.date >= date('now')
                ORDER BY ps.date ASC
                """,
                (current_user["email"],)
            )
        
        rows = cur.fetchall()
        sessions = []
        for row in rows:
            if USE_POSTGRES:
                available_count = get_available_count_for_session(cur, row["date"])
                maximum_capacity = normalize_maximum_capacity(row["maximum_capacity"])
                sessions.append({
                    "date": row["date"],
                    "time": row["time"],
                    "location": row["location"],
                    "session_cost": row["session_cost"],
                    "paid_by": row["paid_by"],
                    "user_status": row["user_status"],
                    "maximum_capacity": maximum_capacity,
                    "available_count": available_count,
                    "remaining_slots": max(maximum_capacity - available_count, 0),
                    "capacity_reached": available_count >= maximum_capacity,
                })
            else:
                available_count = get_available_count_for_session(cur, row[0])
                maximum_capacity = normalize_maximum_capacity(row[5])
                sessions.append({
                    "date": row[0],
                    "time": row[1],
                    "location": row[2],
                    "session_cost": row[3],
                    "paid_by": row[4],
                    "user_status": row[6],
                    "maximum_capacity": maximum_capacity,
                    "available_count": available_count,
                    "remaining_slots": max(maximum_capacity - available_count, 0),
                    "capacity_reached": available_count >= maximum_capacity,
                })
        
        return {"sessions": sessions}

@app.get("/api/user-actions/payments")
def get_pending_payments(current_user: dict = Depends(get_current_user)):
    """Get all sessions where user was available but hasn't confirmed payment"""
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Get sessions where:
        # 1. User marked themselves as available
        # 2. Payment was requested (payment_requested = true)
        # 3. User hasn't confirmed payment OR payment record doesn't exist
        # Order by date descending (newest first)
        if USE_POSTGRES:
            cur.execute(
                """
                SELECT ps.date, ps.time, ps.location, ps.session_cost, ps.paid_by,
                       u.full_name as paid_by_name,
                       u.bank_name as paid_by_bank_name,
                       u.sort_code as paid_by_sort_code,
                       u.account_number as paid_by_account_number,
                       pa.status,
                       COALESCE(pp.paid, FALSE) as paid
                FROM practice_sessions ps
                INNER JOIN practice_availability pa 
                    ON ps.date = pa.date AND pa.user_email = %s
                LEFT JOIN practice_payments pp 
                    ON ps.date = pp.date AND pp.user_email = %s
                LEFT JOIN users u ON ps.paid_by = u.email
                WHERE pa.status = 'available' 
                  AND ps.payment_requested = TRUE
                  AND ps.date::date < CURRENT_DATE
                  AND (pp.paid IS NULL OR pp.paid = FALSE)
                ORDER BY ps.date DESC
                """,
                (current_user["email"], current_user["email"])
            )
        else:
            cur.execute(
                """
                SELECT ps.date, ps.time, ps.location, ps.session_cost, ps.paid_by,
                       u.full_name as paid_by_name,
                       u.bank_name as paid_by_bank_name,
                       u.sort_code as paid_by_sort_code,
                       u.account_number as paid_by_account_number,
                       pa.status,
                       COALESCE(pp.paid, 0) as paid
                FROM practice_sessions ps
                INNER JOIN practice_availability pa 
                    ON ps.date = pa.date AND pa.user_email = ?
                LEFT JOIN practice_payments pp 
                    ON ps.date = pp.date AND pp.user_email = ?
                LEFT JOIN users u ON ps.paid_by = u.email
                WHERE pa.status = 'available' 
                  AND ps.payment_requested = 1
                  AND ps.date < date('now')
                  AND (pp.paid IS NULL OR pp.paid = 0)
                ORDER BY ps.date DESC
                """,
                (current_user["email"], current_user["email"])
            )
        
        rows = cur.fetchall()
        payments = []
        for row in rows:
            if USE_POSTGRES:
                # Calculate individual amount
                # Get count of available users for this session
                cur.execute(
                    "SELECT COUNT(*) FROM practice_availability WHERE date = %s AND status = 'available'",
                    (row["date"],)
                )
                count_row = cur.fetchone()
                available_count = count_row["count"] if count_row and "count" in count_row else 0
                session_cost = row["session_cost"] or 0
                individual_amount = session_cost / available_count if available_count > 0 else 0
                
                payments.append({
                    "date": row["date"],
                    "time": row["time"],
                    "location": row["location"],
                    "session_cost": session_cost,
                    "individual_amount": round(individual_amount, 2),
                    "paid_by": row["paid_by"],
                    "paid_by_name": row["paid_by_name"],
                    "paid_by_bank_name": row["paid_by_bank_name"],
                    "paid_by_sort_code": row["paid_by_sort_code"],
                    "paid_by_account_number": row["paid_by_account_number"],
                    "paid": row["paid"]
                })
            else:
                # Calculate individual amount
                cur.execute(
                    "SELECT COUNT(*) FROM practice_availability WHERE date = ? AND status = 'available'",
                    (row[0],)
                )
                available_count = cur.fetchone()[0]
                session_cost = row[3] or 0
                individual_amount = session_cost / available_count if available_count > 0 else 0
                
                payments.append({
                    "date": row[0],
                    "time": row[1],
                    "location": row[2],
                    "session_cost": session_cost,
                    "individual_amount": round(individual_amount, 2),
                    "paid_by": row[4],
                    "paid_by_name": row[5],
                    "paid_by_bank_name": row[6],
                    "paid_by_sort_code": row[7],
                    "paid_by_account_number": row[8],
                    "paid": bool(row[10])
                })
        
        return {"payments": payments}

@app.get("/api/user-actions/pending-payments")
def get_pending_payments_alias(current_user: dict = Depends(get_current_user)):
    return get_pending_payments(current_user)

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
