# Interview Coach AI — Architecture & Decision Record

> Останнє оновлення: червень 2025  
> Статус: MVP в розробці

---

## Що це за продукт

Веб-додаток для кар'єрних коучів. Коуч завантажує аудіозапис HR-інтерв'ю клієнта — система повертає структурований звіт з оцінками по категоріях, акустичними метриками і рекомендаціями для покращення.

---

## Що оцінюється

| Категорія | Вага | Джерело даних |
|---|---|---|
| Структура і зміст відповідей (STAR) | 25% | LLM (текст) |
| Мовленнєва подача | 20% | Акустика + LLM |
| Впевненість | 20% | LLM (текст) |
| Слухання і взаємодія | 10% | LLM (текст) |
| Підготовленість | 10% | LLM (текст) |
| Складні питання | 10% | LLM (текст) |
| Наратив і позиціонування | 5% | LLM (текст) |

Акустичні метрики (темп, паузи, pitch, енергія) збираються незалежно від транскрипції і передаються в LLM як додатковий контекст.

---

## Архітектура системи

```
User (browser)
    │
    │  1. Upload audio file
    ▼
[React Frontend] ── Vercel
    │
    │  2. POST /api/sessions  →  { task_id }
    │  3. GET  /api/sessions/{task_id}  (polling every 2s)
    ▼
[FastAPI Backend] ── Railway (prod) / Docker (local) / Render (MVP)
    │
    │  4. Зберегти аудіо → R2
    │  5. Запустити Celery task
    ▼
[Celery Worker] ── той самий сервер або окремий контейнер
    │
    ├─ 6a. Soniox Async STT  →  транскрипт + timestamps + speaker labels
    ├─ 6b. Librosa + WebRTC VAD  →  pitch, темп, паузи, енергія
    │
    │  7. Агрегувати контекст
    ▼
[OpenAI GPT-4o Structured Output]
    │
    │  8. JSON scorecard
    ▼
[PostgreSQL]  ←  зберегти звіт
    │
    │  9. task status → "done"
    ▼
[React Frontend]  ←  відобразити scorecard
```

---

## Технічний стек

### Frontend
| Технологія | Роль | Hosting |
|---|---|---|
| React + Vite | UI фреймворк | — |
| Mantine UI | Компоненти (Dropzone, Cards, Charts) | — |
| TanStack Query | Polling task_id, кешування звіту | — |
| **Vercel** | Hosting, CDN, деплой з GitHub | безкоштовно |

### Backend
| Технологія | Роль | Hosting |
|---|---|---|
| FastAPI | REST API (upload, status, звіт) | — |
| Celery | Async обробка аудіо | — |
| Redis | Celery broker | — |
| PostgreSQL | Зберігання сесій і звітів | — |
| **Render.com** | MVP hosting | безкоштовно (cold start) |
| **Railway** | Production hosting | ~$10–20/міс |

### Обробка аудіо
| Технологія | Роль | Тип |
|---|---|---|
| Soniox Async STT | Транскрипція + diarization (HR vs кандидат) | платний API |
| Librosa | Pitch (F0), енергія, темп, спектр | open-source |
| WebRTC VAD | Детекція пауз і тривалості мовлення | open-source |
| Numpy / Scipy | Нормалізація метрик, статистика | open-source |

### AI / LLM
| Технологія | Роль | Примітка |
|---|---|---|
| OpenAI GPT-4o | STAR аналіз, впевненість, наратив, хеджування | Structured Outputs → JSON |

### Зберігання файлів
| Технологія | Роль | Ціна |
|---|---|---|
| Cloudflare R2 | Тимчасове зберігання аудіофайлів | безкоштовно до 10 GB |

---

## Celery Task — покроковий pipeline

```python
@celery.task
def process_interview(session_id: str, audio_url: str):
    # 1. Завантажити аудіо з R2
    audio_path = download_from_r2(audio_url)

    # 2. Паралельно:
    #    2a. Soniox → транскрипт з timestamps + speaker diarization
    #    2b. Librosa + VAD → акустичні метрики
    transcript = soniox_transcribe(audio_path)       # { text, words, speakers }
    acoustics  = analyze_acoustics(audio_path)       # { wpm, pauses, pitch, energy }

    # 3. GPT-4o Structured Output → scorecard JSON
    scorecard = analyze_with_llm(transcript, acoustics)

    # 4. Зберегти в PostgreSQL
    save_report(session_id, scorecard)

    # 5. Оновити статус
    update_session_status(session_id, "done")
```

---

## Soniox — чому обрано

- Є акаунт і API key
- Вбудований speaker diarization — автоматично розділяє HR і кандидата без ручної розмітки
- Async REST API добре лягає на Celery task
- Timestamps на рівні слів — корисно для прив'язки акустичних метрик до конкретних відповідей

**Endpoint:** `POST https://api.soniox.com/v1/speech/transcriptions`  
**Auth:** `Authorization: Bearer <SONIOX_API_KEY>`

---

## OpenAI Structured Outputs — чому важливо

Замість парсингу вільного тексту — передаємо JSON Schema і отримуємо гарантований валідний об'єкт:

```python
class ScoreCategory(BaseModel):
    score: float          # 1.0 – 5.0
    evidence: str         # цитата або приклад з транскрипту
    recommendation: str   # конкретна порада

class InterviewScorecard(BaseModel):
    structure:    ScoreCategory
    delivery:     ScoreCategory
    confidence:   ScoreCategory
    listening:    ScoreCategory
    preparation:  ScoreCategory
    hard_questions: ScoreCategory
    narrative:    ScoreCategory
    overall_score: float          # зважений підсумок
    top_strengths: list[str]      # 2-3 сильні сторони
    top_priorities: list[str]     # 2-3 пріоритети для роботи
    summary: str                  # 3-4 речення для коуча
```

---

## Витрати

| Сервіс | Тип | Ціна |
|---|---|---|
| Vercel | Фіксований | $0 |
| Cloudflare R2 | Фіксований | $0 (до 10 GB) |
| Librosa / WebRTC VAD | Фіксований | $0 (open-source) |
| FastAPI / Celery | Фіксований | $0 (open-source) |
| Render.com (MVP) | Фіксований | $0 (cold start) |
| Railway (production) | Фіксований | ~$10–20/міс |
| Soniox STT | За використання | ~$0.007–0.01/хв аудіо |
| OpenAI GPT-4o | За використання | ~$0.01–0.02/аналіз |

**Орієнтовно для MVP (50 аналізів/міс):** ~$14/міс після переходу на Railway.

---

## Деплой — три середовища

| Середовище | Backend | Frontend | База | Коли |
|---|---|---|---|---|
| **Local** | docker-compose | `vite dev` | Docker Postgres + Redis | розробка |
| **MVP** | Render.com | Vercel | Render Postgres + Redis | перші клієнти |
| **Production** | Railway | Vercel | Railway Postgres + Redis | масштабування |

### Локальний запуск (ціль)
```bash
docker-compose up        # Postgres + Redis + FastAPI + Celery worker
cd frontend && npm run dev  # React dev server
```

---

## Відкриті питання

- [ ] Аутентифікація коучів — чи потрібна на MVP? (простий токен vs повноцінний auth)
- [ ] Зберігати аудіо після обробки чи видаляти одразу? (privacy)
- [ ] Мови — тільки українська/російська чи відразу мультимовність через Soniox?
- [ ] Ліміт розміру файлу — Soniox async підтримує великі файли, але варто обмежити на UI

---

## Implementation Status

### Backend — DONE ✅
- FastAPI app with lifespan (create_tables on startup)
- POST /api/sessions — multipart upload, R2 storage, Celery task trigger
- GET /api/sessions/{session_id} — status polling + full report when done
- Celery + Redis — async pipeline, asyncio.run() with run_in_executor for sync libs
- PostgreSQL — Session + Report models via SQLAlchemy async
- engine.sync_engine.dispose() fix for asyncpg event loop across workers

### Services — DONE ✅
- app/services/r2.py — upload_audio() / download_audio() via boto3 (Cloudflare R2)
- app/services/soniox.py — async STT with speaker diarization (2 speakers),
  CreateTranscriptionConfig, auto cleanup
- app/services/acoustic.py — librosa (tempo/pitch/energy) + webrtcvad (pause ratio),
  metrics normalized to 1.0–5.0
- app/services/openai.py — GPT-4o structured output via client.beta.chat.completions.parse(),
  InterviewScorecard Pydantic model, 7 categories

### Frontend — IN PROGRESS 🔄
### Deployment — TODO 🔲

---

## Що може змінитись пізніше

| Компонент | Зараз | Можлива заміна | Причина |
|---|---|---|---|
| OpenAI GPT-4o | MVP | Claude API | порівняти якість аналізу |
| Soniox | MVP | Groq Whisper Turbo | дешевше, якщо diarization не потрібен |
| Render.com | MVP | Railway | прибрати cold start |
