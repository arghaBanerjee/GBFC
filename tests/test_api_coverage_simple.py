"""
Simple API Coverage Tests
Tests critical API endpoints with low coverage
"""

import os
import sys
import json
import tempfile
from datetime import datetime, date, timedelta

# Set test mode before importing anything else
os.environ['USE_POSTGRES'] = 'false'
os.environ['TEST_MODE'] = 'true'

# Add parent directory to path to import api modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api import app, get_connection, PLACEHOLDER, USE_POSTGRES, hash_password, init_db
from fastapi.testclient import TestClient

client = TestClient(app)

# Test data
ADMIN_EMAIL = "super@admin.com"
ADMIN_PASSWORD = "admin123"
USER_EMAIL = "test@example.com"
USER_PASSWORD = "test123"

def setup_test_db():
    """Setup test database with required data"""
    # Initialize database schema first
    init_db()
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Clean up existing test data
        cur.execute(f"DELETE FROM users WHERE email IN ({PLACEHOLDER}, {PLACEHOLDER})", (ADMIN_EMAIL, USER_EMAIL))
        
        # Create admin user
        cur.execute(
            f"INSERT INTO users (email, password, user_type, full_name) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (ADMIN_EMAIL, hash_password(ADMIN_PASSWORD), "admin", "Admin User")
        )
        
        # Create regular user
        cur.execute(
            f"INSERT INTO users (email, password, user_type, full_name) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (USER_EMAIL, hash_password(USER_PASSWORD), "member", "Test User")
        )
        
        conn.commit()

def get_admin_token():
    """Get admin authentication token"""
    response = client.post("/api/token", data={"username": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    return response.json()["access_token"]

def get_user_token():
    """Get user authentication token"""
    response = client.post("/api/token", data={"username": USER_EMAIL, "password": USER_PASSWORD})
    return response.json()["access_token"]

def test_user_profile_endpoints():
    """Test user profile management endpoints"""
    print("Testing user profile endpoints...")
    
    setup_test_db()
    user_token = get_user_token()
    user_headers = {"Authorization": f"Bearer {user_token}"}
    
    # Test update own name
    response = client.put("/api/profile/name", json={"full_name": "Updated Name"}, headers=user_headers)
    if response.status_code != 200:
        print(f"FAILED: Profile name update - Status: {response.status_code}, Response: {response.text}")
        return False
    
    data = response.json()
    if data["full_name"] != "Updated Name" or data["email"] != USER_EMAIL:
        print(f"FAILED: Profile name data mismatch - Got: {data}")
        return False
    
    # Test update own password
    response = client.put("/api/profile/password", json={
        "current_password": USER_PASSWORD,
        "new_password": "newpassword123"
    }, headers=user_headers)
    if response.status_code != 200:
        print(f"FAILED: Password update - Status: {response.status_code}, Response: {response.text}")
        return False
    
    # Test update own birthday
    response = client.put("/api/profile/birthday", json={"birthday": "1990-01-01"}, headers=user_headers)
    if response.status_code != 200:
        print(f"FAILED: Birthday update - Status: {response.status_code}, Response: {response.text}")
        return False
    
    # Test update theme preference
    response = client.put("/api/profile/theme", json={"theme_preference": "nordic_neutral"}, headers=user_headers)
    if response.status_code != 200:
        print(f"FAILED: Theme update - Status: {response.status_code}, Response: {response.text}")
        return False
    
    print("User profile endpoints tests passed!")
    return True

def test_match_endpoints():
    """Test match CRUD operations"""
    print("Testing match endpoints...")
    
    setup_test_db()
    admin_token = get_admin_token()
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Create a match event
    match_data = {
        "name": "Test Match",
        "date": "2026-12-01",
        "time": "19:00",
        "location": "Test Ground",
        "description": "Test match description"
    }
    response = client.post("/api/matches", json=match_data, headers=admin_headers)
    if response.status_code != 200:
        print(f"FAILED: Create match - Status: {response.status_code}, Response: {response.text}")
        return False
    
    match_id = response.json()["id"]
    
    # Test get match
    response = client.get(f"/api/matches/{match_id}")
    if response.status_code != 200:
        print(f"FAILED: Get match - Status: {response.status_code}, Response: {response.text}")
        return False
    
    # Test update match
    update_data = {
        "name": "Updated Match",
        "date": "2026-12-01",
        "time": "20:00",
        "location": "Updated Ground",
        "description": "Updated description"
    }
    response = client.put(f"/api/matches/{match_id}", json=update_data, headers=admin_headers)
    if response.status_code != 200:
        print(f"FAILED: Update match - Status: {response.status_code}, Response: {response.text}")
        return False
    
    # Test delete match
    response = client.delete(f"/api/matches/{match_id}", headers=admin_headers)
    if response.status_code != 200:
        print(f"FAILED: Delete match - Status: {response.status_code}, Response: {response.text}")
        return False
    
    print("Match endpoints tests passed!")
    return True

def test_auth_endpoints():
    """Test authentication endpoints"""
    print("Testing auth endpoints...")
    
    setup_test_db()
    
    # Test login
    response = client.post("/api/token", data={"username": USER_EMAIL, "password": USER_PASSWORD})
    if response.status_code != 200:
        print(f"FAILED: Login - Status: {response.status_code}, Response: {response.text}")
        return False
    
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test get current user
    response = client.get("/api/me", headers=headers)
    if response.status_code != 200:
        print(f"FAILED: Get current user - Status: {response.status_code}, Response: {response.text}")
        return False
    
    # Test logout
    response = client.post("/api/logout", headers=headers)
    if response.status_code != 200:
        print(f"FAILED: Logout - Status: {response.status_code}, Response: {response.text}")
        return False
    
    print("Auth endpoints tests passed!")
    return True

def test_user_management_endpoints():
    """Test user management endpoints"""
    print("Testing user management endpoints...")
    
    setup_test_db()
    admin_token = get_admin_token()
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Test get all users
    response = client.get("/api/users", headers=admin_headers)
    if response.status_code != 200:
        print(f"FAILED: Get all users - Status: {response.status_code}, Response: {response.text}")
        return False
    
    users = response.json()
    if len(users) < 2:
        print(f"FAILED: Expected at least 2 users, got {len(users)}")
        return False
    
    print("User management endpoints tests passed!")
    return True

def run_all_coverage_tests():
    """Run all coverage tests"""
    print("Running Simple API Coverage Tests...")
    print("=" * 50)
    
    passed = 0
    total = 0
    
    tests = [
        test_user_profile_endpoints,
        test_match_endpoints,
        test_auth_endpoints,
        test_user_management_endpoints,
    ]
    
    for test_func in tests:
        total += 1
        try:
            if test_func():
                passed += 1
        except Exception as e:
            print(f"FAILED: {test_func.__name__} - {e}")
    
    print("=" * 50)
    print(f"Tests passed: {passed}/{total}")
    
    if passed == total:
        print("All API coverage tests passed!")
        return True
    else:
        print("Some tests failed!")
        return False

if __name__ == "__main__":
    success = run_all_coverage_tests()
    sys.exit(0 if success else 1)
