import { useState } from 'react'
import type { Session } from './types/session'
import UploadScreen from './components/UploadScreen'
import ProcessingScreen from './components/ProcessingScreen'
import ReportScreen from './components/ReportScreen'

type View = 'upload' | 'processing' | 'report'

export default function App() {
  const [view, setView] = useState<View>('upload')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)

  function handleUploaded(s: Session) {
    setSessionId(s.id)
    setView('processing')
  }

  function handleComplete(s: Session) {
    setSession(s)
    setView('report')
  }

  function handleReset() {
    setSessionId(null)
    setSession(null)
    setView('upload')
  }

  if (view === 'upload') {
    return <UploadScreen onUploaded={handleUploaded} />
  }

  if (view === 'processing' && sessionId) {
    return (
      <ProcessingScreen
        sessionId={sessionId}
        onComplete={handleComplete}
        onRetry={handleReset}
      />
    )
  }

  if (view === 'report' && session) {
    return <ReportScreen session={session} onNewAnalysis={handleReset} />
  }

  return null
}
