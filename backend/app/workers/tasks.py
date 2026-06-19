import asyncio
import logging
import os
import uuid

from celery import states
from sqlalchemy import update as sa_update

from app.celery_app import celery_app
from app.core.database import AsyncSessionLocal, engine
from app.models.session import Report, Session, SessionStatus
from app.services import acoustic, r2, soniox
from app.services import openai as openai_svc

logger = logging.getLogger(__name__)


async def _set_status(session_id: str, status: SessionStatus) -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(
            sa_update(Session)
            .where(Session.id == uuid.UUID(session_id))
            .values(status=status)
        )
        await db.commit()


async def _save_report_and_done(
    session_id: str,
    scorecard: dict,
    raw_transcript: str,
    acoustic_metrics: dict,
) -> None:
    async with AsyncSessionLocal() as db:
        report = Report(
            session_id=uuid.UUID(session_id),
            scorecard=scorecard,
            raw_transcript=raw_transcript,
            acoustic_metrics=acoustic_metrics,
        )
        db.add(report)
        await db.execute(
            sa_update(Session)
            .where(Session.id == uuid.UUID(session_id))
            .values(status=SessionStatus.done)
        )
        await db.commit()


async def _pipeline(session_id: str, audio_url: str) -> dict:
    """Full async pipeline — runs inside a single asyncio.run() call."""
    tmp_path = f"/tmp/{session_id}.mp3"
    loop = asyncio.get_running_loop()

    try:
        await _set_status(session_id, SessionStatus.processing)

        # 1. Download audio from R2 (sync boto3, offloaded to thread)
        logger.info("[%s] Downloading audio", session_id)
        audio_bytes = await loop.run_in_executor(None, r2.download_audio, audio_url)
        with open(tmp_path, "wb") as fh:
            fh.write(audio_bytes)

        # 2. Transcription — Soniox async STT + speaker diarization
        logger.info("[%s] Transcribing with Soniox", session_id)
        transcript = await loop.run_in_executor(None, soniox.transcribe, tmp_path)

        # 3. Acoustic feature extraction — librosa + webrtcvad
        logger.info("[%s] Extracting acoustic metrics", session_id)
        acoustics = await loop.run_in_executor(None, acoustic.analyze, tmp_path)

        # 4. LLM scorecard — GPT-4o structured output
        logger.info("[%s] Generating scorecard via GPT-4o", session_id)
        scorecard = await loop.run_in_executor(
            None, openai_svc.analyze, transcript, acoustics
        )

        # 5. Persist Report + mark session done
        logger.info("[%s] Saving report", session_id)
        await _save_report_and_done(
            session_id=session_id,
            scorecard=scorecard,
            raw_transcript=transcript.get("text", ""),
            acoustic_metrics=acoustics,
        )

        logger.info("[%s] Pipeline complete", session_id)
        return {"status": "done", "session_id": session_id}

    except Exception as exc:
        logger.exception("[%s] Pipeline failed: %s", session_id, exc)
        try:
            await _set_status(session_id, SessionStatus.failed)
        except Exception:
            logger.exception("[%s] Could not mark session as failed", session_id)
        raise

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@celery_app.task(bind=True, name="process_interview")
def process_interview(self, session_id: str, audio_url: str) -> dict:
    logger.info("[%s] Pipeline started", session_id)
    # Dispose the connection pool before creating a new event loop.
    # asyncpg connections are bound to a specific event loop; after asyncio.run()
    # closes one loop, pooled connections become invalid in the next loop.
    engine.sync_engine.dispose()
    try:
        return asyncio.run(_pipeline(session_id, audio_url))
    except Exception as exc:
        self.update_state(state=states.FAILURE, meta={"exc_type": type(exc).__name__, "exc_message": str(exc)})
        raise
