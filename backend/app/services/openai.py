"""GPT-4o structured output — interview scorecard."""

import logging
from typing import Any

from openai import OpenAI
from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger(__name__)


class ScoreCategory(BaseModel):
    score: float = Field(ge=1.0, le=5.0)
    evidence: str
    recommendation: str


class InterviewScorecard(BaseModel):
    structure: ScoreCategory
    delivery: ScoreCategory
    confidence: ScoreCategory
    listening: ScoreCategory
    preparation: ScoreCategory
    hard_questions: ScoreCategory
    narrative: ScoreCategory
    overall_score: float = Field(ge=1.0, le=5.0)
    top_strengths: list[str]
    top_priorities: list[str]
    summary: str


def analyze(transcript: dict[str, Any], acoustics: dict[str, Any]) -> dict[str, Any]:
    client = OpenAI(api_key=settings.openai_api_key)

    text = transcript.get("text", "")
    speakers = transcript.get("speakers", {})

    labeled_lines = []
    for spk_id, words in sorted(speakers.items()):
        spk_text = " ".join(w["word"] for w in words if w["word"].strip())
        if spk_text:
            labeled_lines.append(f"Speaker {spk_id}: {spk_text}")
    labeled_transcript = "\n".join(labeled_lines) if labeled_lines else text

    system_prompt = (
        "You are an expert HR interview coach. "
        "Speaker 0 is the HR interviewer, Speaker 1 is the candidate "
        "(infer from context if unclear). "
        "Evaluate ONLY the candidate's performance. "
        "For each category provide: a score 1.0–5.0, an exact verbatim quote from "
        "the transcript as evidence, and a specific actionable recommendation."
    )

    user_prompt = (
        f"Interview transcript:\n\n{labeled_transcript}\n\n"
        f"Acoustic metrics:\n"
        f"- Duration: {acoustics.get('duration_sec', 0):.1f} s\n"
        f"- Tempo: {acoustics.get('tempo_bpm', 0):.0f} BPM\n"
        f"- Pause ratio: {acoustics.get('pause_ratio', 0):.1%}\n"
        f"- Pitch mean: {acoustics.get('pitch_mean_hz', 0):.0f} Hz "
        f"(std: {acoustics.get('pitch_std_hz', 0):.0f} Hz)\n\n"
        "Score the candidate on all 7 categories: structure, delivery, confidence, "
        "listening, preparation, hard_questions, narrative."
    )

    logger.info("Calling GPT-4o structured output, model=%s", settings.openai_model)
    completion = client.beta.chat.completions.parse(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format=InterviewScorecard,
    )

    message = completion.choices[0].message
    if message.parsed is not None:
        return message.parsed.model_dump()
    raise ValueError(f"GPT-4o refused structured output: {message.refusal}")
