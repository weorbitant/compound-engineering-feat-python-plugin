from fastapi.testclient import TestClient

from orders.app import app

client = TestClient(app)


def _create() -> dict[str, object]:
    resp = client.post("/orders", json={"item": "book", "total": {"amount": "9.99", "currency": "EUR"}})
    assert resp.status_code == 201
    body: dict[str, object] = resp.json()
    return body


def test_create_and_get_order() -> None:
    order = _create()
    resp = client.get(f"/orders/{order['id']}")
    assert resp.json()["status"] == "pending"


def test_mark_paid() -> None:
    order = _create()
    resp = client.post(f"/orders/{order['id']}/mark-paid")
    assert resp.json()["status"] == "paid"


def test_unknown_order_is_404() -> None:
    assert client.get("/orders/999999").status_code == 404
