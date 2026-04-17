import os
import uuid
import torch
import torchaudio
from pathlib import Path
import wave
import re
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request

# Prefer the soundfile backend to avoid torchcodec/ffmpeg DLL issues on Windows.
try:
    torchaudio.set_audio_backend("soundfile")
except Exception:
    pass

router = APIRouter(prefix="/api/audio", tags=["Audio"])

# Global placeholders for models
tts_model = None
tts_clone_model = None
bundle = None
asr_model = None
labels = None

generated_dir = Path(__file__).resolve().parent.parent / "generated"

def load_models():
    """Lazily load heavy ML models when the endpoint is first hit."""
    global tts_model, tts_clone_model, bundle, asr_model, labels
    device = "cuda" if torch.cuda.is_available() else "cpu"
    
    if tts_model is None:
        try:
            # For a reliable local dev experience (no voice sample required),
            # prefer a simple English single-speaker model that doesn't require
            # external phonemizers (e.g. espeak-ng).
            from TTS.api import TTS
            tts_model = TTS("tts_models/en/ljspeech/tacotron2-DDC").to(device)
        except Exception as e:
            print("Failed to load TTS model:", e)

    if tts_clone_model is None:
        try:
            # Voice cloning (needs a reference wav)
            from TTS.api import TTS
            # PyTorch 2.6+ uses weights_only=True by default for torch.load, which can
            # block unpickling some TTS config classes. XTTS checkpoints are expected
            # to include these configs, so we allowlist them.
            try:
                from TTS.tts.configs.xtts_config import XttsConfig
                if hasattr(torch, "serialization") and hasattr(torch.serialization, "add_safe_globals"):
                    torch.serialization.add_safe_globals([XttsConfig])
            except Exception:
                pass
            # As a robust fallback, patch torch.load to default to weights_only=False
            # for this process. This restores prior behavior needed by some XTTS
            # checkpoints. Only do this for trusted checkpoints.
            try:
                _orig_torch_load = torch.load

                def _torch_load_compat(*args, **kwargs):
                    if "weights_only" not in kwargs:
                        kwargs["weights_only"] = False
                    return _orig_torch_load(*args, **kwargs)

                torch.load = _torch_load_compat  # type: ignore[assignment]
            except Exception:
                pass
            tts_clone_model = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
        except Exception as e:
            print("Failed to load clone TTS model:", e)
            
    if asr_model is None:
        try:
            bundle = torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H
            asr_model = bundle.get_model().to(device)
            labels = bundle.get_labels()
        except Exception as e:
            print("Failed to load generic ASR bundle:", e)

def align_timestamps_heuristic(text: str, duration_sec: float):
    """Fallback cross-lingual heuristic for timestamps if true forced alignment isn't appropriate."""
    words = text.split()
    time_per_word = duration_sec / max(1, len(words))
    timestamps = []
    curr_time = 0.0
    for w in words:
        timestamps.append({"word": w, "start": round(curr_time, 2), "end": round(curr_time + time_per_word, 2)})
        curr_time += time_per_word
    return timestamps


def apply_emotion_markup(text: str, emotion: str) -> str:
    """
    Lightweight "prosody hinting" that nudges the TTS model.
    This is not true emotional TTS, but it helps intonation a bit.
    """
    base = re.sub(r"\s+", " ", text).strip()
    if not base:
        return base
    if emotion in {"joy", "surprise"}:
        return base.replace(".", "!").replace("?", "?!")
    if emotion in {"sadness"}:
        return base.replace(".", "...").replace("!", ".")
    if emotion in {"anger"}:
        return base.replace(".", "!").replace("?", "?!")
    if emotion in {"fear"}:
        return base.replace(".", "...").replace("!", "!")
    return base

@router.post("/generate")
async def generate_audio(
    request: Request,
    text: str = Form(...),
    target_language: str = Form(...),
    speaker_wav: UploadFile | None = File(None),
    voice_preset: str = Form("female"),
):
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text is required.")
        
    load_models()
    if tts_model is None:
        raise HTTPException(status_code=500, detail="TTS Model failed to load.")
        
    if target_language != "en":
        raise HTTPException(status_code=400, detail="Only English (en) is supported in default (non-clone) mode.")

    generated_dir.mkdir(parents=True, exist_ok=True)
    out_filename = f"gen_{uuid.uuid4()}.wav"
    out_path = str(generated_dir / out_filename)
    
    try:
        # Voice cloning is optional in this local-dev mode; speaker_wav is ignored.
        tts_model.tts_to_file(text=text, file_path=out_path)

        # Basic "male" preset: lower the WAV sample rate in header.
        # This makes playback deeper/slower without requiring ffmpeg/torchcodec.
        if voice_preset.lower() == "male":
            with wave.open(out_path, "rb") as rf:
                nch = rf.getnchannels()
                sw = rf.getsampwidth()
                sr = rf.getframerate()
                frames = rf.readframes(rf.getnframes())
            new_sr = max(8000, int(sr * 0.80))
            with wave.open(out_path, "wb") as wf:
                wf.setnchannels(nch)
                wf.setsampwidth(sw)
                wf.setframerate(new_sr)
                wf.writeframes(frames)

        with wave.open(out_path, "rb") as wf:
            frames = wf.getnframes()
            sample_rate = wf.getframerate()
            duration_sec = frames / float(sample_rate) if sample_rate else 0.0
        
        # 3. Timestamps
        # For true English torchaudio alignment, one would compute Trellis dynamic programming.
        # Because we support multi-lingual (es, fr, hi, etc.) where Wav2Vec2_English fails,
        # we dynamically default to a robust heuristic estimator across the board as the phase 1 backbone!
        timestamps = align_timestamps_heuristic(text, duration_sec)
        
        return {
            "audio_url": str(request.base_url).rstrip("/") + f"/generated/{out_filename}",
            "duration": duration_sec,
            "timestamps": timestamps
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")
    finally:
        # Keep generated file on disk so the frontend can fetch it.
        pass


@router.post("/generate-clone")
async def generate_audio_clone(
    request: Request,
    text: str = Form(...),
    target_language: str = Form(...),
    speaker_wav: UploadFile = File(...),
    emotive: bool = Form(False),
):
    """
    Voice cloning path: requires a reference wav.
    """
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text is required.")

    load_models()
    if tts_clone_model is None:
        raise HTTPException(status_code=500, detail="Clone TTS Model failed to load.")

    # XTTS supports many languages; we accept what UI sends, but fail early for empty.
    if not target_language.strip():
        raise HTTPException(status_code=400, detail="target_language is required.")

    generated_dir.mkdir(parents=True, exist_ok=True)
    out_filename = f"clone_{uuid.uuid4()}.wav"
    out_path = str(generated_dir / out_filename)

    speaker_path = str(generated_dir / f"spk_{uuid.uuid4()}.wav")
    try:
        with open(speaker_path, "wb") as f:
            f.write(await speaker_wav.read())

        final_text = text
        if emotive:
            # Very light emotion detection: reuse the same HF model as /api/analyze-tone
            try:
                from transformers import pipeline

                clf = pipeline(
                    "text-classification",
                    model="j-hartmann/emotion-english-distilroberta-base",
                    top_k=1,
                )
                emotion = clf(text[:2000])[0][0]["label"]
                final_text = apply_emotion_markup(text, emotion)
            except Exception:
                final_text = text

        tts_clone_model.tts_to_file(
            text=final_text,
            speaker_wav=speaker_path,
            language=target_language,
            file_path=out_path,
        )

        with wave.open(out_path, "rb") as wf:
            frames = wf.getnframes()
            sample_rate = wf.getframerate()
            duration_sec = frames / float(sample_rate) if sample_rate else 0.0

        timestamps = align_timestamps_heuristic(text, duration_sec)

        return {
            "audio_url": str(request.base_url).rstrip("/") + f"/generated/{out_filename}",
            "duration": duration_sec,
            "timestamps": timestamps,
            "mode": "clone",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")
    finally:
        try:
            if os.path.exists(speaker_path):
                os.remove(speaker_path)
        except Exception:
            pass
