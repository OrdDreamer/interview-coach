import { useEffect } from 'react'
import { Center, Stack, Loader, Text, Title, Button, ThemeIcon } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { getSession } from '../api/sessions'
import type { Session } from '../types/session'

interface Props {
  sessionId: string
  onComplete: (session: Session) => void
  onRetry: () => void
}

const statusText: Record<string, string> = {
  pending: 'Завантаження в чергу...',
  processing: 'Аналіз інтерв\'ю (зазвичай 60–90 секунд)...',
}

export default function ProcessingScreen({ sessionId, onComplete, onRetry }: Props) {
  const { data, error } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => getSession(sessionId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'done' || status === 'failed') return false
      return 3000
    },
  })

  useEffect(() => {
    if (data?.status === 'done') {
      onComplete(data)
    }
  }, [data, onComplete])

  const failed = data?.status === 'failed' || !!error

  return (
    <Center style={{ minHeight: '100vh', padding: '2rem' }}>
      <Stack align="center" gap="xl" style={{ maxWidth: 420, width: '100%' }}>
        {failed ? (
          <>
            <ThemeIcon size={64} color="red" variant="light" radius="xl">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </ThemeIcon>
            <Stack align="center" gap="xs">
              <Title order={3}>Помилка обробки</Title>
              <Text c="dimmed" ta="center">
                Щось пішло не так під час аналізу. Спробуйте ще раз.
              </Text>
            </Stack>
            <Button variant="outline" onClick={onRetry}>
              Спробувати знову
            </Button>
          </>
        ) : (
          <>
            <Loader size="xl" />
            <Stack align="center" gap="xs">
              <Title order={3}>Обробка запису</Title>
              <Text c="dimmed" ta="center">
                {statusText[data?.status ?? 'pending'] ?? statusText.pending}
              </Text>
            </Stack>
            <Text size="xs" c="dimmed" ta="center">
              Soniox транскрибує аудіо → GPT-4o аналізує відповіді
            </Text>
          </>
        )}
      </Stack>
    </Center>
  )
}
