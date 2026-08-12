import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Radio,
  RadioGroup,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react"
import { useQueries, useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { FiClock } from "react-icons/fi"

import { type ComplianceRunPublic, ComplianceService } from "../../client"
import { formatTimestamp } from "../../utils"
import EmptyState from "../Common/EmptyState"
import SkeletonRows from "../Common/SkeletonRows"
import { statusColor, statusLabel } from "./constants"

const PAGE_SIZE = 20
const COLUMNS = ["When", "Result", "Passed", "Failed", "Skipped", "Compare"]

/** Inline pass-rate trend. Oldest on the left, so it reads left-to-right. */
function Sparkline({ runs }: { runs: ComplianceRunPublic[] }) {
  const stroke = useColorModeValue("#2C7A7B", "#4FD1C5")
  const points = useMemo(() => {
    const ordered = [...runs].reverse()
    return ordered.map((run) => {
      const passed = run.passed_count ?? 0
      const failed = run.failed_count ?? 0
      const total = passed + failed
      return total ? (100 * passed) / total : 0
    })
  }, [runs])

  if (points.length < 2) return null

  const width = 100
  const height = 28
  const step = width / (points.length - 1)
  const path = points
    .map((value, index) => {
      const x = index * step
      const y = height - (value / 100) * height
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")

  return (
    <Box>
      <Text fontSize="xs" color="gray.500" mb={1}>
        Pass rate over the last {points.length} runs
      </Text>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="48"
        preserveAspectRatio="none"
        role="img"
        aria-label="Pass rate trend"
      >
        <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" />
      </svg>
    </Box>
  )
}

interface DeviceHistoryTabProps {
  deviceId: number
}

function DeviceHistoryTab({ deviceId }: DeviceHistoryTabProps) {
  const [page, setPage] = useState(0)
  const [baseRunId, setBaseRunId] = useState<string>("")
  const [targetRunId, setTargetRunId] = useState<string>("")

  const { data, isLoading, isError } = useQuery({
    queryKey: ["compliance-runs", deviceId, page],
    queryFn: () =>
      ComplianceService.readDeviceRuns({
        id: deviceId,
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      }),
  })

  const runs = data?.data ?? []
  const total = data?.count ?? 0

  const comparison = useQueries({
    queries: [baseRunId, targetRunId].filter(Boolean).map((runId) => ({
      queryKey: ["compliance-run", Number(runId)],
      queryFn: () => ComplianceService.readRun({ runId: Number(runId) }),
    })),
  })

  const diff = useMemo(() => {
    if (!baseRunId || !targetRunId || comparison.length < 2) return null
    const [base, target] = comparison
    if (!base.data || !target.data) return null
    const baseByRule = new Map(
      base.data.results.map((result) => [result.rule_id, result]),
    )
    return target.data.results
      .map((result) => {
        const before = baseByRule.get(result.rule_id)
        if (!before || before.status === result.status) return null
        return {
          rule_id: result.rule_id,
          title: result.title || result.rule_id,
          from: before.status,
          to: result.status,
          // A rule that stopped passing is the thing an operator must see first.
          regression: before.status === "pass" && result.status !== "pass",
          improvement: before.status !== "pass" && result.status === "pass",
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  }, [baseRunId, targetRunId, comparison])

  if (isError) {
    return (
      <Alert status="error" borderRadius="md">
        <AlertIcon />
        Could not load this device's run history.
      </Alert>
    )
  }

  if (isLoading) return <SkeletonRows columns={COLUMNS} />

  if (runs.length === 0) {
    return (
      <EmptyState
        icon={FiClock}
        title="No compliance runs yet"
        description="Run a check to start building this device's history."
      />
    )
  }

  const rangeStart = page * PAGE_SIZE + 1
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total)
  const comparing = Boolean(baseRunId && targetRunId)

  return (
    <VStack align="stretch" spacing={4}>
      <Sparkline runs={runs} />

      <Box>
        <Text fontSize="xs" color="gray.500" mb={2}>
          Pick a baseline (A) and a comparison (B) run to see which rules
          changed.
        </Text>
        <TableContainer>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>When</Th>
                <Th>Result</Th>
                <Th isNumeric>Passed</Th>
                <Th isNumeric>Failed</Th>
                <Th isNumeric>Skipped</Th>
                <Th>A</Th>
                <Th>B</Th>
              </Tr>
            </Thead>
            <Tbody>
              {runs.map((run) => (
                <Tr key={run.id}>
                  <Td fontSize="xs">{formatTimestamp(run.created_at)}</Td>
                  <Td>
                    <Badge
                      colorScheme={run.status === "error" ? "red" : "green"}
                      variant="subtle"
                    >
                      {run.status === "error" ? "Error" : "Completed"}
                    </Badge>
                    {run.error && (
                      <Text fontSize="xs" color="red.400" mt={1}>
                        {run.error}
                      </Text>
                    )}
                  </Td>
                  <Td isNumeric>{run.passed_count ?? 0}</Td>
                  <Td isNumeric>
                    <Badge
                      colorScheme={run.failed_count ? "red" : "gray"}
                      variant="subtle"
                    >
                      {run.failed_count ?? 0}
                    </Badge>
                  </Td>
                  <Td isNumeric>{run.skipped_count ?? 0}</Td>
                  <Td>
                    <RadioGroup value={baseRunId} onChange={setBaseRunId}>
                      <Radio value={String(run.id)} size="sm" />
                    </RadioGroup>
                  </Td>
                  <Td>
                    <RadioGroup value={targetRunId} onChange={setTargetRunId}>
                      <Radio value={String(run.id)} size="sm" />
                    </RadioGroup>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>

        <Flex justify="space-between" align="center" mt={3}>
          <Text fontSize="xs" color="gray.500">
            Showing {rangeStart}–{rangeEnd} of {total}
          </Text>
          <HStack spacing={2}>
            <Button
              size="xs"
              variant="outline"
              isDisabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Newer
            </Button>
            <Button
              size="xs"
              variant="outline"
              isDisabled={rangeEnd >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Older
            </Button>
          </HStack>
        </Flex>
      </Box>

      {comparing && (
        <Box borderWidth="1px" borderRadius="md" p={3}>
          <Flex justify="space-between" align="center" mb={2}>
            <Heading size="xs">Changes from A to B</Heading>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                setBaseRunId("")
                setTargetRunId("")
              }}
            >
              Clear
            </Button>
          </Flex>
          {baseRunId === targetRunId ? (
            <Text fontSize="sm" color="gray.500">
              A and B are the same run.
            </Text>
          ) : diff === null ? (
            <Text fontSize="sm" color="gray.500">
              Loading…
            </Text>
          ) : diff.length === 0 ? (
            <Text fontSize="sm" color="gray.500">
              No rule changed status between these two runs.
            </Text>
          ) : (
            <VStack align="stretch" spacing={1}>
              {diff.map((entry) => (
                <HStack key={entry.rule_id} spacing={2} fontSize="sm">
                  <Badge
                    colorScheme={
                      entry.regression
                        ? "red"
                        : entry.improvement
                          ? "green"
                          : "gray"
                    }
                    variant="subtle"
                  >
                    {entry.regression
                      ? "Regression"
                      : entry.improvement
                        ? "Fixed"
                        : "Changed"}
                  </Badge>
                  <Text fontWeight="medium">{entry.title}</Text>
                  <Text color="gray.500" fontSize="xs">
                    {entry.rule_id}
                  </Text>
                  <Badge
                    colorScheme={statusColor(entry.from)}
                    variant="outline"
                  >
                    {statusLabel(entry.from)}
                  </Badge>
                  <Text color="gray.400">→</Text>
                  <Badge colorScheme={statusColor(entry.to)} variant="subtle">
                    {statusLabel(entry.to)}
                  </Badge>
                </HStack>
              ))}
            </VStack>
          )}
        </Box>
      )}
    </VStack>
  )
}

export default DeviceHistoryTab
