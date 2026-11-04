import os
from typing import Protocol

import httpx

from lib_common import OrderDTO


class OrdersClient(Protocol):
    def get_order(self, order_id: int) -> OrderDTO | None: ...
    def mark_paid(self, order_id: int) -> None: ...


class HttpOrdersClient:
    def __init__(self, base_url: str | None = None) -> None:
        self._base_url = base_url or os.environ.get("ORDERS_URL", "http://localhost:8001")

    def get_order(self, order_id: int) -> OrderDTO | None:
        resp = httpx.get(f"{self._base_url}/orders/{order_id}")
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return OrderDTO.model_validate(resp.json())

    def mark_paid(self, order_id: int) -> None:
        httpx.post(f"{self._base_url}/orders/{order_id}/mark-paid").raise_for_status()
