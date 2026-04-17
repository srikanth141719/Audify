import os

# Windows dev fix: avoid OpenMP duplicate runtime crash (PyTorch + NumPy/Sklearn).
# Best long-term fix is to ensure only one OpenMP runtime is present, but this
# env var unblocks local development.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

# Import modular ML routers
from routers import extract, tone, audio, nlp

app = FastAPI(
    title="Audify API",
    description="Backend API for the Audify SaaS application.",
    version="1.0.0"
)

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(extract.router)
app.include_router(tone.router)
app.include_router(audio.router)
app.include_router(nlp.router)

generated_dir = Path(__file__).parent / "generated"
generated_dir.mkdir(parents=True, exist_ok=True)
app.mount("/generated", StaticFiles(directory=str(generated_dir)), name="generated")

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Audify API is running"}

