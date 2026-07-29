<div align="center">
  <img width="100" height="100" alt="Lumina logo" src="https://github.com/user-attachments/assets/71ea2a8b-3959-47ef-bd9e-8e6007b19656" />
  <p><strong>A beautifully designed medical report visualizer and explainer.</strong></p>
  <p>Drop a lab report PDF to instantly parse, visualize, and understand your health data.</p>
</div>

---

## Overview

Lumina turns dense, confusing medical PDF reports into clear, visual dashboards. Built for speed and privacy, it uses local parsing and fast LLMs to structure your data, highlight what needs attention, and let you ask natural questions about your health metrics.

![Lumina Demo](./public/demo.gif)

## Key Features

- **Visual Range Bars** — Instantly see exactly where your results fall within the normal reference ranges.
  
- **Smart Parsing** — Automatically extracts test names, full forms (e.g., MCH, WBC), values, and units from unstructured PDFs.
  
- **Lumi AI Assistant** — A sleek, floating chat widget to answer any questions about your specific results.

- **Local History & Trends** — Your reports are saved locally in your browser. Track how your health markers trend over time.

- **Print & Export** — Generate clean, formatted PDF summaries to share with your doctor.

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, custom Figma UI/UX layout.

- **Backend**: Python, FastAPI, PyPDF2.

- **AI Models**: Groq (`llama-3.3-70b-versatile`) for ultra-fast structured extraction and chat.

---

## Running Locally

### 1. Backend Setup

```bash
# Clone the repository
git clone https://github.com/your-username/Lumina.git
cd Lumina

# Create a virtual environment and install dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configure your API key
cp .env.example .env
# Edit .env and add your Groq API key (free at https://console.groq.com)

# Start the server
python main.py
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
