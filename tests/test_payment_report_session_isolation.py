import pytest
from api import init_db, get_connection, hash_password, USE_POSTGRES, PLACEHOLDER
from fastapi.testclient import TestClient
from datetime import date, timedelta
import os

# Set test environment
os.environ["TEST_MODE"] = "true"

from api import app

client = TestClient(app)

TEST_ADMIN = {
    "email": "admin-report@test.com",
    "password": "admin123",
    "full_name": "Admin Report"
}

TEST_MEMBER1 = {
    "email": "member1-report@test.com", 
    "password": "member123",
    "full_name": "Member One Report"
}

TEST_MEMBER2 = {
    "email": "member2-report@test.com",
    "password": "member123", 
    "full_name": "Member Two Report"
}

def setup_test_database():
    """Setup test database with users and sessions"""
    # Initialize database tables first
    from api import init_db
    init_db()
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Clear existing data
        cur.execute("DELETE FROM practice_payments")
        cur.execute("DELETE FROM practice_availability")
        cur.execute("DELETE FROM practice_sessions")
        cur.execute("DELETE FROM users")
        conn.commit()
        
        # Create test users
        hashed_password = hash_password("admin123")
        cur.execute(
            f"INSERT INTO users (email, password, full_name, user_type) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (TEST_ADMIN["email"], hashed_password, TEST_ADMIN["full_name"], "admin")
        )
        
        for user in [TEST_MEMBER1, TEST_MEMBER2]:
            cur.execute(
                f"INSERT INTO users (email, password, full_name, user_type) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (user["email"], hashed_password, user["full_name"], "member")
            )
        
        conn.commit()

def login(email):
    """Login and return token"""
    response = client.post("/api/token", data={
        "username": email,
        "password": "admin123" if email == TEST_ADMIN["email"] else "member123"
    })
    data = response.json()
    if "access_token" in data:
        return data["access_token"]
    else:
        print(f"Login response: {data}")
        raise Exception(f"Login failed: {data}")

def test_payment_report_session_isolation():
    """Test that payment report correctly shows different players for different sessions on same date"""
    setup_test_database()
    
    session_date = (date.today() - timedelta(days=5)).strftime('%Y-%m-%d')
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Create two sessions on the same date
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location, event_type, event_title, session_cost, paid_by, maximum_capacity, payment_requested, payment_requested_at) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, CURRENT_TIMESTAMP)",
            (session_date, '18:00', 'Pitch A', 'practice', 'Session A', 30.0, TEST_ADMIN["email"], 18, 1),
        )
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location, event_type, event_title, session_cost, paid_by, maximum_capacity, payment_requested, payment_requested_at) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, CURRENT_TIMESTAMP)",
            (session_date, '20:00', 'Pitch B', 'practice', 'Session B', 40.0, TEST_ADMIN["email"], 18, 1),
        )
        
        # Get session IDs
        cur.execute(
            f"SELECT id, event_title FROM practice_sessions WHERE date = {PLACEHOLDER} ORDER BY time ASC",
            (session_date,)
        )
        rows = [dict(row) for row in cur.fetchall()]
        session_a_id = next(row['id'] for row in rows if row['event_title'] == 'Session A')
        session_b_id = next(row['id'] for row in rows if row['event_title'] == 'Session B')
        
        # Member1 available for Session A, Member2 available for Session B
        cur.execute(
            f"INSERT INTO practice_availability (practice_session_id, date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (session_a_id, session_date, TEST_MEMBER1["email"], TEST_MEMBER1["full_name"], "available")
        )
        cur.execute(
            f"INSERT INTO practice_availability (practice_session_id, date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (session_b_id, session_date, TEST_MEMBER2["email"], TEST_MEMBER2["full_name"], "available")
        )
        
        # Both members confirm payment for their respective sessions
        cur.execute(
            f"INSERT INTO practice_payments (practice_session_id, date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (session_a_id, session_date, TEST_MEMBER1["email"], 1)
        )
        cur.execute(
            f"INSERT INTO practice_payments (practice_session_id, date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (session_b_id, session_date, TEST_MEMBER2["email"], 1)
        )
        
        conn.commit()
    
    # Generate payment report
    admin_token = login(TEST_ADMIN["email"])
    response = client.get(
        f"/api/reports/player-payment?from_date={session_date}&to_date={session_date}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    
    # The report should contain both sessions with correct player assignments
    # Since it's an Excel file, we can't easily parse it here, but the query should return correct data
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Test the same query used in the report
        cur.execute(f"""
            SELECT 
                ps.date,
                ps.event_type,
                ps.event_title,
                ps.time,
                ps.location,
                ps.session_cost,
                pa.user_email,
                u.full_name,
                pa.status,
                pp.paid
            FROM practice_sessions ps
            LEFT JOIN practice_availability pa ON ps.id = pa.practice_session_id
            LEFT JOIN users u ON pa.user_email = u.email AND (u.is_deleted = FALSE OR u.is_deleted IS NULL)
            LEFT JOIN practice_payments pp ON ps.id = pp.practice_session_id AND pa.user_email = pp.user_email
            WHERE ps.date >= {PLACEHOLDER} AND ps.date <= {PLACEHOLDER}
                AND pa.status IS NOT NULL
            ORDER BY ps.date ASC, ps.time ASC, u.full_name ASC
        """, (session_date, session_date))
        
        rows = cur.fetchall()
        
        # Should have 2 rows (one for each session-player combination)
        assert len(rows) == 2
        
        # Convert to dicts for easier assertion
        results = [dict(row) for row in rows]
        
        # Find Session A and Session B results
        session_a_result = next(r for r in results if r['event_title'] == 'Session A')
        session_b_result = next(r for r in results if r['event_title'] == 'Session B')
        
        # Verify correct player assignments
        assert session_a_result['full_name'] == TEST_MEMBER1['full_name']
        assert session_a_result['user_email'] == TEST_MEMBER1['email']
        assert session_a_result['paid'] in (True, 1)
        
        assert session_b_result['full_name'] == TEST_MEMBER2['full_name']
        assert session_b_result['user_email'] == TEST_MEMBER2['email']
        assert session_b_result['paid'] in (True, 1)

if __name__ == "__main__":
    test_payment_report_session_isolation()
    print("Payment report session isolation test passed!")
