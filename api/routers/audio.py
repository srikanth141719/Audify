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

def split_into_sentences(text: str, max_chars: int = 200) -> list[str]:
    # A simple heuristic to avoid TTS sequence length errors (like 616 > 512)
    sentences = re.split(r'(?<=[.!?¡¿।\n])\s+', text.strip())
    chunks = []
    current_chunk = ""
    for s in sentences:
        if not s.strip(): continue
        # if a single sentence is huge, hard slice it
        while len(s) > max_chars:
            chunks.append(s[:max_chars])
            s = s[max_chars:]
        if len(current_chunk) + len(s) < max_chars:
            current_chunk += s + " "
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = s + " "
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
    return [c for c in chunks if c.strip()]

@router.post("/save-voice")
async def save_voice(file: UploadFile = File(...)):
    """Saves a cloned voice reference permanently to backend storage."""
    voices_dir = Path(__file__).resolve().parent.parent / "voices"
    voices_dir.mkdir(parents=True, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1] or ".wav"
    vid = str(uuid.uuid4())
    save_path = voices_dir / f"{vid}{ext}"
    with open(save_path, "wb") as f:
        f.write(await file.read())
    return {"voice_id": f"{vid}{ext}"}

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
        
    generated_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. Non-English Fallback Check (Default Male/Female uses Google TTS if no clone)
    if target_language != "en":
        try:
            from gtts import gTTS
            out_filename = f"gen_{uuid.uuid4()}.mp3"
            out_path = str(generated_dir / out_filename)
            tts = gTTS(text=text, lang=target_language, slow=False)
            tts.save(out_path)
            duration_sec = len(text) / 15.0 # Rough approx: 15 chars per sec for timestamps
            timestamps = align_timestamps_heuristic(text, duration_sec)
            return {
                "audio_url": str(request.base_url).rstrip("/") + f"/generated/{out_filename}",
                "duration": duration_sec,
                "timestamps": timestamps
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"gTTS Fallback failed: {str(e)}")

    load_models()
    if tts_model is None:
        raise HTTPException(status_code=500, detail="TTS Model failed to load.")
        
    out_filename = f"gen_{uuid.uuid4()}.wav"
    out_path = str(generated_dir / out_filename)
    
    try:
        chunks = split_into_sentences(text, 250)
        temp_wavs = []
        for c in chunks:
            tmp_p = str(generated_dir / f"tmp_{uuid.uuid4()}.wav")
            tts_model.tts_to_file(text=c, file_path=tmp_p)
            temp_wavs.append(tmp_p)
            
        try:
            from pydub import AudioSegment
            combined = AudioSegment.from_wav(temp_wavs[0])
            for w in temp_wavs[1:]:
                combined += AudioSegment.from_wav(w)
            combined.export(out_path, format="wav")
        except:
            # simple single chunk fallback if pydub fails
            tts_model.tts_to_file(text=text[:500], file_path=out_path)
            
        for w in temp_wavs:
            if os.path.exists(w): os.remove(w)

        if voice_preset.lower() == "male":
            try:
                with wave.open(out_path, "rb") as rf:
                    nch, sw, sr = rf.getnchannels(), rf.getsampwidth(), rf.getframerate()
                    frames = rf.readframes(rf.getnframes())
                new_sr = max(8000, int(sr * 0.80))
                with wave.open(out_path, "wb") as wf:
                    wf.setnchannels(nch)
                    wf.setsampwidth(sw)
                    wf.setframerate(new_sr)
                    wf.writeframes(frames)
            except: pass

        duration_sec = 0.0
        try:
            with wave.open(out_path, "rb") as wf:
                duration_sec = wf.getnframes() / float(wf.getframerate()) if wf.getframerate() else 0.0
        except: pass
        if duration_sec <= 0: duration_sec = len(text) / 15.0
        
        timestamps = align_timestamps_heuristic(text, duration_sec)
        
        return {
            "audio_url": str(request.base_url).rstrip("/") + f"/generated/{out_filename}",
            "duration": duration_sec,
            "timestamps": timestamps
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@router.post("/generate-clone")
async def generate_audio_clone(
    request: Request,
    text: str = Form(...),
    target_language: str = Form(...),
    speaker_wav: UploadFile | None = File(None),
    voice_id: str | None = Form(None),
    emotive: bool = Form(False),
):
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text is required.")

    load_models()
    if tts_clone_model is None:
        raise HTTPException(status_code=500, detail="Clone TTS Model failed to load.")

    if not target_language.strip():
        raise HTTPException(status_code=400, detail="target_language is required.")

    generated_dir.mkdir(parents=True, exist_ok=True)
    out_filename = f"clone_{uuid.uuid4()}.wav"
    out_path = str(generated_dir / out_filename)

    speaker_path = None
    is_temp_speaker = False

    try:
        # Determine Reference Voice
        if voice_id:
            voices_dir = Path(__file__).resolve().parent.parent / "voices"
            vp = voices_dir / voice_id
            if vp.exists():
                speaker_path = str(vp)
        elif speaker_wav:
            is_temp_speaker = True
            speaker_path = str(generated_dir / f"spk_{uuid.uuid4()}.wav")
            with open(speaker_path, "wb") as f:
                f.write(await speaker_wav.read())
                
        if not speaker_path or not os.path.exists(speaker_path):
            raise HTTPException(status_code=400, detail="A valid clone audio file (stored or uploaded) must be provided.")

        final_text = text
        if emotive and target_language == "en":
            try:
                from transformers import pipeline
                clf = pipeline("text-classification", model="j-hartmann/emotion-english-distilroberta-base", top_k=1)
                emotion = clf(text[:2000])[0][0]["label"]
                final_text = apply_emotion_markup(text, emotion)
            except Exception:
                pass

        chunks = split_into_sentences(final_text, 250)
        temp_wavs = []
        for c in chunks:
            tmp_p = str(generated_dir / f"tmp_{uuid.uuid4()}.wav")
            tts_clone_model.tts_to_file(text=c, speaker_wav=speaker_path, language=target_language, file_path=tmp_p)
            temp_wavs.append(tmp_p)
            
        try:
            from pydub import AudioSegment
            combined = AudioSegment.from_wav(temp_wavs[0])
            for w in temp_wavs[1:]:
                combined += AudioSegment.from_wav(w)
            combined.export(out_path, format="wav")
        except:
            tts_clone_model.tts_to_file(text=final_text[:250], speaker_wav=speaker_path, language=target_language, file_path=out_path)
            
        for w in temp_wavs:
            if os.path.exists(w): os.remove(w)

        duration_sec = 0.0
        try:
            with wave.open(out_path, "rb") as wf:
                duration_sec = wf.getnframes() / float(wf.getframerate()) if wf.getframerate() else 0.0
        except: pass
        if duration_sec <= 0: duration_sec = len(text) / 15.0

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
            if is_temp_speaker and speaker_path and os.path.exists(speaker_path):
                os.remove(speaker_path)
        except Exception:
            pass
