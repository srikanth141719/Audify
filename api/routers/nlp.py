from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
from transformers import MarianMTModel, MarianTokenizer
import torch

router = APIRouter(prefix="/api/nlp", tags=["NLP"])

# Lazy init (keeps startup fast in dev)
_summarizer_model = None
_summarizer_tokenizer = None
_translator_cache: dict[tuple[str, str], tuple[object, object]] = {}


class SummarizeRequest(BaseModel):
    text: str
    max_length: int | None = 200
    min_length: int | None = 50


class TranslateRequest(BaseModel):
    text: str
    source_language: str
    target_language: str


def get_summarizer():
    global _summarizer_model, _summarizer_tokenizer
    if _summarizer_model is None or _summarizer_tokenizer is None:
        model_name = "sshleifer/distilbart-cnn-12-6"
        _summarizer_tokenizer = AutoTokenizer.from_pretrained(model_name)
        _summarizer_model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
    return _summarizer_model, _summarizer_tokenizer


def get_translator(source_language: str, target_language: str):
    key = (source_language, target_language)
    if key in _translator_cache:
        return _translator_cache[key]

    # Keep this intentionally limited to avoid downloading very large multilingual models.
    # Add more pairs as needed.
    model_map: dict[tuple[str, str], str] = {
        ("en", "es"): "Helsinki-NLP/opus-mt-en-es",
        ("es", "en"): "Helsinki-NLP/opus-mt-es-en",
        ("en", "fr"): "Helsinki-NLP/opus-mt-en-fr",
        ("fr", "en"): "Helsinki-NLP/opus-mt-fr-en",
        ("en", "de"): "Helsinki-NLP/opus-mt-en-de",
        ("de", "en"): "Helsinki-NLP/opus-mt-de-en",
    }

    model_name = model_map.get(key)
    if not model_name:
        raise HTTPException(
            status_code=400,
            detail=f"Translation pair not supported yet: {source_language} -> {target_language}.",
        )

    # Some environments ship a Transformers build where Marian isn't wired into AutoTokenizer.
    # Use the explicit Marian classes for these translation models.
    try:
        if "Helsinki-NLP/opus-mt" in model_name:
            tokenizer = MarianTokenizer.from_pretrained(model_name)
            model = MarianMTModel.from_pretrained(model_name)
        else:
            tokenizer = AutoTokenizer.from_pretrained(model_name)
            model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
        _translator_cache[key] = (model, tokenizer)
        return model, tokenizer
    except Exception:
        # Fallback to a lightweight online translator if local model loading/tokenizers
        # aren't available in the current environment.
        from deep_translator import GoogleTranslator

        class _OnlineTranslator:
            def __init__(self, src: str, tgt: str):
                self._t = GoogleTranslator(source=src, target=tgt)

            def translate(self, s: str) -> str:
                # Avoid 5000 limit for deep-translator
                chunks = [s[i:i+4500] for i in range(0, len(s), 4500)]
                return " ".join([self._t.translate(c) for c in chunks if c.strip()])

        ot = _OnlineTranslator(source_language, target_language)
        _translator_cache[key] = (ot, None)
        return ot, None


@router.post("/summarize")
async def summarize(req: SummarizeRequest):
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    max_len = int(req.max_length or 200)
    min_len = int(req.min_length or 50)
    if min_len >= max_len:
        raise HTTPException(status_code=400, detail="min_length must be < max_length.")

    try:
        model, tokenizer = get_summarizer()
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = model.to(device)

        chunk = text[:3500]
        inputs = tokenizer(chunk, return_tensors="pt", truncation=True, max_length=1024).to(device)
        summary_ids = model.generate(
            **inputs,
            max_length=max_len,
            min_length=min_len,
            do_sample=False,
            num_beams=4,
        )
        summary_text = tokenizer.decode(summary_ids[0], skip_special_tokens=True)
        return {"summary": summary_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")


@router.post("/translate")
async def translate(req: TranslateRequest):
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    src = (req.source_language or "").strip().lower()
    tgt = (req.target_language or "").strip().lower()
    if not src or not tgt:
        raise HTTPException(status_code=400, detail="source_language and target_language are required.")
    if src == tgt:
        return {"translated_text": text}

    try:
        model, tokenizer = get_translator(src, tgt)
        chunk = text[:15000]

        if tokenizer is None:
            # Online fallback
            translated = model.translate(chunk)  # type: ignore[union-attr]
        else:
            device = "cuda" if torch.cuda.is_available() else "cpu"
            model = model.to(device)
            inputs = tokenizer(chunk, return_tensors="pt", truncation=True, max_length=512).to(device)
            gen = model.generate(**inputs, max_length=512, num_beams=4)
            translated = tokenizer.decode(gen[0], skip_special_tokens=True)
        if not translated:
            raise RuntimeError("Empty translation output.")
        return {"translated_text": translated}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

