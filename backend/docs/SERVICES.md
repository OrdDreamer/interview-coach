# Services Documentation

---

## R2 Storage (`app/services/r2.py`)

**Purpose:** Temporary audio file storage on Cloudflare R2 (S3-compatible).

**Provider:** Cloudflare R2 via boto3 with `endpoint_url` pointing to the account-specific endpoint.

### Functions

```python
upload_audio(file_bytes: bytes, filename: str) -> str
```
Uploads raw bytes to R2. Returns the public URL: `{endpoint_url}/{bucket}/{filename}`.

```python
download_audio(url: str) -> bytes
```
Downloads file from R2. Parses the key from the URL path (strips bucket prefix).

### Key decisions
- Filename includes a UUID prefix to avoid collisions: `{uuid4()}_{original_name}`
- `region_name="auto"` — required for Cloudflare R2 (not a real AWS region)
- Token scope: bucket-scoped R2 API token with Object Read & Write only

---

## Soniox STT (`app/services/soniox.py`)

**Purpose:** Audio transcription with automatic speaker diarization.

**Input:** `audio_path: str` — local file path

**Output:**
```python
{
  "text": str,                          # full transcript
  "words": [
    {"word": str, "start": float, "end": float, "speaker": str}
  ],
  "speakers": {
    "0": [{"word": str, "start": float, "end": float, "speaker": str}],
    "1": [...]
  }
}
```

### Config
```python
CreateTranscriptionConfig(enable_speaker_diarization=True)
```
Model: `stt-async-v5` (highest diarization accuracy — full-context async mode).

### Flow
1. Upload file + create transcription job (`client.stt.transcribe()`)
2. Poll until complete (`client.stt.wait()`)
3. Fetch transcript tokens with timestamps and speaker labels (`client.stt.get_transcript()`)
4. Group tokens by speaker into `speakers` dict
5. Cleanup: `client.stt.destroy()` removes both transcription and uploaded file

### Key decisions
- Async STT (not real-time) chosen for significantly higher diarization accuracy
- Tokens with whitespace-only text are skipped
- Speaker labels are strings ("0", "1") — GPT-4o infers HR vs candidate from context
- `destroy()` failure is logged as a warning, not raised (cleanup is best-effort)

---

## Acoustic Analysis (`app/services/acoustic.py`)

**Purpose:** Extract paralinguistic features from audio.

**Input:** `audio_path: str` — local file path

**Output:**
```python
{
  "duration_sec":  float,   # total audio length
  "tempo_bpm":     float,   # librosa beat tracking
  "pitch_mean_hz": float,   # mean voiced F0 (pyin)
  "pitch_std_hz":  float,   # F0 standard deviation
  "energy_mean":   float,   # mean RMS energy
  "energy_std":    float,   # RMS energy std deviation
  "pause_ratio":   float    # fraction of silent frames (webrtcvad)
}
```

### Libraries
| Library | Used for |
|---|---|
| `librosa` | Load audio, beat tracking, pyin F0 estimation, RMS energy |
| `webrtcvad` | Voice activity detection — 30 ms frames at 16 kHz |

### Key decisions
- Audio always resampled to 16 000 Hz mono (webrtcvad requirement; saves memory for long files)
- VAD aggressiveness = 2 (moderate — balances false-positive silence detection)
- `librosa.pyin` used over `librosa.yin` — probabilistic model, more robust on speech
- `pyin` failures (e.g. very short audio) are caught and return 0.0 for pitch fields
- All numpy types explicitly cast to Python `float` for JSON serialization

---

## OpenAI Analysis (`app/services/openai.py`)

**Purpose:** LLM scoring of the interview transcript across 7 weighted categories.

**Input:**
```python
transcript: dict   # from soniox.transcribe()
acoustics:  dict   # from acoustic.analyze()
```

**Output:** `InterviewScorecard` serialized to dict via `.model_dump()`

### Pydantic models
```python
class ScoreCategory(BaseModel):
    score: float           # 1.0–5.0
    evidence: str          # exact quote from transcript
    recommendation: str    # specific actionable advice

class InterviewScorecard(BaseModel):
    structure:      ScoreCategory   # 25%
    delivery:       ScoreCategory   # 20%
    confidence:     ScoreCategory   # 20%
    listening:      ScoreCategory   # 10%
    preparation:    ScoreCategory   # 10%
    hard_questions: ScoreCategory   # 10%
    narrative:      ScoreCategory   # 5%
    overall_score:  float
    top_strengths:  list[str]
    top_priorities: list[str]
    summary:        str
```

### API call
```python
client.beta.chat.completions.parse(
    model=settings.openai_model,   # gpt-4o
    messages=[...],
    response_format=InterviewScorecard,
)
```

### Prompt strategy
- Transcript is formatted as `Speaker 0: ...` / `Speaker 1: ...` lines
- System prompt instructs the model to evaluate ONLY the candidate
- Acoustic metrics are appended as numeric context (duration, tempo, pause ratio, pitch)
- Refusal is raised as `ValueError` — surfaces as pipeline failure

### Key decisions
- `client.beta.chat.completions.parse()` used (not `.create()`) — guarantees schema validation
- Pydantic `Field(ge=1.0, le=5.0)` bounds on scores — enforced at SDK layer
- Speaker identification by context (not by index) — GPT-4o infers HR vs candidate reliably

---

## Celery Pipeline (`app/workers/tasks.py`)

**Task:** `process_interview(session_id: str, audio_url: str)`

### Execution model
- Sync Celery task (`def`, not `async def`) running in a prefork worker
- Single `asyncio.run(_pipeline(...))` wraps all DB operations
- All sync service calls (`r2`, `soniox`, `acoustic`, `openai`) run via `loop.run_in_executor(None, fn, *args)` — keeps the event loop unblocked and avoids greenlet conflicts

### asyncpg event loop fix
```python
engine.sync_engine.dispose()   # called before asyncio.run()
```
asyncpg connections are bound to a specific event loop. After `asyncio.run()` closes one loop,
pooled connections become stale. `dispose()` clears the pool so fresh connections are made
in the new event loop on the next task.

### Error handling
- Any exception → `_set_status(session_id, SessionStatus.failed)` is awaited before re-raise
- Temp file `/tmp/{session_id}.mp3` is always removed in `finally` block
- `self.update_state(FAILURE, meta={...})` ensures Celery result backend reflects failure
