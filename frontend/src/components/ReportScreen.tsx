import {
  Container,
  Stack,
  Group,
  Title,
  Text,
  Button,
  Badge,
  SimpleGrid,
  Card,
  ThemeIcon,
  Paper,
  Divider,
} from '@mantine/core'
import type { Session, Scorecard } from '../types/session'
import ScoreCard from './ScoreCard'
import AcousticMetrics from './AcousticMetrics'

interface Props {
  session: Session
  onNewAnalysis: () => void
}

const CATEGORY_LABELS: Record<keyof Omit<Scorecard, 'overall_score' | 'top_strengths' | 'top_priorities' | 'summary'>, string> = {
  structure: 'Структура відповідей',
  delivery: 'Мовленнєва подача',
  confidence: 'Впевненість',
  listening: 'Активне слухання',
  preparation: 'Підготовленість',
  hard_questions: 'Складні питання',
  narrative: 'Наратив',
}

function overallColor(score: number) {
  if (score > 3.5) return 'green'
  if (score >= 2.5) return 'yellow'
  return 'red'
}

export default function ReportScreen({ session, onNewAnalysis }: Props) {
  const { scorecard, acoustic_metrics } = session.report!
  const color = overallColor(scorecard.overall_score)

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">

        {/* Header */}
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
          <Stack gap={4}>
            <Title order={1}>Звіт про інтерв'ю</Title>
            <Group align="center" gap="sm">
              <Text c="dimmed" size="sm">Загальна оцінка:</Text>
              <Badge color={color} size="xl" variant="filled" radius="md">
                {scorecard.overall_score.toFixed(1)} / 5.0
              </Badge>
            </Group>
          </Stack>
          <Button variant="outline" onClick={onNewAnalysis}>
            Новий аналіз
          </Button>
        </Group>

        <Divider />

        {/* Scorecard grid */}
        <Stack gap="sm">
          <Title order={3}>Оцінки по категоріях</Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((key) => (
              <ScoreCard
                key={key}
                title={CATEGORY_LABELS[key]}
                category={scorecard[key]}
              />
            ))}
          </SimpleGrid>
        </Stack>

        {/* Acoustic metrics */}
        <Stack gap="sm">
          <Title order={3}>Акустичні метрики</Title>
          <AcousticMetrics metrics={acoustic_metrics} />
        </Stack>

        {/* Strengths + Priorities */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Card withBorder radius="md" p="md">
            <Stack gap="sm">
              <Text fw={600} size="sm" c="green">Сильні сторони</Text>
              <Stack gap="xs">
                {scorecard.top_strengths.map((s, i) => (
                  <Group key={i} gap="sm" align="flex-start">
                    <ThemeIcon size={20} color="green" variant="light" radius="xl" style={{ flexShrink: 0, marginTop: 2 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </ThemeIcon>
                    <Text size="sm">{s}</Text>
                  </Group>
                ))}
              </Stack>
            </Stack>
          </Card>

          <Card withBorder radius="md" p="md">
            <Stack gap="sm">
              <Text fw={600} size="sm" c="orange">Пріоритети для роботи</Text>
              <Stack gap="xs">
                {scorecard.top_priorities.map((p, i) => (
                  <Group key={i} gap="sm" align="flex-start">
                    <ThemeIcon size={20} color="orange" variant="light" radius="xl" style={{ flexShrink: 0, marginTop: 2 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <polyline points="19 12 12 19 5 12" />
                      </svg>
                    </ThemeIcon>
                    <Text size="sm">{p}</Text>
                  </Group>
                ))}
              </Stack>
            </Stack>
          </Card>
        </SimpleGrid>

        {/* Summary */}
        <Paper withBorder p="lg" radius="md" bg="gray.0">
          <Stack gap="xs">
            <Text fw={600} size="sm">Висновок для коуча</Text>
            <Text size="sm" fs="italic" c="dimmed">{scorecard.summary}</Text>
          </Stack>
        </Paper>

      </Stack>
    </Container>
  )
}
