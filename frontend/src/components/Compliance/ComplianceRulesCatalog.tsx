import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Select as ChakraSelect,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Table,
  TableContainer,
  Tag,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { FiSearch, FiShield } from "react-icons/fi"

import { ComplianceService } from "../../client"
import EmptyState from "../Common/EmptyState"
import SkeletonRows from "../Common/SkeletonRows"
import { SEVERITY_WEIGHTS, severityColor } from "./constants"

const COLUMNS = ["Rule", "Severity", "Platforms", "Standards", "Fleet status"]

interface ComplianceRulesCatalogProps {
  groupName: string
  onDrillDown: (ruleId: string) => void
}

/**
 * Browsable rule catalog. Rule descriptions and supported platforms are
 * returned by the API but had nowhere to be displayed before this view.
 */
function ComplianceRulesCatalog({
  groupName,
  onDrillDown,
}: ComplianceRulesCatalogProps) {
  const [search, setSearch] = useState("")
  const [severity, setSeverity] = useState("all")

  const {
    data: rules,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["compliance-rules"],
    queryFn: () => ComplianceService.readRules(),
    staleTime: Number.POSITIVE_INFINITY,
  })

  const { data: overview } = useQuery({
    queryKey: ["compliance-overview", groupName],
    queryFn: () =>
      ComplianceService.readOverview(groupName ? { groupName } : {}),
  })

  const failingByRule = useMemo(() => {
    const map = new Map<string, { failed: number; total: number }>()
    for (const stat of overview?.top_failing_rules ?? []) {
      map.set(stat.rule_id, {
        failed: stat.failed_devices,
        total: stat.total_devices,
      })
    }
    return map
  }, [overview])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (rules?.data ?? [])
      .filter((rule) => {
        if (severity !== "all" && rule.severity !== severity) return false
        if (!needle) return true
        return (
          rule.id.toLowerCase().includes(needle) ||
          rule.title.toLowerCase().includes(needle) ||
          rule.description.toLowerCase().includes(needle)
        )
      })
      .sort(
        (a, b) =>
          (SEVERITY_WEIGHTS[b.severity] ?? 0) -
            (SEVERITY_WEIGHTS[a.severity] ?? 0) || a.id.localeCompare(b.id),
      )
  }, [rules, search, severity])

  if (isError) {
    return (
      <Alert status="error" borderRadius="md">
        <AlertIcon />
        Could not load the rule catalog.
      </Alert>
    )
  }

  return (
    <VStack align="stretch" spacing={4}>
      <HStack spacing={3} wrap="wrap">
        <InputGroup size="sm" width={{ base: "100%", md: "280px" }}>
          <InputLeftElement pointerEvents="none">
            <Icon as={FiSearch} color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search rules…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            borderRadius="md"
          />
        </InputGroup>
        <ChakraSelect
          size="sm"
          width="160px"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          <option value="all">All severities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </ChakraSelect>
        <Text fontSize="xs" color="gray.500">
          {visible.length} of {rules?.data?.length ?? 0} rules
        </Text>
      </HStack>

      {isLoading ? (
        <SkeletonRows columns={COLUMNS} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={FiShield}
          title="No rules match"
          description="Try a different search term or severity."
        />
      ) : (
        <TableContainer>
          <Table size="sm">
            <Thead>
              <Tr>
                {COLUMNS.map((column) => (
                  <Th key={column}>{column}</Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {visible.map((rule) => {
                const stat = failingByRule.get(rule.id)
                return (
                  <Tr key={rule.id}>
                    <Td maxW="380px" whiteSpace="normal">
                      <Text fontWeight="medium">{rule.title}</Text>
                      <Text fontSize="xs" color="gray.500">
                        {rule.id}
                      </Text>
                      <Text fontSize="xs" color="gray.500" mt={1}>
                        {rule.description}
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
                    <Td>
                      <HStack spacing={1} wrap="wrap">
                        {rule.platforms.map((platform) => (
                          <Tag key={platform} size="sm" borderRadius="full">
                            {platform}
                          </Tag>
                        ))}
                      </HStack>
                    </Td>
                    <Td fontSize="xs" whiteSpace="normal" maxW="220px">
                      <Box>
                        <Text as="span" color="gray.500">
                          PCI{" "}
                        </Text>
                        {rule.pci_dss.join(", ") || "—"}
                      </Box>
                      <Box>
                        <Text as="span" color="gray.500">
                          ISO{" "}
                        </Text>
                        {rule.iso27001.join(", ") || "—"}
                      </Box>
                    </Td>
                    <Td>
                      {stat ? (
                        <Badge
                          as="button"
                          colorScheme={severityColor(rule.severity)}
                          variant="subtle"
                          onClick={() => onDrillDown(rule.id)}
                          title="Show failing devices"
                        >
                          {stat.failed}/{stat.total} failing →
                        </Badge>
                      ) : (
                        <Text fontSize="xs" color="gray.400">
                          no failures
                        </Text>
                      )}
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        </TableContainer>
      )}
    </VStack>
  )
}

export default ComplianceRulesCatalog
