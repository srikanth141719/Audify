# Audify

Audify is a SaaS platform that transforms text and documents into high-quality generated audio. It features a complete pipeline for document extraction, natural language processing, tone analysis, and Text-To-Speech (TTS) generation.

The project is built using a modern decoupled architecture:
- **Frontend**: Next.js (React), Tailwind CSS, Supabase SSR
- **Backend / API**: FastAPI (Python), PyTorch, Coqui TTS, Hugging Face Transformers
- **Database / Auth**: Supabase (PostgreSQL)

## Features

- **Document Parsing**: Extract text from PDF, DOCX, and other file types seamlessly.
- **Tone & NLP Analysis**: Analyze the mood and context of the text automatically.
- **Multilingual TTS**: Generate lifelike speech across multiple languages using state-of-the-art TTS models.
- **Real-Time Word Highlighting**: Synchronized word highlighting during audio playback in the dashboard.
- **Dashboard Ecosystem**: User authentication, role management, and history tracking.

## Project Structure

- `/web` - The frontend application built with Next.js 14 and React 18.
- `/api` - The FastAPI backend carrying out ML tasks like NLP, extraction, and Audio Generation.

---

## Setup & Installation

### Prerequisites
- [Node.js](https://nodejs.org/en/) (v18 or higher)
- [Python](https://www.python.org/) (3.10 recommended)
- Your own [Supabase](https://supabase.com/) project for Database & Auth.

### 1. Backend Setup (API)

It is highly recommended to use a virtual environment (`venv` or `conda`) to avoid dependency conflicts with other python projects.

```bash
# 1. Navigate to the API folder
cd api

# 2. Create and activate a Virtual Environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# 3. Install all the necessary dependencies
# Note: Ensure you have compatible C++ build tools installed for libraries like PyTorch or deep-translator if needed.
pip install -r requirements.txt

# 4. Start the FastAPI server
uvicorn main:app --host 127.0.0.1 --port 8001
```

> **Note**: The backend uses port `8001`. The API will be available at `http://127.0.0.1:8001`. You can view the swagger documentation at `http://127.0.0.1:8001/docs`.

### 2. Frontend Setup (Web)

```bash
# 1. Navigate to the web folder
cd web

# 2. Install NPM dependencies
npm install

# 3. Set up environment variables
# Note: You need to create a .env.local file in the web directory based on your Supabase credentials
# cp .env.example .env.local

# 4. Start the Next.js development server
npm run dev
```

> **Note**: The frontend uses port `3000`. The website will be available at `http://localhost:3000`.

## Environment Variables

### Frontend (`web/.env.local`)
Create a `.env.local` file in the `web` directory and provide the following keys from your Supabase setup:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Backend (`api/.env`)
Create a `.env` file in the `api` directory if your backend requires additional secret configurations or API keys for extraction APIs.

## License
MIT License
