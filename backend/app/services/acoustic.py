"""Acoustic feature extraction via librosa + WebRTC VAD."""

import logging
import struct

import librosa
import numpy as np
import webrtcvad

logger = logging.getLogger(__name__)

_VAD_SAMPLE_RATE = 16_000
_VAD_FRAME_MS = 30  # webrtcvad supports 10 / 20 / 30 ms
_VAD_AGGRESSIVENESS = 2  # 0 (least aggressive) … 3 (most aggressive)


def analyze(audio_path: str) -> dict:
    y, sr = librosa.load(audio_path, sr=_VAD_SAMPLE_RATE, mono=True)
    duration_sec = float(len(y) / _VAD_SAMPLE_RATE)

    tempo = _tempo(y)
    pitch_mean, pitch_std = _pitch(y)
    energy_mean, energy_std = _energy(y)
    pause_ratio = _pause_ratio(y)

    return {
        "duration_sec": _r(duration_sec),
        "tempo_bpm": _r(tempo),
        "pitch_mean_hz": _r(pitch_mean),
        "pitch_std_hz": _r(pitch_std),
        "energy_mean": _r(energy_mean, 6),
        "energy_std": _r(energy_std, 6),
        "pause_ratio": _r(pause_ratio, 4),
    }


# --- helpers -----------------------------------------------------------------

def _r(value: float, decimals: int = 2) -> float:
    return round(float(value), decimals)


def _tempo(y: np.ndarray) -> float:
    tempo, _ = librosa.beat.beat_track(y=y, sr=_VAD_SAMPLE_RATE)
    return float(np.mean(tempo))


def _pitch(y: np.ndarray) -> tuple[float, float]:
    try:
        f0, voiced_flag, _ = librosa.pyin(
            y,
            fmin=librosa.note_to_hz("C2"),
            fmax=librosa.note_to_hz("C7"),
            sr=_VAD_SAMPLE_RATE,
        )
        if f0 is None or voiced_flag is None:
            return 0.0, 0.0
        voiced = f0[voiced_flag]
        if len(voiced) == 0:
            return 0.0, 0.0
        return float(np.mean(voiced)), float(np.std(voiced))
    except Exception as exc:
        logger.warning("pyin failed: %s", exc)
        return 0.0, 0.0


def _energy(y: np.ndarray) -> tuple[float, float]:
    rms = librosa.feature.rms(y=y)[0]
    return float(np.mean(rms)), float(np.std(rms))


def _pause_ratio(y: np.ndarray) -> float:
    vad = webrtcvad.Vad(_VAD_AGGRESSIVENESS)
    frame_samples = int(_VAD_SAMPLE_RATE * _VAD_FRAME_MS / 1000)
    pcm = (np.clip(y, -1.0, 1.0) * 32767).astype(np.int16)

    speech = total = 0
    for i in range(0, len(pcm) - frame_samples, frame_samples):
        frame = pcm[i : i + frame_samples]
        frame_bytes = struct.pack(f"{len(frame)}h", *frame)
        try:
            if vad.is_speech(frame_bytes, _VAD_SAMPLE_RATE):
                speech += 1
        except Exception:
            pass
        total += 1

    return 1.0 - (speech / total) if total > 0 else 0.0
