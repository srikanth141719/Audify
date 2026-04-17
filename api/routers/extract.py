from fastapi import APIRouter, UploadFile, File, HTTPException
import fitz  # PyMuPDF
import docx
import easyocr
from langdetect import detect, DetectorFactory
from typing import Dict
import io

DetectorFactory.seed = 0

router = APIRouter(prefix="/api/extract", tags=["Extactor"])

# Lazy loading OCR
reader = None

def get_ocr_reader():
    global reader
    if reader is None:
        # Load English and perhaps Spanish by default, we can add more if needed
        reader = easyocr.Reader(['en', 'es'])
    return reader

@router.post("/")
async def extract_text(file: UploadFile = File(...)) -> Dict[str, str]:
    content = await file.read()
    filename = file.filename.lower()
    text = ""

    try:
        if filename.endswith(".txt"):
            text = content.decode("utf-8")
            
        elif filename.endswith(".pdf") or filename.endswith(".epub"):
            # fitz can handle pdf and epub
            with fitz.open(stream=content, filetype="pdf" if filename.endswith(".pdf") else "epub") as doc:
                text = chr(10).join([page.get_text() for page in doc])
                
        elif filename.endswith(".docx"):
            # docx needs a file-like object
            doc = docx.Document(io.BytesIO(content))
            text = "\n".join([para.text for para in doc.paragraphs])
            
        elif filename.endswith((".png", ".jpg", ".jpeg")):
            ocr = get_ocr_reader()
            result = ocr.readtext(content, detail=0)
            text = " ".join(result)
            
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type.")
        
        # Clean up text
        text = text.strip()
        if not text:
            raise HTTPException(status_code=400, detail="No text could be extracted from this file.")
            
        # Detect language
        try:
            lang = detect(text)
        except:
            lang = "unknown"
            
        return {
            "text": text,
            "language": lang
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
