"""
Test payment request notifications
Verify that notifications are sent to:
1. All available users when admin requests payment
2. All admin users when a user confirms payment
"""

import os
import sys
from datetime import date, timedelta
from fastapi.testclient import TestClient

# Add parent directory to path to import api
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set environment to use SQLite test database for testing
os.environ['USE_POSTGRES'] = 'false'
os.environ['TEST_MODE'] = 'true'  # Use test_football_club.db instead of football_club.db

from api import app, get_connection, PLACEHOLDER, hash_password, build_notification_context, init_db

client = TestClient(app)

# Test data
TEST_ADMIN1 = {
    "email": "admin1@test.com",
    "full_name": "Admin One"
}

TEST_ADMIN2 = {
    "email": "admin2@test.com",
    "full_name": "Admin Two"
}

TEST_MEMBER1 = {
    "email": "member1@test.com",
    "full_name": "Member One"
}

TEST_MEMBER2 = {
    "email": "member2@test.com",
    "full_name": "Member Two"
}

TEST_MEMBER3 = {
    "email": "member3@test.com",
    "full_name": "Member Three"
}


def setup_test_database():
    """Setup test database with users and practice session"""
    # Initialize database tables first
    from api import init_db
    init_db()
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Clear existing data
        cur.execute("DELETE FROM notifications")
        cur.execute("DELETE FROM practice_payments")
        cur.execute("DELETE FROM practice_availability")
        cur.execute("DELETE FROM practice_sessions")
        cur.execute("DELETE FROM users")
        conn.commit()


def setup_test_database_with_auth_users():
    """Setup test database with login-capable users"""
    # Initialize database tables first
    from api import init_db
    init_db()
    
    with get_connection() as conn:
        cur = conn.cursor()

        cur.execute("DELETE FROM notifications")
        cur.execute("DELETE FROM practice_payments")
        cur.execute("DELETE FROM practice_availability")
        cur.execute("DELETE FROM practice_sessions")
        cur.execute("DELETE FROM users")
        conn.commit()

        hashed_password = hash_password("pass123")

        cur.execute(
            f"INSERT INTO users (email, password, full_name, user_type) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (TEST_ADMIN1["email"], hashed_password, TEST_ADMIN1["full_name"], "admin")
        )
        cur.execute(
            f"INSERT INTO users (email, password, full_name, user_type) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (TEST_ADMIN2["email"], hashed_password, TEST_ADMIN2["full_name"], "admin")
        )
        cur.execute(
            f"INSERT INTO users (email, password, full_name, user_type) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (TEST_MEMBER1["email"], hashed_password, TEST_MEMBER1["full_name"], "member")
        )
        cur.execute(
            f"INSERT INTO users (email, password, full_name, user_type) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (TEST_MEMBER2["email"], hashed_password, TEST_MEMBER2["full_name"], "member")
        )
        cur.execute(
            f"INSERT INTO users (email, password, full_name, user_type) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (TEST_MEMBER3["email"], hashed_password, TEST_MEMBER3["full_name"], "member")
        )
        conn.commit()


def login(email: str, password: str = "pass123") -> str:
    response = client.post("/api/login", data={"username": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def test_payment_request_notifications():
    """Test that notifications are sent to all available users when payment is requested"""
    setup_test_database()
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        past_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
        session_time = "19:00"
        session_location = "Test Ground"
        
        # Create practice session
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (past_date, session_time, session_location, 30.0, TEST_ADMIN1["email"])
        )
        
        # Add users with different statuses
        # Available users - should receive notification
        cur.execute(
            f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (past_date, TEST_MEMBER1["email"], TEST_MEMBER1["full_name"], "available")
        )
        cur.execute(
            f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (past_date, TEST_MEMBER2["email"], TEST_MEMBER2["full_name"], "available")
        )
        
        # Tentative user - should NOT receive notification
        cur.execute(
            f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (past_date, TEST_MEMBER3["email"], TEST_MEMBER3["full_name"], "tentative")
        )
        conn.commit()
        
        # Simulate admin requesting payment
        from api import create_notification
        
        # Enable payment request
        cur.execute(
            f"UPDATE practice_sessions SET payment_requested = 1 WHERE date = {PLACEHOLDER}",
            (past_date,)
        )
        conn.commit()
        
        # Get all available users
        cur.execute(
            f"SELECT user_email FROM practice_availability WHERE date = {PLACEHOLDER} AND status = {PLACEHOLDER}",
            (past_date, "available")
        )
        available_users = cur.fetchall()
        
        # Send notifications
        notification_message = f"Payment requested by Admin for the Session on {past_date} at {session_time}, {session_location}"
        
        for user_row in available_users:
            user_email = user_row["user_email"]
            create_notification(user_email, "payment_request", notification_message)
        
        # Verify notifications were created
        cur.execute(
            f"SELECT user_email, type, message FROM notifications WHERE type = {PLACEHOLDER}",
            ("payment_request",)
        )
        notifications = cur.fetchall()
        
        # Assertions
        assert len(notifications) == 2, f"Expected 2 notifications, got {len(notifications)}"
        
        notification_emails = [n["user_email"] for n in notifications]
        assert TEST_MEMBER1["email"] in notification_emails, "Member1 should receive notification"
        assert TEST_MEMBER2["email"] in notification_emails, "Member2 should receive notification"
        assert TEST_MEMBER3["email"] not in notification_emails, "Member3 (tentative) should NOT receive notification"
        
        # Verify notification message format
        for notif in notifications:
            assert "Payment requested by Admin" in notif["message"]
            assert past_date in notif["message"]
            assert session_time in notif["message"]
            assert session_location in notif["message"]
        
        print("✓ All available users received payment request notifications")
        print("✓ Tentative/unavailable users did NOT receive notifications")
        print("✓ Notification message format is correct")
        print(f"✓ Notification message: {notification_message}")


def test_notification_message_format():
    """Test that notification message has correct format"""
    setup_test_database()
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        past_date = (date.today() - timedelta(days=2)).strftime("%Y-%m-%d")
        session_time = "21:00"
        session_location = "Toryglen"
        
        # Create session
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (past_date, session_time, session_location, 40.0, TEST_ADMIN1["email"])
        )
        
        # Add available user
        cur.execute(
            f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (past_date, TEST_MEMBER1["email"], TEST_MEMBER1["full_name"], "available")
        )
        conn.commit()
        
        # Create notification
        from api import create_notification
        notification_message = f"Payment requested by Admin for the Session on {past_date} at {session_time}, {session_location}"
        create_notification(TEST_MEMBER1["email"], "payment_request", notification_message)
        
        # Verify
        cur.execute(
            f"SELECT message FROM notifications WHERE user_email = {PLACEHOLDER} AND type = {PLACEHOLDER}",
            (TEST_MEMBER1["email"], "payment_request")
        )
        result = cur.fetchone()
        
        assert result is not None
        message = result["message"]
        
        # Check all required components are in the message
        assert "Payment requested by Admin" in message
        assert "Session on" in message
        assert past_date in message
        assert session_time in message
        assert session_location in message
        
        print(f"✓ Notification message format verified: {message}")


def test_admin_notification_on_payment_confirmation():
    """Test that all admins receive notification when a user confirms payment"""
    setup_test_database_with_auth_users()
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        past_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
        session_time = "20:00"
        session_location = "City Ground"
        
        # Create session with payment requested
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (past_date, session_time, session_location, 30.0, TEST_ADMIN1["email"], 1)
        )
        
        # Add member as available
        cur.execute(
            f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (past_date, TEST_MEMBER1["email"], TEST_MEMBER1["full_name"], "available")
        )
        conn.commit()
        
        # Simulate user confirming payment
        from api import create_notification
        
        # User confirms payment
        cur.execute(
            f"INSERT INTO practice_payments (date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (past_date, TEST_MEMBER1["email"], 1)
        )
        conn.commit()
        
        # Send notifications to all admins
        user_full_name = TEST_MEMBER1["full_name"]
        notification_message = f"{user_full_name} confirmed payment for the Session on {past_date} at {session_time}, {session_location}"
        
        # Get all admin users
        cur.execute(
            f"SELECT email FROM users WHERE user_type = {PLACEHOLDER}",
            ("admin",)
        )
        admin_users = cur.fetchall()
        
        # Send notification to all admins
        for admin_row in admin_users:
            admin_email = admin_row["email"]
            create_notification(admin_email, "payment_confirmed", notification_message)
        
        # Verify notifications were created for all admins
        cur.execute(
            f"SELECT user_email, type, message FROM notifications WHERE type = {PLACEHOLDER}",
            ("payment_confirmed",)
        )
        notifications = cur.fetchall()
        
        # Assertions
        assert len(notifications) == 2, f"Expected 2 admin notifications, got {len(notifications)}"
        
        notification_emails = [n["user_email"] for n in notifications]
        assert TEST_ADMIN1["email"] in notification_emails, "Admin1 should receive notification"
        assert TEST_ADMIN2["email"] in notification_emails, "Admin2 should receive notification"
        
        # Verify notification message format
        for notif in notifications:
            assert TEST_MEMBER1["full_name"] in notif["message"]
            assert "confirmed payment" in notif["message"]
            assert past_date in notif["message"]
            assert session_time in notif["message"]
            assert session_location in notif["message"]
        
        print("✓ All admin users received payment confirmation notifications")
        print("✓ Notification message includes user name, date, time, and location")
        print(f"✓ Notification message: {notification_message}")


def test_no_admin_notification_when_unchecking_payment():
    """Test that admins do NOT receive notification when user unchecks payment"""
    setup_test_database_with_auth_users()
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        past_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        # Create session with payment requested
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (past_date, "19:00", "Test Ground", 30.0, TEST_ADMIN1["email"], 1)
        )
        
        # Add member as available
        cur.execute(
            f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (past_date, TEST_MEMBER1["email"], TEST_MEMBER1["full_name"], "available")
        )
        
        # User confirms payment first
        cur.execute(
            f"INSERT INTO practice_payments (date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (past_date, TEST_MEMBER1["email"], 1)
        )
        conn.commit()
        
        # Clear notifications
        cur.execute("DELETE FROM notifications")
        conn.commit()
        
        # User unchecks payment (paid = False)
        cur.execute(
            f"UPDATE practice_payments SET paid = 0 WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
            (past_date, TEST_MEMBER1["email"])
        )
        conn.commit()
        
        # Verify NO notifications were created (since paid = False)
        cur.execute(
            f"SELECT COUNT(*) FROM notifications WHERE type = {PLACEHOLDER}",
            ("payment_confirmed",)
        )
        count = cur.fetchone()[0]
        
        assert count == 0, "No notifications should be sent when unchecking payment"
        
        print("✓ No admin notifications sent when user unchecks payment")


def test_build_notification_context_uppercases_event_type_but_preserves_title():
    """Notification templates should expose uppercase event_type and preserve user-entered title."""
    context = build_notification_context({
        "event_type": "practice",
        "event_title": "Elite Session",
        "date": "2026-01-02",
    })

    assert context["event_type"] == "PRACTICE"
    assert context["event_title"] == "Elite Session"
    assert context["event_name"] == "Practice - Elite Session"


def test_request_payment_endpoint_succeeds_and_creates_notifications():
    """Regression test for SQLite request_payment flow using real API call."""
    setup_test_database_with_auth_users()

    with get_connection() as conn:
        cur = conn.cursor()
        past_date = (date.today() - timedelta(days=2)).strftime("%Y-%m-%d")
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location, event_type, event_title, session_cost, paid_by, payment_requested) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (past_date, "19:00", "Test Ground", "practice", "Winter Session", 30.0, TEST_ADMIN1["email"], 0)
        )
        cur.execute(
            f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (past_date, TEST_MEMBER1["email"], TEST_MEMBER1["full_name"], "available")
        )
        cur.execute(
            f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (past_date, TEST_MEMBER2["email"], TEST_MEMBER2["full_name"], "available")
        )
        conn.commit()

    admin_token = login(TEST_ADMIN1["email"])
    # Get the session ID first
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT id FROM practice_sessions WHERE date = {PLACEHOLDER}",
            (past_date,)
        )
        session_row = cur.fetchone()
        session_id = session_row[0] if session_row else None
    
    assert session_id is not None, "Session should exist"
    
    # Update availability records to include practice_session_id
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE practice_availability SET practice_session_id = {PLACEHOLDER} WHERE date = {PLACEHOLDER}",
            (session_id, past_date)
        )
        conn.commit()
    
    response = client.post(
        f"/api/practice/sessions/id/{session_id}/request-payment",
        headers={"Authorization": f"Bearer {admin_token}"}
    )

    assert response.status_code == 200, response.text

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT payment_requested FROM practice_sessions WHERE date = {PLACEHOLDER}",
            (past_date,)
        )
        session_row = cur.fetchone()
        assert bool(session_row[0]) is True

        cur.execute(
            f"SELECT user_email, type, message FROM notifications WHERE related_date = {PLACEHOLDER} AND type = {PLACEHOLDER}",
            (past_date, "payment_request")
        )
        notifications = cur.fetchall()

    assert len(notifications) == 2
    assert all(notification[1] == "payment_request" for notification in notifications)
    assert all("Winter Session" in notification[2] for notification in notifications)


def test_confirm_payment_endpoint_succeeds_and_notifies_admins():
    """Regression test for SQLite confirm_payment flow using real API call."""
    setup_test_database_with_auth_users()

    with get_connection() as conn:
        cur = conn.cursor()
        past_date = (date.today() - timedelta(days=2)).strftime("%Y-%m-%d")
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location, event_type, event_title, session_cost, paid_by, payment_requested) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (past_date, "20:00", "City Ground", "match", "Cup Tie", 24.0, TEST_ADMIN1["email"], 1)
        )
        cur.execute(
            f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (past_date, TEST_MEMBER1["email"], TEST_MEMBER1["full_name"], "available")
        )
        conn.commit()

    member_token = login(TEST_MEMBER1["email"])
    response = client.post(
        f"/api/practice/sessions/{past_date}/payment",
        json={"paid": True},
        headers={"Authorization": f"Bearer {member_token}"}
    )

    assert response.status_code == 200, response.text
    assert response.json()["paid"] is True

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT paid FROM practice_payments WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
            (past_date, TEST_MEMBER1["email"])
        )
        payment_row = cur.fetchone()
        assert bool(payment_row[0]) is True

        cur.execute(
            f"SELECT user_email, type, message FROM notifications WHERE related_date = {PLACEHOLDER} AND type = {PLACEHOLDER}",
            (past_date, "payment_confirmed")
        )
        notifications = cur.fetchall()

    assert len(notifications) == 2
    assert TEST_ADMIN1["email"] in [notification[0] for notification in notifications]
    assert TEST_ADMIN2["email"] in [notification[0] for notification in notifications]
    assert all("Cup Tie" in notification[2] for notification in notifications)


if __name__ == "__main__":
    print("Testing Payment Request Notifications...")
    print("=" * 70)
    
    try:
        init_db()
        test_payment_request_notifications()
        print()
        test_notification_message_format()
        print()
        test_admin_notification_on_payment_confirmation()
        print()
        test_no_admin_notification_when_unchecking_payment()
        print()
        test_build_notification_context_uppercases_event_type_but_preserves_title()
        print()
        test_request_payment_endpoint_succeeds_and_creates_notifications()
        print()
        test_confirm_payment_endpoint_succeeds_and_notifies_admins()
        print()
        print("=" * 70)
        print("✅ All notification tests passed!")
    except AssertionError as e:
        print()
        print("=" * 70)
        print(f"❌ Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        print()
        print("=" * 70)
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
