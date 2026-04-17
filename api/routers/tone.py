from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from transformers import pipeline

router = APIRouter(prefix="/api/analyze-tone", tags=["Tone"])

# Initialize HF pipeline
# j-hartmann/emotion-english-distilroberta-base classifies into anger, disgust, fear, joy, neutral, sadness, surprise
classifier_pipeline = pipeline("text-classification", model="j-hartmann/emotion-english-distilroberta-base", top_k=1)

class ToneRequest(BaseModel):
    text: str

@router.post("/")
async def analyze_tone(req: ToneRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
        
    # We truncate to 512 tokens roughly to prevent model crash on huge texts.
    # DistilRoBERTa accepts max 512 length sequence length.
    truncated_text = req.text[:2000] 
    
    try:
        results = classifier_pipeline(truncated_text)
        # Results format: [[{'label': 'joy', 'score': 0.9}]]
        top_emotion = results[0][0]['label']
        confidence = results[0][0]['score']
        
        return {
            "tone": top_emotion,
            "confidence": confidence
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze tone: {str(e)}")
