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

from api import app, init_db, hash_password, USE_POSTGRES, get_connection, PLACEHOLDER, notify_practice_slots_available, deliver_notification
from fastapi.testclient import TestClient

client = TestClient(app)

def setup_test_data():
    """Create test data for user actions"""
    init_db()
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Clear existing data
        cur.execute("DELETE FROM notifications")
        cur.execute("DELETE FROM practice_payments")
        cur.execute("DELETE FROM practice_availability")
        cur.execute("DELETE FROM practice_sessions")
        cur.execute("DELETE FROM users")
        
        # Create test users
        users = [
            ("user1@test.com", "User One", hash_password("pass123")),
            ("user2@test.com", "User Two", hash_password("pass123")),
            ("payer@test.com", "Payer User", hash_password("pass123")),
            ("user3@test.com", "User Three", hash_password("pass123")),
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
            (str(today + timedelta(days=5)), "18:00", "Location A", 20.0, None, False, 5),
            (str(today + timedelta(days=10)), "19:00", "Location B", 30.0, None, False, 2),
            (str(today + timedelta(days=15)), "20:00", "Location C", 25.0, "payer@test.com", True, 100),
        ]
        
        for date, time, location, cost, paid_by, payment_requested, maximum_capacity in future_sessions:
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested, maximum_capacity) "
                f"VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (date, time, location, cost, paid_by, payment_requested if USE_POSTGRES else (1 if payment_requested else 0), maximum_capacity)
            )
        
        # Past sessions with payment requested
        past_sessions = [
            (str(today - timedelta(days=5)), "18:00", "Location D", 20.0, "payer@test.com", True, 100),
            (str(today - timedelta(days=10)), "19:00", "Location E", 30.0, "payer@test.com", True, 100),
        ]
        
        for date, time, location, cost, paid_by, payment_requested, maximum_capacity in past_sessions:
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested, maximum_capacity) "
                f"VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (date, time, location, cost, paid_by, payment_requested if USE_POSTGRES else (1 if payment_requested else 0), maximum_capacity)
            )
        
        # Add availability for user1
        # Future sessions - user1 available for first two
        cur.execute(
            f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, 'available')",
            (str(today + timedelta(days=5)), "user1@test.com", "User One")
        )
        cur.execute(
            f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, 'available')",
            (str(today + timedelta(days=10)), "user2@test.com", "User Two")
        )
        cur.execute(
            f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, 'available')",
            (str(today + timedelta(days=10)), "user3@test.com", "User Three")
        )
        
        # Past sessions - user1 was available
        cur.execute(
            f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, 'available')",
            (str(today - timedelta(days=5)), "user1@test.com", "User One")
        )
        cur.execute(
            f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, 'available')",
            (str(today - timedelta(days=10)), "user1@test.com", "User One")
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
    assert sessions[0]["maximum_capacity"] == 5
    assert sessions[0]["available_count"] == 1
    assert sessions[0]["remaining_slots"] == 4
    assert sessions[0]["capacity_reached"] is False
    
    # Second session should have no status (user hasn't voted)
    assert sessions[1]["user_status"] is None
    assert sessions[1]["maximum_capacity"] == 2
    assert sessions[1]["available_count"] == 2
    assert sessions[1]["remaining_slots"] == 0
    assert sessions[1]["capacity_reached"] is True
    
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

def test_same_day_past_time_payment_request_shows_in_pending_payments():
    """A same-day session with payment requested should appear in pending payments once its practice time has passed"""
    setup_test_data()

    response = client.post("/api/login", data={
        "username": "user1@test.com",
        "password": "pass123"
    })
    assert response.status_code == 200
    token = response.json()["access_token"]

    today_str = datetime.now().date().isoformat()
    past_time = (datetime.now() - timedelta(hours=1)).strftime("%H:%M")

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT OR REPLACE INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested, maximum_capacity) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (today_str, past_time, "Today Location", 20.0, "payer@test.com", True if USE_POSTGRES else 1, 18)
        )
        cur.execute(
            f"INSERT OR REPLACE INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, 'available')",
            (today_str, "user1@test.com", "User One")
        )
        cur.execute(
            f"DELETE FROM practice_payments WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
            (today_str, "user1@test.com")
        )
        conn.commit()

    response = client.get(
        "/api/user-actions/pending-payments",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    payments = response.json()["payments"]
    payment = next((p for p in payments if p["date"] == today_str), None)
    assert payment is not None
    assert payment["paid_by"] == "payer@test.com"
    assert payment["paid"] is False

def test_individual_amount_calculation():
    """Test that individual amount is calculated correctly"""
    print("Testing individual amount calculation...")

    init_db()
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

def test_cannot_mark_available_when_capacity_reached():
    """A new available vote should be rejected when the session is already full"""
    setup_test_data()

    response = client.post("/api/login", data={
        "username": "user1@test.com",
        "password": "pass123"
    })
    token = response.json()["access_token"]

    today = datetime.now().date()
    full_session_date = str(today + timedelta(days=10))

    response = client.post(
        f"/api/practice/{full_session_date}/availability",
        headers={"Authorization": f"Bearer {token}"},
        json={"status": "available"}
    )

    assert response.status_code == 403
    assert "Maximum capacity" in response.json()["detail"]

def test_reopening_slot_does_not_send_realtime_notification_and_allows_new_available_vote():
    """Removing an available vote from a full session should reopen a slot without sending an immediate notification"""
    setup_test_data()

    today = datetime.now().date()
    full_session_date = str(today + timedelta(days=10))

    user2_login = client.post("/api/login", data={
        "username": "user2@test.com",
        "password": "pass123"
    })
    user2_token = user2_login.json()["access_token"]

    response = client.post(
        f"/api/practice/{full_session_date}/availability",
        headers={"Authorization": f"Bearer {user2_token}"},
        json={"status": "none"}
    )
    assert response.status_code == 200

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT type, related_date FROM notifications WHERE type = {PLACEHOLDER} AND related_date = {PLACEHOLDER}",
            ("practice_slot_available", full_session_date)
        )
        notifications = cur.fetchall()
        assert len(notifications) == 0

    user1_login = client.post("/api/login", data={
        "username": "user1@test.com",
        "password": "pass123"
    })
    user1_token = user1_login.json()["access_token"]

    response = client.post(
        f"/api/practice/{full_session_date}/availability",
        headers={"Authorization": f"Bearer {user1_token}"},
        json={"status": "available"}
    )
    assert response.status_code == 200

    response = client.get(
        "/api/user-actions/upcoming-sessions",
        headers={"Authorization": f"Bearer {user1_token}"}
    )
    sessions = response.json()["sessions"]
    session = next((s for s in sessions if s["date"] == full_session_date), None)
    assert session is not None
    assert session["user_status"] == "available"
    assert session["capacity_reached"] is True

def test_slot_available_scheduler_notifies_only_nearest_upcoming_session():
    """The 9 AM scheduler should notify only for the nearest upcoming session with open slots"""
    setup_test_data()

    today = datetime.now().date()
    nearest_session_date = str(today + timedelta(days=1))
    later_session_date = str(today + timedelta(days=2))

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"DELETE FROM notifications WHERE type = {PLACEHOLDER}",
            ("practice_slot_available",)
        )
        cur.execute(
            f"DELETE FROM practice_availability WHERE date IN ({PLACEHOLDER}, {PLACEHOLDER})",
            (nearest_session_date, later_session_date)
        )
        cur.execute(
            f"DELETE FROM practice_sessions WHERE date IN ({PLACEHOLDER}, {PLACEHOLDER})",
            (nearest_session_date, later_session_date)
        )
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested, maximum_capacity) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (nearest_session_date, "18:00", "Nearest Location", None, None, False if USE_POSTGRES else 0, 5)
        )
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested, maximum_capacity) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (later_session_date, "19:00", "Later Location", None, None, False if USE_POSTGRES else 0, 4)
        )
        cur.execute(
            f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, 'available')",
            (nearest_session_date, "user1@test.com", "User One")
        )
        cur.execute(
            f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, 'available')",
            (later_session_date, "user2@test.com", "User Two")
        )
        conn.commit()

    notify_practice_slots_available()

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT related_date FROM notifications WHERE type = {PLACEHOLDER} ORDER BY related_date ASC",
            ("practice_slot_available",)
        )
        notifications = cur.fetchall()
        assert len(notifications) >= 1
        related_dates = [row["related_date"] for row in notifications]
        assert nearest_session_date in related_dates
        assert later_session_date not in related_dates

def test_same_day_past_practice_notifications_are_suppressed():
    """Practice-related notifications should not be created when the practice datetime is already in the past"""
    setup_test_data()

    today_str = datetime.now().date().isoformat()
    past_time = (datetime.now() - timedelta(hours=1)).strftime("%H:%M")

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"DELETE FROM notifications WHERE related_date = {PLACEHOLDER}", (today_str,))
        conn.commit()

    for notif_type in ["practice", "practice_slot_available", "session_capacity_reached"]:
        deliver_notification(
            notif_type,
            {
                "date": today_str,
                "time": past_time,
                "location": "Test Location",
                "maximum_capacity": 18,
                "available_count": 5,
                "remaining_slots": 13,
            },
            related_date=today_str,
        )

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT type FROM notifications WHERE related_date = {PLACEHOLDER} AND type IN ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (today_str, "practice", "practice_slot_available", "session_capacity_reached")
        )
        notifications = cur.fetchall()
        assert len(notifications) == 0

def test_same_day_passed_session_removed_from_upcoming_and_member_changes_blocked():
    """A same-day session with a past time should not appear in upcoming sessions and should reject member availability changes"""
    setup_test_data()

    response = client.post("/api/login", data={
        "username": "user1@test.com",
        "password": "pass123"
    })
    assert response.status_code == 200
    token = response.json()["access_token"]

    today_str = datetime.now().date().isoformat()
    past_time = (datetime.now() - timedelta(hours=1)).strftime("%H:%M")

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT OR REPLACE INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested, maximum_capacity) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (today_str, past_time, "Today Location", None, None, False if USE_POSTGRES else 0, 18)
        )
        conn.commit()

    response = client.get(
        "/api/user-actions/upcoming-sessions",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    sessions = response.json()["sessions"]
    assert next((s for s in sessions if s["date"] == today_str), None) is None

    response = client.post(
        "/api/practice/availability",
        headers={"Authorization": f"Bearer {token}"},
        json={"date": today_str, "status": "available"}
    )
    assert response.status_code == 403
    assert "date and time has passed" in response.json()["detail"]

    response = client.post(
        f"/api/practice/{today_str}/availability",
        headers={"Authorization": f"Bearer {token}"},
        json={"status": "tentative"}
    )
    assert response.status_code == 403
    assert "date and time has passed" in response.json()["detail"]

def test_same_day_future_time_session_still_shows_in_upcoming():
    """A same-day session should still appear in upcoming sessions if its practice time has not passed yet"""
    setup_test_data()

    response = client.post("/api/login", data={
        "username": "user1@test.com",
        "password": "pass123"
    })
    assert response.status_code == 200
    token = response.json()["access_token"]

    today_str = datetime.now().date().isoformat()
    future_time = (datetime.now() + timedelta(hours=1)).strftime("%H:%M")

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT OR REPLACE INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested, maximum_capacity) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (today_str, future_time, "Today Future Location", None, None, False if USE_POSTGRES else 0, 18)
        )
        conn.commit()

    response = client.get(
        "/api/user-actions/upcoming-sessions",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    sessions = response.json()["sessions"]
    session = next((s for s in sessions if s["date"] == today_str), None)
    assert session is not None
    assert session["time"] == future_time

def test_capacity_reached_creates_notification_record():
    """When the last slot is taken, a session_capacity_reached notification should be created"""
    setup_test_data()

    today = datetime.now().date()
    limited_session_date = str(today + timedelta(days=5))

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE practice_sessions SET maximum_capacity = {PLACEHOLDER} WHERE date = {PLACEHOLDER}",
            (2, limited_session_date)
        )
        conn.commit()

    response = client.post("/api/login", data={
        "username": "user2@test.com",
        "password": "pass123"
    })
    token = response.json()["access_token"]

    response = client.post(
        "/api/practice/availability",
        headers={"Authorization": f"Bearer {token}"},
        json={"date": limited_session_date, "status": "available"}
    )
    assert response.status_code == 200

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT type, related_date FROM notifications WHERE type = {PLACEHOLDER} AND related_date = {PLACEHOLDER}",
            ("session_capacity_reached", limited_session_date)
        )
        notifications = cur.fetchall()
        assert len(notifications) >= 1

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
        test_same_day_past_time_payment_request_shows_in_pending_payments,
        test_individual_amount_calculation,
        test_cannot_mark_available_when_capacity_reached,
        test_reopening_slot_does_not_send_realtime_notification_and_allows_new_available_vote,
        test_slot_available_scheduler_notifies_only_nearest_upcoming_session,
        test_capacity_reached_creates_notification_record,
        test_same_day_past_practice_notifications_are_suppressed,
        test_same_day_passed_session_removed_from_upcoming_and_member_changes_blocked,
        test_same_day_future_time_session_still_shows_in_upcoming,
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
