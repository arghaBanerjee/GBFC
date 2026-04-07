#!/usr/bin/env python3
"""
Tests for Admin Expenses CRUD functionality
Tests both SQLite and PostgreSQL compatibility
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
# Set test mode before importing api
os.environ["TEST_MODE"] = "true"

from api import app, init_db, hash_password, USE_POSTGRES, get_connection, PLACEHOLDER, SESSIONS
from fastapi.testclient import TestClient
import pytest

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_expenses_test_state():
    init_db()
    SESSIONS.clear()
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM auth_sessions")
        cur.execute("DELETE FROM expenses")
        cur.execute("DELETE FROM practice_sessions")
        cur.execute("DELETE FROM users")
        conn.commit()
    setup_test_data()
    yield

def setup_test_data():
    """Create test data for expenses"""
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Create admin user
        admin_email = "admin@test.com"
        admin_password = hash_password("admin123")
        cur.execute(
            f"INSERT INTO users (email, full_name, password, user_type) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (admin_email, "Admin User", admin_password, "admin")
        )
        
        # Create regular user
        member_email = "member@test.com"
        member_password = hash_password("member123")
        cur.execute(
            f"INSERT INTO users (email, full_name, password, user_type) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, 'member')",
            (member_email, "Member User", member_password)
        )
        
        conn.commit()

def auth_headers(email, password):
    response = client.post(
        '/api/token',
        data={'username': email, 'password': password},
    )
    assert response.status_code == 200, response.text
    token = response.json()['access_token']
    return {'Authorization': f'Bearer {token}'}

def test_admin_list_expenses_empty():
    """Test admin can list expenses when empty"""
    headers = auth_headers("admin@test.com", "admin123")
    response = client.get("/api/expenses", headers=headers)
    assert response.status_code == 200
    assert response.json() == []

def test_admin_create_expense():
    """Test admin can create an expense"""
    headers = auth_headers("admin@test.com", "admin123")
    payload = {
        "title": "Test Expense",
        "amount": 25.50,
        "paid_by": "member@test.com",
        "expense_date": "2026-04-07",
        "category": "Equipment",
        "payment_method": "Cash",
        "description": "Test expense description"
    }
    response = client.post("/api/expenses", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Test Expense"
    assert data["amount"] == 25.5
    assert data["paid_by"] == "member@test.com"
    assert data["expense_date"] == "2026-04-07"
    assert data["category"] == "Equipment"
    assert data["payment_method"] == "Cash"
    assert data["description"] == "Test expense description"
    assert data["paid_by_name"] == "Member User"
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data

def test_admin_list_expenses_with_data():
    """Test admin can list expenses with data"""
    headers = auth_headers("admin@test.com", "admin123")
    # Create two expenses
    payload1 = {
        "title": "First Expense",
        "amount": 10.00,
        "expense_date": "2026-04-06",
        "category": "Travel"
    }
    payload2 = {
        "title": "Second Expense",
        "amount": 15.00,
        "expense_date": "2026-04-07",
        "category": "Food"
    }
    client.post("/api/expenses", json=payload1, headers=headers)
    client.post("/api/expenses", json=payload2, headers=headers)
    
    response = client.get("/api/expenses", headers=headers)
    assert response.status_code == 200
    expenses = response.json()
    # Should have 2 manual expenses (no booking costs)
    manual_expenses = [e for e in expenses if e.get("source") == "expense"]
    assert len(manual_expenses) == 2
    # Should be ordered by expense_date DESC, id DESC
    assert manual_expenses[0]["title"] == "Second Expense"
    assert manual_expenses[1]["title"] == "First Expense"
    # Manual expenses should be editable
    assert manual_expenses[0]["source"] == "expense"
    assert manual_expenses[0]["can_edit"] is True
    assert manual_expenses[0]["can_delete"] is True

def test_admin_list_expenses_includes_booking_costs():
    """Test GET /api/expenses includes read-only practice session booking costs"""
    headers = auth_headers("admin@test.com", "admin123")
    
    # Create a practice session with booking cost
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO practice_sessions (date, event_type, event_title, time, location, session_cost, paid_by, payment_requested) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            ("2026-04-07", "practice", "Team Practice", "19:00", "Glasgow Green", 25.0, "admin@test.com", True if USE_POSTGRES else 1)
        )
        conn.commit()
    
    response = client.get("/api/expenses", headers=headers)
    assert response.status_code == 200
    items = response.json()
    assert len(items) >= 1
    
    # Find the booking cost row
    booking_row = next((item for item in items if item.get("source") == "booking"), None)
    assert booking_row is not None
    assert booking_row["title"] == "Team Practice"
    assert booking_row["amount"] == 25.0
    assert booking_row["category"] == "Event Booking"
    assert booking_row["source"] == "booking"
    assert booking_row["is_booking_expense"] is True
    assert booking_row["practice_session_date"] == "2026-04-07"
    assert booking_row["linked_practice_time"] == "19:00"
    assert booking_row["linked_practice_location"] == "Glasgow Green"
    assert booking_row["can_edit"] is False
    assert booking_row["can_delete"] is False

def test_admin_list_expenses_mixed_manual_and_booking():
    """Test GET /api/expenses combines manual expenses and booking costs correctly"""
    headers = auth_headers("admin@test.com", "admin123")
    
    # Create manual expense
    payload = {
        "title": "Manual Expense",
        "amount": 12.00,
        "expense_date": "2026-04-07",
        "category": "Supplies"
    }
    client.post("/api/expenses", json=payload, headers=headers)
    
    # Create practice session with booking cost
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO practice_sessions (date, event_type, event_title, time, location, session_cost, paid_by, payment_requested) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            ("2026-04-07", "match", "League Match", "20:00", "Scotstoun", 30.0, "admin@test.com", True if USE_POSTGRES else 1)
        )
        conn.commit()
    
    response = client.get("/api/expenses", headers=headers)
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 2
    
    # Verify both types are present with correct flags
    manual = next(item for item in items if item["source"] == "expense")
    booking = next(item for item in items if item["source"] == "booking")
    
    # Manual expense should be editable
    assert manual["title"] == "Manual Expense"
    assert manual["can_edit"] is True
    assert manual["can_delete"] is True
    
    # Booking cost should be read-only
    assert booking["title"] == "League Match"
    assert booking["can_edit"] is False
    assert booking["can_delete"] is False

def test_admin_update_expense():
    """Test admin can update an expense"""
    headers = auth_headers("admin@test.com", "admin123")
    # Create expense
    payload = {
        "title": "Original Title",
        "amount": 20.00,
        "expense_date": "2026-04-07",
        "category": "Original"
    }
    create_response = client.post("/api/expenses", json=payload, headers=headers)
    expense_id = create_response.json()["id"]
    
    # Update expense
    update_payload = {
        "title": "Updated Title",
        "amount": 25.00,
        "paid_by": "member@test.com",
        "expense_date": "2026-04-08",
        "category": "Updated",
        "payment_method": "Card",
        "description": "Updated description"
    }
    response = client.put(f"/api/expenses/{expense_id}", json=update_payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Title"
    assert data["amount"] == 25.0
    assert data["expense_date"] == "2026-04-08"
    assert data["category"] == "Updated"
    assert data["payment_method"] == "Card"
    assert data["description"] == "Updated description"

def test_admin_delete_expense():
    """Test admin can delete an expense"""
    headers = auth_headers("admin@test.com", "admin123")
    # Create expense
    payload = {
        "title": "To Delete",
        "amount": 5.00,
        "expense_date": "2026-04-07"
    }
    create_response = client.post("/api/expenses", json=payload, headers=headers)
    expense_id = create_response.json()["id"]
    
    # Delete expense
    response = client.delete(f"/api/expenses/{expense_id}", headers=headers)
    assert response.status_code == 200
    assert response.json() == {"message": "Expense deleted"}
    
    # Verify it's gone (filter by source to ignore booking costs)
    response = client.get("/api/expenses", headers=headers)
    assert response.status_code == 200
    remaining = [e for e in response.json() if e.get("source") == "expense"]
    assert len(remaining) == 0

def test_non_admin_cannot_access_expenses():
    """Test non-admin users cannot access expense endpoints"""
    headers = auth_headers("member@test.com", "member123")
    
    # Try list
    response = client.get("/api/expenses", headers=headers)
    assert response.status_code == 403
    
    # Try create
    payload = {"title": "Test", "amount": 1.00, "expense_date": "2026-04-07"}
    response = client.post("/api/expenses", json=payload, headers=headers)
    assert response.status_code == 403
    
    # Try update
    response = client.put("/api/expenses/1", json=payload, headers=headers)
    assert response.status_code == 403
    
    # Try delete
    response = client.delete("/api/expenses/1", headers=headers)
    assert response.status_code == 403

def test_unauthenticated_cannot_access_expenses():
    """Test unauthenticated users cannot access expense endpoints"""
    
    # Try list
    response = client.get("/api/expenses")
    assert response.status_code == 401
    
    # Try create
    payload = {"title": "Test", "amount": 1.00, "expense_date": "2026-04-07"}
    response = client.post("/api/expenses", json=payload)
    assert response.status_code == 401
    
    # Try update
    response = client.put("/api/expenses/1", json=payload)
    assert response.status_code == 401
    
    # Try delete
    response = client.delete("/api/expenses/1")
    assert response.status_code == 401

def test_update_nonexistent_expense():
    """Test updating non-existent expense returns 404"""
    headers = auth_headers("admin@test.com", "admin123")
    payload = {"title": "Test", "amount": 1.00, "expense_date": "2026-04-07"}
    response = client.put("/api/expenses/999", json=payload, headers=headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Expense not found"

def test_delete_nonexistent_expense():
    """Test deleting non-existent expense returns 404"""
    headers = auth_headers("admin@test.com", "admin123")
    response = client.delete("/api/expenses/999", headers=headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Expense not found"

def test_expense_validation():
    """Test expense validation"""
    headers = auth_headers("admin@test.com", "admin123")
    
    # Test missing required fields
    response = client.post("/api/expenses", json={}, headers=headers)
    assert response.status_code == 422  # Validation error
    
    # Test invalid amount
    payload = {"title": "Test", "amount": "invalid", "expense_date": "2026-04-07"}
    response = client.post("/api/expenses", json=payload, headers=headers)
    assert response.status_code == 422

if __name__ == "__main__":
    pytest.main([__file__])
