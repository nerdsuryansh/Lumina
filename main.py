import io
import os
from dotenv import load_dotenv
load_dotenv()  # Loads GEMINI_API_KEY from .env file automatically
import json
from fastapi import FastAPI, File, UploadFile
import uvicorn
import PyPDF2
from pydantic import BaseModel
from google import genai
from typing import Literal, List
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = genai.Client(api_key=os.environ.get("AQ.Ab8RN6JErwF5PU1Wb9fQdgMOtwRftJc9_t6O-oscmvkUDobnJA"))

# ─── Models ──────────────────────────────────────────────────────────────────

class LabResult(BaseModel):
    test_name: str
    value: str
    normal_range: str
    status_badge: Literal["Low", "Normal", "High"]

class MedicalSummary(BaseModel):
    summary: str
    results: List[LabResult]

class ChatMessageIn(BaseModel):
    role: str   # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    report_context: str
    messages: List[ChatMessageIn]
    new_message: str

# ─── Routes ──────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "Lumina Backend is live!"}

@app.post("/upload/")
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()
    pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
    extracted_text = "".join(
        page.extract_text() for page in pdf_reader.pages if page.extract_text()
    )
    # Truncate to avoid slow requests on large PDFs (lab results are always in first ~8000 chars)
    extracted_text = extracted_text[:8000]

    response = client.models.generate_content(
        model='gemini-3.5-flash',
        contents=f"""You are a precise medical report analyzer. Extract all lab test results from the text below.

STRICT STATUS CLASSIFICATION RULES:
- "Normal": value falls WITHIN the stated reference/normal range (including values like "<1.0" when the reference IS "<1.0")
- "Low": value is BELOW the minimum of the stated reference range (a deficiency or deficit)
- "High": value is ABOVE the maximum of the stated reference range
- If a result has an interpretation table (e.g. hsCRP risk categories), use the category that the value falls into: Low/Moderate/High risk = Normal/Normal/High respectively
- For "<X" values where the reference is also "<X" or the value satisfies the reference condition, classify as "Normal"

Also write a 2-3 sentence clinical summary of the overall results.
Respond ONLY with valid JSON. No extra text.

Medical report text:
{extracted_text}""",
        config={
            'response_mime_type': 'application/json',
            'response_schema': MedicalSummary,
        }
    )

    return json.loads(response.text)

@app.post("/chat/")
async def chat(req: ChatRequest):
    # Build conversation history (last 10 messages to avoid token overflow)
    history_lines = [
        f"{'User' if m.role == 'user' else 'Assistant'}: {m.content}"
        for m in req.messages[-10:]
    ]
    history_text = "\n".join(history_lines)

    prompt = f"""You are Lumina, a helpful AI medical assistant. The user has uploaded a medical report with these findings:

{req.report_context}

{'Previous conversation:' + chr(10) + history_text if history_text else ''}

User: {req.new_message}

Respond clearly and helpfully. Explain medical terms in plain language. Keep answers concise (2-4 sentences unless more detail is asked for). Do not diagnose — suggest consulting a doctor for medical decisions."""

    response = client.models.generate_content(
        model='gemini-3.5-flash',
        contents=prompt
    )
    return {"response": response.text}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)