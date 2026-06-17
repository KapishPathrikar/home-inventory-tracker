import uuid
from sqlalchemy import Column, String, Integer, Numeric, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)

class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    product_name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    quantity = Column(Integer, default=1, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    purchase_date = Column(Date, nullable=False)
    consumed_date = Column(Date, nullable=True)
    status = Column(String, default="Available", nullable=False) # "Available" or "Consumed"