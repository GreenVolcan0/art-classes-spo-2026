from datetime import datetime, timedelta, timezone


def make_workshop_payload(category_id, **overrides):
    """Собирает валидный payload мастер-класса."""
    payload = {
        "category_id": category_id,
        "title": "Роспись по шёлку",
        "description": "Учимся батику",
        "location": "Студия «Палитра»",
        "start_at": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
        "duration_min": 90,
        "price": "1500.00",
        "capacity": 2,
    }
    payload.update(overrides)
    return payload


def publish_workshop(client, admin_headers, workshop_id):
    resp = client.post(
        f"/api/admin/workshops/{workshop_id}/approve", headers=admin_headers
    )
    assert resp.status_code == 200, resp.text
    return resp.json()