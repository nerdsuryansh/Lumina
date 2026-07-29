import io
import os
import re
import time
import json
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, File, UploadFile, HTTPException
import uvicorn
import PyPDF2
from pydantic import BaseModel

from groq import Groq
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

GROQ_API_KEY   = os.environ.get("GROQ_API_KEY")

groq_client   = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

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
    role: str
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
    if not groq_client:
        raise HTTPException(status_code=401, detail="No API key configured — add GROQ_API_KEY to .env")

    content = await file.read()
    pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
    extracted_text = "".join(
        page.extract_text() for page in pdf_reader.pages if page.extract_text()
    )
    extracted_text = extracted_text[:3000]

    if groq_client:
        for attempt in range(3):
            try:
                response = groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[
                        {
                            "role": "system",
                            "content": """You are a medical report analyzer. Read the report carefully and extract ALL lab test results that appear in the text. Return ONLY valid JSON.

STRICT STATUS CLASSIFICATION RULES:
- "Normal": value falls WITHIN the stated reference/normal range (including values like "<1.0" when the reference IS "<1.0")
- "Low": value is BELOW the minimum of the stated reference range
- "High": value is ABOVE the maximum of the stated reference range
- If a result has an interpretation table (e.g. hsCRP or Troponin risk categories), use the category that the value falls into: Low/Average/Moderate risk = Normal, High/Persistent risk = High.
- For "<X" values where the reference is also "<X" or the value satisfies the reference condition, classify as "Normal".
- CRITICAL: If a test name is listed with a unit (e.g. mg/dL) and a reference range (e.g. <20) but there is NO separate numerical result value given for the patient, it means the result is pending. Do NOT extract it. Do NOT use the reference range as the result. ONLY extract tests that have a clear patient result.

JSON format:
{"summary": "2-3 sentence clinical summary", "results": [{"test_name": "exact name (if abbreviation, include full form in brackets, e.g. 'MCH (Mean Corpuscular Hemoglobin)')", "value": "value with unit", "normal_range": "reference range", "status_badge": "Low|Normal|High"}]}"""
                        },
                        {
                            "role": "user",
                            "content": f"Medical report text:\n{extracted_text}"
                        }
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.0,
                    max_tokens=1200,
                )
                raw = response.choices[0].message.content
                data = json.loads(raw)
                for r in data.get("results", []):
                    s = r.get("status_badge", "Normal")
                    r["status_badge"] = s if s in ("Low", "Normal", "High") else "Normal"
                return data

            except Exception as e:
                err = str(e)
                if "401" in err or "authentication" in err.lower():
                    raise HTTPException(status_code=401, detail="Invalid Groq API key.")
                if "429" in err or "rate_limit" in err.lower():
                    if attempt < 2:
                        match = re.search(r'try again in ([\d.]+)s', err)
                        wait = float(match.group(1)) + 1 if match else 15
                        time.sleep(min(wait, 60))
                        continue
                    raise HTTPException(status_code=429, detail="Rate limit reached — please wait a moment and try again.")
                raise HTTPException(status_code=500, detail="Analysis failed — please try again.")


@app.post("/chat/")
async def chat(req: ChatRequest):
    if not groq_client:
        raise HTTPException(status_code=401, detail="No API key configured — add GROQ_API_KEY to .env")

    if groq_client:
        history = [{"role": m.role, "content": m.content} for m in req.messages[-10:]]
        messages = [
            {
                "role": "system",
                "content": f"You are Lumina, a helpful AI medical assistant. The user uploaded a medical report:\n\n{req.report_context}\n\nExplain medical terms clearly. Keep answers concise. Do not diagnose — suggest consulting a doctor."
            },
            *history,
            {"role": "user", "content": req.new_message}
        ]
        try:
            r = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                temperature=0.5,
            )
            return {"response": r.choices[0].message.content}
        except Exception as e:
            raise HTTPException(status_code=500, detail="Chat analysis failed — please try again.")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)