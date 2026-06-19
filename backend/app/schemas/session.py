import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class SessionResponse(BaseModel):
    id: uuid.UUID
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportResponse(BaseModel):
    session_id: uuid.UUID
    scorecard: dict[str, Any]
    acoustic_metrics: dict[str, Any] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionDetailResponse(BaseModel):
    id: uuid.UUID
    status: str
    created_at: datetime
    report: ReportResponse | None = None

    model_config = {"from_attributes": True}
