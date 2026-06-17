import json
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from app.core.config import settings

# Initialize the Gemini Client with your free API Key
client = genai.Client(api_key=settings.GEMINI_API_KEY)

# Define schemas so Gemini forces its AI output to match our DB format perfectly
class ExtractedItem(BaseModel):
    product_name: str = Field(description="Name or brand of the grocery item")
    category: str = Field(description="Estimated category like Dairy, Snacks, Personal Care, Groceries")
    quantity: int = Field(description="Quantity purchased, defaulting to 1 if not readable")
    price: float = Field(description="Single item price or total price for this row item in INR")

class ReceiptSchema(BaseModel):
    purchase_date: str = Field(description="Date of purchase extracted from the bill in YYYY-MM-DD format")
    items: list[ExtractedItem]

def scan_receipt_image(image_bytes: bytes) -> dict:
    """
    Sends receipt image bytes to Gemini 1.5 Flash to extract 
    structured JSON data for FREE.
    """
    try:
        image_part = types.Part.from_bytes(
            data=image_bytes,
            mime_type="image/jpeg",  # Handles standard camera uploads
        )
        
        prompt = (
            "Analyze this supermarket receipt/invoice (e.g., D-Mart). "
            "Extract the purchase date and all individual products with their quantity, category, and price."
        )

        # Call the Gemini Flash model
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[image_part, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ReceiptSchema,
            ),
        )
        
        # Safely parse string response into a Python dictionary
        return json.loads(response.text)
        
    except Exception as e:
        return {"error": f"Failed to parse receipt: {str(e)}"}