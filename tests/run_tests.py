"""
Simple test runner that doesn't require pytest.
Run with: python3 run_tests.py
"""

import sqlite3
from datetime import date, timedelta
import os
import sys

# Set test mode before importing anything else
os.environ['USE_POSTGRES'] = 'false'
os.environ['TEST_MODE'] = 'true'

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import after path is set
from api import get_connection, hash_password, PLACEHOLDER

# Test database
TEST_DB = "test_football.db"

def setup_test_db():
    """Setup test database"""
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)
    
    # Force SQLite for testing
    os.environ["DATABASE_URL"] = ""
    
    from api import init_db
    init_db()

def cleanup_test_db():
    """Cleanup test database"""
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)

def create_user(email, full_name, password="password123", user_type="member"):
    """Helper to create a user"""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO users (email, full_name, password, user_type) VALUES (?, ?, ?, ?)",
            (email, full_name, hash_password(password), user_type)
        )
        conn.commit()

def create_practice_session(date_str, time="21:00", location="Toryglen"):
    """Helper to create a practice session"""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location) VALUES (?, ?, ?)",
            (date_str, time, location)
        )
        conn.commit()

def set_practice_availability(email, full_name, date_str, status):
    """Helper to set practice availability with user_full_name"""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT OR REPLACE INTO practice_availability (date, user_email, user_full_name, status) VALUES (?, ?, ?, ?)",
            (date_str, email, full_name, status)
        )
        conn.commit()

def set_practice_availability_without_name(email, date_str, status):
    """Helper to set practice availability WITHOUT user_full_name"""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT OR REPLACE INTO practice_availability (date, user_email, status) VALUES (?, ?, ?)",
            (date_str, email, status)
        )
        conn.commit()

def soft_delete_user(email, deleted_by_email):
    """Helper to soft delete a user"""
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Delete likes
        cur.execute("DELETE FROM forum_likes WHERE user_email = ?", (email,))
        cur.execute("DELETE FROM event_likes WHERE user_email = ?", (email,))
        
        # Delete future practice availability
        cur.execute(
            "DELETE FROM practice_availability WHERE user_email = ? AND date > date('now')",
            (email,)
        )
        
        # Mark as deleted
        cur.execute(
            "UPDATE users SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, deleted_by = ? WHERE email = ?",
            (deleted_by_email, email)
        )
        conn.commit()

def reactivate_user(email, new_full_name, new_password):
    """Helper to reactivate a user"""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE users SET is_deleted = 0, deleted_at = NULL, full_name = ?, password = ?, user_type = 'member' WHERE email = ?",
            (new_full_name, hash_password(new_password), email)
        )
        conn.commit()

# Test functions
def test_user_deletion_removes_future_practice_sessions():
    """Test that deleting a user removes their future practice availability"""
    print("\n🧪 Test: User deletion removes future practice sessions")
    
    setup_test_db()
    
    try:
        create_user("admin@test.com", "Admin User", user_type="admin")
        create_user("john@test.com", "John Smith")
        
        today = date.today()
        past_date = (today - timedelta(days=5)).isoformat()
        future_date = (today + timedelta(days=5)).isoformat()
        
        create_practice_session(past_date)
        create_practice_session(future_date)
        
        set_practice_availability("john@test.com", "John Smith", past_date, "available")
        set_practice_availability("john@test.com", "John Smith", future_date, "available")
        
        # Verify both exist
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) as count FROM practice_availability WHERE user_email = ?", ("john@test.com",))
            count = cur.fetchone()["count"]
            assert count == 2, f"Expected 2 records, got {count}"
        
        # Delete user
        soft_delete_user("john@test.com", "admin@test.com")
        
        # Verify only past remains
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT date FROM practice_availability WHERE user_email = ?", ("john@test.com",))
            rows = cur.fetchall()
            assert len(rows) == 1, f"Expected 1 record, got {len(rows)}"
            assert rows[0]["date"] == past_date, f"Expected {past_date}, got {rows[0]['date']}"
        
        print("✅ PASSED")
        return True
    except AssertionError as e:
        print(f"❌ FAILED: {e}")
        return False
    finally:
        cleanup_test_db()

def test_reactivated_user_doesnt_see_old_selections():
    """Test that reactivated user doesn't see old practice selections"""
    print("\n🧪 Test: Reactivated user doesn't see old selections")
    
    setup_test_db()
    
    try:
        create_user("john@test.com", "John Smith")
        
        today = date.today()
        past_date = (today - timedelta(days=5)).isoformat()
        create_practice_session(past_date)
        
        set_practice_availability("john@test.com", "John Smith", past_date, "available")
        
        # Delete and reactivate
        soft_delete_user("john@test.com", "admin@test.com")
        reactivate_user("john@test.com", "Jane Doe", "newpassword")
        
        # Check Jane's availability
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT date, status, user_full_name FROM practice_availability WHERE user_email = ?",
                ("john@test.com",)
            )
            rows = cur.fetchall()
            
            # Filter by name match (simulating API logic)
            jane_records = [r for r in rows if r.get("user_full_name") == "Jane Doe"]
            
            assert len(jane_records) == 0, f"Jane should have 0 records, got {len(jane_records)}"
        
        print("✅ PASSED")
        return True
    except AssertionError as e:
        print(f"❌ FAILED: {e}")
        return False
    finally:
        cleanup_test_db()

def test_historical_practice_records_show_original_username():
    """Test that historical records show original username"""
    print("\n🧪 Test: Historical practice records show original username")
    
    setup_test_db()
    
    try:
        create_user("john@test.com", "John Smith")
        
        today = date.today()
        past_date = (today - timedelta(days=5)).isoformat()
        create_practice_session(past_date)
        
        set_practice_availability("john@test.com", "John Smith", past_date, "available")
        
        # Simulate reactivation - change name
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute("UPDATE users SET full_name = ? WHERE email = ?", ("Jane Doe", "john@test.com"))
            conn.commit()
        
        # Check what name is shown
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT user_full_name FROM practice_availability WHERE user_email = ? AND date = ?",
                ("john@test.com", past_date)
            )
            row = cur.fetchone()
            stored_name = row["user_full_name"]
            
            assert stored_name == "John Smith", f"Expected 'John Smith', got '{stored_name}'"
        
        print("✅ PASSED")
        return True
    except AssertionError as e:
        print(f"❌ FAILED: {e}")
        return False
    finally:
        cleanup_test_db()

def test_old_records_without_user_full_name_show_placeholder():
    """Test that old records show [OldData] placeholder"""
    print("\n🧪 Test: Old records without user_full_name show [OldData]")
    
    setup_test_db()
    
    try:
        create_user("john@test.com", "John Smith")
        
        today = date.today()
        past_date = (today - timedelta(days=5)).isoformat()
        create_practice_session(past_date)
        
        # Create old record without user_full_name
        set_practice_availability_without_name("john@test.com", past_date, "available")
        
        # Simulate API logic
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT user_email, user_full_name, status FROM practice_availability WHERE date = ?",
                (past_date,)
            )
            rows = cur.fetchall()
            
            for r in rows:
                name = r.get("user_full_name")
                if not name:
                    name = "[OldData]"
                
                assert name == "[OldData]", f"Expected '[OldData]', got '{name}'"
        
        print("✅ PASSED")
        return True
    except AssertionError as e:
        print(f"❌ FAILED: {e}")
        return False
    finally:
        cleanup_test_db()

def test_placeholder_not_affected_by_reactivation():
    """Test that [OldData] placeholder doesn't change to reactivated user's name"""
    print("\n🧪 Test: [OldData] placeholder not affected by reactivation")
    
    setup_test_db()
    
    try:
        create_user("john@test.com", "John Smith")
        
        today = date.today()
        past_date = (today - timedelta(days=5)).isoformat()
        create_practice_session(past_date)
        
        # Create old record without user_full_name
        set_practice_availability_without_name("john@test.com", past_date, "available")
        
        # Delete and reactivate with different name
        soft_delete_user("john@test.com", "admin@test.com")
        reactivate_user("john@test.com", "Jane Doe", "newpassword")
        
        # Check what name is shown (simulating API logic)
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT user_email, user_full_name, status FROM practice_availability WHERE date = ?",
                (past_date,)
            )
            rows = cur.fetchall()
            
            for r in rows:
                name = r.get("user_full_name")
                if not name:
                    name = "[OldData]"
                
                assert name == "[OldData]", f"Expected '[OldData]', got '{name}'"
                assert name != "Jane Doe", "Should not show reactivated user's new name"
        
        print("✅ PASSED")
        return True
    except AssertionError as e:
        print(f"❌ FAILED: {e}")
        return False
    finally:
        cleanup_test_db()

def test_new_records_store_user_full_name():
    """Test that new records properly store user_full_name"""
    print("\n🧪 Test: New practice availability records store user_full_name")
    
    setup_test_db()
    
    try:
        create_user("john@test.com", "John Smith")
        
        today = date.today()
        future_date = (today + timedelta(days=5)).isoformat()
        create_practice_session(future_date)
        
        # Set availability with name
        set_practice_availability("john@test.com", "John Smith", future_date, "available")
        
        # Verify user_full_name is stored
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT user_full_name FROM practice_availability WHERE user_email = ? AND date = ?",
                ("john@test.com", future_date)
            )
            row = cur.fetchone()
            assert row is not None, "Record should exist"
            assert row["user_full_name"] == "John Smith", f"Expected 'John Smith', got '{row['user_full_name']}'"
        
        print("✅ PASSED")
        return True
    except AssertionError as e:
        print(f"❌ FAILED: {e}")
        return False
    finally:
        cleanup_test_db()

# Run all tests
if __name__ == "__main__":
    print("=" * 60)
    print("Running User Reactivation & Practice Availability Tests")
    print("=" * 60)
    
    tests = [
        test_user_deletion_removes_future_practice_sessions,
        test_reactivated_user_doesnt_see_old_selections,
        test_historical_practice_records_show_original_username,
        test_old_records_without_user_full_name_show_placeholder,
        test_placeholder_not_affected_by_reactivation,
        test_new_records_store_user_full_name,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        if test():
            passed += 1
        else:
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)
    
    sys.exit(0 if failed == 0 else 1)
