import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  HStack,
  Heading,
  Progress,
  SimpleGrid,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  VStack,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { FiShield } from "react-icons/fi"

import { ComplianceService } from "../../client"
import EmptyState from "../Common/EmptyState"
import SkeletonRows from "../Common/SkeletonRows"
import StatCard from "../Common/StatCard"
import {
  SCORE_EXPLAINER,
  SEVERITY_ORDER,
  formatScore,
  scoreColor,
  severityColor,
} from "./constants"

interface ComplianceOverviewProps {
  groupName: string
  /** Jump to the Devices tab pre-filtered — the overview's job is to point somewhere. */
  onDrillDown: (filter: { status?: string; ruleId?: string }) => void
}

const FRAMEWORK_LABELS: Record<string, string> = {
  pci_dss: "PCI DSS",
  iso27001: "ISO 27001",
}

function ComplianceOverview({
  groupName,
  onDrillDown,
}: ComplianceOverviewProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["compliance-overview", groupName],
    queryFn: () =>
      ComplianceService.readOverview(groupName ? { groupName } : {}),
  })

  if (isError) {
    return (
      <Alert status="error" borderRadius="md">
        <AlertIcon />
        Could not load the compliance overview. Check that the backend is
        reachable and try again.
      </Alert>
    )
  }

  const openFailures = SEVERITY_ORDER.map((severity) => ({
    severity,
    count: data?.severity_breakdown?.[severity] ?? 0,
  }))

  const frameworks = (data?.framework_stats ?? []).reduce<
    Record<string, { control: string; passed: number; failed: number }[]>
  >((acc, stat) => {
    acc[stat.framework] = acc[stat.framework] ?? []
    acc[stat.framework].push(stat)
    return acc
  }, {})

  return (
    <VStack align="stretch" spacing={6}>
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
        <StatCard
          label="Compliance score"
          isLoading={isLoading}
          colorScheme={scoreColor(data?.score)}
          count={formatScore(data?.score)}
          helpText={
            <Tooltip label={SCORE_EXPLAINER}>
              <Text as="span" borderBottom="1px dashed" cursor="help">
                severity-weighted
              </Text>
            </Tooltip>
          }
        />
        <StatCard
          label="Compliant devices"
          isLoading={isLoading}
          colorScheme="green"
          count={data?.compliant_devices ?? 0}
          helpText={`of ${data?.total_devices ?? 0} devices`}
        />
        <StatCard
          label="Failing devices"
          isLoading={isLoading}
          colorScheme={data?.failing_devices ? "red" : undefined}
          count={data?.failing_devices ?? 0}
          helpText={`${data?.failed_total ?? 0} open failures`}
        />
        <StatCard
          label="Never checked"
          isLoading={isLoading}
          colorScheme={data?.never_checked ? "orange" : undefined}
          count={data?.never_checked ?? 0}
          helpText="no compliance run yet"
        />
      </SimpleGrid>

      <Box>
        <Heading size="sm" mb={2}>
          Open failures by severity
        </Heading>
        <HStack spacing={2} wrap="wrap">
          {openFailures.map(({ severity, count }) => (
            <Badge
              key={severity}
              colorScheme={count ? severityColor(severity) : "gray"}
              variant={count ? "solid" : "subtle"}
              px={2}
              py={1}
              borderRadius="md"
            >
              {count} {severity}
            </Badge>
          ))}
          {data?.never_checked ? (
            <Badge
              as="button"
              colorScheme="orange"
              variant="outline"
              px={2}
              py={1}
              borderRadius="md"
              onClick={() => onDrillDown({ status: "never" })}
            >
              {data.never_checked} never checked →
            </Badge>
          ) : null}
        </HStack>
      </Box>

      <Box>
        <Heading size="sm" mb={2}>
          Rules failing on the most devices
        </Heading>
        {isLoading ? (
          <SkeletonRows
            columns={["Rule", "Severity", "Failing", "Coverage"]}
            rows={4}
          />
        ) : data?.top_failing_rules?.length ? (
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Rule</Th>
                  <Th>Severity</Th>
                  <Th isNumeric>Failing devices</Th>
                  <Th width="30%">Share of evaluated</Th>
                </Tr>
              </Thead>
              <Tbody>
                {data.top_failing_rules.slice(0, 10).map((rule) => {
                  const share = rule.total_devices
                    ? (100 * rule.failed_devices) / rule.total_devices
                    : 0
                  return (
                    <Tr
                      key={rule.rule_id}
                      cursor="pointer"
                      _hover={{ bg: "blackAlpha.50" }}
                      onClick={() => onDrillDown({ ruleId: rule.rule_id })}
                    >
                      <Td>
                        <Text fontWeight="medium">{rule.title}</Text>
                        <Text fontSize="xs" color="gray.500">
                          {rule.rule_id}
                        </Text>
                      </Td>
                      <Td>
                        <Badge
                          colorScheme={severityColor(rule.severity)}
                          variant="outline"
                          fontSize="2xs"
                        >
                          {rule.severity.toUpperCase()}
                        </Badge>
                      </Td>
                      <Td isNumeric fontWeight="medium">
                        {rule.failed_devices} / {rule.total_devices}
                      </Td>
                      <Td>
                        <Progress
                          value={share}
                          size="sm"
                          borderRadius="full"
                          colorScheme={severityColor(rule.severity)}
                        />
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          </TableContainer>
        ) : (
          <EmptyState
            icon={FiShield}
            title="No failing rules"
            description={
              data?.checked_devices
                ? "Every evaluated rule passes on every checked device."
                : "Run a compliance check to populate this view."
            }
          />
        )}
      </Box>

      <Box>
        <Heading size="sm" mb={2}>
          Framework coverage
        </Heading>
        <Text fontSize="xs" color="gray.500" mb={3}>
          Per-control results across every checked device. A control counts once
          per device per mapped rule.
        </Text>
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
          {Object.entries(FRAMEWORK_LABELS).map(([key, label]) => {
            const stats = frameworks[key] ?? []
            return (
              <Box key={key} borderWidth="1px" borderRadius="md" p={3}>
                <Heading size="xs" mb={2}>
                  {label}
                </Heading>
                {stats.length === 0 ? (
                  <Text fontSize="sm" color="gray.400">
                    No data yet.
                  </Text>
                ) : (
                  <VStack
                    align="stretch"
                    spacing={1}
                    maxH="260px"
                    overflowY="auto"
                  >
                    {stats.map((stat) => {
                      const total = stat.passed + stat.failed
                      const pct = total ? (100 * stat.passed) / total : 0
                      return (
                        <HStack key={stat.control} spacing={3}>
                          <Text fontSize="xs" width="70px" flexShrink={0}>
                            {stat.control}
                          </Text>
                          <Progress
                            value={pct}
                            size="sm"
                            flex="1"
                            borderRadius="full"
                            colorScheme={scoreColor(pct)}
                          />
                          <Text
                            fontSize="xs"
                            color="gray.500"
                            width="60px"
                            textAlign="right"
                            flexShrink={0}
                          >
                            {stat.passed}/{total}
                          </Text>
                        </HStack>
                      )
                    })}
                  </VStack>
                )}
              </Box>
            )
          })}
        </SimpleGrid>
      </Box>
    </VStack>
  )
}

export default ComplianceOverview
