import io
import os
import json
from fastapi import FastAPI, File, UploadFile
import uvicorn
import PyPDF2
from pydantic import BaseModel
from google import genai
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "Lumina Backend is live!"}
client = genai.Client(api_key=os.environ.get("AQ.Ab8RN6JErwF5PU1Wb9fQdgMOtwRftJc9_t6O-oscmvkUDobnJA"))

class LabResult(BaseModel):
    test_name: str
    value: str
    normal_range: str
    status_badge: str

class MedicalSummary(BaseModel):
    summary: str
    results: list[LabResult]

@app.post("/upload/")
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()
    pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
    extracted_text = "".join(page.extract_text() for page in pdf_reader.pages if page.extract_text())

    response = client.models.generate_content(
        model='gemini-3.5-flash',
        contents=f"Extract the lab results and provide a summary for this medical text:\n{extracted_text}",
        config={
            'response_mime_type': 'application/json',
            'response_schema': MedicalSummary
        }
    )

    return json.loads(response.text)

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)