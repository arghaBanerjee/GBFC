#!/usr/bin/env python3
"""
Tests for World Cup Predictions with Extra Time and Penalty Shootout
"""

import os
import sys
from datetime import datetime, timezone

# Set test mode before importing anything else
os.environ['USE_POSTGRES'] = 'false'
os.environ['TEST_MODE'] = 'true'

# Add parent directory to path to import api modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api import app, get_connection, PLACEHOLDER, hash_password, init_db, _wc_points
from fastapi.testclient import TestClient

client = TestClient(app)

ADMIN_EMAIL = "wc_admin@test.com"
ADMIN_PASSWORD = "adminpassword"
USER_EMAIL = "wc_user@test.com"
USER_PASSWORD = "userpassword"

def setup_test_data():
    """Initialize DB and seed test user and admin"""
    init_db()
    with get_connection() as conn:
        cur = conn.cursor()
        
        # Clean up
        cur.execute("DELETE FROM users WHERE email IN (?, ?)", (ADMIN_EMAIL, USER_EMAIL))
        cur.execute("DELETE FROM world_cup_predictions")
        cur.execute("DELETE FROM world_cup_results")
        cur.execute("DELETE FROM practice_sessions WHERE description = ?", ("2026 FIFA World Cup Match",))
        
        # Create users
        cur.execute(
            "INSERT INTO users (email, password, user_type, full_name) VALUES (?, ?, ?, ?)",
            (ADMIN_EMAIL, hash_password(ADMIN_PASSWORD), "admin", "WC Admin")
        )
        cur.execute(
            "INSERT INTO users (email, password, user_type, full_name) VALUES (?, ?, ?, ?)",
            (USER_EMAIL, hash_password(USER_PASSWORD), "member", "WC User")
        )
        
        # Ensure stage lock is unlocked for 'round_of_16'
        cur.execute("INSERT OR REPLACE INTO world_cup_stage_locks (stage, unlocked) VALUES (?, ?)", ("round_of_16", 1))
        
        # Seed a test knockout match (Round of 16)
        # We set date in the future so prediction window is open
        future_date = "2026-07-06"
        cur.execute("""
            INSERT INTO practice_sessions 
            (date, time, location, event_type, event_title, description, maximum_capacity, session_cost, cost_type, paid_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (future_date, "18:00", "Munich", "others", "Germany vs Spain", "2026 FIFA World Cup Match", 0, None, "Total", None))
        
        conn.commit()

def get_tokens():
    """Helper to authenticate and retrieve access tokens"""
    admin_res = client.post("/api/token", data={"username": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    user_res = client.post("/api/token", data={"username": USER_EMAIL, "password": USER_PASSWORD})
    return admin_res.json()["access_token"], user_res.json()["access_token"]

def test_world_cup_predictions_flow():
    print("=" * 60)
    print("RUNNING WORLD CUP PREDICTIONS & SCORING TESTS")
    print("=" * 60)

    setup_test_data()
    admin_token, user_token = get_tokens()
    
    # Retrieve match ID
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM practice_sessions WHERE description = ?", ("2026 FIFA World Cup Match",))
        match_id = cur.fetchone()[0]
    
    user_headers = {"Authorization": f"Bearer {user_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Test unit scoring function _wc_points directly
    print("\n1. Testing points scoring function _wc_points...")
    
    # Scenario A: Win in 90m (Prediction: 2-1, Actual: 2-1)
    pts = _wc_points(2, 1, None, None, None, None, 2, 1, None, None, None, None, 2)
    assert pts == 60, f"Expected 60 (30 * 2), got {pts}"
    print("   ✅ Scenario A (Win 90m, exact) passed.")
    
    # Scenario B: Win in 90m (Prediction: 1-0, Actual: 2-0, multiplier 1)
    pts = _wc_points(1, 0, None, None, None, None, 2, 0, None, None, None, None, 1)
    assert pts == 20, f"Expected 20 (10 winner + 10 home goals), got {pts}"
    print("   ✅ Scenario B (Win 90m, outcome + partial) passed.")
    
    # Scenario C: Draw in 90m, goes to ET, ends in ET (Prediction: 1-1, ET 2-1; Actual: 1-1, ET 2-1)
    # 90m: pred 1-1, actual 1-1 (10 winner + 20 exact = 30)
    # ET: pred 2-1, actual 2-1 (10 winner + 15 exact = 25)
    # Total = (30 + 25) * multiplier = 55 * 2 = 110
    pts = _wc_points(1, 1, 2, 1, None, None, 1, 1, 2, 1, None, None, 2)
    assert pts == 110, f"Expected 110, got {pts}"
    print("   ✅ Scenario C (ET end, exact) passed.")
    
    # Scenario D: Draw in 90m, ET, Penalties (Prediction: 1-1, ET 2-2, Pens 4-3; Actual: 1-1, ET 2-2, Pens 4-3)
    # 90m: 1-1 vs 1-1 (30 pts)
    # ET: 2-2 vs 2-2 (10 winner + 15 exact = 25 pts)
    # Pens: 4-3 vs 4-3 (10 winner + 10 exact = 20 pts)
    # Total = (30 + 25 + 20) * 1 = 75
    pts = _wc_points(1, 1, 2, 2, 4, 3, 1, 1, 2, 2, 4, 3, 1)
    assert pts == 75, f"Expected 75, got {pts}"
    print("   ✅ Scenario D (Pens end, exact) passed.")

    # 2. Test predict endpoint validations
    print("\n2. Testing /api/worldcup/predict validations...")
    
    # Validation A: Draw in penalties prediction should fail
    res = client.post("/api/worldcup/predict", json={
        "match_id": match_id,
        "home_goals": 1,
        "away_goals": 1,
        "home_goals_et": 2,
        "away_goals_et": 2,
        "home_pens": 4,
        "away_pens": 4
    }, headers=user_headers)
    assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
    assert "shootout" in res.json()["detail"].lower(), f"Unexpected error detail: {res.text}"
    print("   ✅ Validation A (shootout draw prediction block) passed.")

    # Validation B: Saving a valid ET and shootout prediction
    res = client.post("/api/worldcup/predict", json={
        "match_id": match_id,
        "home_goals": 1,
        "away_goals": 1,
        "home_goals_et": 2,
        "away_goals_et": 2,
        "home_pens": 4,
        "away_pens": 3
    }, headers=user_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    print("   ✅ Validation B (valid prediction save) passed.")

    # Verify stored values in db
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM world_cup_predictions WHERE match_id = ?", (match_id,))
        pred = dict(cur.fetchone())
        assert pred["predicted_home_goals"] == 1
        assert pred["predicted_away_goals"] == 1
        assert pred["predicted_home_goals_et"] == 2
        assert pred["predicted_away_goals_et"] == 2
        assert pred["predicted_home_pens"] == 4
        assert pred["predicted_away_pens"] == 3
    print("   ✅ Stored prediction values verified.")

    # Validation C: Clears downstream values when user shifts from draw to direct win
    res = client.post("/api/worldcup/predict", json={
        "match_id": match_id,
        "home_goals": 2,
        "away_goals": 1,
        "home_goals_et": 2,
        "away_goals_et": 2,
        "home_pens": 4,
        "away_pens": 3
    }, headers=user_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM world_cup_predictions WHERE match_id = ?", (match_id,))
        pred = dict(cur.fetchone())
        assert pred["predicted_home_goals"] == 2
        assert pred["predicted_away_goals"] == 1
        assert pred["predicted_home_goals_et"] is None
        assert pred["predicted_away_goals_et"] is None
        assert pred["predicted_home_pens"] is None
        assert pred["predicted_away_pens"] is None
    print("   ✅ Validation C (downstream clearing on win prediction) passed.")

    # 3. Test entering results and points calculation
    print("\n3. Testing /api/worldcup/results/{match_id} and points recalculation...")
    
    # Reset prediction to 1-1, 2-2, 4-3
    client.post("/api/worldcup/predict", json={
        "match_id": match_id,
        "home_goals": 1,
        "away_goals": 1,
        "home_goals_et": 2,
        "away_goals_et": 2,
        "home_pens": 4,
        "away_pens": 3
    }, headers=user_headers)

    # Admin posts shootout result 1-1, 2-2, 4-3
    res = client.post(f"/api/worldcup/results/{match_id}", json={
        "home_goals": 1,
        "away_goals": 1,
        "home_goals_et": 2,
        "away_goals_et": 2,
        "home_pens": 4,
        "away_pens": 3
    }, headers=admin_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    
    # User should get:
    # 90m: 1-1 vs 1-1 (30 pts)
    # ET: 2-2 vs 2-2 (25 pts)
    # Pens: 4-3 vs 4-3 (20 pts)
    # Total = (30 + 25 + 20) * multiplier (since round_of_16 multiplier is 3, total = 225)
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT points_awarded FROM world_cup_predictions WHERE match_id = ? AND user_email = ?", (match_id, USER_EMAIL))
        pts_awarded = cur.fetchone()[0]
        assert pts_awarded == 225, f"Expected 225 points, got {pts_awarded}"
    print("   ✅ Full exact match (Pens win) points verified (225 pts).")

    # Admin posts ET end result 1-1, 2-1 (no pens)
    res = client.post(f"/api/worldcup/results/{match_id}", json={
        "home_goals": 1,
        "away_goals": 1,
        "home_goals_et": 2,
        "away_goals_et": 1
    }, headers=admin_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"

    # User prediction is: 1-1, 2-2, 4-3
    # User gets:
    # 90m: 1-1 vs 1-1 (30 pts)
    # ET: 2-2 vs 2-1 -> outcome wrong (draw vs home win), but predicted home goals (2) matches actual (2) (+5 pts). ET pts = 5.
    # Pens: actual did not go to pens, so 0 pts.
    # Total = (30 + 5 + 0) * 3 = 105 pts
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT points_awarded FROM world_cup_predictions WHERE match_id = ? AND user_email = ?", (match_id, USER_EMAIL))
        pts_awarded = cur.fetchone()[0]
        assert pts_awarded == 105, f"Expected 105 points, got {pts_awarded}"
    print("   ✅ ET win points verified (105 pts).")

    print("\n✅ ALL TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    try:
        test_world_cup_predictions_flow()
    except Exception as e:
        print(f"❌ TEST RUN FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
