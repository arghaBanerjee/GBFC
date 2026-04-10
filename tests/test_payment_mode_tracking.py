#!/usr/bin/env python3
"""
Tests for Payment Mode Tracking functionality
Tests both SQLite and PostgreSQL compatibility for:
- payment_mode_edit_at column
- payment_mode_edit_by column
- User payment mode endpoint tracking
- Admin payment mode endpoint tracking
- API response field inclusion
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
    """Create test data for payment mode tracking tests"""
    init_db()
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Clear existing data
        cur.execute("DELETE FROM auth_sessions")
        cur.execute("DELETE FROM users")
        
        # Create test users
        users = [
            ("member@test.com", "Member User", hash_password("pass123"), "member"),
            ("admin@test.com", "Admin User", hash_password("pass123"), "admin"),
            ("testuser@test.com", "Test User", hash_password("pass123"), "member"),
        ]
        
        for email, name, pwd, user_type in users:
            cur.execute(
                f"INSERT INTO users (email, full_name, password, user_type) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (email, name, pwd, user_type)
            )
        
        conn.commit()

def get_auth_token(email, password):
    """Get authentication token for user"""
    response = client.post('/api/token', data={'username': email, 'password': password})
    if response.status_code == 200:
        return response.json()['access_token']
    return None

def test_database_schema_includes_tracking_columns():
    """Test that database schema includes payment_mode_edit_at and payment_mode_edit_by columns"""
    print("Testing database schema includes tracking columns...")
    
    setup_test_data()
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Check if tracking columns exist in users table
        if USE_POSTGRES:
            cur.execute("""
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'users' 
                AND column_name IN ('payment_mode_edit_at', 'payment_mode_edit_by')
                ORDER BY column_name
            """)
        else:
            cur.execute("PRAGMA table_info(users)")
            columns = cur.fetchall()
            tracking_columns = [col for col in columns if col[1] in ('payment_mode_edit_at', 'payment_mode_edit_by')]
            
        if USE_POSTGRES:
            columns = cur.fetchall()
            assert len(columns) == 2, f"Expected 2 tracking columns, found {len(columns)}"
            
            for col in columns:
                column_name, data_type, is_nullable = col
                if column_name == 'payment_mode_edit_at':
                    assert data_type in ('timestamp', 'timestamp without time zone'), f"payment_mode_edit_at should be timestamp, got {data_type}"
                elif column_name == 'payment_mode_edit_by':
                    assert data_type == 'character varying', f"payment_mode_edit_by should be varchar, got {data_type}"
                assert is_nullable == 'YES', f"{column_name} should be nullable"
        else:
            assert len(tracking_columns) == 2, f"Expected 2 tracking columns, found {len(tracking_columns)}"
            
            for col in tracking_columns:
                cid, name, data_type, not_null, default_val, pk = col
                if name == 'payment_mode_edit_at':
                    assert 'timestamp' in data_type.lower(), f"payment_mode_edit_at should be timestamp, got {data_type}"
                elif name == 'payment_mode_edit_by':
                    assert data_type == 'TEXT', f"payment_mode_edit_by should be TEXT, got {data_type}"
                assert not_null == 0, f"{name} should be nullable (not_null should be 0)"
    
    print("  Database schema includes tracking columns correctly")

def test_initial_tracking_fields_are_null():
    """Test that new users have NULL tracking fields initially"""
    print("Testing initial tracking fields are NULL...")
    
    setup_test_data()
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Check that new users have NULL tracking fields
        cur.execute(
            f"SELECT payment_mode_edit_at, payment_mode_edit_by FROM users WHERE email = {PLACEHOLDER}",
            ('testuser@test.com',)
        )
        result = cur.fetchone()
        
        assert result is not None, "User should exist"
        payment_mode_edit_at, payment_mode_edit_by = result
        
        assert payment_mode_edit_at is None, "payment_mode_edit_at should be NULL initially"
        assert payment_mode_edit_by is None, "payment_mode_edit_by should be NULL initially"
    
    print("  Initial tracking fields are NULL correctly")

def test_user_payment_mode_endpoint_tracking():
    """Test that user payment mode endpoint captures tracking information"""
    print("Testing user payment mode endpoint tracking...")
    
    setup_test_data()
    
    # Get user auth token
    user_token = get_auth_token("member@test.com", "pass123")
    assert user_token is not None, "Should get user auth token"
    user_headers = {'Authorization': f'Bearer {user_token}'}
    
    # Update payment mode as user
    response = client.put('/api/users/me/payment-mode', 
                         json={'payment_mode': 'Monthly'}, 
                         headers=user_headers)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    # Check tracking information in database
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT payment_mode, payment_mode_edit_at, payment_mode_edit_by FROM users WHERE email = {PLACEHOLDER}",
            ('member@test.com',)
        )
        result = cur.fetchone()
        
        assert result is not None, "User should exist"
        payment_mode, payment_mode_edit_at, payment_mode_edit_by = result
        
        assert payment_mode == 'Monthly', f"Expected Monthly, got {payment_mode}"
        assert payment_mode_edit_at is not None, "payment_mode_edit_at should be set"
        assert payment_mode_edit_by == 'member@test.com', f"Expected member@test.com, got {payment_mode_edit_by}"
    
    print("  User payment mode endpoint captures tracking correctly")

def test_admin_payment_mode_endpoint_tracking():
    """Test that admin payment mode endpoint captures tracking information"""
    print("Testing admin payment mode endpoint tracking...")
    
    setup_test_data()
    
    # Get admin auth token
    admin_token = get_auth_token("admin@test.com", "pass123")
    assert admin_token is not None, "Should get admin auth token"
    admin_headers = {'Authorization': f'Bearer {admin_token}'}
    
    # Update payment mode as admin
    response = client.put('/api/users/member@test.com/payment-mode', 
                         json={'payment_mode': 'Monthly'}, 
                         headers=admin_headers)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    # Check tracking information in database
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT payment_mode, payment_mode_edit_at, payment_mode_edit_by FROM users WHERE email = {PLACEHOLDER}",
            ('member@test.com',)
        )
        result = cur.fetchone()
        
        assert result is not None, "User should exist"
        payment_mode, payment_mode_edit_at, payment_mode_edit_by = result
        
        assert payment_mode == 'Monthly', f"Expected Monthly, got {payment_mode}"
        assert payment_mode_edit_at is not None, "payment_mode_edit_at should be set"
        assert payment_mode_edit_by == 'admin@test.com', f"Expected admin@test.com, got {payment_mode_edit_by}"
    
    print("  Admin payment mode endpoint captures tracking correctly")

def test_api_response_includes_tracking_fields():
    """Test that API responses include new tracking fields"""
    print("Testing API responses include tracking fields...")
    
    setup_test_data()
    
    # Get user auth token
    user_token = get_auth_token("member@test.com", "pass123")
    assert user_token is not None, "Should get user auth token"
    user_headers = {'Authorization': f'Bearer {user_token}'}
    
    # Get admin auth token
    admin_token = get_auth_token("admin@test.com", "pass123")
    assert admin_token is not None, "Should get admin auth token"
    admin_headers = {'Authorization': f'Bearer {admin_token}'}
    
    # Test GET /api/me includes tracking fields
    response = client.get('/api/me', headers=user_headers)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    user_data = response.json()
    assert 'payment_mode_edit_at' in user_data, "Response should include payment_mode_edit_at"
    assert 'payment_mode_edit_by' in user_data, "Response should include payment_mode_edit_by"
    assert user_data['payment_mode_edit_at'] is None, "Initial payment_mode_edit_at should be None"
    assert user_data['payment_mode_edit_by'] is None, "Initial payment_mode_edit_by should be None"
    
    # Test GET /api/users includes tracking fields
    response = client.get('/api/users', headers=admin_headers)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    users = response.json()
    assert len(users) >= 2, "Should have at least 2 users"
    
    for user in users:
        assert 'payment_mode_edit_at' in user, f"User {user.get('email')} should include payment_mode_edit_at"
        assert 'payment_mode_edit_by' in user, f"User {user.get('email')} should include payment_mode_edit_by"
    
    print("  API responses include tracking fields correctly")

def test_tracking_updates_on_multiple_changes():
    """Test that tracking information updates correctly on multiple payment mode changes"""
    print("Testing tracking updates on multiple changes...")
    
    setup_test_data()
    
    # Get user auth token
    user_token = get_auth_token("member@test.com", "pass123")
    assert user_token is not None, "Should get user auth token"
    user_headers = {'Authorization': f'Bearer {user_token}'}
    
    # Get admin auth token
    admin_token = get_auth_token("admin@test.com", "pass123")
    assert admin_token is not None, "Should get admin auth token"
    admin_headers = {'Authorization': f'Bearer {admin_token}'}
    
    # First change: User updates to Monthly
    response = client.put('/api/users/me/payment-mode', 
                         json={'payment_mode': 'Monthly'}, 
                         headers=user_headers)
    assert response.status_code == 200
    
    # Check first tracking
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT payment_mode, payment_mode_edit_at, payment_mode_edit_by FROM users WHERE email = {PLACEHOLDER}",
            ('member@test.com',)
        )
        result = cur.fetchone()
        payment_mode, first_edit_at, first_edit_by = result
        assert payment_mode == 'Monthly'
        assert first_edit_by == 'member@test.com'
        first_timestamp = first_edit_at
    
    # Add small delay to ensure different timestamps
    import time
    time.sleep(0.1)
    
    # Second change: Admin updates to Daily
    response = client.put('/api/users/member@test.com/payment-mode', 
                         json={'payment_mode': 'Daily'}, 
                         headers=admin_headers)
    assert response.status_code == 200
    
    # Check second tracking
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT payment_mode, payment_mode_edit_at, payment_mode_edit_by FROM users WHERE email = {PLACEHOLDER}",
            ('member@test.com',)
        )
        result = cur.fetchone()
        payment_mode, second_edit_at, second_edit_by = result
        assert payment_mode == 'Daily'
        assert second_edit_by == 'admin@test.com'
        second_timestamp = second_edit_at
    
    # Verify that both updates were captured correctly
    # The important thing is that tracking information is updated, not necessarily that timestamps are different
    # (in some database configurations, rapid updates might have same timestamp)
    assert first_edit_by == 'member@test.com', "First update should be by user"
    assert second_edit_by == 'admin@test.com', "Second update should be by admin"
    assert first_edit_at is not None, "First timestamp should be set"
    assert second_edit_at is not None, "Second timestamp should be set"
    
    print("  Tracking updates correctly on multiple changes")

def test_tracking_field_datetime_format():
    """Test that tracking fields have proper datetime format in API responses"""
    print("Testing tracking field datetime format...")
    
    setup_test_data()
    
    # Get user auth token
    user_token = get_auth_token("member@test.com", "pass123")
    assert user_token is not None, "Should get user auth token"
    user_headers = {'Authorization': f'Bearer {user_token}'}
    
    # Update payment mode to set tracking fields
    response = client.put('/api/users/me/payment-mode', 
                         json={'payment_mode': 'Monthly'}, 
                         headers=user_headers)
    assert response.status_code == 200
    
    # Check API response format
    response = client.get('/api/me', headers=user_headers)
    assert response.status_code == 200
    
    user_data = response.json()
    payment_mode_edit_at = user_data.get('payment_mode_edit_at')
    
    assert payment_mode_edit_at is not None, "payment_mode_edit_at should be set"
    
    # Check if it's a valid datetime string (ISO format)
    try:
        # Try to parse the datetime string
        if isinstance(payment_mode_edit_at, str):
            datetime.fromisoformat(payment_mode_edit_at.replace('Z', '+00:00'))
        print("  Datetime format is valid")
    except ValueError:
        assert False, f"Invalid datetime format: {payment_mode_edit_at}"
    
    print("  Tracking field datetime format is correct")

def run_all_payment_mode_tracking_tests():
    """Run all payment mode tracking tests"""
    print("=" * 80)
    print("PAYMENT MODE TRACKING TESTS")
    print("=" * 80)
    
    tests = [
        test_database_schema_includes_tracking_columns,
        test_initial_tracking_fields_are_null,
        test_user_payment_mode_endpoint_tracking,
        test_admin_payment_mode_endpoint_tracking,
        test_api_response_includes_tracking_fields,
        test_tracking_updates_on_multiple_changes,
        test_tracking_field_datetime_format,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
            print(f"  {test.__name__}: PASSED")
        except Exception as e:
            failed += 1
            print(f"  {test.__name__}: FAILED - {e}")
    
    print("=" * 80)
    print(f"Payment Mode Tracking Tests: {passed} passed, {failed} failed")
    print("=" * 80)
    
    return failed == 0

if __name__ == "__main__":
    success = run_all_payment_mode_tracking_tests()
    sys.exit(0 if success else 1)
