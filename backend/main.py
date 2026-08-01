import io
import os
import re
import time
import json
from dotenv import load_dotenv
load_dotenv(override=True)
from fastapi import FastAPI, File, UploadFile, HTTPException, Request, Form
import uvicorn
import PyPDF2
from pydantic import BaseModel
import re
import time

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

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
print("LOADED API KEY:", GROQ_API_KEY[:10] + "..." if GROQ_API_KEY else "NONE")

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
    model: str = "llama-3.1-8b-instant"

# ─── Routes ──────────────────────────────────────────────────────────────────

@app.get("/api/")
async def root():
    return {"status": "Lumina Backend is live!"}

@app.post("/api/upload/")
async def upload_file(req: Request, file: UploadFile = File(...), model: str = Form("llama-3.1-8b-instant")):
    auth_header = req.headers.get("Authorization")
    client = groq_client
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            client = Groq(api_key=token)
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid Groq API key provided in headers.")

    if not client:
        raise HTTPException(status_code=401, detail="No API key configured — add GROQ_API_KEY to .env")

    content = await file.read()
    pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
    extracted_text = "".join(
        page.extract_text() for page in pdf_reader.pages if page.extract_text()
    )
    extracted_text = extracted_text[:3000]

    if client:
        for attempt in range(3):
            try:
                response = client.chat.completions.create(
                    model=model,
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
- CRITICAL ACRONYM RULE: If a test name is an acronym or abbreviation (like WBC, MCV, LDL, hsCRP), you MUST provide its full expanded medical name in parentheses, even if it is not written in the report. Format exactly as: "Acronym (Full Form)", for example: "WBC (White Blood Cells)" or "HDL (High-Density Lipoprotein)". EVERY abbreviation must have a full form.

- CRITICAL SUMMARY RULE: For the `summary` field, write a comprehensive, highly empathetic, and patient-friendly medical summary (3-5 sentences). Write directly to the patient ("Your report indicates..."). Explicitly highlight any High or Low out-of-range results and explain what they generally mean in simple, reassuring terms. Acknowledge the normal results to provide peace of mind. Avoid overly dense medical jargon.

JSON format:
{"summary": "A comprehensive, empathetic, patient-friendly summary (3-5 sentences)", "results": [{"test_name": "Acronym (Full Form)", "value": "value with unit", "normal_range": "reference range", "status_badge": "Low|Normal|High"}]}"""
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
                    match = re.search(r'try again in ([\dhms.]+)', err)
                    if match:
                        wait_str = match.group(1)
                        raise HTTPException(status_code=429, detail=f"Rate limit reached. Please wait {wait_str}")
                    else:
                        raise HTTPException(status_code=429, detail="Quota exceeded.")
                
                if attempt < 2:
                    time.sleep(2) # Short wait for generic/parse errors before retry
                    continue

                
                print(f"Error in upload: {e}")
                raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/api/chat/")
async def chat(req: Request, chat_req: ChatRequest):
    auth_header = req.headers.get("Authorization")
    client = groq_client
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            client = Groq(api_key=token)
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid Groq API key provided in headers.")

    if not client:
        raise HTTPException(status_code=401, detail="No API key configured — add GROQ_API_KEY to .env or provide it in the app.")

    if client:
        history = [{"role": m.role, "content": m.content} for m in chat_req.messages[-10:]]
        messages = [
            {
                "role": "system",
                "content": f"You are Lumina, a helpful AI medical assistant. The user uploaded a medical report:\n\n{chat_req.report_context}\n\nExplain medical terms clearly. Keep answers concise. Do not diagnose — suggest consulting a doctor."
            },
            *history,
            {"role": "user", "content": chat_req.new_message}
        ]
        
        for attempt in range(3):
            try:
                r = client.chat.completions.create(
                    model=chat_req.model,
                    messages=messages,
                    temperature=0.5,
                )
                return {"response": r.choices[0].message.content}
            except Exception as e:
                err = str(e)
                if "401" in err or "authentication" in err.lower():
                    raise HTTPException(status_code=401, detail="Invalid Groq API key.")
                
                if "429" in err or "rate_limit" in err.lower():
                    match = re.search(r'try again in ([\dhms.]+)', err)
                    if match:
                        wait_str = match.group(1)
                        raise HTTPException(status_code=429, detail=f"Rate limit reached. Please wait {wait_str}")
                    else:
                        raise HTTPException(status_code=429, detail="Quota exceeded.")
                
                if attempt < 2:
                    time.sleep(1)
                    continue
                
                print(f"Error in chat: {e}")
                raise HTTPException(status_code=500, detail="Chat failed. Please try again.")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

# WSGI Wrapper for PythonAnywhere
try:
    from a2wsgi import ASGIMiddleware
    application = ASGIMiddleware(app)
except ImportError:
    pass