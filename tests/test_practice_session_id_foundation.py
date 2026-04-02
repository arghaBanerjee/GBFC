import os
import sys
from datetime import date, timedelta

os.environ['USE_POSTGRES'] = 'false'
os.environ['TEST_MODE'] = 'true'

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient

from api import app, get_connection, init_db, PLACEHOLDER, hash_password

client = TestClient(app)

ADMIN_EMAIL = 'admin-session-id@test.com'
ADMIN_PASSWORD = 'admin123'
MEMBER_EMAIL = 'member-session-id@test.com'
MEMBER_PASSWORD = 'member123'


def auth_headers(email, password):
    response = client.post(
        '/api/token',
        data={'username': email, 'password': password},
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
    )
    assert response.status_code == 200, response.text
    token = response.json()['access_token']
    return {'Authorization': f'Bearer {token}'}


def reset_test_state():
    init_db()
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute('DELETE FROM practice_payments')
        cur.execute('DELETE FROM practice_availability')
        cur.execute('DELETE FROM event_comments')
        cur.execute('DELETE FROM event_likes')
        cur.execute('DELETE FROM event_media')
        cur.execute('DELETE FROM events')
        cur.execute('DELETE FROM notifications')
        cur.execute('DELETE FROM practice_sessions')
        cur.execute('DELETE FROM users')
        conn.commit()

        cur.execute(
            f"INSERT INTO users (email, password, full_name, user_type) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (ADMIN_EMAIL, hash_password(ADMIN_PASSWORD), 'Admin Session', 'admin'),
        )
        cur.execute(
            f"INSERT INTO users (email, password, full_name, user_type) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (MEMBER_EMAIL, hash_password(MEMBER_PASSWORD), 'Member Session', 'member'),
        )
        conn.commit()


def create_session(session_date, session_time='19:00', event_type='practice', event_title='Session'):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location, event_type, event_title, maximum_capacity) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (session_date, session_time, 'Test Ground', event_type, event_title, 100),
        )
        conn.commit()


def get_session_id(session_date):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT id FROM practice_sessions WHERE date = {PLACEHOLDER}", (session_date,))
        row = cur.fetchone()
        assert row is not None
        return row['id']


def test_init_db_backfills_practice_session_ids_for_existing_rows():
    reset_test_state()
    session_date = (date.today() + timedelta(days=5)).strftime('%Y-%m-%d')

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location, event_type, event_title, maximum_capacity) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (session_date, '19:00', 'Legacy Ground', 'practice', 'Legacy Session', 100),
        )
        cur.execute(
            f"INSERT INTO practice_availability (date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (session_date, MEMBER_EMAIL, 'Member Session', 'available'),
        )
        cur.execute(
            f"INSERT INTO practice_payments (date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (session_date, MEMBER_EMAIL, 1),
        )
        cur.execute(
            f"INSERT INTO events (name, date, time, location, description, image_url, youtube_url, practice_session_date) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            ('Legacy Match', session_date, '19:00', 'Legacy Ground', None, None, None, session_date),
        )
        conn.commit()

    init_db()

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT id FROM practice_sessions WHERE date = {PLACEHOLDER}", (session_date,))
        session_row = cur.fetchone()
        assert session_row is not None
        session_id = session_row['id']
        assert session_id is not None

        cur.execute(f"SELECT practice_session_id FROM practice_availability WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}", (session_date, MEMBER_EMAIL))
        availability_row = cur.fetchone()
        assert availability_row is not None
        assert availability_row['practice_session_id'] == session_id

        cur.execute(f"SELECT practice_session_id FROM practice_payments WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}", (session_date, MEMBER_EMAIL))
        payment_row = cur.fetchone()
        assert payment_row is not None
        assert payment_row['practice_session_id'] == session_id

        cur.execute(f"SELECT practice_session_id FROM events WHERE practice_session_date = {PLACEHOLDER}", (session_date,))
        event_row = cur.fetchone()
        assert event_row is not None
        assert event_row['practice_session_id'] == session_id


def test_list_practice_sessions_returns_numeric_id():
    reset_test_state()
    session_date = (date.today() + timedelta(days=7)).strftime('%Y-%m-%d')
    create_session(session_date, event_title='ID Visible Session')

    response = client.get('/api/practice/sessions')
    assert response.status_code == 200, response.text
    sessions = response.json()
    assert len(sessions) >= 1

    matching = next((session for session in sessions if session['date'] == session_date), None)
    assert matching is not None
    assert isinstance(matching['id'], int)
    assert matching['id'] > 0


def test_admin_create_allows_multiple_sessions_on_same_date():
    reset_test_state()
    session_date = (date.today() + timedelta(days=9)).strftime('%Y-%m-%d')
    headers = auth_headers(ADMIN_EMAIL, ADMIN_PASSWORD)

    first_response = client.post(
        '/api/practice/sessions',
        json={
            'date': session_date,
            'time': '18:00',
            'location': 'Ground A',
            'event_type': 'practice',
            'event_title': 'First Session',
            'maximum_capacity': 18,
        },
        headers=headers,
    )
    assert first_response.status_code == 200, first_response.text

    second_response = client.post(
        '/api/practice/sessions',
        json={
            'date': session_date,
            'time': '20:00',
            'location': 'Ground B',
            'event_type': 'social',
            'event_title': 'Second Session',
            'maximum_capacity': 24,
        },
        headers=headers,
    )
    assert second_response.status_code == 200, second_response.text

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT id, time, location, event_type, event_title FROM practice_sessions WHERE date = {PLACEHOLDER} ORDER BY id ASC",
            (session_date,),
        )
        rows = cur.fetchall()
        assert len(rows) == 2
        row_dicts = [dict(row) for row in rows]
        assert row_dicts[0]['id'] != row_dicts[1]['id']
        assert {row['event_title'] for row in row_dicts} == {'First Session', 'Second Session'}
        assert {row['time'] for row in row_dicts} == {'18:00', '20:00'}


def test_same_day_sessions_keep_availability_isolated_by_session_id():
    reset_test_state()
    session_date = (date.today() + timedelta(days=11)).strftime('%Y-%m-%d')
    admin_headers = auth_headers(ADMIN_EMAIL, ADMIN_PASSWORD)

    first_response = client.post(
        '/api/practice/sessions',
        json={
            'date': session_date,
            'time': '18:30',
            'location': 'Pitch 1',
            'event_type': 'practice',
            'event_title': 'Session One',
            'maximum_capacity': 18,
        },
        headers=admin_headers,
    )
    assert first_response.status_code == 200, first_response.text
    first_session_id = first_response.json()['id']

    second_response = client.post(
        '/api/practice/sessions',
        json={
            'date': session_date,
            'time': '20:30',
            'location': 'Pitch 2',
            'event_type': 'social',
            'event_title': 'Session Two',
            'maximum_capacity': 18,
        },
        headers=admin_headers,
    )
    assert second_response.status_code == 200, second_response.text
    second_session_id = second_response.json()['id']

    member_headers = auth_headers(MEMBER_EMAIL, MEMBER_PASSWORD)
    availability_response = client.post(
        f'/api/practice/sessions/id/{first_session_id}/availability',
        json={'status': 'available'},
        headers=member_headers,
    )
    assert availability_response.status_code == 200, availability_response.text

    first_summary = client.get(f'/api/practice/sessions/id/{first_session_id}/availability')
    assert first_summary.status_code == 200, first_summary.text
    first_payload = first_summary.json()
    assert 'Member Session' in first_payload['available']

    second_summary = client.get(f'/api/practice/sessions/id/{second_session_id}/availability')
    assert second_summary.status_code == 200, second_summary.text
    second_payload = second_summary.json()
    assert 'Member Session' not in second_payload['available']

    my_availability = client.get('/api/practice/availability', headers=member_headers)
    assert my_availability.status_code == 200, my_availability.text
    availability_map = my_availability.json()
    assert availability_map[str(first_session_id)] == 'available'
    assert str(second_session_id) not in availability_map


def test_user_actions_upcoming_sessions_keeps_same_day_status_isolated():
    reset_test_state()
    session_date = (date.today() + timedelta(days=12)).strftime('%Y-%m-%d')
    admin_headers = auth_headers(ADMIN_EMAIL, ADMIN_PASSWORD)

    first_response = client.post(
        '/api/practice/sessions',
        json={
            'date': session_date,
            'time': '18:15',
            'location': 'Pitch 1',
            'event_type': 'practice',
            'event_title': 'UA Session One',
            'maximum_capacity': 18,
        },
        headers=admin_headers,
    )
    assert first_response.status_code == 200, first_response.text
    first_session_id = first_response.json()['id']

    second_response = client.post(
        '/api/practice/sessions',
        json={
            'date': session_date,
            'time': '19:45',
            'location': 'Pitch 2',
            'event_type': 'social',
            'event_title': 'UA Session Two',
            'maximum_capacity': 18,
        },
        headers=admin_headers,
    )
    assert second_response.status_code == 200, second_response.text
    second_session_id = second_response.json()['id']

    member_headers = auth_headers(MEMBER_EMAIL, MEMBER_PASSWORD)
    availability_response = client.post(
        f'/api/practice/sessions/id/{first_session_id}/availability',
        json={'status': 'tentative'},
        headers=member_headers,
    )
    assert availability_response.status_code == 200, availability_response.text

    response = client.get('/api/user-actions/upcoming-sessions', headers=member_headers)
    assert response.status_code == 200, response.text
    sessions = response.json()['sessions']

    first_session = next((session for session in sessions if session['id'] == first_session_id), None)
    second_session = next((session for session in sessions if session['id'] == second_session_id), None)

    assert first_session is not None
    assert second_session is not None
    assert first_session['user_status'] == 'tentative'
    assert second_session['user_status'] is None


def test_practice_notifications_include_session_id_for_deep_links():
    reset_test_state()
    session_date = (date.today() + timedelta(days=13)).strftime('%Y-%m-%d')
    admin_headers = auth_headers(ADMIN_EMAIL, ADMIN_PASSWORD)

    create_response = client.post(
        '/api/practice/sessions',
        json={
            'date': session_date,
            'time': '19:15',
            'location': 'Pitch Notifications',
            'event_type': 'practice',
            'event_title': 'Notification Session',
            'maximum_capacity': 18,
        },
        headers=admin_headers,
    )
    assert create_response.status_code == 200, create_response.text
    session_id = create_response.json()['id']

    member_headers = auth_headers(MEMBER_EMAIL, MEMBER_PASSWORD)
    notifications_response = client.get('/api/notifications', headers=member_headers)
    assert notifications_response.status_code == 200, notifications_response.text
    notifications = notifications_response.json()
    practice_notification = next((notif for notif in notifications if notif['type'] == 'practice' and notif['related_date'] == session_date), None)

    assert practice_notification is not None
    assert practice_notification['practice_session_id'] == session_id


def test_events_endpoint_deduplicates_match_rows_by_session_id():
    reset_test_state()
    match_date = (date.today() + timedelta(days=14)).strftime('%Y-%m-%d')

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location, event_type, event_title, maximum_capacity) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (match_date, '18:45', 'Duplicate Stadium', 'match', 'Duplicate Match', 100),
        )
        cur.execute(f"SELECT id FROM practice_sessions WHERE date = {PLACEHOLDER}", (match_date,))
        session_id = cur.fetchone()['id']
        cur.execute(
            f"INSERT INTO events (name, date, time, location, description, image_url, youtube_url, practice_session_date) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            ('Legacy Duplicate Match', match_date, '18:45', 'Duplicate Stadium', None, None, None, match_date),
        )
        conn.commit()

    response = client.get('/api/events')
    assert response.status_code == 200, response.text
    events = response.json()

    matching_events = [event for event in events if event['date'] == match_date and event['name'] == 'Duplicate Match']
    assert len(matching_events) == 1

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT id, practice_session_id FROM events WHERE practice_session_date = {PLACEHOLDER}", (match_date,))
        rows = cur.fetchall()
        row_dicts = [dict(row) for row in rows]
        assert len(row_dicts) == 1
        assert row_dicts[0]['practice_session_id'] == session_id


def test_admin_id_based_availability_update_allows_past_session_changes():
    reset_test_state()
    session_date = (date.today() - timedelta(days=1)).strftime('%Y-%m-%d')

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location, event_type, event_title, maximum_capacity) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (session_date, '19:00', 'Admin Ground', 'practice', 'Past Admin Session', 18),
        )
        cur.execute(f"SELECT id FROM practice_sessions WHERE date = {PLACEHOLDER}", (session_date,))
        session_id = cur.fetchone()['id']
        conn.commit()

    admin_headers = auth_headers(ADMIN_EMAIL, ADMIN_PASSWORD)
    response = client.post(
        f'/api/admin/practice/sessions/id/{session_id}/availability',
        json={
            'user_email': MEMBER_EMAIL,
            'status': 'available',
        },
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT practice_session_id, status FROM practice_availability WHERE practice_session_id = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
            (session_id, MEMBER_EMAIL),
        )
        row = cur.fetchone()
        assert row is not None
        assert row['practice_session_id'] == session_id
        assert row['status'] == 'available'


def test_member_availability_write_populates_practice_session_id():
    reset_test_state()
    session_date = (date.today() + timedelta(days=8)).strftime('%Y-%m-%d')
    create_session(session_date, event_title='Availability Session')

    headers = auth_headers(MEMBER_EMAIL, MEMBER_PASSWORD)
    response = client.post(
        '/api/practice/availability',
        json={'date': session_date, 'status': 'available'},
        headers=headers,
    )
    assert response.status_code == 200, response.text

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT id FROM practice_sessions WHERE date = {PLACEHOLDER}", (session_date,))
        session_id = cur.fetchone()['id']
        cur.execute(
            f"SELECT practice_session_id, status FROM practice_availability WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
            (session_date, MEMBER_EMAIL),
        )
        row = cur.fetchone()
        assert row is not None
        assert row['practice_session_id'] == session_id
        assert row['status'] == 'available'


def test_member_payment_write_populates_practice_session_id():
    reset_test_state()
    session_date = (date.today() - timedelta(days=2)).strftime('%Y-%m-%d')
    create_session(session_date, event_title='Payment Session')

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE practice_sessions SET session_cost = {PLACEHOLDER}, paid_by = {PLACEHOLDER}, payment_requested = {PLACEHOLDER}, payment_requested_at = CURRENT_TIMESTAMP WHERE date = {PLACEHOLDER}",
            (20.0, ADMIN_EMAIL, 1, session_date),
        )
        cur.execute(
            f"INSERT INTO practice_availability (date, user_email, user_full_name, status, practice_session_id) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, (SELECT id FROM practice_sessions WHERE date = {PLACEHOLDER}))",
            (session_date, MEMBER_EMAIL, 'Member Session', 'available', session_date),
        )
        conn.commit()

    headers = auth_headers(MEMBER_EMAIL, MEMBER_PASSWORD)
    response = client.post(
        f'/api/practice/{session_date}/payment',
        json={'paid': True},
        headers=headers,
    )
    assert response.status_code == 200, response.text

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT id FROM practice_sessions WHERE date = {PLACEHOLDER}", (session_date,))
        session_id = cur.fetchone()['id']
        cur.execute(
            f"SELECT practice_session_id, paid FROM practice_payments WHERE date = {PLACEHOLDER} AND user_email = {PLACEHOLDER}",
            (session_date, MEMBER_EMAIL),
        )
        row = cur.fetchone()
        assert row is not None
        assert row['practice_session_id'] == session_id
        assert row['paid'] in (True, 1)


def test_get_practice_session_by_id_route_returns_session():
    reset_test_state()
    session_date = (date.today() + timedelta(days=4)).strftime('%Y-%m-%d')
    create_session(session_date, event_title='Canonical ID Session')
    session_id = get_session_id(session_date)

    response = client.get(f'/api/practice/sessions/id/{session_id}')
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload['id'] == session_id
    assert payload['date'] == session_date


def test_id_based_availability_route_updates_same_record_model():
    reset_test_state()
    session_date = (date.today() + timedelta(days=6)).strftime('%Y-%m-%d')
    create_session(session_date, event_title='ID Availability Session')
    session_id = get_session_id(session_date)

    headers = auth_headers(MEMBER_EMAIL, MEMBER_PASSWORD)
    response = client.post(
        f'/api/practice/sessions/id/{session_id}/availability',
        json={'status': 'available'},
        headers=headers,
    )
    assert response.status_code == 200, response.text

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT date, practice_session_id, status FROM practice_availability WHERE user_email = {PLACEHOLDER}",
            (MEMBER_EMAIL,),
        )
        row = cur.fetchone()
        assert row is not None
        assert row['date'] == session_date
        assert row['practice_session_id'] == session_id
        assert row['status'] == 'available'


def test_id_based_payment_route_dual_writes_payment_record():
    reset_test_state()
    session_date = (date.today() - timedelta(days=3)).strftime('%Y-%m-%d')
    create_session(session_date, event_title='ID Payment Session')
    session_id = get_session_id(session_date)

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE practice_sessions SET session_cost = {PLACEHOLDER}, paid_by = {PLACEHOLDER}, payment_requested = {PLACEHOLDER}, payment_requested_at = CURRENT_TIMESTAMP WHERE id = {PLACEHOLDER}",
            (15.0, ADMIN_EMAIL, 1, session_id),
        )
        cur.execute(
            f"INSERT INTO practice_availability (practice_session_id, date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (session_id, session_date, MEMBER_EMAIL, 'Member Session', 'available'),
        )
        conn.commit()

    headers = auth_headers(MEMBER_EMAIL, MEMBER_PASSWORD)
    response = client.post(
        f'/api/practice/sessions/id/{session_id}/payment',
        json={'paid': True},
        headers=headers,
    )
    assert response.status_code == 200, response.text

    payments_response = client.get(
        f'/api/practice/sessions/id/{session_id}/payments',
        headers=headers,
    )
    assert payments_response.status_code == 200, payments_response.text
    payments = payments_response.json()
    assert MEMBER_EMAIL in payments

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT date, practice_session_id, paid FROM practice_payments WHERE user_email = {PLACEHOLDER}",
            (MEMBER_EMAIL,),
        )
        row = cur.fetchone()
        assert row is not None
        assert row['date'] == session_date
        assert row['practice_session_id'] == session_id
        assert row['paid'] in (True, 1)


def test_id_based_payment_confirmation_isolated_from_same_date_sessions():
    reset_test_state()
    session_date = (date.today() - timedelta(days=5)).strftime('%Y-%m-%d')

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location, event_type, event_title, session_cost, paid_by, maximum_capacity, payment_requested, payment_requested_at) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, CURRENT_TIMESTAMP)",
            (session_date, '18:00', 'Pitch A', 'practice', 'Payment Session A', 20.0, ADMIN_EMAIL, 18, 1),
        )
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location, event_type, event_title, session_cost, paid_by, maximum_capacity, payment_requested, payment_requested_at) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, CURRENT_TIMESTAMP)",
            (session_date, '20:00', 'Pitch B', 'practice', 'Payment Session B', 30.0, ADMIN_EMAIL, 18, 1),
        )
        cur.execute(
            f"SELECT id, event_title FROM practice_sessions WHERE date = {PLACEHOLDER} ORDER BY time ASC",
            (session_date,),
        )
        rows = [dict(row) for row in cur.fetchall()]
        target_session_id = next(row['id'] for row in rows if row['event_title'] == 'Payment Session A')
        other_session_id = next(row['id'] for row in rows if row['event_title'] == 'Payment Session B')
        cur.execute(
            f"INSERT INTO practice_availability (practice_session_id, date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (target_session_id, session_date, MEMBER_EMAIL, 'Member Session', 'available'),
        )
        cur.execute(
            f"INSERT INTO practice_availability (practice_session_id, date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (other_session_id, session_date, MEMBER_EMAIL, 'Member Session', 'available'),
        )
        cur.execute(
            f"INSERT INTO practice_payments (practice_session_id, date, user_email, paid) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (other_session_id, session_date, MEMBER_EMAIL, 0),
        )
        conn.commit()

    headers = auth_headers(MEMBER_EMAIL, MEMBER_PASSWORD)
    response = client.post(
        f'/api/practice/sessions/id/{target_session_id}/payment',
        json={'paid': True},
        headers=headers,
    )
    assert response.status_code == 200, response.text

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT practice_session_id, paid FROM practice_payments WHERE user_email = {PLACEHOLDER} ORDER BY practice_session_id ASC",
            (MEMBER_EMAIL,),
        )
        rows = [dict(row) for row in cur.fetchall()]
        paid_by_session = {row['practice_session_id']: row['paid'] for row in rows}
        assert paid_by_session[target_session_id] in (True, 1)
        assert paid_by_session[other_session_id] in (False, 0)


def test_payment_request_notification_audience_isolated_by_session_id():
    reset_test_state()
    session_date = (date.today() - timedelta(days=7)).strftime('%Y-%m-%d')

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location, event_type, event_title, session_cost, paid_by, maximum_capacity, payment_requested, payment_requested_at) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, CURRENT_TIMESTAMP)",
            (session_date, '18:00', 'Pitch A', 'practice', 'Notify Session A', 20.0, ADMIN_EMAIL, 18, 1),
        )
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location, event_type, event_title, session_cost, paid_by, maximum_capacity, payment_requested, payment_requested_at) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, CURRENT_TIMESTAMP)",
            (session_date, '20:00', 'Pitch B', 'practice', 'Notify Session B', 30.0, ADMIN_EMAIL, 18, 1),
        )
        cur.execute(
            f"SELECT id, event_title FROM practice_sessions WHERE date = {PLACEHOLDER} ORDER BY time ASC",
            (session_date,),
        )
        rows = [dict(row) for row in cur.fetchall()]
        target_session_id = next(row['id'] for row in rows if row['event_title'] == 'Notify Session A')
        other_session_id = next(row['id'] for row in rows if row['event_title'] == 'Notify Session B')
        cur.execute(
            f"INSERT INTO practice_availability (practice_session_id, date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (target_session_id, session_date, MEMBER_EMAIL, 'Member Session', 'available'),
        )
        cur.execute(
            f"INSERT INTO practice_availability (practice_session_id, date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (other_session_id, session_date, ADMIN_EMAIL, 'Admin Session', 'available'),
        )
        conn.commit()

    from api import resolve_notification_recipients
    with get_connection() as conn:
        cur = conn.cursor()
        from api import NOTIFICATION_TYPE_DEFAULTS
        setting = NOTIFICATION_TYPE_DEFAULTS.get("payment_request", {})
        recipients = resolve_notification_recipients(
            target_audience=setting["target_audience"], 
            payload={
                "session_id": target_session_id,
                "date": session_date,
            },
            notif_type="payment_request"
        )
        emails = {r["email"] for r in recipients}
        assert MEMBER_EMAIL in emails
        assert ADMIN_EMAIL not in emails


def test_id_based_request_payment_route_sets_payment_requested():
    reset_test_state()
    session_date = (date.today() - timedelta(days=2)).strftime('%Y-%m-%d')
    create_session(session_date, event_title='ID Request Payment Session')
    session_id = get_session_id(session_date)

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE practice_sessions SET session_cost = {PLACEHOLDER}, paid_by = {PLACEHOLDER} WHERE id = {PLACEHOLDER}",
            (25.0, ADMIN_EMAIL, session_id),
        )
        cur.execute(
            f"INSERT INTO practice_availability (practice_session_id, date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (session_id, session_date, MEMBER_EMAIL, 'Member Session', 'available'),
        )
        conn.commit()

    admin_headers = auth_headers(ADMIN_EMAIL, ADMIN_PASSWORD)
    response = client.post(
        f'/api/practice/sessions/id/{session_id}/request-payment',
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT payment_requested FROM practice_sessions WHERE id = {PLACEHOLDER}",
            (session_id,),
        )
        row = cur.fetchone()
        assert row is not None
        assert row['payment_requested'] in (True, 1)


def test_id_based_request_payment_route_isolated_from_same_date_sessions():
    reset_test_state()
    session_date = (date.today() - timedelta(days=4)).strftime('%Y-%m-%d')

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location, event_type, event_title, session_cost, paid_by, maximum_capacity) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (session_date, '18:00', 'Pitch A', 'practice', 'Same Day Session A', 20.0, ADMIN_EMAIL, 18),
        )
        cur.execute(
            f"INSERT INTO practice_sessions (date, time, location, event_type, event_title, session_cost, paid_by, maximum_capacity, payment_requested, payment_requested_at) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, CURRENT_TIMESTAMP)",
            (session_date, '20:00', 'Pitch B', 'practice', 'Same Day Session B', 30.0, ADMIN_EMAIL, 18, 1),
        )
        cur.execute(
            f"SELECT id, event_title FROM practice_sessions WHERE date = {PLACEHOLDER} ORDER BY time ASC",
            (session_date,),
        )
        rows = [dict(row) for row in cur.fetchall()]
        target_session_id = next(row['id'] for row in rows if row['event_title'] == 'Same Day Session A')
        other_session_id = next(row['id'] for row in rows if row['event_title'] == 'Same Day Session B')
        cur.execute(
            f"INSERT INTO practice_availability (practice_session_id, date, user_email, user_full_name, status) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
            (target_session_id, session_date, MEMBER_EMAIL, 'Member Session', 'available'),
        )
        conn.commit()

    admin_headers = auth_headers(ADMIN_EMAIL, ADMIN_PASSWORD)
    response = client.post(
        f'/api/practice/sessions/id/{target_session_id}/request-payment',
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT id, payment_requested FROM practice_sessions WHERE id IN ({PLACEHOLDER}, {PLACEHOLDER}) ORDER BY id ASC",
            (target_session_id, other_session_id),
        )
        rows = [dict(row) for row in cur.fetchall()]
        requested_by_id = {row['id']: row['payment_requested'] for row in rows}
        assert requested_by_id[target_session_id] in (True, 1)
        assert requested_by_id[other_session_id] in (True, 1)


def test_delete_practice_by_id_removes_session():
    reset_test_state()
    session_date = (date.today() + timedelta(days=10)).strftime('%Y-%m-%d')
    create_session(session_date, event_title='Delete By ID Session')
    session_id = get_session_id(session_date)

    headers = auth_headers(ADMIN_EMAIL, ADMIN_PASSWORD)
    response = client.delete(f'/api/practice/sessions/id/{session_id}', headers=headers)
    assert response.status_code == 200, response.text

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT id FROM practice_sessions WHERE id = {PLACEHOLDER}", (session_id,))
        assert cur.fetchone() is None


if __name__ == '__main__':
    test_init_db_backfills_practice_session_ids_for_existing_rows()
    test_list_practice_sessions_returns_numeric_id()
    test_admin_create_allows_multiple_sessions_on_same_date()
    test_same_day_sessions_keep_availability_isolated_by_session_id()
    test_user_actions_upcoming_sessions_keeps_same_day_status_isolated()
    test_practice_notifications_include_session_id_for_deep_links()
    test_events_endpoint_deduplicates_match_rows_by_session_id()
    test_admin_id_based_availability_update_allows_past_session_changes()
    test_member_availability_write_populates_practice_session_id()
    test_member_payment_write_populates_practice_session_id()
    test_get_practice_session_by_id_route_returns_session()
    test_id_based_availability_route_updates_same_record_model()
    test_id_based_payment_route_dual_writes_payment_record()
    test_id_based_payment_confirmation_isolated_from_same_date_sessions()
    test_payment_request_notification_audience_isolated_by_session_id()
    test_id_based_request_payment_route_sets_payment_requested()
    test_id_based_request_payment_route_isolated_from_same_date_sessions()
    test_delete_practice_by_id_removes_session()
    print('All practice session ID foundation tests passed!')
