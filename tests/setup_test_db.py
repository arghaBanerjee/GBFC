"""
Setup test database with required schema
Run this before running tests to ensure test database has all required tables
"""

import os
import sys
import sqlite3

# Set test mode before importing api
os.environ['USE_POSTGRES'] = 'false'
os.environ['TEST_MODE'] = 'true'

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api import DB_PATH

def setup_test_database():
    """Create all required tables in test database"""
    print(f"Setting up test database: {DB_PATH}")
    
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    # Create users table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT,
            user_type TEXT DEFAULT 'member',
            is_deleted BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP,
            birthday DATE
        )
    """)
    
    # Create practice_sessions table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS practice_sessions (
            date TEXT PRIMARY KEY,
            time TEXT,
            location TEXT,
            session_cost REAL,
            paid_by TEXT,
            payment_requested BOOLEAN DEFAULT FALSE
        )
    """)
    
    # Create practice_availability table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS practice_availability (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            user_email TEXT NOT NULL,
            user_full_name TEXT,
            status TEXT NOT NULL,
            UNIQUE(date, user_email)
        )
    """)
    
    # Create practice_payments table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS practice_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            user_email TEXT NOT NULL,
            paid BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(date, user_email)
        )
    """)
    
    # Create notifications table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_email TEXT NOT NULL,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            read BOOLEAN DEFAULT FALSE,
            related_date DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create events table (for matches)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            time TEXT,
            location TEXT,
            opponent TEXT,
            event_type TEXT DEFAULT 'match',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.commit()
    conn.close()
    
    print(f"✓ Test database setup complete: {DB_PATH}")
    print("✓ All tables created successfully")


if __name__ == "__main__":
    setup_test_database()
