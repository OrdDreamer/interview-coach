export interface ScoreCategory {
  score: number
  evidence: string
  recommendation: string
}

export interface Scorecard {
  structure: ScoreCategory
  delivery: ScoreCategory
  confidence: ScoreCategory
  listening: ScoreCategory
  preparation: ScoreCategory
  hard_questions: ScoreCategory
  narrative: ScoreCategory
  overall_score: number
  top_strengths: string[]
  top_priorities: string[]
  summary: string
}

export interface AcousticMetrics {
  duration_sec: number
  tempo_bpm: number
  pitch_mean_hz: number
  pause_ratio: number
}

export interface Report {
  scorecard: Scorecard
  acoustic_metrics: AcousticMetrics
}

export interface Session {
  id: string
  status: 'pending' | 'processing' | 'done' | 'failed'
  created_at: string
  report?: Report
}
