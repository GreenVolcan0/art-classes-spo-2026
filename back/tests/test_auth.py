def test_register_client_gets_full_access(register, login):
    resp = register("client@test.example.com", role="client")
    assert resp.status_code == 201
    data = resp.json()
    assert data["role"] == "client"
    assert data["is_approved"] is True
    assert "password_hash" not in data

    token = login("client@test.example.com")
    assert token.status_code == 200
    assert token.json()["access_token"]


def test_register_master_not_approved(register):
    resp = register("master@test.example.com", role="master", bio="О себе")
    assert resp.status_code == 201
    data = resp.json()
    assert data["role"] == "master"
    assert data["is_approved"] is False


def test_register_admin_forbidden(register):
    resp = register("hacker@test.example.com", role="admin")
    # Валидатор в схеме запрещает admin
    assert resp.status_code == 422


def test_register_duplicate_email(register):
    assert register("dup@test.example.com").status_code == 201
    assert register("dup@test.example.com").status_code == 409


def test_register_short_password(register):
    resp = register("short@test.example.com", password="1234567")  # 7 символов
    assert resp.status_code == 422


def test_login_wrong_password(register, login):
    register("u@test.example.com", password="password123")
    resp = login("u@test.example.com", "wrongpass")
    assert resp.status_code == 401


def test_login_blocked_user(client, register, login, admin_headers):
    register("blocked@test.example.com")
    # Найдём пользователя
    users = client.get(
        "/api/admin/users", params={"q": "blocked"}, headers=admin_headers
    ).json()["items"]
    uid = users[0]["id"]
    assert client.post(f"/api/admin/users/{uid}/block", headers=admin_headers).status_code == 200

    resp = login("blocked@test.example.com")
    assert resp.status_code == 403


def test_me_requires_token(client):
    assert client.get("/api/users/me").status_code == 401


def test_me_returns_profile(client, auth_headers):
    headers = auth_headers("me@test.example.com")
    resp = client.get("/api/users/me", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "me@test.example.com"


def test_update_profile(client, auth_headers):
    headers = auth_headers("upd@test.example.com")
    resp = client.patch(
        "/api/users/me",
        json={"first_name": "Пётр", "phone": "+7 900 000-00-00"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["first_name"] == "Пётр"
    assert body["phone"] == "+7 900 000-00-00"


def test_client_cannot_set_bio(client, auth_headers):
    headers = auth_headers("bio@test.example.com", role="client")
    resp = client.patch("/api/users/me", json={"bio": "скрытый текст"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["bio"] is None