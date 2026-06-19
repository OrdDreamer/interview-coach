import { SimpleGrid, Paper, Stack, Text } from '@mantine/core'
import type { AcousticMetrics as AcousticMetricsType } from '../types/session'

interface Props {
  metrics: AcousticMetricsType
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

interface StatCardProps {
  label: string
  value: string
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap={4} align="center">
        <Text size="xl" fw={700}>{value}</Text>
        <Text size="xs" c="dimmed" ta="center">{label}</Text>
      </Stack>
    </Paper>
  )
}

export default function AcousticMetrics({ metrics }: Props) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
      <StatCard label="Тривалість" value={formatDuration(metrics.duration_sec)} />
      <StatCard label="Темп (BPM)" value={String(Math.round(metrics.tempo_bpm))} />
      <StatCard label="Висота тону (Hz)" value={String(Math.round(metrics.pitch_mean_hz))} />
      <StatCard label="Паузи" value={`${(metrics.pause_ratio * 100).toFixed(1)}%`} />
    </SimpleGrid>
  )
}
