from pydantic import BaseModel
from datetime import date
from typing import Optional, List
from uuid import UUID

class InventoryItemCreate(BaseModel):
    product_name: str
    category: Optional[str] = None
    quantity: int = 1
    price: float
    purchase_date: date

class InventoryItemResponse(BaseModel):
    id: UUID
    user_id: UUID
    product_name: str
    category: Optional[str]
    quantity: int
    price: float
    purchase_date: date
    consumed_date: Optional[date]
    status: str

    class Config:
        from_attributes = True

class BulkSaveRequest(BaseModel):
    items: List[InventoryItemCreate]