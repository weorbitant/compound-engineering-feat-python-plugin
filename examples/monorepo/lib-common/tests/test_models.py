from decimal import Decimal

import pytest
from pydantic import ValidationError

from lib_common import Money, OrderDTO, OrderStatus


def test_money_rejects_non_positive_amount() -> None:
    with pytest.raises(ValidationError):
        Money(amount=Decimal("0"), currency="EUR")


def test_money_rejects_lowercase_currency() -> None:
    with pytest.raises(ValidationError):
        Money(amount=Decimal("1.00"), currency="eur")


def test_order_defaults_to_pending() -> None:
    order = OrderDTO(id=1, item="book", total=Money(amount=Decimal("9.99"), currency="EUR"))
    assert order.status is OrderStatus.PENDING
