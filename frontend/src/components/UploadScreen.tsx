import { useState } from 'react'
import {
  Center,
  Stack,
  Title,
  Text,
  Button,
  Group,
  Paper,
  ThemeIcon,
} from '@mantine/core'
import { Dropzone, MIME_TYPES } from '@mantine/dropzone'
import type { FileWithPath } from '@mantine/dropzone'
import type { Session } from '../types/session'
import { uploadSession } from '../api/sessions'

interface Props {
  onUploaded: (session: Session) => void
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadScreen({ onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const session = await uploadSession(file)
      onUploaded(session)
    } catch (e: unknown) {
      setError('Помилка завантаження. Перевірте файл і спробуйте ще раз.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Center style={{ minHeight: '100vh', padding: '2rem' }}>
      <Stack align="center" gap="xl" style={{ width: '100%', maxWidth: 560 }}>
        <Stack align="center" gap="xs">
          <Title order={1} ta="center">
            Interview Coach AI
          </Title>
          <Text c="dimmed" ta="center" size="md">
            Завантажте аудіозапис HR-інтерв'ю — отримайте детальний звіт з
            оцінками по 7 категоріях
          </Text>
        </Stack>

        <Dropzone
          onDrop={(files: FileWithPath[]) => {
            setFile(files[0])
            setError(null)
          }}
          onReject={() => setError('Непідтримуваний формат або файл завеликий (макс. 100 MB)')}
          maxSize={100 * 1024 * 1024}
          accept={[
            MIME_TYPES.mp4,
            'audio/mpeg',
            'audio/wav',
            'audio/x-wav',
            'audio/m4a',
            'audio/x-m4a',
            'audio/ogg',
            'audio/webm',
          ]}
          style={{ width: '100%', cursor: 'pointer' }}
        >
          <Stack align="center" gap="md" style={{ padding: '2rem' }}>
            <ThemeIcon size={56} variant="light" color="blue" radius="xl">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </ThemeIcon>
            <Stack align="center" gap={4}>
              <Text size="lg" fw={500}>
                Перетягніть файл або натисніть для вибору
              </Text>
              <Text size="sm" c="dimmed">
                MP3, WAV, M4A, OGG, WebM — до 100 MB
              </Text>
            </Stack>
          </Stack>
        </Dropzone>

        {file && (
          <Paper withBorder p="sm" radius="md" style={{ width: '100%' }}>
            <Group gap="sm">
              <ThemeIcon size={36} variant="light" color="green" radius="md">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </ThemeIcon>
              <Stack gap={2} style={{ flex: 1 }}>
                <Text size="sm" fw={500} lineClamp={1}>{file.name}</Text>
                <Text size="xs" c="dimmed">{formatBytes(file.size)}</Text>
              </Stack>
            </Group>
          </Paper>
        )}

        {error && (
          <Text c="red" size="sm" ta="center">{error}</Text>
        )}

        <Button
          size="lg"
          fullWidth
          loading={loading}
          disabled={!file}
          onClick={handleSubmit}
        >
          Аналізувати інтерв'ю
        </Button>
      </Stack>
    </Center>
  )
}
