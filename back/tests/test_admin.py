def test_admin_can_approve_master(client, register, admin_headers):
    register("tomaster@test.example.com", role="master", bio="x")
    users = client.get(
        "/api/admin/users", params={"role": "master"}, headers=admin_headers
    ).json()["items"]
    m = next(u for u in users if u["email"] == "tomaster@test.example.com")
    assert m["is_approved"] is False

    resp = client.post(f"/api/admin/masters/{m['id']}/approve", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["is_approved"] is True


def test_admin_cannot_block_self(client, admin_headers):
    me = client.get("/api/users/me", headers=admin_headers).json()
    resp = client.post(f"/api/admin/users/{me['id']}/block", headers=admin_headers)
    assert resp.status_code == 409


def test_blocked_user_token_immediately_invalid(
    client, auth_headers, admin_headers
):
    headers = auth_headers("toblock@test.example.com")
    me = client.get("/api/users/me", headers=headers).json()
    client.post(f"/api/admin/users/{me['id']}/block", headers=admin_headers)

    # Тот же токен — уже не работает
    assert client.get("/api/users/me", headers=headers).status_code in (401, 403)


def test_make_admin(client, auth_headers, admin_headers):
    headers = auth_headers("futureadmin@test.example.com")
    me = client.get("/api/users/me", headers=headers).json()
    resp = client.post(f"/api/admin/users/{me['id']}/make-admin", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["role"] == "admin"


def test_logs_are_written(client, admin_headers, approved_master, category):
    headers, _ = approved_master("logger@test.example.com")
    # Создаём МК — должна появиться запись в журнале
    from datetime import datetime, timedelta, timezone

    payload = {
        "category_id": category["id"],
        "title": "Логи",
        "description": "x",
        "location": "y",
        "start_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "duration_min": 60,
        "price": "0",
        "capacity": 1,
    }
    client.post("/api/workshops", json=payload, headers=headers)

    logs = client.get(
        "/api/admin/logs", params={"entity_type": "workshop"}, headers=admin_headers
    ).json()
    assert logs["total"] >= 1


def test_logs_available_only_to_admin(client, auth_headers):
    headers = auth_headers("notadmin@test.example.com")
    assert client.get("/api/admin/logs", headers=headers).status_code == 403


def test_non_admin_cannot_approve_master(client, register, auth_headers):
    register("target@test.example.com", role="master", bio="x")
    headers = auth_headers("plainuser@test.example.com")
    resp = client.post("/api/admin/masters/1/approve", headers=headers)
    assert resp.status_code == 403


def test_admin_cannot_be_created_via_registration(client):
    resp = client.post(
        "/api/auth/register",
        json={
            "email": "wannabe@test.example.com",
            "password": "password123",
            "first_name": "A",
            "last_name": "B",
            "role": "admin",
        },
    )
    assert resp.status_code == 422