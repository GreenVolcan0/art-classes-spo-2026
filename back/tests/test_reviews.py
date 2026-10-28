from datetime import datetime, timedelta, timezone
import uuid

from helpers import make_workshop_payload, publish_workshop


def _finished_workshop(client, approved_master, category, admin_headers, auth_headers, db, client_email):
    """Публикует МК, создаёт бронь клиента, затем переводит МК в finished.
    Возвращает (wid, master, bid, client_headers)."""
    from app.enums import WorkshopStatus
    from app.models import Workshop

    # Уникальный email мастера, чтобы не было 409 при повторных вызовах в одном тесте
    headers, master = approved_master(f"rev_master_{uuid.uuid4().hex[:8]}@test.example.com")
    payload = make_workshop_payload(category["id"], capacity=5)
    resp = client.post("/api/workshops", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    wid = resp.json()["id"]
    client.post(f"/api/workshops/{wid}/submit", headers=headers)
    publish_workshop(client, admin_headers, wid)

    # Бронируем, пока МК published
    ch = auth_headers(client_email)
    book = client.post(f"/api/workshops/{wid}/bookings", json={}, headers=ch)
    assert book.status_code == 201, book.text
    bid = book.json()["id"]

    # Теперь завершаем
    w = db.get(Workshop, wid)
    w.status = WorkshopStatus.finished
    db.commit()

    return wid, master, bid, ch

def test_review_after_finished(
    client, approved_master, category, admin_headers, auth_headers, db
):
    wid, _, bid, ch = _finished_workshop(
        client, approved_master, category, admin_headers, auth_headers, db,
        "reviewer@test.example.com",
    )
    resp = client.post(
        f"/api/bookings/{bid}/review",
        json={"rating": 5, "comment": "Отлично!"},
        headers=ch,
    )
    assert resp.status_code == 201
    assert resp.json()["rating"] == 5

def test_review_on_unfinished_workshop_rejected(
    client, approved_master, category, admin_headers, auth_headers
):
    headers, _ = approved_master("unfin@test.example.com")
    resp = client.post(
        "/api/workshops",
        json=make_workshop_payload(category["id"], capacity=3),
        headers=headers,
    )
    wid = resp.json()["id"]
    client.post(f"/api/workshops/{wid}/submit", headers=headers)
    publish_workshop(client, admin_headers, wid)

    ch = auth_headers("early@test.example.com")
    booking = client.post(f"/api/workshops/{wid}/bookings", json={}, headers=ch).json()
    resp = client.post(
        f"/api/bookings/{booking['id']}/review",
        json={"rating": 4},
        headers=ch,
    )
    assert resp.status_code == 409


def test_one_review_per_booking(
    client, approved_master, category, admin_headers, auth_headers, db
):
    wid, _, bid, ch = _finished_workshop(
        client, approved_master, category, admin_headers, auth_headers, db,
        "single@test.example.com",
    )
    assert client.post(
        f"/api/bookings/{bid}/review", json={"rating": 5}, headers=ch
    ).status_code == 201
    assert client.post(
        f"/api/bookings/{bid}/review", json={"rating": 1}, headers=ch
    ).status_code == 409

def test_rating_excludes_hidden_reviews(
    client, approved_master, category, admin_headers, auth_headers, db
):
    from app.enums import WorkshopStatus
    from app.models import Workshop
    import uuid

    headers, master = approved_master(f"rev_master_{uuid.uuid4().hex[:8]}@test.example.com")
    resp = client.post("/api/workshops", json=make_workshop_payload(category["id"], capacity=5), headers=headers)
    wid = resp.json()["id"]
    client.post(f"/api/workshops/{wid}/submit", headers=headers)
    publish_workshop(client, admin_headers, wid)

    ch1 = auth_headers("r1@test.example.com")
    ch2 = auth_headers("r2@test.example.com")
    b1 = client.post(f"/api/workshops/{wid}/bookings", json={}, headers=ch1)
    b2 = client.post(f"/api/workshops/{wid}/bookings", json={}, headers=ch2)
    assert b1.status_code == 201 and b2.status_code == 201
    bid1, bid2 = b1.json()["id"], b2.json()["id"]

    # Завершаем
    w = db.get(Workshop, wid)
    w.status = WorkshopStatus.finished
    db.commit()

    r1 = client.post(f"/api/bookings/{bid1}/review", json={"rating": 5}, headers=ch1).json()
    client.post(f"/api/bookings/{bid2}/review", json={"rating": 1}, headers=ch2)

    profile = client.get(f"/api/masters/{master['id']}").json()
    assert profile["rating"] == 3.0
    assert profile["reviews_count"] == 2

    hide = client.post(f"/api/admin/reviews/{r1['id']}/hide", headers=admin_headers)
    assert hide.status_code == 200

    profile = client.get(f"/api/masters/{master['id']}").json()
    assert profile["rating"] == 1.0
    assert profile["reviews_count"] == 1

def test_client_cannot_hide_review(
    client, approved_master, category, admin_headers, auth_headers, db
):
    wid, _, bid, ch = _finished_workshop(
        client, approved_master, category, admin_headers, auth_headers, db,
        "no_hide@test.example.com",
    )
    r = client.post(f"/api/bookings/{bid}/review", json={"rating": 3}, headers=ch).json()
    resp = client.post(f"/api/admin/reviews/{r['id']}/hide", headers=ch)
    assert resp.status_code == 403

def test_review_only_with_confirmed_booking(
    client, approved_master, category, admin_headers, auth_headers, db
):
    wid, _, _, ch = _finished_workshop(
        client, approved_master, category, admin_headers, auth_headers, db,
        "nobook@test.example.com",
    )
    resp = client.post("/api/bookings/99999/review", json={"rating": 5}, headers=ch)
    assert resp.status_code == 404