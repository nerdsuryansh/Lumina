<div align="center">
  
  <img width="100" height="100" alt="Plugin icon - 1" src="https://github.com/user-attachments/assets/71ea2a8b-3959-47ef-bd9e-8e6007b19656" />
  <p><strong>A Smart Medical Report Visualizer & Explainer</strong></p>
  <p>Upload any medical lab report PDF and get instant AI-powered insights — summaries, status badges, visual range bars, and a chat assistant to answer your questions.</p>

  ![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python&logoColor=white)
  ![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat&logo=fastapi&logoColor=white)
  ![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)
  ![Gemini](https://img.shields.io/badge/Gemini_AI-API-4285F4?style=flat&logo=google&logoColor=white)
  ![Figma](https://img.shields.io/badge/Figma-F24E1E?style=flat&logo=figma&logoColor=white)
</div>

---

## Features

- **PDF Upload & Preview** — Drag & drop or click to upload. The PDF renders live in the left panel.
- **AI-Powered Analysis** — Gemini extracts all lab test results and generates a clinical summary automatically.
- **Visual Range Bars** — Each result shows a glowing dot on a bar indicating where the value falls relative to the normal range.
- **Status Badges** — Every test is classified as `Low`, `Normal`, or `High` with color-coded badges.
- **Ask Lumina AI** — Chat with an AI assistant about your report. Ask follow-up questions like *"What foods help improve my hemoglobin?"*
- **Report History** — All analyzed reports are saved locally. Revisit past results anytime.
- **Trend View** — Upload multiple reports over time and see how your lab values are trending on a chart.
- **Export PDF** — Print or save the analysis as a clean PDF report.

---

## Preview

> Upload a medical report → Get instant AI analysis with visual indicators and chat support.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Design** | Custom Figma UI/UX Layout |
| **Frontend** | React 18 + TypeScript + Vite |
| **Backend** | Python + FastAPI + Uvicorn |
| **AI** | Google Gemini API (`gemini-3.5-flash`) |
| **PDF Parsing** | PyPDF2 |
| **Styling** | Inline styles + Plus Jakarta Sans |

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)

---

### 1. Clone the repo

```bash
git clone https://github.com/your-username/Lumina.git
cd Lumina
```

### 2. Set up the backend

```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Add your Gemini API key
cp .env.example .env
# Then open .env and replace "your_gemini_api_key_here" with your actual key
# Get a free key at: https://aistudio.google.com/app/apikey

# Start the backend
python main.py
```

The API will be live at `http://127.0.0.1:8000`

### 3. Set up the frontend

```bash
# In a new terminal
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 📁 Project Structure

```
Lumina/
├── main.py           # FastAPI backend — PDF parsing + Gemini API
├── index.tsx         # React frontend — full UI
├── main.tsx          # React entry point
├── index.html        # HTML shell
├── vite.config.ts    # Vite bundler config
├── package.json      # Frontend dependencies
├── requirements.txt  # Python dependencies
└── logo.png          # Lumina logo
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Your Google Gemini API key (required) |

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first.

---

## License

Copyright (c) 2026 Suryansh Pareek. All Rights Reserved.

---

<div align="center">
  Made with ❤️ by <strong>Suryansh ;)</strong>
</div>
