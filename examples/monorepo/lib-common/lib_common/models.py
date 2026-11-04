from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, Field


class OrderStatus(StrEnum):
    PENDING = "pending"
    PAID = "paid"


class Money(BaseModel):
    amount: Decimal = Field(gt=0, decimal_places=2)
    currency: str = Field(pattern=r"^[A-Z]{3}$")


class OrderDTO(BaseModel):
    id: int
    item: str
    total: Money
    status: OrderStatus = OrderStatus.PENDING
