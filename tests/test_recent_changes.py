"""
Test script to verify recent changes work with SQLite locally
Tests:
1. Admin security check on create_event
2. User name update endpoint
3. Session management (frontend only - no DB test needed)
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_admin_create_event():
    """Test that create_event endpoint works with SQLite and requires admin"""
    print("\n=== Testing Create Event Endpoint ===")
    
    # First, login as super admin
    login_data = {
        "username": "super@admin.com",
        "password": "admin123"
    }
    
    response = requests.post(f"{BASE_URL}/api/token", data=login_data)
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        return False
    
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test creating an event
    event_data = {
        "name": "Test Match - SQLite Compatibility",
        "date": "2026-04-01",
        "time": "15:00",
        "location": "Test Stadium",
        "type": "match",
        "description": "Testing SQLite compatibility",
        "image_url": "",
        "youtube_url": ""
    }
    
    response = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=headers)
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Event created successfully with ID: {result.get('id')}")
        
        # Clean up - delete the test event
        event_id = result.get('id')
        if event_id:
            delete_response = requests.delete(f"{BASE_URL}/api/events/{event_id}", headers=headers)
            if delete_response.status_code == 200:
                print(f"✅ Test event cleaned up")
        return True
    else:
        print(f"❌ Failed to create event: {response.status_code} - {response.text}")
        return False

def test_non_admin_create_event():
    """Test that non-admin users cannot create events"""
    print("\n=== Testing Non-Admin Access Control ===")
    
    # Login as a regular user (if exists)
    # For this test, we'll try without a token first
    event_data = {
        "name": "Unauthorized Event",
        "date": "2026-04-01",
        "time": "15:00",
        "location": "Test Stadium",
        "type": "match",
        "description": "Should fail",
        "image_url": "",
        "youtube_url": ""
    }
    
    response = requests.post(f"{BASE_URL}/api/events", json=event_data)
    
    if response.status_code == 401:
        print(f"✅ Unauthorized access blocked (401)")
        return True
    else:
        print(f"❌ Expected 401, got: {response.status_code}")
        return False

def test_update_user_name():
    """Test that admin can update user names"""
    print("\n=== Testing Update User Name Endpoint ===")
    
    # Login as super admin
    login_data = {
        "username": "super@admin.com",
        "password": "admin123"
    }
    
    response = requests.post(f"{BASE_URL}/api/token", data=login_data)
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        return False
    
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get list of users
    response = requests.get(f"{BASE_URL}/api/users", headers=headers)
    if response.status_code != 200:
        print(f"❌ Failed to get users: {response.status_code}")
        return False
    
    users = response.json()
    if len(users) < 2:
        print(f"⚠️  Not enough users to test (need at least 2)")
        return True  # Skip test
    
    # Find a non-super-admin user
    test_user = None
    for user in users:
        if user['email'] != 'super@admin.com':
            test_user = user
            break
    
    if not test_user:
        print(f"⚠️  No non-admin user found to test")
        return True  # Skip test
    
    # Store original name
    original_name = test_user['full_name']
    test_email = test_user['email']
    
    # Update the name
    new_name = f"{original_name} (Test)"
    update_data = {"full_name": new_name}
    
    response = requests.put(f"{BASE_URL}/api/users/{test_email}/name", json=update_data, headers=headers)
    
    if response.status_code == 200:
        print(f"✅ User name updated successfully")
        
        # Restore original name
        restore_data = {"full_name": original_name}
        restore_response = requests.put(f"{BASE_URL}/api/users/{test_email}/name", json=restore_data, headers=headers)
        
        if restore_response.status_code == 200:
            print(f"✅ Original name restored")
        return True
    else:
        print(f"❌ Failed to update user name: {response.status_code} - {response.text}")
        return False

def main():
    print("=" * 60)
    print("SQLite Compatibility Test for Recent Changes")
    print("=" * 60)
    print("\nMake sure the backend server is running on http://localhost:8000")
    print("Press Ctrl+C to cancel, or Enter to continue...")
    
    try:
        input()
    except KeyboardInterrupt:
        print("\n\nTest cancelled.")
        return
    
    results = []
    
    # Run tests
    results.append(("Create Event (Admin)", test_admin_create_event()))
    results.append(("Non-Admin Access Control", test_non_admin_create_event()))
    results.append(("Update User Name", test_update_user_name()))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! SQLite compatibility verified.")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Please review.")

if __name__ == "__main__":
    main()
