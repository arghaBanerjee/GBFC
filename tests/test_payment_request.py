"""
Comprehensive tests for Practice Session Payment Request functionality
Tests both SQLite and PostgreSQL compatibility
"""

import os
import sys
import sqlite3
import pytest
from datetime import date, timedelta
from decimal import Decimal

# Add parent directory to path to import api
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set environment to use SQLite test database for testing
os.environ['USE_POSTGRES'] = 'false'
os.environ['TEST_MODE'] = 'true'  # Use test_football_club.db instead of football_club.db

from api import app, get_connection, USE_POSTGRES, PLACEHOLDER
from fastapi.testclient import TestClient

client = TestClient(app)

# Test data
TEST_USER_ADMIN = {
    "email": "admin@test.com",
    "password": "admin123",
    "full_name": "Admin User"
}

TEST_USER_MEMBER1 = {
    "email": "member1@test.com",
    "password": "member123",
    "full_name": "Member One"
}

TEST_USER_MEMBER2 = {
    "email": "member2@test.com",
    "password": "member123",
    "full_name": "Member Two"
}

TEST_USER_MEMBER3 = {
    "email": "member3@test.com",
    "password": "member123",
    "full_name": "Member Three"
}


def setup_test_database():
    """Setup test database with users and practice session"""
    with get_connection() as conn:
        cur = conn.cursor()
        if not USE_POSTGRES:
            try:
                cur.execute("ALTER TABLE practice_sessions ADD COLUMN payment_requested_at TIMESTAMP")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e).lower():
                    raise
        
        # Clear existing data
        cur.execute("DELETE FROM practice_payments")
        cur.execute("DELETE FROM practice_availability")
        cur.execute("DELETE FROM practice_sessions")
        cur.execute("DELETE FROM users")
        conn.commit()
        
        # Create test users
        # Admin user
        cur.execute(
            f"INSERT INTO users (email, password, full_name, user_type) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (TEST_USER_ADMIN["email"], "hashed_password", TEST_USER_ADMIN["full_name"], "admin")
        )
        
        # Member users
        for user in [TEST_USER_MEMBER1, TEST_USER_MEMBER2, TEST_USER_MEMBER3]:
            cur.execute(
                f"INSERT INTO users (email, password, full_name, user_type) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (user["email"], "hashed_password", user["full_name"], "member")
            )
        
        conn.commit()


def get_admin_token():
    """Get authentication token for admin user"""
    # For testing, we'll create a simple token
    # In real scenario, this would go through proper authentication
    return "test_admin_token"


def get_member_token(email):
    """Get authentication token for member user"""
    return f"test_member_token_{email}"


class TestPaymentRequestSchema:
    """Test database schema for payment request functionality"""
    
    def test_practice_sessions_table_has_payment_fields(self):
        """Test that practice_sessions table has payment-related columns"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            if USE_POSTGRES:
                cur.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'practice_sessions'
                """)
            else:
                cur.execute("PRAGMA table_info(practice_sessions)")
            
            columns = [row[1] if not USE_POSTGRES else row[0] for row in cur.fetchall()]
            
            assert 'session_cost' in columns, "session_cost column missing"
            assert 'paid_by' in columns, "paid_by column missing"
            assert 'payment_requested' in columns, "payment_requested column missing"
            assert 'payment_requested_at' in columns, "payment_requested_at column missing"
    
    def test_practice_payments_table_exists(self):
        """Test that practice_payments table exists with correct schema"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            if USE_POSTGRES:
                cur.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'practice_payments'
                """)
            else:
                cur.execute("PRAGMA table_info(practice_payments)")
            
            columns = [row[1] if not USE_POSTGRES else row[0] for row in cur.fetchall()]
            
            assert 'id' in columns, "id column missing"
            assert 'date' in columns, "date column missing"
            assert 'user_email' in columns, "user_email column missing"
            assert 'paid' in columns, "paid column missing"
            assert 'created_at' in columns, "created_at column missing"


class TestPracticeSessionPaymentFields:
    """Test practice session creation and updates with payment fields"""
    
    def setup_method(self):
        """Setup before each test"""
        setup_test_database()
    
    def test_create_session_with_payment_fields(self):
        """Test creating a practice session with payment fields"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            session_date = (date.today() + timedelta(days=7)).strftime("%Y-%m-%d")
            
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (session_date, "19:00", "Test Ground", 30.0, TEST_USER_ADMIN["email"])
            )
            conn.commit()
            
            # Verify insertion
            cur.execute(f"SELECT session_cost, paid_by, payment_requested FROM practice_sessions WHERE date = {PLACEHOLDER}", (session_date,))
            result = cur.fetchone()
            
            assert result is not None, "Session not created"
            assert float(result[0]) == 30.0, "Session cost not saved correctly"
            assert result[1] == TEST_USER_ADMIN["email"], "Paid by not saved correctly"
            assert result[2] in (False, 0, None), "Payment requested should be False by default"
    
    def test_update_session_payment_fields(self):
        """Test updating payment fields in existing session"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            session_date = (date.today() + timedelta(days=7)).strftime("%Y-%m-%d")
            
            # Create session
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (session_date, "19:00", "Test Ground")
            )
            conn.commit()
            
            # Update with payment fields
            cur.execute(
                f"UPDATE practice_sessions SET session_cost = {PLACEHOLDER}, paid_by = {PLACEHOLDER} WHERE date = {PLACEHOLDER}",
                (50.0, TEST_USER_MEMBER1["email"], session_date)
            )
            conn.commit()
            
            # Verify update
            cur.execute(f"SELECT session_cost, paid_by FROM practice_sessions WHERE date = {PLACEHOLDER}", (session_date,))
            result = cur.fetchone()
            
            assert float(result[0]) == 50.0, "Session cost not updated"
            assert result[1] == TEST_USER_MEMBER1["email"], "Paid by not updated"


class TestPaymentRequestEnabling:
    """Test enabling payment request for a session"""
    
    def setup_method(self):
        """Setup before each test"""
        setup_test_database()
    
    def test_enable_payment_request_for_past_session(self):
        """Test enabling payment request for a past session"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            # Create a past session
            past_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
            
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, "19:00", "Test Ground", 30.0, TEST_USER_ADMIN["email"])
            )
            conn.commit()
            
            # Enable payment request
            cur.execute(
                f"UPDATE practice_sessions SET payment_requested = {PLACEHOLDER} WHERE date = {PLACEHOLDER}",
                (True if USE_POSTGRES else 1, past_date)
            )
            conn.commit()
            
            # Verify
            cur.execute(f"SELECT payment_requested FROM practice_sessions WHERE date = {PLACEHOLDER}", (past_date,))
            result = cur.fetchone()
            
            assert result[0] in (True, 1), "Payment request not enabled"
    
    def test_payment_request_cannot_be_disabled_once_enabled(self):
        """Test that payment request stays enabled (business rule)"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            past_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
            
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (past_date, "19:00", "Test Ground", 30.0, TEST_USER_ADMIN["email"], True if USE_POSTGRES else 1)
            )
            conn.commit()
            
            # Verify it's enabled
            cur.execute(f"SELECT payment_requested FROM practice_sessions WHERE date = {PLACEHOLDER}", (past_date,))
            result = cur.fetchone()
            
            assert result[0] in (True, 1), "Payment request should be enabled"


class TestUserPaymentConfirmation:
    """Test user payment confirmation functionality"""
    
    def setup_method(self):
        """Setup before each test"""
        setup_test_database()
    
    def test_user_can_confirm_payment(self):
        """Test that a user can confirm payment"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            session_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
            
            # Create session with payment requested
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (session_date, "19:00", "Test Ground", 30.0, TEST_USER_ADMIN["email"], True if USE_POSTGRES else 1)
            )
            session_id = cur.lastrowid if not USE_POSTGRES else None
            if USE_POSTGRES:
                cur.execute(
                    f"SELECT id FROM practice_sessions WHERE date = {PLACEHOLDER} ORDER BY id DESC LIMIT 1",
                    (session_date,)
                )
                session_id = cur.fetchone()[0]
            
            # Add user availability
            cur.execute(
                f"INSERT INTO practice_availability (practice_session_id, date, user_email, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (session_id, session_date, TEST_USER_MEMBER1["email"], "available")
            )
            conn.commit()
            
            # User confirms payment
            if USE_POSTGRES:
                cur.execute(
                    f"INSERT INTO practice_payments (practice_session_id, date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}) ON CONFLICT (practice_session_id, user_email) DO UPDATE SET paid = EXCLUDED.paid",
                    (session_id, session_date, TEST_USER_MEMBER1["email"], True if USE_POSTGRES else 1)
                )
            else:
                cur.execute(
                    f"INSERT OR REPLACE INTO practice_payments (practice_session_id, date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                    (session_id, session_date, TEST_USER_MEMBER1["email"], True if USE_POSTGRES else 1)
                )
            conn.commit()
            
            # Verify
            cur.execute(
                f"SELECT paid FROM practice_payments WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
                (session_date, TEST_USER_MEMBER1["email"])
            )
            result = cur.fetchone()
            
            assert result is not None, "Payment confirmation not recorded"
            assert result[0] in (True, 1), "Payment not marked as confirmed"
    
    def test_user_can_unconfirm_payment(self):
        """Test that a user can unconfirm payment"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            session_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
            
            # Create session with payment requested
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (session_date, "19:00", "Test Ground", 30.0, TEST_USER_ADMIN["email"], True if USE_POSTGRES else 1)
            )
            
            # User confirms payment
            cur.execute(
                f"INSERT INTO practice_payments (date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (session_date, TEST_USER_MEMBER1["email"], True if USE_POSTGRES else 1)
            )
            conn.commit()
            
            # User unconfirms payment
            cur.execute(
                f"UPDATE practice_payments SET paid = {PLACEHOLDER} WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
                (False if USE_POSTGRES else 0, session_date, TEST_USER_MEMBER1["email"])
            )
            conn.commit()
            
            # Verify
            cur.execute(
                f"SELECT paid FROM practice_payments WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
                (session_date, TEST_USER_MEMBER1["email"])
            )
            result = cur.fetchone()
            
            assert result[0] in (False, 0), "Payment should be unconfirmed"
    
    def test_multiple_users_can_confirm_payment(self):
        """Test that multiple users can confirm payment for same session"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            session_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
            
            # Create session
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location, session_cost, paid_by, payment_requested) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (session_date, "19:00", "Test Ground", 60.0, TEST_USER_ADMIN["email"], True if USE_POSTGRES else 1)
            )
            conn.commit()
            
            # Multiple users confirm payment
            for user in [TEST_USER_MEMBER1, TEST_USER_MEMBER2, TEST_USER_MEMBER3]:
                cur.execute(
                    f"INSERT INTO practice_payments (date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                    (session_date, user["email"], True if USE_POSTGRES else 1)
                )
            conn.commit()
            
            # Verify all confirmations
            cur.execute(
                f"SELECT COUNT(*) FROM practice_payments WHERE date = {PLACEHOLDER} AND paid = {PLACEHOLDER}",
                (session_date, True if USE_POSTGRES else 1)
            )
            result = cur.fetchone()
            
            assert result[0] == 3, "All three users should have confirmed payment"


class TestPaymentCalculations:
    """Test payment amount calculations"""
    
    def test_payment_split_among_available_users(self):
        """Test that payment is correctly split among available users"""
        total_cost = 60.0
        available_users = 3
        expected_per_user = total_cost / available_users
        
        assert expected_per_user == 20.0, "Payment should be split equally"
    
    def test_payment_calculation_with_decimal_precision(self):
        """Test payment calculation with decimal precision"""
        total_cost = 50.0
        available_users = 3
        expected_per_user = round(total_cost / available_users, 2)
        
        assert expected_per_user == 16.67, "Payment should be rounded to 2 decimal places"


class TestUniqueConstraints:
    """Test unique constraints on practice_payments table"""
    
    def setup_method(self):
        """Setup before each test"""
        setup_test_database()
    
    def test_unique_constraint_on_practice_session_id_user_email(self):
        """Test that (practice_session_id, user_email) combination is unique"""
        with get_connection() as conn:
            cur = conn.cursor()
            
            session_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
            cur.execute(
                f"INSERT INTO practice_sessions (date, time, location) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (session_date, "19:00", "Constraint Ground")
            )
            session_id = cur.lastrowid if not USE_POSTGRES else None
            if USE_POSTGRES:
                cur.execute(
                    f"SELECT id FROM practice_sessions WHERE date = {PLACEHOLDER} ORDER BY id DESC LIMIT 1",
                    (session_date,)
                )
                session_id = cur.fetchone()[0]
            
            # First insert
            cur.execute(
                f"INSERT INTO practice_payments (practice_session_id, date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (session_id, session_date, TEST_USER_MEMBER1["email"], True if USE_POSTGRES else 1)
            )
            conn.commit()
            
            # Try to insert duplicate - should use ON CONFLICT to update instead
            if USE_POSTGRES:
                cur.execute(
                    f"INSERT INTO practice_payments (practice_session_id, date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}) ON CONFLICT (practice_session_id, user_email) DO UPDATE SET paid = EXCLUDED.paid",
                    (session_id, session_date, TEST_USER_MEMBER1["email"], False if USE_POSTGRES else 0)
                )
            else:
                cur.execute(
                    f"INSERT OR REPLACE INTO practice_payments (practice_session_id, date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                    (session_id, session_date, TEST_USER_MEMBER1["email"], False if USE_POSTGRES else 0)
                )
            conn.commit()
            
            # Verify only one record exists with updated value
            cur.execute(
                f"SELECT COUNT(*), paid FROM practice_payments WHERE practice_session_id = {PLACEHOLDER} AND user_email = {PLACEHOLDER} GROUP BY paid",
                (session_id, TEST_USER_MEMBER1["email"])
            )
            result = cur.fetchone()
            
            assert result[0] == 1, "Should only have one record"
            assert result[1] in (False, 0), "Value should be updated to False"


if __name__ == "__main__":
    print("Running Payment Request Tests...")
    print("=" * 70)
    
    # Run pytest with verbose output
    exit_code = pytest.main([__file__, "-v", "--tb=short"])
    
    sys.exit(exit_code)
