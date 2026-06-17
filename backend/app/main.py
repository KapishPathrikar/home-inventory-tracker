import uuid
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware # Import CORS
from app.core.database import engine, Base, SessionLocal
from app.models.models import User
from app.api.inventory import router as inventory_router, MOCK_USER_ID

Base.metadata.create_all(bind=engine)

db = SessionLocal()
try:
    mock_user_exists = db.query(User).filter(User.id == MOCK_USER_ID).first()
    if not mock_user_exists:
        dummy_user = User(
            id=MOCK_USER_ID,
            email="mvpuser@tracker.local",
            password_hash="not_needed_for_mvp"
        )
        db.add(dummy_user)
        db.commit()
finally:
    db.close()

app = FastAPI(title="Home Inventory Tracker API")

# Configure CORS so your Next.js browser page can access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"], # Explicitly specify methods
    allow_headers=["*"],
)

app.include_router(inventory_router)

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "message": "Welcome to the Home Inventory Tracker API! Core routing live."
    }