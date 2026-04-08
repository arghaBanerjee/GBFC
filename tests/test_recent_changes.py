"""
Test script to verify recent changes work with SQLite locally
Tests:
1. Admin security check on create_event
2. User name update endpoint
3. Session management (frontend only - no DB test needed)
"""

import os
# Set test mode before importing anything else
os.environ['USE_POSTGRES'] = 'false'
os.environ['TEST_MODE'] = 'true'

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

from api import app, init_db, get_connection, hash_password, PLACEHOLDER, SESSIONS

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_recent_changes_state():
    init_db()
    SESSIONS.clear()
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM auth_sessions")
        cur.execute("DELETE FROM event_comments")
        cur.execute("DELETE FROM event_likes")
        cur.execute("DELETE FROM event_media")
        cur.execute("DELETE FROM events")
        cur.execute("DELETE FROM notifications")
        cur.execute("DELETE FROM practice_payments")
        cur.execute("DELETE FROM practice_availability")
        cur.execute("DELETE FROM practice_sessions")
        cur.execute("DELETE FROM users")
        cur.execute(
            f"INSERT INTO users (email, full_name, password, user_type) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            ("super@admin.com", "Super Admin", hash_password("admin123"), "admin")
        )
        cur.execute(
            f"INSERT INTO users (email, full_name, password, user_type) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            ("member@test.com", "Member User", hash_password("pass123"), "member")
        )
        conn.commit()
    yield

def login(username, password):
    response = client.post("/api/token", data={"username": username, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]

def test_admin_create_event():
    """Test that create_event endpoint works with SQLite and requires admin"""
    token = login("super@admin.com", "admin123")
    headers = {"Authorization": f"Bearer {token}"}

    event_data = {
        "name": "Test Match - SQLite Compatibility",
        "date": "2026-04-01",
        "time": "15:00",
        "location": "Test Stadium",
        "type": "match",
        "description": "Testing SQLite compatibility",
        "image_url": "",
        "youtube_url": ""
    }

    response = client.post(f"/api/matches", json=event_data, headers=headers)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result.get("id")

def test_non_admin_create_event():
    """Test that non-admin users cannot create events"""
    event_data = {
        "name": "Unauthorized Event",
        "date": "2026-04-01",
        "time": "15:00",
        "location": "Test Stadium",
        "type": "match",
        "description": "This should fail",
        "image_url": "",
        "youtube_url": ""
    }

    # Login as regular user
    token = login("member@test.com", "pass123")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(f"/api/matches", json=event_data, headers=headers)
    assert response.status_code == 403, response.text

def test_update_user_name():
    """Test that admin can update user names"""
    token = login("super@admin.com", "admin123")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get(f"/api/users", headers=headers)
    assert response.status_code == 200, response.text
    users = response.json()
    test_user = None
    for user in users:
        if user['email'] != 'super@admin.com':
            test_user = user
            break

    assert test_user is not None
    original_name = test_user['full_name']
    test_email = test_user['email']

    new_name = f"{original_name} (Test)"
    update_data = {"full_name": new_name}

    response = client.put(f"/api/users/{test_email}/name", json=update_data, headers=headers)
    assert response.status_code == 200, response.text

    verify_response = client.get(f"/api/users", headers=headers)
    assert verify_response.status_code == 200, verify_response.text
    updated_users = verify_response.json()
    updated_user = next(user for user in updated_users if user['email'] == test_email)
    assert updated_user['full_name'] == new_name
