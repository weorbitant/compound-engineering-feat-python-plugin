from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from lib_common import Money, OrderDTO, OrderStatus

app = FastAPI(title="orders")

_orders: dict[int, OrderDTO] = {}


class CreateOrder(BaseModel):
    item: str
    total: Money


@app.post("/orders", status_code=201)
def create_order(body: CreateOrder) -> OrderDTO:
    order = OrderDTO(id=len(_orders) + 1, item=body.item, total=body.total)
    _orders[order.id] = order
    return order


@app.get("/orders/{order_id}")
def get_order(order_id: int) -> OrderDTO:
    if order_id not in _orders:
        raise HTTPException(status_code=404, detail="order not found")
    return _orders[order_id]


@app.post("/orders/{order_id}/mark-paid")
def mark_paid(order_id: int) -> OrderDTO:
    order = get_order(order_id)
    order.status = OrderStatus.PAID
    return order
