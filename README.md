# Interview Coach AI

A web application for career coaches. A coach uploads an audio recording of a client's HR interview — the system returns a structured report with scores across 7 categories, acoustic metrics, and specific improvement recommendations. Built for coaches who want data-driven insights instead of gut-feel feedback.

---

## How it works

```
Upload audio → Soniox async STT → speaker diarization (HR vs candidate)
                                ↓
                     Librosa + WebRTC VAD → acoustic metrics (tempo, pitch, pauses)
                                ↓
                     GPT-4o Structured Output → 7-category scorecard
                                ↓
                     PostgreSQL → REST API → Coach dashboard
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **API** | FastAPI + Uvicorn |
| **Task queue** | Celery + Redis |
| **Database** | PostgreSQL + SQLAlchemy async |
| **Audio storage** | Cloudflare R2 (S3-compatible) |
| **Transcription** | Soniox async STT (speaker diarization) |
| **Acoustics** | Librosa + WebRTC VAD |
| **AI scoring** | OpenAI GPT-4o (Structured Outputs) |
| **Frontend** | React + Vite + Mantine UI *(in progress)* |
| **Local dev** | Docker Compose |

---

## What gets analyzed

| Category | Weight | Data source |
|---|---|---|
| Structure and content (STAR) | 25% | LLM (transcript) |
| Speech delivery | 20% | Acoustic + LLM |
| Confidence | 20% | LLM (transcript) |
| Listening and engagement | 10% | LLM (transcript) |
| Preparation | 10% | LLM (transcript) |
| Handling hard questions | 10% | LLM (transcript) |
| Narrative and positioning | 5% | LLM (transcript) |

Each category returns `score` (1.0–5.0), a verbatim `evidence` quote, and an actionable `recommendation`.

---

## Local Development

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Node.js 18+ *(for frontend)*
- API keys: Soniox, OpenAI, Cloudflare R2

### Setup

**1. Clone the repo**
```bash
git clone <repo-url>
cd interview-coach
```

**2. Configure environment**
```bash
cd backend
cp .env.example .env
# Edit .env — fill in your API keys (see table below)
```

**3. Start backend services**
```bash
docker compose up
# API: http://localhost:8000
# Docs: http://localhost:8000/docs
```

**4. Start frontend** *(once implemented)*
```bash
cd ../frontend
npm install
npm run dev
# http://localhost:5173
```

**5. Test the pipeline**
```bash
curl -X POST http://localhost:8000/api/sessions -F "file=@your-interview.mp3"
# Returns { "id": "...", "status": "pending" }

curl http://localhost:8000/api/sessions/<id>
# Poll until "status": "done" — then read the full scorecard
```

### Environment Variables

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `REDIS_URL` | Redis connection string | ✅ |
| `SONIOX_API_KEY` | Soniox STT API key | ✅ |
| `OPENAI_API_KEY` | OpenAI API key | ✅ |
| `OPENAI_MODEL` | Model name (default: `gpt-4o`) | optional |
| `R2_ACCOUNT_ID` | Cloudflare account ID | ✅ |
| `R2_ACCESS_KEY_ID` | R2 API token access key | ✅ |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret key | ✅ |
| `R2_BUCKET_NAME` | R2 bucket name | ✅ |
| `R2_ENDPOINT_URL` | `https://<account_id>.r2.cloudflarestorage.com` | ✅ |
| `APP_ENV` | `development` or `production` | optional |
| `SECRET_KEY` | App secret (change in production) | optional |

---

## API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/sessions` | Upload audio, start analysis |
| `GET` | `/api/sessions/{id}` | Poll status, get full report |
| `GET` | `/health` | Liveness check |

See [`backend/docs/API.md`](backend/docs/API.md) for full request/response documentation.  
See [`backend/docs/SERVICES.md`](backend/docs/SERVICES.md) for service implementation details.

---

## Project Structure

```
interview-coach/
├── ARCHITECTURE.md          # Tech decisions and design rationale
├── README.md
├── .gitignore
│
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI routers (sessions endpoint)
│   │   ├── core/            # Config, database engine, settings
│   │   ├── models/          # SQLAlchemy models (Session, Report)
│   │   ├── schemas/         # Pydantic response schemas
│   │   ├── services/        # r2, soniox, acoustic, openai
│   │   └── workers/         # Celery tasks (process_interview pipeline)
│   ├── docs/
│   │   ├── API.md           # Endpoint reference
│   │   └── SERVICES.md      # Service implementation docs
│   ├── docker-compose.yml   # Postgres + Redis + API + Worker
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── .env.example         # Template — copy to .env and fill in keys
│
└── frontend/                # React + Vite (in progress)
```

---

## Roadmap

- [x] Backend pipeline (Soniox STT + Librosa + GPT-4o)
- [x] Cloudflare R2 audio storage
- [x] PostgreSQL session and report persistence
- [x] API documentation
- [ ] React frontend (upload UI + scorecard dashboard)
- [ ] Render.com deployment
- [ ] Authentication for coaches
- [ ] Railway production deployment
