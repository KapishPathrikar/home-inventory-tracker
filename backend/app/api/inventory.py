import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, status
from sqlalchemy.orm import Session
from app.services.scanner import scan_receipt_image
from app.core.database import get_db
from app.models.models import InventoryItem
from app.schemas.inventory import BulkSaveRequest, InventoryItemResponse
from typing import List

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])

# Hardcoding a dummy User ID for MVP phase until Auth layer is wired up
MOCK_USER_ID = uuid.UUID("99999999-9999-9999-9999-999999999999")

@router.post("/scan")
async def scan_receipt(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image.")
    image_bytes = await file.read()
    extracted_data = scan_receipt_image(image_bytes)
    if "error" in extracted_data:
        raise HTTPException(status_code=500, detail=extracted_data["error"])
    return extracted_data

@router.post("/save-bulk", response_model=List[InventoryItemResponse])
def save_bulk_items(payload: BulkSaveRequest, db: Session = Depends(get_db)):
    """
    Saves the confirmed list of extracted receipt items into the PostgreSQL database.
    """
    saved_records = []
    for item in payload.items:
        db_item = InventoryItem(
            user_id=MOCK_USER_ID,
            product_name=item.product_name,
            category=item.category,
            quantity=item.quantity,
            price=item.price,
            purchase_date=item.purchase_date,
            status="Available"
        )
        db.add(db_item)
        saved_records.append(db_item)
    
    db.commit()
    for record in saved_records:
        db.refresh(record)
    return saved_records

@router.get("/", response_model=List[InventoryItemResponse])
def get_inventory(db: Session = Depends(get_db)):
    """
    Fetches all inventory items (both Available and Consumed) for tracking calculations.
    """
    items = db.query(InventoryItem).all()
    return items

@router.patch("/{item_id}/consume", response_model=InventoryItemResponse)
def mark_as_consumed(item_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Marks an item as completely used/consumed.
    """
    from datetime import date
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    item.status = "Consumed"
    item.consumed_date = date.today()
    db.commit()
    db.refresh(item)
    return item

@router.delete("/delete-all", status_code=status.HTTP_200_OK)
def delete_all_inventory(db: Session = Depends(get_db)):
    """
    Permanently erases all inventory records (Active and Consumed) from the database.
    """
    try:
        db.query(InventoryItem).delete()
        db.commit()
        return {"message": "All inventory items deleted successfully."}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while clearing inventory: {str(e)}"
        )

@router.delete("/{item_id}")
def delete_inventory_item(item_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Permanently erases an item from the database.
    """
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    db.delete(item)
    db.commit()
    return {"message": "Successfully deleted"}