#!/usr/bin/env python3
"""
Backend tests for forum post create, edit, and delete flows.
Ensures the core forum CRUD endpoints used by the frontend work correctly.
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


def test_create_forum_post():
    setup_forum_test_data()
    author_headers = login("author@test.com")

    response = client.post(
        "/api/forum",
        json={"content": "Creating a new forum post for test coverage"},
        headers=author_headers,
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["id"] > 0
    assert data["user_email"] == "author@test.com"
    assert data["user_full_name"] == "Author User"
    assert data["content"] == "Creating a new forum post for test coverage"
    assert data["likes_count"] == 0
    assert data["comments"] == []


def test_edit_forum_post():
    setup_forum_test_data()
    author_headers = login("author@test.com")

    create_response = client.post(
        "/api/forum",
        json={"content": "Original post content"},
        headers=author_headers,
    )
    assert create_response.status_code == 200, create_response.text
    post_id = create_response.json()["id"]

    edit_response = client.put(
        f"/api/forum/{post_id}",
        json={"content": "Updated forum post content"},
        headers=author_headers,
    )

    assert edit_response.status_code == 200, edit_response.text
    data = edit_response.json()
    assert data["id"] == post_id
    assert data["content"] == "Updated forum post content"
    assert data["user_email"] == "author@test.com"

    list_response = client.get("/api/forum")
    assert list_response.status_code == 200, list_response.text
    posts = list_response.json()
    assert any(post["id"] == post_id and post["content"] == "Updated forum post content" for post in posts)


def test_delete_forum_post():
    setup_forum_test_data()
    author_headers = login("author@test.com")

    create_response = client.post(
        "/api/forum",
        json={"content": "Post that will be deleted"},
        headers=author_headers,
    )
    assert create_response.status_code == 200, create_response.text
    post_id = create_response.json()["id"]

    delete_response = client.delete(
        f"/api/forum/{post_id}",
        headers=author_headers,
    )

    assert delete_response.status_code == 200, delete_response.text
    assert delete_response.json()["message"] == "Post deleted"

    list_response = client.get("/api/forum")
    assert list_response.status_code == 200, list_response.text
    posts = list_response.json()
    assert all(post["id"] != post_id for post in posts)


if __name__ == "__main__":
    import pytest
    raise SystemExit(pytest.main([__file__, "-v", "--tb=short"]))
