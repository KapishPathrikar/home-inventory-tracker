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
        
        prompt = """
You are an expert OCR and data extraction receipt parser. Your job is to extract line items from the provided D-Mart invoice image with absolute precision.

CRITICAL INSTRUCTION FOR COLUMNS:
The receipt contains columns in this exact sequence:
[HSN Code] [Product Particulars] [Qty/Kg] [N/Rate] [Value]

- "Qty/Kg" is the quantity purchased.
- "N/Rate" is the individual item unit rate.
- "Value" is the total final price for that item line (Qty x N/Rate).

Rules for Data Extraction:
1. You MUST extract the final total line cost from the "Value" column and map it to the "price" field. Do NOT use the "N/Rate" column for the price.
- Example from bill: "040690 HALDIRAM PANEE-200g  | Qty: 2 | N/Rate: 66.00 | Value: 132.00". The price must be extracted as 132.00, NOT 66.00.
2. If "Qty/Kg" is a decimal (e.g., L ATTA WHEAT 4.982), round the quantity up or down to the nearest whole integer (e.g., 5) to match the database constraints.
3. Clean the product names by stripping out any leading HSN number codes.
4. Extract the "Bill Dt" value at the top as the 'purchase_date' formatted strictly as YYYY-MM-DD (e.g., "15/06/2026" becomes "2026-06-15").

Return a valid JSON object matching this schema exactly without any markdown formatting wrappers:
{
"purchase_date": "YYYY-MM-DD",
"items": [
    {
    "product_name": "Stripped Clean Product Name",
    "category": "Groceries",
    "quantity": 2,
    "price": 132.00
    }
]
}
"""

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