from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

# Create the SQLAlchemy engine connecting to Neon DB
engine = create_engine(settings.DATABASE_URL)

# Create a SessionLocal class for creating database sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for our database models to inherit from
Base = declarative_base()

# Dependency to get the DB session for each API request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()