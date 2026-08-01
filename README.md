<div align="center">
  <img width="100" height="100" alt="Lumina logo" src="https://github.com/user-attachments/assets/71ea2a8b-3959-47ef-bd9e-8e6007b19656" />
  <p><strong>Medical reports, decoded.</strong></p>
  <p>Drop a lab report PDF to instantly parse, visualize, and understand your health data.</p>
</div>

---

## Overview

Lumina turns dense, confusing medical PDF reports into clear, visual dashboards. Built for speed and privacy, it uses local parsing and fast LLMs to structure your data, highlight what needs attention, and let you ask natural questions about your health metrics.

![Lumina Demo](./public/demo.mp4)

## Key Features

- **Responsive Mobile Layout** — Beautifully optimized for mobile screens. Upload, read, and chat with your medical reports effortlessly on the go.
  
- **Visual Range Bars** — Instantly see exactly where your results fall within the normal reference ranges.
  
- **Smart Parsing** — Automatically extracts test names, full forms (e.g., MCH, WBC), values, and units from unstructured PDFs.
  
- **Lumi AI Bar** — A sleek, inline AI search bar at the top of your analysis report to answer any questions about your specific results instantly.

- **Local History & Trends** — Your reports are saved locally in your browser. Track how your health markers trend over time.

- **Bring Your Own Key (BYOK)** — Configure your own Groq API key and seamlessly switch between models directly from the Settings menu.

- **Print & Export** — Generate clean, formatted PDF summaries to share with your doctor.

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, custom Figma UI/UX layout.

- **Backend**: Python, FastAPI, PyPDF2 (Hosted as Native Vercel Serverless Functions).

- **AI Models**: Groq (`llama-3.3-70b-versatile` by default) for ultra-fast structured extraction and chat.

---

## Running Locally

### 1. Backend Setup

```bash
# Clone the repository
git clone https://github.com/nerdsuryansh/Lumina.git
cd Lumina

# Create a virtual environment and install dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configure your API key
cp .env.example .env
# Edit .env and add your Groq API key (free at https://console.groq.com)

# Start the server (Now running as a Vercel Serverless API)
python api/index.py
```

### 2. Frontend Setup

```bash
# In a new terminal window
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

<div align="center">
  Designed and built by <strong>Suryansh Pareek</strong>
</div>

## License

Copyright (c) 2026 Suryansh Pareek. All Rights Reserved.

This project is proprietary and confidential. Unauthorized copying, modification, or distribution is strictly prohibited.
