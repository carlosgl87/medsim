# MedSim — Simulador Clínico con IA

A medical education simulator that uses Claude AI to generate virtual patients
with randomized diseases. Students practice clinical reasoning by interviewing
the patient, ordering lab tests, forming a diagnosis, and receiving detailed
AI-powered feedback.

---

## Project Structure

```
medsim/
├── backend/                  # FastAPI Python backend
│   ├── main.py               # API endpoints (6 routes)
│   ├── patient_agent.py      # All Claude API interactions
│   ├── diseases.json         # 20 disease profiles with lab values and rubrics
│   ├── scoring.py            # (redirects to patient_agent.py)
│   ├── sessions/             # Auto-created; stores session JSON files
│   ├── requirements.txt      # Python dependencies
│   ├── .env                  # Your API key — CREATE THIS (see Step 1)
│   └── .env.example          # Template for the .env file
│
└── frontend/                 # React + Vite + Tailwind CSS frontend
    ├── src/
    │   ├── App.jsx            # Root component: Router + Navbar + Routes
    │   ├── config.js          # API_URL constant (http://localhost:8000)
    │   ├── main.jsx           # React entry point (mounts App into #root)
    │   ├── index.css          # Tailwind directives + global styles
    │   └── pages/
    │       ├── NewPatient.jsx # 5-stage simulation flow
    │       └── History.jsx    # Session history grid + detail modal
    ├── index.html             # HTML shell with Google Fonts
    ├── package.json           # Node.js dependencies
    ├── vite.config.js         # Vite bundler configuration
    ├── tailwind.config.js     # Tailwind custom colors (navy, teal)
    └── postcss.config.js      # PostCSS (required by Tailwind)
```

---

## Prerequisites

Before starting, make sure you have installed:

| Tool | Version | Check with |
|------|---------|------------|
| Python | 3.10 or newer | `python --version` |
| pip | (comes with Python) | `pip --version` |
| Node.js | 18 or newer | `node --version` |
| npm | (comes with Node.js) | `npm --version` |

You also need an **Anthropic API key**. Get one at <https://console.anthropic.com>.

---

## Setup & Run

### Step 1 — Configure the API Key

The backend reads your Anthropic API key from a `.env` file.
This file is **not** committed to version control (it's in `.gitignore`)
because it contains a secret credential that must never be shared publicly.

```bash
# Navigate to the backend folder
cd medsim/backend

# Copy the example template to create your own .env file
# On Windows (Command Prompt):
copy .env.example .env

# On macOS / Linux / Git Bash:
cp .env.example .env
```

Now open the newly created `medsim/backend/.env` file in any text editor
and replace `your_key_here` with your real Anthropic API key:

```
# medsim/backend/.env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> **Security note:** Never paste your API key directly into Python source code
> or commit the `.env` file to a repository. The `.env.example` file (with a
> placeholder value) is safe to commit — the real `.env` file is not.

---

### Step 2 — Install Backend Dependencies

```bash
# Make sure you are in the backend folder
cd medsim/backend

# (Recommended) Create and activate a virtual environment first.
# This keeps MedSim's packages isolated from your system Python.
#
# On Windows:
python -m venv venv
venv\Scripts\activate
#
# On macOS / Linux:
python -m venv venv
source venv/bin/activate

# Install all required Python packages listed in requirements.txt
pip install -r requirements.txt
```

`requirements.txt` installs:
- **FastAPI** — async web framework that powers the API
- **Uvicorn** — ASGI server that runs FastAPI (like gunicorn but for async)
- **Anthropic** — official Python SDK for the Claude API
- **python-dotenv** — reads the `.env` file into environment variables
- **Pydantic** — validates request/response data shapes

---

### Step 3 — Run the FastAPI Backend

```bash
# From the medsim/backend/ folder (with venv activated):
uvicorn main:app --reload
```

**What this command does:**
- `uvicorn` — starts the ASGI server
- `main:app` — loads the `app` object from `main.py`
- `--reload` — automatically restarts the server whenever you save a `.py` file
  (development-only flag; remove it in production)

**Expected output:**
```
INFO:     Will watch for changes in these directories: ['...backend']
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Application startup complete.
```

The backend is now running at **<http://localhost:8000>**.

> **Keep this terminal open.** The backend must be running while you use the app.

---

### Step 4 — Install Frontend Dependencies

Open a **new terminal** (keep the backend terminal running):

```bash
# Navigate to the frontend folder
cd medsim/frontend

# Install all Node.js packages listed in package.json
npm install
```

`package.json` installs:
- **React** — UI component library
- **React DOM** — renders React components into the browser DOM
- **React Router DOM** — client-side routing (/new-patient, /history)
- **Axios** — HTTP client for calling the FastAPI backend
- **Tailwind CSS** — utility-first CSS framework
- **Vite** — fast development server and build tool
- **PostCSS + Autoprefixer** — CSS processing pipeline required by Tailwind

---

### Step 5 — Run the React Frontend

```bash
# From the medsim/frontend/ folder:
npm run dev
```

**Expected output:**
```
  VITE v5.x.x  ready in 300 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Vite will automatically open <http://localhost:5173> in your default browser.
If it doesn't, open it manually.

> **Keep this terminal open too.** Both the backend (port 8000) and the
> frontend (port 5173) must run simultaneously.

---

## Running URLs

| Service | URL | Description |
|---------|-----|-------------|
| Frontend (React app) | <http://localhost:5173> | The student-facing UI |
| Backend API | <http://localhost:8000> | FastAPI server |
| Interactive API docs | <http://localhost:8000/docs> | Swagger UI — test endpoints manually |
| Alternative API docs | <http://localhost:8000/redoc> | ReDoc — cleaner read-only reference |

> **Tip:** The Swagger UI at `/docs` is extremely useful during development.
> You can call any endpoint directly from the browser to test it without
> needing the frontend. FastAPI generates this documentation automatically
> from your Python code and Pydantic models.

---

## The 5-Stage Simulation Flow

Each simulation session takes a student through five sequential stages:

### Stage 1 — Anamnesis (Patient Interview)
The backend randomly selects one of 20 diseases from `diseases.json` and
generates a fictional patient (name, age, weight, height, sex, and a
backstory written by Claude). The student interviews the virtual patient
through a real-time chat interface. The patient — played by Claude with a
carefully crafted system prompt — answers in conversational Spanish,
describes symptoms without using medical terminology, and never reveals
the diagnosis.

### Stage 2 — Lab Test Selection
The student selects from a searchable catalog of ~25 common laboratory
tests grouped by category (hematology, blood chemistry, electrolytes,
urology, immunology, microbiology, imaging). Tests relevant to the disease
return realistic abnormal values; unrelated tests return "within normal
parameters." This stage evaluates the student's ability to order targeted,
clinically justified tests rather than an exhaustive panel.

### Stage 3 — Lab Results
The requested lab results are displayed in a table. Abnormal values are
highlighted in red/orange with a warning badge. Normal results are marked
with a green checkmark.

### Stage 4 — Diagnosis Submission
The student fills in two fields:
- **Primary diagnosis** — the name of the condition they believe the patient has
- **Clinical reasoning** — a free-text explanation connecting symptoms, history,
  and lab findings to the diagnosis

### Stage 5 — AI Evaluation
Claude evaluates the student's performance against the disease's scoring rubric
using adaptive thinking (extended reasoning mode). The score is broken down into
four categories of 25 points each:

| Category | What it measures |
|----------|-----------------|
| **Anamnesis** (0–25) | Did the student ask the key questions from the rubric? |
| **Lab selection** (0–25) | Were the ordered tests clinically appropriate and complete? |
| **Diagnosis** (0–25) | Is the proposed diagnosis correct (or reasonably close)? |
| **Reasoning** (0–25) | Does the written reasoning integrate evidence correctly? |

The student receives written feedback per category, the correct diagnosis
revealed, and an overall summary from Claude.

---

## API Endpoints Reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/session/start` | Start a new session; returns `session_id` + patient profile |
| `POST` | `/session/chat` | Send a message to the patient; returns patient's response |
| `POST` | `/session/labs` | Request lab tests; returns results dict |
| `POST` | `/session/diagnose` | Submit diagnosis; returns score breakdown (0–100) |
| `GET` | `/history` | List all completed sessions with scores |
| `GET` | `/session/{session_id}` | Full session data including disease and conversation |

All sessions are persisted as JSON files in `backend/sessions/` with the
session UUID as the filename. Each file contains the complete session state:
patient profile, full conversation history, lab results, student diagnosis,
and scoring results.

---

## Troubleshooting

**`Error: ANTHROPIC_API_KEY not found`**
→ Make sure `medsim/backend/.env` exists and contains a valid key (not the placeholder).

**`ModuleNotFoundError: No module named 'fastapi'`**
→ Your virtual environment may not be activated. Run `venv\Scripts\activate` (Windows)
or `source venv/bin/activate` (Mac/Linux) before starting the backend.

**`CORS error` in the browser console**
→ The backend is not running. Start it with `uvicorn main:app --reload` in a
separate terminal from the `medsim/backend/` folder.

**Frontend shows "Error al iniciar la sesión"**
→ Check that the backend is running at `http://localhost:8000`. You can verify
by visiting `http://localhost:8000/docs` in your browser.

**`npm install` fails with node version errors**
→ Update Node.js to version 18 or newer from <https://nodejs.org>.
