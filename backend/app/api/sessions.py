import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.session import Report, Session, SessionStatus
from app.schemas.session import ReportResponse, SessionDetailResponse, SessionResponse
from app.services import r2
from app.workers.tasks import process_interview

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

_MAX_BYTES = 100 * 1024 * 1024  # 100 MB


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    file_bytes = await file.read()
    if len(file_bytes) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 100 MB)")

    filename = f"{uuid.uuid4()}_{file.filename}"
    audio_url = r2.upload_audio(file_bytes, filename)

    session = Session(audio_url=audio_url, status=SessionStatus.pending)
    db.add(session)
    await db.commit()
    await db.refresh(session)

    process_interview.delay(str(session.id), audio_url)

    return SessionResponse.model_validate(session)


@router.get("/{session_id}", response_model=SessionDetailResponse)
async def get_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> SessionDetailResponse:
    result = await db.execute(
        select(Session)
        .where(Session.id == session_id)
        .options(selectinload(Session.report))
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    report = None
    if session.status == SessionStatus.done and session.report is not None:
        report = ReportResponse.model_validate(session.report)

    return SessionDetailResponse(
        id=session.id,
        status=session.status,
        created_at=session.created_at,
        report=report,
    )
