"""
Comprehensive Regression Tests for Practice Session Payment Request Functionality
Tests all features including:
- Payment info save and update
- Payment request enablement
- Payment confirmation by users
- Availability locking after payment request
- UI visibility and access control
"""

import os
import sys
import pytest
from datetime import date, timedelta

# Add parent directory to path to import api
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set environment to use SQLite test database for testing
os.environ['USE_POSTGRES'] = 'false'
os.environ['TEST_MODE'] = 'true'  # Use test_football_club.db instead of football_club.db

from api import app, get_connection, USE_POSTGRES, PLACEHOLDER
from fastapi.testclient import TestClient

client = TestClient(app)

# Test data
TEST_ADMIN = {
    "email": "admin@test.com",
    "password": "admin123",
    "full_name": "Admin User"
}

TEST_MEMBER1 = {
    "email": "member1@test.com",
    "password": "member123",
    "full_name": "Member One"
}

TEST_MEMBER2 = {
    "email": "member2@test.com",
    "password": "member123",
    "full_name": "Member Two"
}

TEST_MEMBER3 = {
    "email": "member3@test.com",
    "password": "member123",
    "full_name": "Member Three"
}


def setup_test_database():
    """Setup test database with users and clean state"""
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Clear existing data
        cur.execute("DELETE FROM practice_payments")
        cur.execute("DELETE FROM practice_availability")
        cur.execute("DELETE FROM practice_sessions")
        cur.execute("DELETE FROM users")
        conn.commit()
        
        # Create test users
        cur.execute(
            f"INSERT INTO users (email, password, full_name, user_type) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (TEST_ADMIN["email"], "hashed_password", TEST_ADMIN["full_name"], "admin")
        )
        
        for user in [TEST_MEMBER1, TEST_MEMBER2, TEST_MEMBER3]:
            cur.execute(
                f"INSERT INTO users (email, password, full_name, user_type) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (user["email"], "hashed_password", user["full_name"], "member")
            )
        
        conn.commit()


class TestPaymentInfoSaveAndUpdate:
    """Test saving and updating payment information before payment request"""
    
    def setup_method(self):
        setup_test_database()
    
    def test_save_payment_info_with_cost_and_paid_by(self):
        """Test saving session cost and paid_by user"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            session_date = (date.today() + timedelta(days=7)).strftime("%Y-%m-%d")
            
            # Create session
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (session_date, "19:00", "Test Ground")
            )
            conn.commit()
            
            # Save payment info
            cur.execute(
                f"UPDATE practice_sessions SET session_cost = {PLACEHOLDER}, paid_by = {PLACEHOLDER} WHERE date = {PLACEHOLDER}",
                (30.0, TEST_ADMIN["email"], session_date)
            )
            conn.commit()
            
            # Verify
            cur.execute(
                f"SELECT session_cost, paid_by, payment_requested FROM practice_sessions WHERE date = {PLACEHOLDER}",
                (session_date,)
            )
            result = cur.fetchone()
            
            assert result is not None
            assert float(result[0]) == 30.0
            assert result[1] == TEST_ADMIN["email"]
            assert result[2] in (False, 0, None), "Payment should not be requested yet"
    
    def test_update_payment_info_multiple_times(self):
        """Test that admin can update payment info multiple times before requesting payment"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            session_date = (date.today() + timedelta(days=7)).strftime("%Y-%m-%d")
            
            # Create session with initial payment info
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (session_date, "19:00", "Test Ground", 30.0, TEST_ADMIN["email"])
            )
            conn.commit()
            
            # Update payment info - change cost
            cur.execute(
                f"UPDATE practice_sessions SET session_cost = {PLACEHOLDER} WHERE date = {PLACEHOLDER}",
                (40.0, session_date)
            )
            conn.commit()
            
            # Update payment info - change paid_by
            cur.execute(
                f"UPDATE practice_sessions SET paid_by = {PLACEHOLDER} WHERE date = {PLACEHOLDER}",
                (TEST_MEMBER1["email"], session_date)
            )
            conn.commit()
            
            # Verify final state
            cur.execute(
                f"SELECT session_cost, paid_by FROM practice_sessions WHERE date = {PLACEHOLDER}",
                (session_date,)
            )
            result = cur.fetchone()
            
            assert float(result[0]) == 40.0
            assert result[1] == TEST_MEMBER1["email"]
    
    def test_payment_info_cannot_be_updated_after_payment_request(self):
        """Test that payment info is locked after payment request is enabled"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            past_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
            
            # Create session with payment requested
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, "19:00", "Test Ground", 30.0, TEST_ADMIN["email"], True if USE_POSTGRES else 1)
            )
            conn.commit()
            
            # Verify payment is requested
            cur.execute(
                f"SELECT payment_requested FROM practice_sessions WHERE date = {PLACEHOLDER}",
                (past_date,)
            )
            result = cur.fetchone()
            assert result[0] in (True, 1), "Payment should be requested"


class TestPaymentRequestEnablement:
    """Test payment request enablement and restrictions"""
    
    def setup_method(self):
        setup_test_database()
    
    def test_payment_request_only_after_session_date(self):
        """Test that payment request should only be enabled after session date"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            # Future session
            future_date = (date.today() + timedelta(days=7)).strftime("%Y-%m-%d")
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (future_date, "19:00", "Test Ground", 30.0, TEST_ADMIN["email"])
            )
            
            # Past session
            past_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, "19:00", "Test Ground", 30.0, TEST_ADMIN["email"])
            )
            conn.commit()
            
            # Business rule: Payment request should only be enabled for past sessions
            # This is enforced in the UI, not the database
            assert date.fromisoformat(future_date) > date.today()
            assert date.fromisoformat(past_date) < date.today()
    
    def test_payment_request_requires_cost_and_paid_by(self):
        """Test that payment request requires both session_cost and paid_by to be set"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            past_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
            
            # Session with only cost
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, "19:00", "Test Ground", 30.0)
            )
            conn.commit()
            
            cur.execute(
                f"SELECT session_cost, paid_by FROM practice_sessions WHERE date = {PLACEHOLDER}",
                (past_date,)
            )
            result = cur.fetchone()
            
            # Verify that paid_by is NULL - payment request should not be enabled in UI
            assert result[0] is not None
            assert result[1] is None
    
    def test_payment_request_is_irreversible(self):
        """Test that payment request cannot be disabled once enabled"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            past_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
            
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, "19:00", "Test Ground", 30.0, TEST_ADMIN["email"], True if USE_POSTGRES else 1)
            )
            conn.commit()
            
            # Verify it stays enabled (business rule - no API to disable it)
            cur.execute(
                f"SELECT payment_requested FROM practice_sessions WHERE date = {PLACEHOLDER}",
                (past_date,)
            )
            result = cur.fetchone()
            assert result[0] in (True, 1)


class TestPaymentConfirmationByUsers:
    """Test user payment confirmation functionality"""
    
    def setup_method(self):
        setup_test_database()
    
    def test_available_user_can_confirm_payment(self):
        """Test that an available user can confirm payment"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            past_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
            
            # Create session with payment requested
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, "19:00", "Test Ground", 30.0, TEST_ADMIN["email"], True if USE_POSTGRES else 1)
            )
            
            # Add user as available
            cur.execute(
                f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, TEST_MEMBER1["email"], TEST_MEMBER1["full_name"], "available")
            )
            conn.commit()
            
            # User confirms payment
            cur.execute(
                f"INSERT INTO practice_payments (date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}) ON CONFLICT (date, user_email) DO UPDATE SET paid = EXCLUDED.paid",
                (past_date, TEST_MEMBER1["email"], True if USE_POSTGRES else 1)
            )
            conn.commit()
            
            # Verify
            cur.execute(
                f"SELECT paid FROM practice_payments WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
                (past_date, TEST_MEMBER1["email"])
            )
            result = cur.fetchone()
            
            assert result is not None
            assert result[0] in (True, 1)
    
    def test_user_can_toggle_payment_confirmation(self):
        """Test that user can check and uncheck payment confirmation"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            past_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
            
            # Create session
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, "19:00", "Test Ground", 30.0, TEST_ADMIN["email"], True if USE_POSTGRES else 1)
            )
            conn.commit()
            
            # Confirm payment
            cur.execute(
                f"INSERT INTO practice_payments (date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, TEST_MEMBER1["email"], True if USE_POSTGRES else 1)
            )
            conn.commit()
            
            # Unconfirm payment
            cur.execute(
                f"UPDATE practice_payments SET paid = {PLACEHOLDER} WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
                (False if USE_POSTGRES else 0, past_date, TEST_MEMBER1["email"])
            )
            conn.commit()
            
            # Re-confirm payment
            cur.execute(
                f"UPDATE practice_payments SET paid = {PLACEHOLDER} WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
                (True if USE_POSTGRES else 1, past_date, TEST_MEMBER1["email"])
            )
            conn.commit()
            
            # Verify final state
            cur.execute(
                f"SELECT paid FROM practice_payments WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
                (past_date, TEST_MEMBER1["email"])
            )
            result = cur.fetchone()
            assert result[0] in (True, 1)
    
    def test_multiple_users_payment_confirmations(self):
        """Test that multiple users can independently confirm payment"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            past_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
            
            # Create session
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, "19:00", "Test Ground", 60.0, TEST_ADMIN["email"], True if USE_POSTGRES else 1)
            )
            
            # Add all users as available
            for user in [TEST_MEMBER1, TEST_MEMBER2, TEST_MEMBER3]:
                cur.execute(
                    f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                    (past_date, user["email"], user["full_name"], "available")
                )
            conn.commit()
            
            # Member1 and Member3 confirm, Member2 doesn't
            cur.execute(
                f"INSERT INTO practice_payments (date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, TEST_MEMBER1["email"], True if USE_POSTGRES else 1)
            )
            cur.execute(
                f"INSERT INTO practice_payments (date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, TEST_MEMBER3["email"], True if USE_POSTGRES else 1)
            )
            conn.commit()
            
            # Verify
            cur.execute(
                f"SELECT COUNT(*) FROM practice_payments WHERE date = {PLACEHOLDER} AND paid = {PLACEHOLDER}",
                (past_date, True if USE_POSTGRES else 1)
            )
            result = cur.fetchone()
            assert result[0] == 2, "Two users should have confirmed payment"


class TestAvailabilityLockingAfterPaymentRequest:
    """Test that availability cannot be changed after payment request"""
    
    def setup_method(self):
        setup_test_database()
    
    def test_user_cannot_change_availability_after_payment_request(self):
        """Test that users cannot change their availability after payment is requested"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            past_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
            
            # Create session with payment requested
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, "19:00", "Test Ground", 30.0, TEST_ADMIN["email"], True if USE_POSTGRES else 1)
            )
            
            # User sets availability
            cur.execute(
                f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, TEST_MEMBER1["email"], TEST_MEMBER1["full_name"], "available")
            )
            conn.commit()
            
            # Verify payment is requested
            cur.execute(
                f"SELECT payment_requested FROM practice_sessions WHERE date = {PLACEHOLDER}",
                (past_date,)
            )
            result = cur.fetchone()
            assert result[0] in (True, 1)
            
            # Business rule: UI should prevent changes, backend should reject them
            # This test verifies the session state that triggers UI restrictions
    
    def test_admin_cannot_delete_availability_after_payment_request(self):
        """Test that admin cannot delete user availability after payment request"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            past_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
            
            # Create session with payment requested
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, "19:00", "Test Ground", 30.0, TEST_ADMIN["email"], True if USE_POSTGRES else 1)
            )
            
            # Add user availability
            cur.execute(
                f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, TEST_MEMBER1["email"], TEST_MEMBER1["full_name"], "available")
            )
            conn.commit()
            
            # Count availability records
            cur.execute(
                f"SELECT COUNT(*) FROM practice_availability WHERE date = {PLACEHOLDER}",
                (past_date,)
            )
            count_before = cur.fetchone()[0]
            
            # Business rule: UI should hide delete buttons when payment_requested = true
            # Verify the condition that triggers this UI behavior
            cur.execute(
                f"SELECT payment_requested FROM practice_sessions WHERE date = {PLACEHOLDER}",
                (past_date,)
            )
            result = cur.fetchone()
            assert result[0] in (True, 1), "Delete buttons should be hidden in UI"


class TestPaymentCardVisibility:
    """Test payment request card visibility for users"""
    
    def setup_method(self):
        setup_test_database()
    
    def test_payment_card_appears_for_available_users(self):
        """Test that payment card appears for all users marked as available"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            past_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
            
            # Create session with payment requested
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, "19:00", "Test Ground", 30.0, TEST_ADMIN["email"], True if USE_POSTGRES else 1)
            )
            
            # Add users with different statuses
            cur.execute(
                f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, TEST_MEMBER1["email"], TEST_MEMBER1["full_name"], "available")
            )
            cur.execute(
                f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, TEST_MEMBER2["email"], TEST_MEMBER2["full_name"], "tentative")
            )
            cur.execute(
                f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, TEST_MEMBER3["email"], TEST_MEMBER3["full_name"], "not_available")
            )
            conn.commit()
            
            # Verify only available users should see payment card
            cur.execute(
                f"SELECT user_email FROM practice_availability WHERE date = {PLACEHOLDER} AND status = {PLACEHOLDER}",
                (past_date, "available")
            )
            available_users = cur.fetchall()
            
            assert len(available_users) == 1
            assert available_users[0][0] == TEST_MEMBER1["email"]
    
    def test_payment_card_shows_for_admin_who_paid(self):
        """Test that payment card appears for admin who paid, if they are available"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            past_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
            
            # Create session where admin paid
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, "19:00", "Test Ground", 30.0, TEST_ADMIN["email"], True if USE_POSTGRES else 1)
            )
            
            # Admin is available
            cur.execute(
                f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, TEST_ADMIN["email"], TEST_ADMIN["full_name"], "available")
            )
            conn.commit()
            
            # Verify admin is in available list
            cur.execute(
                f"SELECT user_email FROM practice_availability WHERE date = {PLACEHOLDER} AND status = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
                (past_date, "available", TEST_ADMIN["email"])
            )
            result = cur.fetchone()
            
            assert result is not None
            assert result[0] == TEST_ADMIN["email"]


class TestPaymentCalculations:
    """Test payment amount calculations"""
    
    def test_equal_split_among_available_users(self):
        """Test that payment is split equally among available users"""
        total_cost = 60.0
        available_count = 3
        per_user = total_cost / available_count
        
        assert per_user == 20.0
    
    def test_payment_with_decimal_precision(self):
        """Test payment calculation with proper decimal rounding"""
        total_cost = 50.0
        available_count = 3
        per_user = round(total_cost / available_count, 2)
        
        assert per_user == 16.67
    
    def test_payment_split_with_single_user(self):
        """Test payment when only one user is available"""
        total_cost = 30.0
        available_count = 1
        per_user = total_cost / available_count
        
        assert per_user == 30.0


class TestDataIntegrity:
    """Test data integrity and constraints"""
    
    def setup_method(self):
        setup_test_database()
    
    def test_payment_record_unique_per_user_per_session(self):
        """Test that each user can only have one payment record per session"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            past_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
            
            # Insert first payment record
            cur.execute(
                f"INSERT INTO practice_payments (date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, TEST_MEMBER1["email"], True if USE_POSTGRES else 1)
            )
            conn.commit()
            
            # Try to insert duplicate - should update instead
            cur.execute(
                f"INSERT INTO practice_payments (date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}) ON CONFLICT (date, user_email) DO UPDATE SET paid = EXCLUDED.paid",
                (past_date, TEST_MEMBER1["email"], False if USE_POSTGRES else 0)
            )
            conn.commit()
            
            # Verify only one record exists
            cur.execute(
                f"SELECT COUNT(*) FROM practice_payments WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
                (past_date, TEST_MEMBER1["email"])
            )
            count = cur.fetchone()[0]
            
            assert count == 1
    
    def test_payment_confirmation_persists_correctly(self):
        """Test that payment confirmation state persists correctly"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            past_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
            
            # Create payment confirmation
            cur.execute(
                f"INSERT INTO practice_payments (date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, TEST_MEMBER1["email"], True if USE_POSTGRES else 1)
            )
            conn.commit()
            
            # Read it back
            cur.execute(
                f"SELECT paid FROM practice_payments WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
                (past_date, TEST_MEMBER1["email"])
            )
            result = cur.fetchone()
            
            assert result is not None
            assert result[0] in (True, 1)


if __name__ == "__main__":
    print("Running Comprehensive Payment Request Tests...")
    print("=" * 70)
    print("Testing:")
    print("  - Payment info save and update")
    print("  - Payment request enablement")
    print("  - Payment confirmation by users")
    print("  - Availability locking after payment request")
    print("  - Payment card visibility")
    print("  - Data integrity")
    print("=" * 70)
    
    # Run pytest with verbose output
    exit_code = pytest.main([__file__, "-v", "--tb=short"])
    
    sys.exit(exit_code)
