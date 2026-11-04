from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel

from lib_common import Money, OrderStatus
from payments.orders_client import HttpOrdersClient, OrdersClient

app = FastAPI(title="payments")


def get_orders_client() -> OrdersClient:
    return HttpOrdersClient()


class PaymentRequest(BaseModel):
    order_id: int
    amount: Money


class PaymentResult(BaseModel):
    order_id: int
    status: str


@app.post("/payments", status_code=201)
def pay(
    body: PaymentRequest,
    orders: Annotated[OrdersClient, Depends(get_orders_client)],
) -> PaymentResult:
    order = orders.get_order(body.order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="order not found")
    if order.status is OrderStatus.PAID:
        raise HTTPException(status_code=409, detail="order already paid")
    if body.amount != order.total:
        raise HTTPException(status_code=422, detail="amount does not match order total")
    orders.mark_paid(order.id)
    return PaymentResult(order_id=order.id, status="captured")
