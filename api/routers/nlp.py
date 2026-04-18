from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
from transformers import MarianMTModel, MarianTokenizer
import torch
import re

router = APIRouter(prefix="/api/nlp", tags=["NLP"])

# Lazy init (keeps startup fast in dev)
_summarizer_model = None
_summarizer_tokenizer = None
_translator_cache: dict[tuple[str, str], tuple[object, object]] = {}
_lang_aliases = {
    "english": "en",
    "spanish": "es",
    "french": "fr",
    "german": "de",
    "hindi": "hi",
    "japanese": "ja",
    "korean": "ko",
    "chinese": "zh-cn",
    "chinese-simplified": "zh-cn",
    "portuguese": "pt",
    "italian": "it",
    "russian": "ru",
    "arabic": "ar",
    "turkish": "tr",
    "dutch": "nl",
    "polish": "pl",
    "czech": "cs",
}


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


def normalize_lang_code(lang: str) -> str:
    cleaned = (lang or "").strip().lower().replace("_", "-")
    return _lang_aliases.get(cleaned, cleaned)


def split_text_for_seq2seq(text: str, max_chars: int = 2200) -> list[str]:
    compact = re.sub(r"\s+", " ", text).strip()
    if not compact:
        return []
    if len(compact) <= max_chars:
        return [compact]

    sentences = re.split(r"(?<=[.!?।！？])\s+", compact)
    chunks: list[str] = []
    current = ""
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        if len(s) > max_chars:
            if current:
                chunks.append(current.strip())
                current = ""
            for i in range(0, len(s), max_chars):
                part = s[i:i + max_chars].strip()
                if part:
                    chunks.append(part)
            continue
        if len(current) + len(s) + 1 <= max_chars:
            current = f"{current} {s}".strip()
        else:
            if current:
                chunks.append(current.strip())
            current = s
    if current:
        chunks.append(current.strip())
    return chunks


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
        # Fallback for unsupported local pairs.
        from deep_translator import GoogleTranslator

        class _OnlineTranslator:
            def __init__(self, src: str, tgt: str):
                self._t = GoogleTranslator(source=src, target=tgt)

            def translate(self, s: str) -> str:
                chunks = split_text_for_seq2seq(s, 4000)
                return " ".join([self._t.translate(c) for c in chunks if c.strip()])

        ot = _OnlineTranslator(source_language, target_language)
        _translator_cache[key] = (ot, None)
        return ot, None

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
                chunks = split_text_for_seq2seq(s, 4000)
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

        def summarize_chunk(chunk_text: str, out_min: int, out_max: int) -> str:
            inputs = tokenizer(chunk_text, return_tensors="pt", truncation=True, max_length=1024).to(device)
            summary_ids = model.generate(
                **inputs,
                max_length=out_max,
                min_length=max(10, min(out_min, out_max - 1)),
                do_sample=False,
                num_beams=5,
                length_penalty=1.0,
                no_repeat_ngram_size=3,
            )
            return tokenizer.decode(summary_ids[0], skip_special_tokens=True).strip()

        chunks = split_text_for_seq2seq(text, 2200)
        if not chunks:
            raise HTTPException(status_code=400, detail="Text cannot be empty.")

        # First pass: summarize each chunk so long texts are fully covered.
        first_pass = []
        for c in chunks:
            c_min = max(20, min_len // max(1, len(chunks)))
            c_max = max(60, min(max_len // max(1, len(chunks)) + 60, 180))
            first_pass.append(summarize_chunk(c, c_min, c_max))

        combined = " ".join([p for p in first_pass if p]).strip()
        if not combined:
            combined = text[:3000]

        # Second pass: produce coherent final summary across all chunk summaries.
        final_min = max(20, min_len)
        final_max = max(final_min + 20, max_len)
        summary_text = summarize_chunk(combined, final_min, final_max)
        return {"summary": summary_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")


@router.post("/translate")
async def translate(req: TranslateRequest):
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    src = normalize_lang_code(req.source_language)
    tgt = normalize_lang_code(req.target_language)
    if not src or not tgt:
        raise HTTPException(status_code=400, detail="source_language and target_language are required.")
    if src == tgt:
        return {
            "original_text": text,
            "translated_text": text,
            "audiobook_text": text,
            "source_language": src,
            "target_language": tgt,
        }

    try:
        model, tokenizer = get_translator(src, tgt)
        if tokenizer is None:
            # Online fallback
            translated = model.translate(text)  # type: ignore[union-attr]
        else:
            device = "cuda" if torch.cuda.is_available() else "cpu"
            model = model.to(device)
            translated_parts: list[str] = []
            for c in split_text_for_seq2seq(text, 1600):
                inputs = tokenizer(c, return_tensors="pt", truncation=True, max_length=512).to(device)
                gen = model.generate(
                    **inputs,
                    max_length=512,
                    num_beams=5,
                    no_repeat_ngram_size=3,
                )
                translated_parts.append(tokenizer.decode(gen[0], skip_special_tokens=True))
            translated = " ".join([p.strip() for p in translated_parts if p.strip()])
        if not translated:
            raise RuntimeError("Empty translation output.")
        return {
            "original_text": text,
            "translated_text": translated,
            "audiobook_text": translated,
            "source_language": src,
            "target_language": tgt,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

