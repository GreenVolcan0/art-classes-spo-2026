def test_admin_can_create_category(client, admin_headers):
    resp = client.post(
        "/api/categories",
        json={"name": "Керамика", "description": "Гончарное дело"},
        headers=admin_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "Керамика"


def test_non_admin_cannot_create_category(client, auth_headers):
    headers = auth_headers("nocat@test.example.com")
    resp = client.post(
        "/api/categories", json={"name": "Керамика"}, headers=headers
    )
    assert resp.status_code == 403


def test_category_name_unique(client, admin_headers):
    client.post("/api/categories", json={"name": "Уник"}, headers=admin_headers)
    resp = client.post("/api/categories", json={"name": "Уник"}, headers=admin_headers)
    assert resp.status_code == 409


def test_category_with_workshops_cannot_be_deleted(
    client, admin_headers, approved_master, category
):
    headers, _ = approved_master("catmaster@test.example.com")
    from datetime import datetime, timedelta, timezone

    payload = {
        "category_id": category["id"],
        "title": "Тестовая работа",
        "description": "Описание",
        "location": "Студия",
        "start_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
        "duration_min": 60,
        "price": "1000",
        "capacity": 5,
    }
    client.post("/api/workshops", json=payload, headers=headers)

    resp = client.delete(f"/api/categories/{category['id']}", headers=admin_headers)
    assert resp.status_code == 409


def test_empty_category_can_be_deleted(client, admin_headers):
    cat = client.post(
        "/api/categories", json={"name": "Временная"}, headers=admin_headers
    ).json()
    resp = client.delete(f"/api/categories/{cat['id']}", headers=admin_headers)
    assert resp.status_code == 204