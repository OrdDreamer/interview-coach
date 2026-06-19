# Interview Coach API

Base URL: `http://localhost:8000`

---

## Endpoints

### POST /api/sessions

Upload an audio file for analysis. Creates a session, uploads the file to Cloudflare R2,
and dispatches a Celery pipeline task.

**Request**
```
Content-Type: multipart/form-data
Body: file — audio file (mp3, wav, m4a, ogg, webm; max 100 MB)
```

**Response 201**
```json
{
  "id": "uuid",
  "status": "pending",
  "created_at": "2026-06-19T20:49:36.107258Z"
}
```

**Error responses**
- `413` — file exceeds 100 MB
- `422` — no file provided

---

### GET /api/sessions/{session_id}

Poll session status and retrieve the report when processing is complete.

**Response — pending or processing**
```json
{
  "id": "uuid",
  "status": "pending",
  "created_at": "2026-06-19T20:49:36.107258Z",
  "report": null
}
```

**Response — done**
```json
{
  "id": "uuid",
  "status": "done",
  "created_at": "2026-06-19T20:49:36.107258Z",
  "report": {
    "session_id": "uuid",
    "scorecard": {
      "structure":      { "score": 3.5, "evidence": "...", "recommendation": "..." },
      "delivery":       { "score": 3.0, "evidence": "...", "recommendation": "..." },
      "confidence":     { "score": 4.0, "evidence": "...", "recommendation": "..." },
      "listening":      { "score": 4.5, "evidence": "...", "recommendation": "..." },
      "preparation":    { "score": 3.5, "evidence": "...", "recommendation": "..." },
      "hard_questions": { "score": 3.0, "evidence": "...", "recommendation": "..." },
      "narrative":      { "score": 3.5, "evidence": "...", "recommendation": "..." },
      "overall_score":  3.6,
      "top_strengths":  ["strength 1", "strength 2"],
      "top_priorities": ["priority 1", "priority 2"],
      "summary":        "3–4 sentence summary for the coach."
    },
    "acoustic_metrics": {
      "duration_sec":  300.01,
      "tempo_bpm":     110.29,
      "pitch_mean_hz": 175.22,
      "pitch_std_hz":  77.8,
      "energy_mean":   0.046093,
      "energy_std":    0.035632,
      "pause_ratio":   0.0968
    },
    "created_at": "2026-06-19T20:50:25.610310Z"
  }
}
```

**Response — failed**
```json
{
  "id": "uuid",
  "status": "failed",
  "created_at": "2026-06-19T20:49:36.107258Z",
  "report": null
}
```

**Error responses**
- `404` — session not found

---

### GET /health

Liveness check.

**Response 200**
```json
{ "status": "ok" }
```

---

## Scorecard field reference

| Field | Type | Range | Weight |
|---|---|---|---|
| `structure` | ScoreCategory | 1.0–5.0 | 25% |
| `delivery` | ScoreCategory | 1.0–5.0 | 20% |
| `confidence` | ScoreCategory | 1.0–5.0 | 20% |
| `listening` | ScoreCategory | 1.0–5.0 | 10% |
| `preparation` | ScoreCategory | 1.0–5.0 | 10% |
| `hard_questions` | ScoreCategory | 1.0–5.0 | 10% |
| `narrative` | ScoreCategory | 1.0–5.0 | 5% |
| `overall_score` | float | 1.0–5.0 | weighted average |

Each `ScoreCategory`:
```json
{
  "score": 3.5,
  "evidence": "exact verbatim quote from transcript",
  "recommendation": "specific actionable advice"
}
```

## Pipeline timing

Typical end-to-end latency for a 5-minute audio file: **~60–90 seconds**

| Stage | ~Time |
|---|---|
| R2 upload | < 1 s |
| Soniox transcription | 20–50 s |
| Acoustic analysis (librosa + VAD) | 5–15 s |
| GPT-4o structured output | 5–15 s |
| DB write | < 1 s |
