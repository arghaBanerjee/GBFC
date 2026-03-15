#!/usr/bin/env python3
"""
Tests for User Actions functionality (Upcoming Sessions and Pending Payments)
Tests both SQLite and PostgreSQL compatibility
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta

# Set test mode before importing api
os.environ["TEST_MODE"] = "true"

from api import app, init_db, hash_password, USE_POSTGRES, get_connection, PLACEHOLDER
from fastapi.testclient import TestClient

client = TestClient(app)

def setup_test_data():
    """Create test data for user actions"""
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Clear existing data
        cur.execute("DELETE FROM practice_payments")
        cur.execute("DELETE FROM practice_availability")
        cur.execute("DELETE FROM practice_sessions")
        cur.execute("DELETE FROM users")
        
        # Create test users
        users = [
            ("user1@test.com", "User One", hash_password("pass123")),
            ("user2@test.com", "User Two", hash_password("pass123")),
            ("payer@test.com", "Payer User", hash_password("pass123")),
        ]
        
        for email, name, pwd in users:
            cur.execute(
                f"INSERT INTO users (email, full_name, password, user_type) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, 'member')",
                (email, name, pwd)
            )
        
        # Create practice sessions
        today = datetime.now().date()
        
        # Future sessions (upcoming)
        future_sessions = [
            (str(today + timedelta(days=5)), "18:00", "Location A", 20.0, None, False),
            (str(today + timedelta(days=10)), "19:00", "Location B", 30.0, None, False),
            (str(today + timedelta(days=15)), "20:00", "Location C", 25.0, "payer@test.com", True),
        ]
        
        for date, time, location, cost, paid_by, payment_requested in future_sessions:
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested) "
                f"VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (date, time, location, cost, paid_by, payment_requested if USE_POSTGRES else (1 if payment_requested else 0))
            )
        
        # Past sessions with payment requested
        past_sessions = [
            (str(today - timedelta(days=5)), "18:00", "Location D", 20.0, "payer@test.com", True),
            (str(today - timedelta(days=10)), "19:00", "Location E", 30.0, "payer@test.com", True),
        ]
        
        for date, time, location, cost, paid_by, payment_requested in past_sessions:
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested) "
                f"VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (date, time, location, cost, paid_by, payment_requested if USE_POSTGRES else (1 if payment_requested else 0))
            )
        
        # Add availability for user1
        # Future sessions - user1 available for first two
        cur.execute(
            f"INSERT INTO practice_availability (date, user_email, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, 'available')",
            (str(today + timedelta(days=5)), "user1@test.com")
        )
        
        # Past sessions - user1 was available
        cur.execute(
            f"INSERT INTO practice_availability (date, user_email, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, 'available')",
            (str(today - timedelta(days=5)), "user1@test.com")
        )
        cur.execute(
            f"INSERT INTO practice_availability (date, user_email, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, 'available')",
            (str(today - timedelta(days=10)), "user1@test.com")
        )
        
        # Add payment confirmation for one past session
        cur.execute(
            f"INSERT INTO practice_payments (date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (str(today - timedelta(days=10)), "user1@test.com", True if USE_POSTGRES else 1)
        )
        
        conn.commit()

def test_get_upcoming_sessions():
    """Test getting upcoming practice sessions"""
    print("Testing get upcoming sessions...")
    
    setup_test_data()
    
    # Login as user1
    response = client.post("/api/login", data={
        "username": "user1@test.com",
        "password": "pass123"
    })
    assert response.status_code == 200
    token = response.json()["access_token"]
    
    # Get upcoming sessions
    response = client.get(
        "/api/user-actions/upcoming-sessions",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "sessions" in data
    sessions = data["sessions"]
    
    # Should have 3 future sessions
    assert len(sessions) == 3
    
    # First session should have user's availability status
    assert sessions[0]["user_status"] == "available"
    
    # Second session should have no status (user hasn't voted)
    assert sessions[1]["user_status"] is None
    
    print("✓ Get upcoming sessions works correctly")

def test_get_pending_payments():
    """Test getting pending payments"""
    print("Testing get pending payments...")
    
    setup_test_data()
    
    # Login as user1
    response = client.post("/api/login", data={
        "username": "user1@test.com",
        "password": "pass123"
    })
    assert response.status_code == 200
    token = response.json()["access_token"]
    
    # Get pending payments
    response = client.get(
        "/api/user-actions/pending-payments",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "payments" in data
    payments = data["payments"]
    
    # Should have 1 pending payment (one past session where user was available but hasn't paid)
    assert len(payments) == 1
    
    # Check payment details
    payment = payments[0]
    assert payment["paid_by"] == "payer@test.com"
    assert payment["paid_by_name"] == "Payer User"
    assert payment["individual_amount"] > 0
    assert payment["paid"] == False
    
    print("✓ Get pending payments works correctly")

def test_upcoming_sessions_ordered_correctly():
    """Test that upcoming sessions are ordered by date ascending (nearest first)"""
    print("Testing upcoming sessions ordering...")
    
    setup_test_data()
    
    # Login as user1
    response = client.post("/api/login", data={
        "username": "user1@test.com",
        "password": "pass123"
    })
    token = response.json()["access_token"]
    
    # Get upcoming sessions
    response = client.get(
        "/api/user-actions/upcoming-sessions",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    sessions = response.json()["sessions"]
    
    # Verify sessions are in ascending order (nearest date first)
    for i in range(len(sessions) - 1):
        date1 = datetime.strptime(sessions[i]["date"], "%Y-%m-%d")
        date2 = datetime.strptime(sessions[i + 1]["date"], "%Y-%m-%d")
        assert date1 <= date2, "Sessions should be ordered by date ascending"
    
    print("✓ Upcoming sessions are ordered correctly (nearest first)")

def test_pending_payments_ordered_correctly():
    """Test that pending payments are ordered by date descending (newest first)"""
    print("Testing pending payments ordering...")
    
    setup_test_data()
    
    # Login as user1
    response = client.post("/api/login", data={
        "username": "user1@test.com",
        "password": "pass123"
    })
    token = response.json()["access_token"]
    
    # Get pending payments
    response = client.get(
        "/api/user-actions/pending-payments",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    payments = response.json()["payments"]
    
    # Verify payments are in descending order (newest first)
    for i in range(len(payments) - 1):
        date1 = datetime.strptime(payments[i]["date"], "%Y-%m-%d")
        date2 = datetime.strptime(payments[i + 1]["date"], "%Y-%m-%d")
        assert date1 >= date2, "Payments should be ordered by date descending"
    
    print("✓ Pending payments are ordered correctly (newest first)")

def test_set_availability_from_user_actions():
    """Test setting availability from user actions page"""
    print("Testing set availability from user actions...")
    
    setup_test_data()
    
    # Login as user1
    response = client.post("/api/login", data={
        "username": "user1@test.com",
        "password": "pass123"
    })
    token = response.json()["access_token"]
    
    today = datetime.now().date()
    future_date = str(today + timedelta(days=10))
    
    # Set availability to tentative
    response = client.post(
        f"/api/practice/{future_date}/availability",
        headers={"Authorization": f"Bearer {token}"},
        json={"status": "tentative"}
    )
    
    assert response.status_code == 200
    
    # Verify it's reflected in upcoming sessions
    response = client.get(
        "/api/user-actions/upcoming-sessions",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    sessions = response.json()["sessions"]
    session = next((s for s in sessions if s["date"] == future_date), None)
    assert session is not None
    assert session["user_status"] == "tentative"
    
    print("✓ Set availability from user actions works correctly")

def test_confirm_payment_from_user_actions():
    """Test confirming payment from user actions page"""
    print("Testing confirm payment from user actions...")
    
    setup_test_data()
    
    # Login as user1
    response = client.post("/api/login", data={
        "username": "user1@test.com",
        "password": "pass123"
    })
    token = response.json()["access_token"]
    
    today = datetime.now().date()
    past_date = str(today - timedelta(days=5))
    
    # Confirm payment
    response = client.post(
        f"/api/practice/{past_date}/payment",
        headers={"Authorization": f"Bearer {token}"},
        json={"paid": True}
    )
    
    assert response.status_code == 200
    
    # Verify it's no longer in pending payments
    response = client.get(
        "/api/user-actions/pending-payments",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    payments = response.json()["payments"]
    # Should now have 0 pending payments (the one we just paid)
    assert len(payments) == 0
    
    print("✓ Confirm payment from user actions works correctly")

def test_individual_amount_calculation():
    """Test that individual amount is calculated correctly"""
    print("Testing individual amount calculation...")
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Clear and setup specific test data
        cur.execute("DELETE FROM practice_payments")
        cur.execute("DELETE FROM practice_availability")
        cur.execute("DELETE FROM practice_sessions")
        cur.execute("DELETE FROM users")
        
        # Create users
        for i in range(1, 5):
            cur.execute(
                f"INSERT INTO users (email, full_name, password) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (f"user{i}@test.com", f"User {i}", hash_password("pass"))
            )
        
        today = datetime.now().date()
        past_date = str(today - timedelta(days=5))
        
        # Create session with cost 40
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested) "
            f"VALUES ({PLACEHOLDER}, '18:00', 'Location', 40.0, 'user1@test.com', {PLACEHOLDER})",
            (past_date, True if USE_POSTGRES else 1)
        )
        
        # 4 users available
        for i in range(1, 5):
            cur.execute(
                f"INSERT INTO practice_availability (date, user_email, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, 'available')",
                (past_date, f"user{i}@test.com")
            )
        
        conn.commit()
    
    # Login as user2
    response = client.post("/api/login", data={
        "username": "user2@test.com",
        "password": "pass"
    })
    token = response.json()["access_token"]
    
    # Get pending payments
    response = client.get(
        "/api/user-actions/pending-payments",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    payments = response.json()["payments"]
    assert len(payments) == 1
    
    # Individual amount should be 40 / 4 = 10
    assert payments[0]["individual_amount"] == 10.0
    
    print("✓ Individual amount calculation is correct")

def run_all_tests():
    """Run all user actions tests"""
    print("\n" + "="*80)
    print("Running User Actions Feature Tests")
    print("="*80 + "\n")
    
    tests = [
        test_get_upcoming_sessions,
        test_get_pending_payments,
        test_upcoming_sessions_ordered_correctly,
        test_pending_payments_ordered_correctly,
        test_set_availability_from_user_actions,
        test_confirm_payment_from_user_actions,
        test_individual_amount_calculation,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"✗ {test.__name__} FAILED: {e}")
            failed += 1
        except Exception as e:
            print(f"✗ {test.__name__} ERROR: {e}")
            failed += 1
    
    print("\n" + "="*80)
    print(f"User Actions Tests Complete: {passed} passed, {failed} failed")
    print("="*80 + "\n")
    
    return failed == 0

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
