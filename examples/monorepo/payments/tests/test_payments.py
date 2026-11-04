from collections.abc import Iterator
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from lib_common import Money, OrderDTO, OrderStatus
from payments.app import app, get_orders_client


class FakeOrders:
    def __init__(self) -> None:
        self.orders = {1: OrderDTO(id=1, item="book", total=Money(amount=Decimal("9.99"), currency="EUR"))}

    def get_order(self, order_id: int) -> OrderDTO | None:
        return self.orders.get(order_id)

    def mark_paid(self, order_id: int) -> None:
        self.orders[order_id].status = OrderStatus.PAID


@pytest.fixture
def client() -> Iterator[TestClient]:
    fake = FakeOrders()
    app.dependency_overrides[get_orders_client] = lambda: fake
    yield TestClient(app)
    app.dependency_overrides.clear()


def _pay(client: TestClient, order_id: int = 1, amount: str = "9.99") -> int:
    body = {"order_id": order_id, "amount": {"amount": amount, "currency": "EUR"}}
    return int(client.post("/payments", json=body).status_code)


def test_pay_captures_matching_amount(client: TestClient) -> None:
    assert _pay(client) == 201


def test_pay_twice_is_conflict(client: TestClient) -> None:
    _pay(client)
    assert _pay(client) == 409


def test_wrong_amount_is_rejected(client: TestClient) -> None:
    assert _pay(client, amount="1.00") == 422


def test_unknown_order_is_404(client: TestClient) -> None:
    assert _pay(client, order_id=42) == 404
