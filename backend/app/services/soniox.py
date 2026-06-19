"""Soniox async STT with speaker diarization."""

import logging

from soniox.client import SonioxClient
from soniox.types import CreateTranscriptionConfig

from app.core.config import settings

logger = logging.getLogger(__name__)


def transcribe(audio_path: str) -> dict:
    client = SonioxClient(api_key=settings.soniox_api_key)

    logger.info("Submitting transcription job for %s", audio_path)
    transcription = client.stt.transcribe(
        model="stt-async-v5",
        file=audio_path,
        config=CreateTranscriptionConfig(enable_speaker_diarization=True),
    )
    logger.info("Waiting for transcription %s", transcription.id)
    client.stt.wait(transcription.id)

    transcript = client.stt.get_transcript(transcription.id)

    tokens = transcript.tokens or []
    full_text = transcript.text or ""

    words: list[dict] = []
    speakers: dict[str, list[dict]] = {}

    for token in tokens:
        if not token.text.strip():
            continue
        spk = str(token.speaker) if token.speaker is not None else "0"
        entry = {
            "word": token.text,
            "start": token.start_ms / 1000.0,
            "end": token.end_ms / 1000.0,
            "speaker": spk,
        }
        words.append(entry)
        speakers.setdefault(spk, []).append(entry)

    try:
        client.stt.destroy(transcription.id)
    except Exception:
        logger.warning("Could not destroy transcription %s", transcription.id)

    return {
        "text": full_text,
        "words": words,
        "speakers": speakers,
    }
