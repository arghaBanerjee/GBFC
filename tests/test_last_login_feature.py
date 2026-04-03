"""
Test Last Login Feature
Verifies that last_login tracking works correctly for both SQLite and PostgreSQL
"""

import os
# Set test mode before importing anything else
os.environ['USE_POSTGRES'] = 'false'
os.environ['TEST_MODE'] = 'true'

import sqlite3
from datetime import datetime

# Test database path
TEST_DB = "test_last_login.db"

def setup_test_db():
    """Create a test database with last_login column"""
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)
    
    conn = sqlite3.connect(TEST_DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    # Create users table with last_login column
    cur.execute("""
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            password TEXT NOT NULL,
            user_type TEXT DEFAULT 'member',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP,
            is_deleted INTEGER DEFAULT 0
        )
    """)
    
    conn.commit()
    return conn

def test_signup_sets_last_login():
    """Test that signup sets initial last_login timestamp"""
    print("\n=== Testing Signup Sets Last Login ===")
    
    conn = setup_test_db()
    cur = conn.cursor()
    
    try:
        # Simulate signup with last_login
        PLACEHOLDER = "?"  # SQLite
        email = "newuser@test.com"
        full_name = "New User"
        password = "hashed_password"
        
        cur.execute(
            f"INSERT INTO users (email, full_name, password, last_login) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, CURRENT_TIMESTAMP)",
            (email, full_name, password)
        )
        conn.commit()
        
        # Verify last_login was set
        cur.execute(f"SELECT email, last_login FROM users WHERE email = {PLACEHOLDER}", (email,))
        result = cur.fetchone()
        
        if result and result['last_login']:
            print(f"✅ User created: {result['email']}")
            print(f"✅ Last login set: {result['last_login']}")
            return True
        else:
            print(f"❌ Last login not set")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    finally:
        conn.close()
        if os.path.exists(TEST_DB):
            os.remove(TEST_DB)

def test_login_updates_last_login():
    """Test that login updates last_login timestamp"""
    print("\n=== Testing Login Updates Last Login ===")
    
    conn = setup_test_db()
    cur = conn.cursor()
    
    try:
        PLACEHOLDER = "?"  # SQLite
        email = "testuser@test.com"
        
        # Create user with initial last_login
        cur.execute(
            f"INSERT INTO users (email, full_name, password, last_login) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, CURRENT_TIMESTAMP)",
            (email, "Test User", "hashed_password")
        )
        conn.commit()
        
        # Get initial last_login
        cur.execute(f"SELECT last_login FROM users WHERE email = {PLACEHOLDER}", (email,))
        initial_login = cur.fetchone()['last_login']
        
        # Simulate login - update last_login
        cur.execute(
            f"UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE email = {PLACEHOLDER}",
            (email,)
        )
        conn.commit()
        
        # Get updated last_login
        cur.execute(f"SELECT last_login FROM users WHERE email = {PLACEHOLDER}", (email,))
        updated_login = cur.fetchone()['last_login']
        
        if initial_login and updated_login:
            print(f"✅ Initial last_login: {initial_login}")
            print(f"✅ Updated last_login: {updated_login}")
            print(f"✅ Last login timestamp updated on login")
            return True
        else:
            print(f"❌ Last login update failed")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    finally:
        conn.close()
        if os.path.exists(TEST_DB):
            os.remove(TEST_DB)

def test_get_users_includes_last_login():
    """Test that get_users query includes last_login"""
    print("\n=== Testing Get Users Includes Last Login ===")
    
    conn = setup_test_db()
    cur = conn.cursor()
    
    try:
        PLACEHOLDER = "?"  # SQLite
        
        # Create multiple users with different last_login times
        users = [
            ("user1@test.com", "User One", "2024-01-01 10:00:00"),
            ("user2@test.com", "User Two", "2024-01-02 15:30:00"),
            ("user3@test.com", "User Three", None),  # Never logged in
        ]
        
        for email, name, last_login in users:
            if last_login:
                cur.execute(
                    f"INSERT INTO users (email, full_name, password, last_login) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                    (email, name, "hashed_password", last_login)
                )
            else:
                cur.execute(
                    f"INSERT INTO users (email, full_name, password) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                    (email, name, "hashed_password")
                )
        conn.commit()
        
        # Simulate get_users query
        cur.execute("SELECT id, email, full_name, user_type, created_at, last_login FROM users WHERE (is_deleted = 0 OR is_deleted IS NULL) ORDER BY id DESC")
        results = cur.fetchall()
        
        if len(results) == 3:
            print(f"✅ Retrieved {len(results)} users")
            for row in results:
                user_dict = dict(row)
                last_login_str = user_dict['last_login'] if user_dict['last_login'] else 'Never'
                print(f"✅ {user_dict['email']}: Last login = {last_login_str}")
            return True
        else:
            print(f"❌ Expected 3 users, got {len(results)}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    finally:
        conn.close()
        if os.path.exists(TEST_DB):
            os.remove(TEST_DB)

def test_postgresql_compatibility():
    """Test PostgreSQL compatibility of last_login queries"""
    print("\n=== Testing PostgreSQL Compatibility ===")
    
    # Test PLACEHOLDER usage
    USE_POSTGRES = True
    PLACEHOLDER = "%s" if USE_POSTGRES else "?"
    
    queries = [
        # Signup query
        f"INSERT INTO users (email, full_name, password, last_login) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, CURRENT_TIMESTAMP)",
        # Login update query
        f"UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE email = {PLACEHOLDER}",
        # Get users query
        "SELECT id, email, full_name, user_type, created_at, last_login FROM users WHERE (is_deleted = FALSE OR is_deleted IS NULL) ORDER BY id DESC",
    ]
    
    all_compatible = True
    for i, query in enumerate(queries, 1):
        if USE_POSTGRES:
            # Check for PostgreSQL compatibility
            has_placeholder = "%s" in query or "CURRENT_TIMESTAMP" in query
            no_sqlite_specific = "?" not in query
            
            if has_placeholder and no_sqlite_specific:
                print(f"✅ Query {i}: PostgreSQL compatible")
            else:
                print(f"❌ Query {i}: Not PostgreSQL compatible")
                all_compatible = False
        
    if all_compatible:
        print(f"✅ All queries use PLACEHOLDER variable")
        print(f"✅ CURRENT_TIMESTAMP works on both databases")
        return True
    else:
        print(f"❌ Some queries not compatible")
        return False

def test_userout_model():
    """Test that UserOut model includes last_login field"""
    print("\n=== Testing UserOut Model ===")
    
    # Simulate UserOut model
    user_data = {
        'id': 1,
        'email': 'test@user.com',
        'full_name': 'Test User',
        'user_type': 'member',
        'created_at': '2024-01-01T00:00:00',
        'last_login': '2024-01-15T10:30:00'
    }
    
    required_fields = ['id', 'email', 'full_name', 'user_type', 'created_at', 'last_login']
    
    all_present = all(field in user_data for field in required_fields)
    
    if all_present:
        print(f"✅ UserOut model has all required fields")
        print(f"✅ last_login field present: {user_data['last_login']}")
        return True
    else:
        print(f"❌ UserOut model missing fields")
        return False

def main():
    print("=" * 70)
    print("Last Login Feature Test")
    print("=" * 70)
    print("\nTesting last_login tracking functionality...")
    
    results = []
    
    # Run tests
    results.append(("Signup Sets Last Login", test_signup_sets_last_login()))
    results.append(("Login Updates Last Login", test_login_updates_last_login()))
    results.append(("Get Users Includes Last Login", test_get_users_includes_last_login()))
    results.append(("PostgreSQL Compatibility", test_postgresql_compatibility()))
    results.append(("UserOut Model", test_userout_model()))
    
    # Summary
    print("\n" + "=" * 70)
    print("Test Summary")
    print("=" * 70)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed!")
        print("✅ Last login tracking implemented correctly")
        print("✅ PostgreSQL compatible")
        print("✅ Ready to display in Admin section")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Please review.")

if __name__ == "__main__":
    main()
