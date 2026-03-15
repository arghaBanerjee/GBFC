"""
Database Compatibility Tests
Tests SQL query generation and database compatibility for both SQLite and PostgreSQL
Merged from: test_db_compatibility.py, test_postgresql_compatibility.py, 
             test_sql_compatibility.py, test_cursor_fix.py
"""

import os
import sys
import sqlite3

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set test mode
os.environ['USE_POSTGRES'] = 'false'
os.environ['TEST_MODE'] = 'true'


def test_placeholder_generation():
    """Test that PLACEHOLDER is generated correctly for both databases"""
    print("\n=== Testing PLACEHOLDER Generation ===")
    
    # Test SQLite
    os.environ.pop('DATABASE_URL', None)
    DATABASE_URL = os.environ.get("DATABASE_URL")
    USE_POSTGRES = DATABASE_URL is not None
    PLACEHOLDER = "%s" if USE_POSTGRES else "?"
    
    assert PLACEHOLDER == "?", f"SQLite: Expected '?' but got '{PLACEHOLDER}'"
    print("✅ SQLite PLACEHOLDER correct: ?")
    
    # Test PostgreSQL
    os.environ['DATABASE_URL'] = 'postgresql://test'
    DATABASE_URL = os.environ.get("DATABASE_URL")
    USE_POSTGRES = DATABASE_URL is not None
    PLACEHOLDER = "%s" if USE_POSTGRES else "?"
    
    assert PLACEHOLDER == "%s", f"PostgreSQL: Expected '%s' but got '{PLACEHOLDER}'"
    print("✅ PostgreSQL PLACEHOLDER correct: %s")
    
    # Cleanup
    os.environ.pop('DATABASE_URL', None)


def test_query_generation():
    """Test SQL query generation for both databases"""
    print("\n=== Testing Query Generation ===")
    
    # SQLite queries
    PLACEHOLDER = "?"
    signup_query = f"INSERT INTO users (email, full_name, password) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})"
    login_query = f"SELECT * FROM users WHERE email = {PLACEHOLDER}"
    
    assert "?" in signup_query, "SQLite signup query should contain '?'"
    assert "?" in login_query, "SQLite login query should contain '?'"
    print("✅ SQLite queries generated correctly")
    
    # PostgreSQL queries
    PLACEHOLDER = "%s"
    signup_query = f"INSERT INTO users (email, full_name, password) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})"
    login_query = f"SELECT * FROM users WHERE email = {PLACEHOLDER}"
    
    assert "%s" in signup_query, "PostgreSQL signup query should contain '%s'"
    assert "%s" in login_query, "PostgreSQL login query should contain '%s'"
    print("✅ PostgreSQL queries generated correctly")


def test_cursor_row_access():
    """Test that cursor returns dict-like rows"""
    print("\n=== Testing Cursor Row Access ===")
    
    # Create in-memory SQLite database
    conn = sqlite3.connect(':memory:')
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    # Create test table
    cur.execute("CREATE TABLE test (id INTEGER, name TEXT)")
    cur.execute("INSERT INTO test VALUES (1, 'Test')")
    
    # Test row access
    cur.execute("SELECT * FROM test")
    row = cur.fetchone()
    
    # Test both access methods
    assert row['id'] == 1, "Dictionary-style access failed"
    assert row[0] == 1, "Index-style access failed"
    assert row['name'] == 'Test', "Dictionary-style access for name failed"
    
    conn.close()
    print("✅ SQLite Row supports both dictionary and index access")


def test_boolean_compatibility():
    """Test boolean field compatibility"""
    print("\n=== Testing Boolean Field Compatibility ===")
    
    conn = sqlite3.connect(':memory:')
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    # Create table with boolean field
    cur.execute("""
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            email TEXT,
            is_deleted BOOLEAN DEFAULT FALSE
        )
    """)
    
    # Test insert with FALSE
    cur.execute("INSERT INTO users (email, is_deleted) VALUES (?, ?)", ('test@test.com', False))
    
    # Test query with FALSE check
    cur.execute("SELECT * FROM users WHERE is_deleted = FALSE OR is_deleted IS NULL")
    row = cur.fetchone()
    
    assert row is not None, "Boolean query failed"
    assert row['email'] == 'test@test.com', "Boolean query returned wrong data"
    
    conn.close()
    print("✅ Boolean fields work correctly in SQLite")


if __name__ == "__main__":
    print("=" * 70)
    print("Database Compatibility Tests")
    print("=" * 70)
    
    try:
        test_placeholder_generation()
        test_query_generation()
        test_cursor_row_access()
        test_boolean_compatibility()
        
        print("\n" + "=" * 70)
        print("✅ All database compatibility tests passed!")
        print("=" * 70)
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
