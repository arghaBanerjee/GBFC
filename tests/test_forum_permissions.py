#!/usr/bin/env python3
"""
Tests for forum post edit/delete permissions.
Covers the recent move of forum post management from Admin into the main forum page
by verifying the backend authorization rules that the UI now relies on.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["TEST_MODE"] = "true"

from fastapi.testclient import TestClient

from api import app, get_connection, hash_password, init_db, PLACEHOLDER

client = TestClient(app)


def setup_forum_test_data():
    init_db()
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM forum_likes")
        cur.execute("DELETE FROM forum_comments")
        cur.execute("DELETE FROM forum_posts")
        cur.execute("DELETE FROM notifications")
        cur.execute("DELETE FROM users")

        users = [
            ("author@test.com", "Author User", hash_password("pass123"), "member"),
            ("other@test.com", "Other User", hash_password("pass123"), "member"),
            ("admin@test.com", "Admin User", hash_password("pass123"), "admin"),
        ]

        for email, full_name, password, user_type in users:
            cur.execute(
                f"INSERT INTO users (email, full_name, password, user_type) VALUES ({PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER}, {PLACEHOLDER})",
                (email, full_name, password, user_type),
            )

        conn.commit()


def login(email, password="pass123"):
    response = client.post(
        "/api/login",
        data={"username": email, "password": password},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_post_as_author(content="Original forum post"):
    headers = login("author@test.com")
    response = client.post(
        "/api/forum",
        json={"content": content},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json(), headers


def test_forum_post_author_can_edit_own_post():
    setup_forum_test_data()
    post, author_headers = create_post_as_author()

    response = client.put(
        f"/api/forum/{post['id']}",
        json={"content": "Author edited post"},
        headers=author_headers,
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["id"] == post["id"]
    assert data["content"] == "Author edited post"
    assert data["user_email"] == "author@test.com"



def test_forum_post_non_owner_cannot_edit_post():
    setup_forum_test_data()
    post, _ = create_post_as_author()
    other_headers = login("other@test.com")

    response = client.put(
        f"/api/forum/{post['id']}",
        json={"content": "Unauthorized edit"},
        headers=other_headers,
    )

    assert response.status_code == 403, response.text
    assert response.json()["detail"] == "You can only edit your own posts"



def test_admin_can_edit_any_forum_post():
    setup_forum_test_data()
    post, _ = create_post_as_author()
    admin_headers = login("admin@test.com")

    response = client.put(
        f"/api/forum/{post['id']}",
        json={"content": "Admin edited post"},
        headers=admin_headers,
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["content"] == "Admin edited post"
    assert data["user_email"] == "author@test.com"



def test_admin_can_delete_any_forum_post():
    setup_forum_test_data()
    post, _ = create_post_as_author()
    admin_headers = login("admin@test.com")

    response = client.delete(
        f"/api/forum/{post['id']}",
        headers=admin_headers,
    )

    assert response.status_code == 200, response.text
    assert response.json()["message"] == "Post deleted"

    get_response = client.get("/api/forum")
    assert get_response.status_code == 200, get_response.text
    assert get_response.json() == []
