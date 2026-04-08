"""
Comprehensive tests for Event CRUD operations
Tests all event types: practice, match, social, other
Tests Create, Read, Update, Delete operations
Tests both SQLite and PostgreSQL compatibility
"""

import pytest
import requests
from datetime import date, timedelta
import json
import os
import sys

# Add parent directory to path to import api modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api import app, get_connection, PLACEHOLDER, USE_POSTGRES, hash_password, init_db
from fastapi.testclient import TestClient

client = TestClient(app)

# Test data
ADMIN_EMAIL = "super@admin.com"
ADMIN_PASSWORD = "admin123"
USER_EMAIL = "user@test.com"
USER_PASSWORD = "test123"

def setup_test_db():
    """Setup test database with required data"""
    # Initialize database schema first
    init_db()
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Clear existing data
        cur.execute("DELETE FROM practice_sessions")
        cur.execute("DELETE FROM events")
        cur.execute("DELETE FROM users")
        conn.commit()
        
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

def login(email, password):
    """Login and get token"""
    response = client.post("/api/login", data={"username": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]

def get_auth_headers(email, password):
    """Get authorization headers"""
    token = login(email, password)
    return {"Authorization": f"Bearer {token}"}

class TestPracticeEventCRUD:
    """Test CRUD operations for practice events"""
    
    def setup_method(self):
        """Setup before each test"""
        setup_test_db()
        self.admin_headers = get_auth_headers(ADMIN_EMAIL, ADMIN_PASSWORD)
        self.user_headers = get_auth_headers(USER_EMAIL, USER_PASSWORD)
    
    def test_create_practice_event(self):
        """Test creating a practice event"""
        event_data = {
            "date": (date.today() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "time": "19:00",
            "location": "Glasgow Green",
            "event_type": "practice",
            "event_title": "Team Training",
            "description": "Regular team training session",
            "image_url": "",
            "youtube_url": "",
            "session_cost": 25.0,
            "paid_by": ADMIN_EMAIL,
            "maximum_capacity": 30
        }
        
        response = client.post("/api/calendar/events", json=event_data, headers=self.admin_headers)
        assert response.status_code == 200
        
        result = response.json()
        assert result["id"] > 0
        assert result["event_type"] == "practice"
        assert result["event_title"] == "Team Training"
        assert result["date"] == event_data["date"]
        assert result["time"] == event_data["time"]
        assert result["location"] == event_data["location"]
        assert result["session_cost"] == 25.0
        assert result["maximum_capacity"] == 30
    
    def test_read_practice_event(self):
        """Test reading a practice event"""
        # Create event first
        event_data = {
            "date": (date.today() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "time": "19:00",
            "location": "Glasgow Green",
            "event_type": "practice",
            "event_title": "Team Training",
            "description": "Regular team training session",
            "session_cost": 25.0,
            "maximum_capacity": 30
        }
        
        create_response = client.post("/api/calendar/events", json=event_data, headers=self.admin_headers)
        event_id = create_response.json()["id"]
        
        # Read event
        response = client.get(f"/api/calendar/events/id/{event_id}", headers=self.admin_headers)
        assert response.status_code == 200
        
        result = response.json()
        assert result["id"] == event_id
        assert result["event_type"] == "practice"
        assert result["event_title"] == "Team Training"
    
    def test_update_practice_event(self):
        """Test updating a practice event"""
        # Create event first
        event_data = {
            "date": (date.today() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "time": "19:00",
            "location": "Glasgow Green",
            "event_type": "practice",
            "event_title": "Team Training",
            "session_cost": 25.0,
            "maximum_capacity": 30
        }
        
        create_response = client.post("/api/calendar/events", json=event_data, headers=self.admin_headers)
        event_id = create_response.json()["id"]
        
        # Update event
        update_data = {
            "date": (date.today() + timedelta(days=8)).strftime("%Y-%m-%d"),
            "time": "20:00",
            "location": "Updated Location",
            "event_type": "practice",
            "event_title": "Updated Training",
            "description": "Updated description",
            "session_cost": 30.0,
            "maximum_capacity": 25
        }
        
        response = client.put(f"/api/calendar/events/id/{event_id}", json=update_data, headers=self.admin_headers)
        assert response.status_code == 200
        
        result = response.json()
        assert result["id"] == event_id
        assert result["event_title"] == "Updated Training"
        assert result["location"] == "Updated Location"
        assert result["session_cost"] == 30.0
        assert result["maximum_capacity"] == 25
    
    def test_delete_practice_event(self):
        """Test deleting a practice event"""
        # Create event first
        event_data = {
            "date": (date.today() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "time": "19:00",
            "location": "Glasgow Green",
            "event_type": "practice",
            "event_title": "Team Training",
            "session_cost": 25.0,
            "maximum_capacity": 30
        }
        
        create_response = client.post("/api/calendar/events", json=event_data, headers=self.admin_headers)
        event_id = create_response.json()["id"]
        
        # Delete event
        response = client.delete(f"/api/calendar/events/id/{event_id}", headers=self.admin_headers)
        assert response.status_code == 200
        
        # Verify deletion
        response = client.get(f"/api/calendar/events/id/{event_id}", headers=self.admin_headers)
        assert response.status_code == 404

class TestMatchEventCRUD:
    """Test CRUD operations for match events"""
    
    def setup_method(self):
        """Setup before each test"""
        setup_test_db()
        self.admin_headers = get_auth_headers(ADMIN_EMAIL, ADMIN_PASSWORD)
        self.user_headers = get_auth_headers(USER_EMAIL, USER_PASSWORD)
    
    def test_create_match_event(self):
        """Test creating a match event"""
        event_data = {
            "date": (date.today() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "time": "15:00",
            "location": "Celtic Park",
            "name": "vs Celtic FC",
            "description": "League match against Celtic",
            "image_url": "",
            "youtube_url": ""
        }
        
        response = client.post("/api/matches", json=event_data, headers=self.admin_headers)
        assert response.status_code == 200
        
        result = response.json()
        assert result["id"] > 0
        assert result["name"] == "vs Celtic FC"
        assert result["date"] == event_data["date"]
        assert result["time"] == event_data["time"]
        assert result["location"] == event_data["location"]
    
    def test_read_match_event(self):
        """Test reading a match event"""
        # Create event first
        event_data = {
            "date": (date.today() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "time": "15:00",
            "location": "Celtic Park",
            "name": "vs Celtic FC",
            "description": "League match against Celtic"
        }
        
        create_response = client.post("/api/matches", json=event_data, headers=self.admin_headers)
        event_id = create_response.json()["id"]
        
        # Read event
        response = client.get(f"/api/matches/{event_id}", headers=self.admin_headers)
        assert response.status_code == 200
        
        result = response.json()
        assert result["id"] == event_id
        assert result["name"] == "vs Celtic FC"
    
    def test_update_match_event(self):
        """Test updating a match event"""
        # Create event first
        event_data = {
            "date": (date.today() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "time": "15:00",
            "location": "Celtic Park",
            "name": "vs Celtic FC",
            "description": "League match against Celtic"
        }
        
        create_response = client.post("/api/matches", json=event_data, headers=self.admin_headers)
        event_id = create_response.json()["id"]
        
        # Update event
        update_data = {
            "date": (date.today() + timedelta(days=8)).strftime("%Y-%m-%d"),
            "time": "16:00",
            "location": "Ibrox Stadium",
            "name": "vs Rangers FC",
            "description": "Updated match against Rangers",
            "image_url": "",
            "youtube_url": ""
        }
        
        response = client.put(f"/api/matches/{event_id}", json=update_data, headers=self.admin_headers)
        assert response.status_code == 200
        
        result = response.json()
        assert result["id"] == event_id
        assert result["name"] == "vs Rangers FC"
        assert result["date"] == update_data["date"]
        assert result["time"] == update_data["time"]
        assert result["location"] == update_data["location"]
    
    def test_delete_match_event(self):
        """Test deleting a match event"""
        # Create event first
        event_data = {
            "date": (date.today() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "time": "15:00",
            "location": "Celtic Park",
            "name": "vs Celtic FC",
            "description": "League match against Celtic"
        }
        
        create_response = client.post("/api/matches", json=event_data, headers=self.admin_headers)
        event_id = create_response.json()["id"]
        
        # Delete event
        response = client.delete(f"/api/matches/{event_id}", headers=self.admin_headers)
        assert response.status_code == 200
        
        # Verify deletion
        response = client.get(f"/api/matches/{event_id}", headers=self.admin_headers)
        assert response.status_code == 404

class TestSocialEventCRUD:
    """Test CRUD operations for social events"""
    
    def setup_method(self):
        """Setup before each test"""
        setup_test_db()
        self.admin_headers = get_auth_headers(ADMIN_EMAIL, ADMIN_PASSWORD)
        self.user_headers = get_auth_headers(USER_EMAIL, USER_PASSWORD)
    
    def test_create_social_event(self):
        """Test creating a social event"""
        event_data = {
            "date": (date.today() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "time": "18:00",
            "location": "City Centre Restaurant",
            "event_type": "social",
            "event_title": "Team Dinner",
            "description": "End of season celebration dinner",
            "image_url": "",
            "youtube_url": "",
            "session_cost": 35.0,
            "paid_by": ADMIN_EMAIL,
            "maximum_capacity": 50
        }
        
        response = client.post("/api/calendar/events", json=event_data, headers=self.admin_headers)
        assert response.status_code == 200
        
        result = response.json()
        assert result["id"] > 0
        assert result["event_type"] == "social"
        assert result["event_title"] == "Team Dinner"
        assert result["date"] == event_data["date"]
        assert result["time"] == event_data["time"]
        assert result["location"] == event_data["location"]
        assert result["session_cost"] == 35.0
        assert result["maximum_capacity"] == 50
    
    def test_read_social_event(self):
        """Test reading a social event"""
        # Create event first
        event_data = {
            "date": (date.today() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "time": "18:00",
            "location": "City Centre Restaurant",
            "event_type": "social",
            "event_title": "Team Dinner",
            "session_cost": 35.0,
            "maximum_capacity": 50
        }
        
        create_response = client.post("/api/calendar/events", json=event_data, headers=self.admin_headers)
        event_id = create_response.json()["id"]
        
        # Read event
        response = client.get(f"/api/calendar/events/id/{event_id}", headers=self.admin_headers)
        assert response.status_code == 200
        
        result = response.json()
        assert result["id"] == event_id
        assert result["event_type"] == "social"
        assert result["event_title"] == "Team Dinner"
    
    def test_update_social_event(self):
        """Test updating a social event"""
        # Create event first
        event_data = {
            "date": (date.today() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "time": "18:00",
            "location": "City Centre Restaurant",
            "event_type": "social",
            "event_title": "Team Dinner",
            "session_cost": 35.0,
            "maximum_capacity": 50
        }
        
        create_response = client.post("/api/calendar/events", json=event_data, headers=self.admin_headers)
        event_id = create_response.json()["id"]
        
        # Update event
        update_data = {
            "date": (date.today() + timedelta(days=8)).strftime("%Y-%m-%d"),
            "time": "19:00",
            "location": "Updated Restaurant",
            "event_type": "social",
            "event_title": "Updated Team Dinner",
            "description": "Updated description",
            "session_cost": 40.0,
            "maximum_capacity": 60
        }
        
        response = client.put(f"/api/calendar/events/id/{event_id}", json=update_data, headers=self.admin_headers)
        assert response.status_code == 200
        
        result = response.json()
        assert result["id"] == event_id
        assert result["event_title"] == "Updated Team Dinner"
        assert result["location"] == "Updated Restaurant"
        assert result["session_cost"] == 40.0
        assert result["maximum_capacity"] == 60
    
    def test_delete_social_event(self):
        """Test deleting a social event"""
        # Create event first
        event_data = {
            "date": (date.today() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "time": "18:00",
            "location": "City Centre Restaurant",
            "event_type": "social",
            "event_title": "Team Dinner",
            "session_cost": 35.0,
            "maximum_capacity": 50
        }
        
        create_response = client.post("/api/calendar/events", json=event_data, headers=self.admin_headers)
        event_id = create_response.json()["id"]
        
        # Delete event
        response = client.delete(f"/api/calendar/events/id/{event_id}", headers=self.admin_headers)
        assert response.status_code == 200
        
        # Verify deletion
        response = client.get(f"/api/calendar/events/id/{event_id}", headers=self.admin_headers)
        assert response.status_code == 404

class TestOtherEventCRUD:
    """Test CRUD operations for other events"""
    
    def setup_method(self):
        """Setup before each test"""
        setup_test_db()
        self.admin_headers = get_auth_headers(ADMIN_EMAIL, ADMIN_PASSWORD)
        self.user_headers = get_auth_headers(USER_EMAIL, USER_PASSWORD)
    
    def test_create_other_event(self):
        """Test creating an other event"""
        event_data = {
            "date": (date.today() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "time": "10:00",
            "location": "Meeting Room",
            "event_type": "others",
            "event_title": "Committee Meeting",
            "description": "Monthly committee meeting",
            "image_url": "",
            "youtube_url": "",
            "session_cost": 0.0,
            "paid_by": "",
            "maximum_capacity": 20
        }
        
        response = client.post("/api/calendar/events", json=event_data, headers=self.admin_headers)
        assert response.status_code == 200
        
        result = response.json()
        assert result["id"] > 0
        assert result["event_type"] == "others"
        assert result["event_title"] == "Committee Meeting"
        assert result["date"] == event_data["date"]
        assert result["time"] == event_data["time"]
        assert result["location"] == event_data["location"]
        assert result["session_cost"] == 0.0
        assert result["maximum_capacity"] == 20
    
    def test_read_other_event(self):
        """Test reading an other event"""
        # Create event first
        event_data = {
            "date": (date.today() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "time": "10:00",
            "location": "Meeting Room",
            "event_type": "others",
            "event_title": "Committee Meeting",
            "session_cost": 0.0,
            "maximum_capacity": 20
        }
        
        create_response = client.post("/api/calendar/events", json=event_data, headers=self.admin_headers)
        event_id = create_response.json()["id"]
        
        # Read event
        response = client.get(f"/api/calendar/events/id/{event_id}", headers=self.admin_headers)
        assert response.status_code == 200
        
        result = response.json()
        assert result["id"] == event_id
        assert result["event_type"] == "others"
        assert result["event_title"] == "Committee Meeting"
    
    def test_update_other_event(self):
        """Test updating an other event"""
        # Create event first
        event_data = {
            "date": (date.today() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "time": "10:00",
            "location": "Meeting Room",
            "event_type": "others",
            "event_title": "Committee Meeting",
            "session_cost": 0.0,
            "maximum_capacity": 20
        }
        
        create_response = client.post("/api/calendar/events", json=event_data, headers=self.admin_headers)
        event_id = create_response.json()["id"]
        
        # Update event
        update_data = {
            "date": (date.today() + timedelta(days=8)).strftime("%Y-%m-%d"),
            "time": "11:00",
            "location": "Updated Meeting Room",
            "event_type": "others",
            "event_title": "Updated Committee Meeting",
            "description": "Updated description",
            "session_cost": 0.0,
            "maximum_capacity": 25
        }
        
        response = client.put(f"/api/calendar/events/id/{event_id}", json=update_data, headers=self.admin_headers)
        assert response.status_code == 200
        
        result = response.json()
        assert result["id"] == event_id
        assert result["event_title"] == "Updated Committee Meeting"
        assert result["location"] == "Updated Meeting Room"
        assert result["maximum_capacity"] == 25
    
    def test_delete_other_event(self):
        """Test deleting an other event"""
        # Create event first
        event_data = {
            "date": (date.today() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "time": "10:00",
            "location": "Meeting Room",
            "event_type": "others",
            "event_title": "Committee Meeting",
            "session_cost": 0.0,
            "maximum_capacity": 20
        }
        
        create_response = client.post("/api/calendar/events", json=event_data, headers=self.admin_headers)
        event_id = create_response.json()["id"]
        
        # Delete event
        response = client.delete(f"/api/calendar/events/id/{event_id}", headers=self.admin_headers)
        assert response.status_code == 200
        
        # Verify deletion
        response = client.get(f"/api/calendar/events/id/{event_id}", headers=self.admin_headers)
        assert response.status_code == 404

class TestEventCRUDPermissions:
    """Test CRUD operations permissions"""
    
    def setup_method(self):
        """Setup before each test"""
        setup_test_db()
        self.admin_headers = get_auth_headers(ADMIN_EMAIL, ADMIN_PASSWORD)
        self.user_headers = get_auth_headers(USER_EMAIL, USER_PASSWORD)
    
    def test_non_admin_cannot_create_event(self):
        """Test that non-admin users cannot create events"""
        event_data = {
            "date": (date.today() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "time": "19:00",
            "location": "Test Location",
            "event_type": "practice",
            "event_title": "Test Event",
            "session_cost": 25.0,
            "maximum_capacity": 30
        }
        
        response = client.post("/api/calendar/events", json=event_data, headers=self.user_headers)
        assert response.status_code == 403
    
    def test_non_admin_cannot_update_event(self):
        """Test that non-admin users cannot update events"""
        # Create event as admin first
        event_data = {
            "date": (date.today() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "time": "19:00",
            "location": "Test Location",
            "event_type": "practice",
            "event_title": "Test Event",
            "session_cost": 25.0,
            "maximum_capacity": 30
        }
        
        create_response = client.post("/api/calendar/events", json=event_data, headers=self.admin_headers)
        event_id = create_response.json()["id"]
        
        # Try to update as regular user
        update_data = {
            "date": (date.today() + timedelta(days=8)).strftime("%Y-%m-%d"),
            "time": "20:00",
            "location": "Updated Location",
            "event_type": "practice",
            "event_title": "Updated Event",
            "session_cost": 30.0,
            "maximum_capacity": 25
        }
        
        response = client.put(f"/api/calendar/events/id/{event_id}", json=update_data, headers=self.user_headers)
        assert response.status_code == 403
    
    def test_non_admin_cannot_delete_event(self):
        """Test that non-admin users cannot delete events"""
        # Create event as admin first
        event_data = {
            "date": (date.today() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "time": "19:00",
            "location": "Test Location",
            "event_type": "practice",
            "event_title": "Test Event",
            "session_cost": 25.0,
            "maximum_capacity": 30
        }
        
        create_response = client.post("/api/calendar/events", json=event_data, headers=self.admin_headers)
        event_id = create_response.json()["id"]
        
        # Try to delete as regular user
        response = client.delete(f"/api/calendar/events/id/{event_id}", headers=self.user_headers)
        assert response.status_code == 403
    
    def test_unauthenticated_cannot_access_events(self):
        """Test that unauthenticated users cannot access event endpoints"""
        event_data = {
            "date": (date.today() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "time": "19:00",
            "location": "Test Location",
            "event_type": "practice",
            "event_title": "Test Event",
            "session_cost": 25.0,
            "maximum_capacity": 30
        }
        
        # Try to create without authentication
        response = client.post("/api/calendar/events", json=event_data)
        assert response.status_code == 401
        
        # Try to read without authentication (should work for public endpoints)
        response = client.get("/api/calendar/events")
        assert response.status_code == 200

class TestEventCRUDValidation:
    """Test CRUD operations validation"""
    
    def setup_method(self):
        """Setup before each test"""
        setup_test_db()
        self.admin_headers = get_auth_headers(ADMIN_EMAIL, ADMIN_PASSWORD)
    
    def test_create_event_missing_required_fields(self):
        """Test creating event with missing required fields"""
        # Missing date
        event_data = {
            "time": "19:00",
            "location": "Test Location",
            "event_type": "practice",
            "event_title": "Test Event"
        }
        
        response = client.post("/api/calendar/events", json=event_data, headers=self.admin_headers)
        assert response.status_code == 422
    
    def test_create_event_invalid_event_type(self):
        """Test creating event with invalid event type"""
        event_data = {
            "date": (date.today() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "time": "19:00",
            "location": "Test Location",
            "event_type": "invalid_type",
            "event_title": "Test Event",
            "session_cost": 25.0,
            "maximum_capacity": 30
        }
        
        response = client.post("/api/calendar/events", json=event_data, headers=self.admin_headers)
        assert response.status_code == 400
    
    def test_create_event_invalid_maximum_capacity(self):
        """Test creating event with invalid maximum capacity"""
        event_data = {
            "date": (date.today() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "time": "19:00",
            "location": "Test Location",
            "event_type": "practice",
            "event_title": "Test Event",
            "session_cost": 25.0,
            "maximum_capacity": -10  # Invalid negative capacity
        }
        
        response = client.post("/api/calendar/events", json=event_data, headers=self.admin_headers)
        assert response.status_code == 400
    
    def test_update_nonexistent_event(self):
        """Test updating a non-existent event"""
        update_data = {
            "date": (date.today() + timedelta(days=8)).strftime("%Y-%m-%d"),
            "time": "20:00",
            "location": "Updated Location",
            "event_type": "practice",
            "event_title": "Updated Event",
            "session_cost": 30.0,
            "maximum_capacity": 25
        }
        
        response = client.put("/api/calendar/events/id/99999", json=update_data, headers=self.admin_headers)
        assert response.status_code == 404
    
    def test_delete_nonexistent_event(self):
        """Test deleting a non-existent event"""
        response = client.delete("/api/calendar/events/id/99999", headers=self.admin_headers)
        assert response.status_code == 404

# Run tests if this file is executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
