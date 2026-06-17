import os
from pydantic_settings import BaseSettings, SettingsConfigDict

# Get the absolute path to the directory where this file lives (backend/app/core)
current_dir = os.path.dirname(os.path.abspath(__file__))

# Navigate up 3 levels to reach the backend folder where .env is stored
env_path = os.path.abspath(os.path.join(current_dir, "..", "..", ".env"))

class Settings(BaseSettings):
    DATABASE_URL: str
    GEMINI_API_KEY: str
    CLOUDINARY_URL: str
    JWT_SECRET: str
    
    # Explicitly configure the exact path target to find the .env file
    model_config = SettingsConfigDict(
        env_file=env_path,
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()