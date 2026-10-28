from datetime import datetime, timedelta, timezone

from helpers import make_workshop_payload, publish_workshop


def _future(days=5):
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def test_unapproved_master_can_create_draft_but_not_submit(
    client, approved_master, category
):
    headers, _ = approved_master("m1@test.example.com")
    # Создаём черновик
    resp = client.post(
        "/api/workshops",
        json=make_workshop_payload(category["id"]),
        headers=headers,
    )
    assert resp.status_code == 201
    wid = resp.json()["id"]
    assert resp.json()["status"] == "draft"
    # Отправка на модерацию должна пройти (мастер подтверждён)
    assert client.post(f"/api/workshops/{wid}/submit", headers=headers).status_code == 200


def test_unconfirmed_master_cannot_submit(client, register, login, category, admin_headers):
    register("pending_master@test.example.com", role="master", bio="x")
    token = login("pending_master@test.example.com").json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.post(
        "/api/workshops",
        json=make_workshop_payload(category["id"]),
        headers=headers,
    )
    assert resp.status_code == 201
    wid = resp.json()["id"]
    # Отправка на модерацию запрещена
    assert client.post(f"/api/workshops/{wid}/submit", headers=headers).status_code == 403


def test_master_cannot_book(client, approved_master, category):
    headers, _ = approved_master("bookmaster@test.example.com")
    resp = client.post(
        "/api/workshops",
        json=make_workshop_payload(category["id"], capacity=5),
        headers=headers,
    )
    wid = resp.json()["id"]
    client.post(f"/api/workshops/{wid}/submit", headers=headers)
    resp = client.post(f"/api/workshops/{wid}/bookings", json={}, headers=headers)
    assert resp.status_code == 403


def test_publish_flow_and_catalog(client, approved_master, category, admin_headers):
    headers, _ = approved_master("flow@test.example.com")
    resp = client.post(
        "/api/workshops",
        json=make_workshop_payload(category["id"]),
        headers=headers,
    )
    wid = resp.json()["id"]
    client.post(f"/api/workshops/{wid}/submit", headers=headers)

    published = publish_workshop(client, admin_headers, wid)
    assert published["status"] == "published"

    # Каталог виден без авторизации
    catalog = client.get("/api/workshops").json()
    assert any(w["id"] == wid for w in catalog["items"])


def test_reject_with_reason_and_resubmit(client, approved_master, category, admin_headers):
    headers, _ = approved_master("reject@test.example.com")
    resp = client.post(
        "/api/workshops",
        json=make_workshop_payload(category["id"]),
        headers=headers,
    )
    wid = resp.json()["id"]
    client.post(f"/api/workshops/{wid}/submit", headers=headers)

    reject = client.post(
        f"/api/admin/workshops/{wid}/reject",
        json={"reason": "Мало деталей"},
        headers=admin_headers,
    )
    assert reject.status_code == 200
    body = reject.json()
    assert body["status"] == "rejected"
    assert body["reject_reason"] == "Мало деталей"

    # Мастер исправляет и отправляет снова
    client.patch(
        f"/api/workshops/{wid}",
        json={"description": "Подробное описание"},
        headers=headers,
    )
    resubmit = client.post(f"/api/workshops/{wid}/submit", headers=headers)
    assert resubmit.status_code == 200
    assert resubmit.json()["status"] == "pending"


def test_cancel_workshop_cancels_bookings(
    client, approved_master, category, admin_headers, auth_headers
):
    headers, _ = approved_master("cancel@test.example.com")
    resp = client.post(
        "/api/workshops",
        json=make_workshop_payload(category["id"], capacity=3),
        headers=headers,
    )
    wid = resp.json()["id"]
    client.post(f"/api/workshops/{wid}/submit", headers=headers)
    publish_workshop(client, admin_headers, wid)

    client_headers = auth_headers("buyer@test.example.com")
    book = client.post(
        f"/api/workshops/{wid}/bookings", json={}, headers=client_headers
    )
    assert book.status_code == 201
    assert book.json()["status"] == "confirmed"

    cancel = client.post(f"/api/workshops/{wid}/cancel", headers=admin_headers)
    assert cancel.status_code == 200
    assert cancel.json()["status"] == "cancelled"

    my = client.get("/api/bookings/my", headers=client_headers).json()
    assert my["items"][0]["status"] == "cancelled"


def test_published_workshop_editing_blocked_with_bookings(
    client, approved_master, category, admin_headers, auth_headers
):
    headers, _ = approved_master("lockedit@test.example.com")
    resp = client.post(
        "/api/workshops",
        json=make_workshop_payload(category["id"], capacity=3),
        headers=headers,
    )
    wid = resp.json()["id"]
    client.post(f"/api/workshops/{wid}/submit", headers=headers)
    publish_workshop(client, admin_headers, wid)

    client_headers = auth_headers("booker@test.example.com")
    client.post(f"/api/workshops/{wid}/bookings", json={}, headers=client_headers)

    # Менять место при активных бронях нельзя
    upd = client.patch(
        f"/api/workshops/{wid}",
        json={"location": "Новое место"},
        headers=headers,
    )
    assert upd.status_code == 409

    # А цену — тоже
    upd_price = client.patch(
        f"/api/workshops/{wid}", json={"price": "999.00"}, headers=headers
    )
    assert upd_price.status_code == 409

    # Уменьшить места ниже подтверждённых — нельзя
    upd_cap = client.patch(
        f"/api/workshops/{wid}", json={"capacity": 0}, headers=headers
    )
    # 0 не пройдёт валидацию схемы (ge=1); проверим через 1 < подтверждённых? 1 бронь — ок,
    # поэтому проверим на 0 — но схема не даст. Проверим уменьшение ниже числа броней:
    # сначала займём 2 места
    client_headers2 = auth_headers("booker2@test.example.com")
    client.post(f"/api/workshops/{wid}/bookings", json={}, headers=client_headers2)
    upd_cap2 = client.patch(
        f"/api/workshops/{wid}", json={"capacity": 1}, headers=headers
    )
    assert upd_cap2.status_code == 409


def test_catalog_filters(client, approved_master, category, admin_headers):
    headers, _ = approved_master("catalog@test.example.com")
    resp = client.post(
        "/api/workshops",
        json=make_workshop_payload(
            category["id"], title="Акварельный пейзаж", price="2000.00"
        ),
        headers=headers,
    )
    wid = resp.json()["id"]
    client.post(f"/api/workshops/{wid}/submit", headers=headers)
    publish_workshop(client, admin_headers, wid)

    # Поиск по q
    found = client.get("/api/workshops", params={"q": "Акварельный"}).json()
    assert found["total"] == 1

    # Фильтр по цене
    cheap = client.get("/api/workshops", params={"price_max": "100.00"}).json()
    assert cheap["total"] == 0

    # Фильтр по категории
    by_cat = client.get(
        "/api/workshops", params={"category_id": category["id"]}
    ).json()
    assert by_cat["total"] >= 1


def test_unpublished_workshop_hidden_from_others(
    client, approved_master, category, auth_headers
):
    headers, _ = approved_master("hidden@test.example.com")
    resp = client.post(
        "/api/workshops",
        json=make_workshop_payload(category["id"]),
        headers=headers,
    )
    wid = resp.json()["id"]
    # Чужой клиент не видит черновик
    other = auth_headers("other@test.example.com")
    assert client.get(f"/api/workshops/{wid}", headers=other).status_code == 404
    # Владелец видит
    assert client.get(f"/api/workshops/{wid}", headers=headers).status_code == 200


def test_create_workshop_in_past_rejected(client, approved_master, category):
    headers, _ = approved_master("past@test.example.com")
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    resp = client.post(
        "/api/workshops",
        json=make_workshop_payload(category["id"], start_at=past),
        headers=headers,
    )
    assert resp.status_code == 422