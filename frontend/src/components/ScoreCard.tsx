import { Card, Stack, Group, Badge, Progress, Text } from '@mantine/core'
import type { ScoreCategory } from '../types/session'

interface Props {
  title: string
  category: ScoreCategory
}

function scoreColor(score: number) {
  if (score > 3.5) return 'green'
  if (score >= 2.5) return 'yellow'
  return 'red'
}

export default function ScoreCard({ title, category }: Props) {
  const color = scoreColor(category.score)
  const pct = (category.score / 5) * 100

  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Text fw={600} size="sm">{title}</Text>
          <Badge color={color} variant="filled" size="lg">
            {category.score.toFixed(1)} / 5.0
          </Badge>
        </Group>

        <Progress value={pct} color={color} size="sm" radius="xl" />

        <Stack gap={6}>
          <Text size="xs" c="dimmed" fs="italic" lineClamp={3}>
            «{category.evidence}»
          </Text>
          <Text size="xs">{category.recommendation}</Text>
        </Stack>
      </Stack>
    </Card>
  )
}
