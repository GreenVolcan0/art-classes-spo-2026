from datetime import datetime, timedelta, timezone

from helpers import make_workshop_payload, publish_workshop


def _publish_workshop(client, approved_master, category, admin_headers, capacity=2, **overrides):
    headers, master = approved_master(f"m_{capacity}_{overrides.get('tag','x')}@test.example.com")
    payload = make_workshop_payload(category["id"], capacity=capacity, **{
        k: v for k, v in overrides.items() if k != "tag"
    })
    resp = client.post("/api/workshops", json=payload, headers=headers)
    wid = resp.json()["id"]
    client.post(f"/api/workshops/{wid}/submit", headers=headers)
    publish_workshop(client, admin_headers, wid)
    return wid, headers


def test_book_confirmed(client, approved_master, category, admin_headers, auth_headers):
    wid, _ = _publish_workshop(client, approved_master, category, admin_headers, capacity=2)
    ch = auth_headers("c1@test.example.com")
    resp = client.post(f"/api/workshops/{wid}/bookings", json={}, headers=ch)
    assert resp.status_code == 201
    assert resp.json()["status"] == "confirmed"


def test_no_free_seats_requires_waitlist(
    client, approved_master, category, admin_headers, auth_headers
):
    wid, _ = _publish_workshop(client, approved_master, category, admin_headers, capacity=1)
    c1 = auth_headers("a@test.example.com")
    c2 = auth_headers("b@test.example.com")

    assert client.post(f"/api/workshops/{wid}/bookings", json={}, headers=c1).status_code == 201

    # Без join_waitlist — 409 с кодом no_free_seats
    resp = client.post(f"/api/workshops/{wid}/bookings", json={}, headers=c2)
    assert resp.status_code == 409
    assert resp.json()["detail"]["code"] == "no_free_seats"

    # С join_waitlist — waitlisted
    resp = client.post(
        f"/api/workshops/{wid}/bookings", json={"join_waitlist": True}, headers=c2
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "waitlisted"


def test_no_double_booking(client, approved_master, category, admin_headers, auth_headers):
    wid, _ = _publish_workshop(client, approved_master, category, admin_headers, capacity=3)
    ch = auth_headers("double@test.example.com")
    assert client.post(f"/api/workshops/{wid}/bookings", json={}, headers=ch).status_code == 201
    second = client.post(f"/api/workshops/{wid}/bookings", json={}, headers=ch)
    assert second.status_code == 409


def test_waitlist_promoted_after_cancel(
    client, approved_master, category, admin_headers, auth_headers
):
    wid, _ = _publish_workshop(client, approved_master, category, admin_headers, capacity=1)
    c1 = auth_headers("first@test.example.com")
    c2 = auth_headers("second@test.example.com")

    client.post(f"/api/workshops/{wid}/bookings", json={}, headers=c1)
    client.post(
        f"/api/workshops/{wid}/bookings", json={"join_waitlist": True}, headers=c2
    )

    # c2 в очереди
    my2 = client.get("/api/bookings/my", headers=c2).json()["items"]
    assert my2[0]["status"] == "waitlisted"
    booking_id = my2[0]["id"]

    # c1 отменяет
    my1 = client.get("/api/bookings/my", headers=c1).json()["items"]
    assert client.post(
        f"/api/bookings/{my1[0]['id']}/cancel", headers=c1
    ).status_code == 200

    # c2 автоматически повышен до confirmed
    my2 = client.get("/api/bookings/my", headers=c2).json()["items"]
    promoted = next(b for b in my2 if b["id"] == booking_id)
    assert promoted["status"] == "confirmed"


def test_cancel_deadline_24h(
    client, approved_master, category, admin_headers, auth_headers
):
    # Создаём МК, стартующий через 2 часа — отмена подтверждённой брони запрещена
    near = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    headers, _ = approved_master("near@test.example.com")
    payload = make_workshop_payload(category["id"], start_at=near, capacity=2)
    resp = client.post("/api/workshops", json=payload, headers=headers)
    wid = resp.json()["id"]
    client.post(f"/api/workshops/{wid}/submit", headers=headers)
    publish_workshop(client, admin_headers, wid)

    ch = auth_headers("nearbuyer@test.example.com")
    book = client.post(f"/api/workshops/{wid}/bookings", json={}, headers=ch)
    booking_id = book.json()["id"]

    cancel = client.post(f"/api/bookings/{booking_id}/cancel", headers=ch)
    assert cancel.status_code == 409


def test_cannot_cancel_after_start(
    client, approved_master, category, admin_headers, auth_headers
):
    # Старт через 2 часа — отмена невозможна (менее 24ч)
    near = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    headers, _ = approved_master("after@test.example.com")
    payload = make_workshop_payload(category["id"], start_at=near, capacity=2)
    resp = client.post("/api/workshops", json=payload, headers=headers)
    wid = resp.json()["id"]
    client.post(f"/api/workshops/{wid}/submit", headers=headers)
    publish_workshop(client, admin_headers, wid)

    ch = auth_headers("afterbuyer@test.example.com")
    booking_id = client.post(
        f"/api/workshops/{wid}/bookings", json={}, headers=ch
    ).json()["id"]

    assert client.post(f"/api/bookings/{booking_id}/cancel", headers=ch).status_code == 409


def test_participants_lists(client, approved_master, category, admin_headers, auth_headers):
    wid, master_headers = _publish_workshop(
        client, approved_master, category, admin_headers, capacity=1
    )
    c1 = auth_headers("p1@test.example.com")
    c2 = auth_headers("p2@test.example.com")
    client.post(f"/api/workshops/{wid}/bookings", json={}, headers=c1)
    client.post(
        f"/api/workshops/{wid}/bookings", json={"join_waitlist": True}, headers=c2
    )

    resp = client.get(f"/api/workshops/{wid}/participants", headers=master_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["confirmed"]) == 1
    assert len(body["waitlist"]) == 1
    assert body["capacity"] == 1
    assert body["free_seats"] == 0

    # Чужой мастер не видит участников
    other_headers, _ = approved_master("other_master@test.example.com")
    assert client.get(
        f"/api/workshops/{wid}/participants", headers=other_headers
    ).status_code == 403