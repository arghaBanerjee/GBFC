"""
Comprehensive tests for user reactivation and practice availability scenarios.

Tests cover:
1. User deletion removes future practice sessions
2. User deletion preserves past practice sessions
3. Reactivated user doesn't see old practice selections
4. Historical practice records show original username
5. Old records without user_full_name show [HistoricalUser]
6. Likes are removed on user deletion
"""

import os
# Set test mode before importing anything else
os.environ['USE_POSTGRES'] = 'false'
os.environ['TEST_MODE'] = 'true'

import pytest
import sqlite3
from datetime import date, timedelta
import sys

# Add parent directory to path to import api
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api import app, get_connection, hash_password, USE_POSTGRES, PLACEHOLDER

from fastapi.testclient import TestClient

client = TestClient(app)

# Test database setup
TEST_DB = "test_football.db"

@pytest.fixture(autouse=True)
def setup_test_db():
    """Setup test database before each test and cleanup after"""
    # Use test database
    os.environ["DATABASE_URL"] = ""  # Force SQLite
    
    # Remove existing test db
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)
    
    # Initialize database
    from api import init_db
    init_db()
    
    yield
    
    # Cleanup
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)


def create_user(email, full_name, password="password123", user_type="member"):
    """Helper to create a user"""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO users (email, full_name, password, user_type) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (email, full_name, hash_password(password), user_type)
        )
        conn.commit()


def create_practice_session(date_str, time="21:00", location="Toryglen"):
    """Helper to create a practice session"""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (date_str, time, location)
        )
        conn.commit()


def set_practice_availability(email, full_name, date_str, status):
    """Helper to set practice availability with user_full_name"""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT OR REPLACE INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (date_str, email, full_name, status)
        )
        conn.commit()


def set_practice_availability_without_name(email, date_str, status):
    """Helper to set practice availability WITHOUT user_full_name (simulating old records)"""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT OR REPLACE INTO practice_availability (date, user_email, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (date_str, email, status)
        )
        conn.commit()


def login_user(email, password="password123"):
    """Helper to login and get token"""
    response = client.post(
        "/api/token",
        data={"username": email, "password": password}
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_user_deletion_removes_future_practice_sessions():
    """Test that deleting a user removes their future practice availability but preserves past"""
    # Create admin and regular user
    create_user("admin@test.com", "Admin User", user_type="admin")
    create_user("john@test.com", "John Smith")
    
    # Create practice sessions
    today = date.today()
    past_date = (today - timedelta(days=5)).isoformat()
    future_date = (today + timedelta(days=5)).isoformat()
    
    create_practice_session(past_date)
    create_practice_session(future_date)
    
    # John votes for both sessions
    set_practice_availability("john@test.com", "John Smith", past_date, "available")
    set_practice_availability("john@test.com", "John Smith", future_date, "available")
    
    # Verify both records exist
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) as count FROM practice_availability WHERE user_email = ?", ("john@test.com",))
        count = cur.fetchone()["count"]
        assert count == 2, "Should have 2 practice availability records"
    
    # Admin deletes John
    admin_token = login_user("admin@test.com")
    response = client.delete(
        "/api/users/john@test.com",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    
    # Verify future record deleted, past record preserved
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT date FROM practice_availability WHERE user_email = ?", ("john@test.com",))
        rows = cur.fetchall()
        assert len(rows) == 1, "Should have only 1 record (past)"
        assert rows[0]["date"] == past_date, "Should be the past date"


def test_reactivated_user_doesnt_see_old_selections():
    """Test that reactivated user doesn't see previous user's practice selections"""
    # Create admin and user
    create_user("admin@test.com", "Admin User", user_type="admin")
    create_user("john@test.com", "John Smith")
    
    # Create past practice session
    today = date.today()
    past_date = (today - timedelta(days=5)).isoformat()
    create_practice_session(past_date)
    
    # John votes
    set_practice_availability("john@test.com", "John Smith", past_date, "available")
    
    # Admin deletes John
    admin_token = login_user("admin@test.com")
    client.delete(
        "/api/users/john@test.com",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    # Jane signs up with same email (reactivation)
    response = client.post(
        "/api/signup",
        json={"email": "john@test.com", "full_name": "Jane Doe", "password": "newpassword"}
    )
    assert response.status_code == 200
    
    # Jane logs in and checks her availability
    jane_token = login_user("john@test.com", "newpassword")
    response = client.get(
        "/api/practice/availability",
        headers={"Authorization": f"Bearer {jane_token}"}
    )
    assert response.status_code == 200
    availability = response.json()
    
    # Jane should NOT see John's old selection
    assert past_date not in availability, "Jane should not see John's old practice selection"
    assert len(availability) == 0, "Jane should have no practice selections"


def test_historical_practice_records_show_original_username():
    """Test that historical practice records display the original user's name"""
    # Create user
    create_user("john@test.com", "John Smith")
    
    # Create past practice session
    today = date.today()
    past_date = (today - timedelta(days=5)).isoformat()
    create_practice_session(past_date)
    
    # John votes with his name stored
    set_practice_availability("john@test.com", "John Smith", past_date, "available")
    
    # Get practice availability summary
    response = client.get(f"/api/practice/availability/{past_date}")
    assert response.status_code == 200
    summary = response.json()
    
    # Should show "John Smith" (or "John" after frontend split)
    assert "John Smith" in summary["available"], "Should show original username"
    
    # Now simulate reactivation - update user's name
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("UPDATE users SET full_name = ? WHERE email = ?", ("Jane Doe", "john@test.com"))
        conn.commit()
    
    # Get practice availability summary again
    response = client.get(f"/api/practice/availability/{past_date}")
    assert response.status_code == 200
    summary = response.json()
    
    # Should STILL show "John Smith" (stored name), NOT "Jane Doe"
    assert "John Smith" in summary["available"], "Should still show original username from snapshot"
    assert "Jane Doe" not in summary["available"], "Should NOT show new reactivated user's name"


def test_old_records_without_user_full_name_show_placeholder():
    """Test that old records without user_full_name show [OldData] placeholder"""
    # Create user
    create_user("john@test.com", "John Smith")
    
    # Create past practice session
    today = date.today()
    past_date = (today - timedelta(days=5)).isoformat()
    create_practice_session(past_date)
    
    # Create old record WITHOUT user_full_name (simulating pre-migration data)
    set_practice_availability_without_name("john@test.com", past_date, "available")
    
    # Get practice availability summary
    response = client.get(f"/api/practice/availability/{past_date}")
    assert response.status_code == 200
    summary = response.json()
    
    # Should show "[OldData]" placeholder
    assert "[OldData]" in summary["available"], "Should show [OldData] for old records without user_full_name"
    assert "John Smith" not in summary["available"], "Should NOT show current user's name"


def test_old_records_placeholder_not_affected_by_reactivation():
    """Test that [OldData] placeholder doesn't change to reactivated user's name"""
    # Create admin and user
    create_user("admin@test.com", "Admin User", user_type="admin")
    create_user("john@test.com", "John Smith")
    
    # Create past practice session
    today = date.today()
    past_date = (today - timedelta(days=5)).isoformat()
    create_practice_session(past_date)
    
    # Create old record WITHOUT user_full_name
    set_practice_availability_without_name("john@test.com", past_date, "available")
    
    # Verify it shows [OldData]
    response = client.get(f"/api/practice/availability/{past_date}")
    assert response.status_code == 200
    assert "[OldData]" in response.json()["available"]
    
    # Admin deletes John
    admin_token = login_user("admin@test.com")
    client.delete(
        "/api/users/john@test.com",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    # Jane reactivates with same email
    client.post(
        "/api/signup",
        json={"email": "john@test.com", "full_name": "Jane Doe", "password": "newpassword"}
    )
    
    # Check practice availability summary again
    response = client.get(f"/api/practice/availability/{past_date}")
    assert response.status_code == 200
    summary = response.json()
    
    # Should STILL show [OldData], NOT "Jane Doe"
    assert "[OldData]" in summary["available"], "Should still show [OldData] placeholder"
    assert "Jane Doe" not in summary["available"], "Should NOT show reactivated user's new name"


def test_user_deletion_removes_likes():
    """Test that user deletion removes all likes"""
    # Create admin and user
    create_user("admin@test.com", "Admin User", user_type="admin")
    create_user("john@test.com", "John Smith")
    
    # Create forum post
    john_token = login_user("john@test.com")
    response = client.post(
        "/api/forum",
        json={"content": "Test post"},
        headers={"Authorization": f"Bearer {john_token}"}
    )
    post_id = response.json()["id"]
    
    # John likes the post
    client.post(
        f"/api/forum/{post_id}/like",
        headers={"Authorization": f"Bearer {john_token}"}
    )
    
    # Verify like exists
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) as count FROM forum_likes WHERE user_email = ?", ("john@test.com",))
        count = cur.fetchone()["count"]
        assert count == 1, "Should have 1 like"
    
    # Admin deletes John
    admin_token = login_user("admin@test.com")
    client.delete(
        "/api/users/john@test.com",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    # Verify like is removed
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) as count FROM forum_likes WHERE user_email = ?", ("john@test.com",))
        count = cur.fetchone()["count"]
        assert count == 0, "Likes should be removed after user deletion"


def test_new_practice_availability_stores_user_full_name():
    """Test that new practice availability records store user_full_name"""
    # Create user
    create_user("john@test.com", "John Smith")
    
    # Create future practice session
    today = date.today()
    future_date = (today + timedelta(days=5)).isoformat()
    create_practice_session(future_date)
    
    # John votes via API
    john_token = login_user("john@test.com")
    response = client.post(
        "/api/practice/availability",
        json={"date": future_date, "status": "available"},
        headers={"Authorization": f"Bearer {john_token}"}
    )
    assert response.status_code == 200
    
    # Verify user_full_name is stored
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT user_full_name FROM practice_availability WHERE user_email = ? AND date = ?",
            ("john@test.com", future_date)
        )
        row = cur.fetchone()
        assert row is not None, "Record should exist"
        assert row["user_full_name"] == "John Smith", "user_full_name should be stored"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
