import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Select as ChakraSelect,
  Flex,
  HStack,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Progress,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  useDisclosure,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import {
  FiChevronDown,
  FiChevronUp,
  FiMoreVertical,
  FiPlayCircle,
  FiSearch,
  FiShield,
} from "react-icons/fi"

import {
  type ApiError,
  ComplianceService,
  type ComplianceSummaryItem,
} from "../../client"
import useCustomToast from "../../hooks/useCustomToast"
import { formatTimestamp } from "../../utils"
import ConfirmActionDialog from "../Common/ConfirmActionDialog"
import EmptyState from "../Common/EmptyState"
import SkeletonRows from "../Common/SkeletonRows"
import GroupRemediationModal from "./GroupRemediationModal"
import { SCORE_EXPLAINER, formatScore, scoreColor } from "./constants"

const PAGE_SIZE = 25

const COLUMNS = [
  "Hostname",
  "Platform",
  "Score",
  "Failing",
  "Last Checked",
  "Actions",
]

type SortKey =
  | "hostname"
  | "platform"
  | "score"
  | "failed_count"
  | "last_checked"

interface ComplianceDashboardProps {
  groupName: string
  statusFilter: string
  ruleFilter: string
  onStatusFilterChange: (status: string) => void
  onRuleFilterChange: (ruleId: string) => void
}

function severityChips(row: ComplianceSummaryItem) {
  const chips: { label: string; color: string }[] = []
  if (row.failed_high)
    chips.push({ label: `${row.failed_high}H`, color: "red" })
  if (row.failed_medium)
    chips.push({ label: `${row.failed_medium}M`, color: "orange" })
  if (row.failed_low) chips.push({ label: `${row.failed_low}L`, color: "blue" })
  return chips
}

function ComplianceDashboard({
  groupName,
  statusFilter,
  ruleFilter,
  onStatusFilterChange,
  onRuleFilterChange,
}: ComplianceDashboardProps) {
  const showToast = useCustomToast()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState<SortKey>("hostname")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const groupApplyModal = useDisclosure()
  const groupRunConfirm = useDisclosure()

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Any filter change invalidates the current offset — page 3 of the old
  // result set is meaningless against the new one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on filter change
  useEffect(() => setPage(0), [groupName, statusFilter, ruleFilter])

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "compliance-summary",
      groupName,
      statusFilter,
      ruleFilter,
      debouncedSearch,
      page,
    ],
    queryFn: () =>
      ComplianceService.readSummary({
        ...(groupName ? { groupName } : {}),
        ...(statusFilter && statusFilter !== "all"
          ? { status: statusFilter }
          : {}),
        ...(ruleFilter ? { ruleId: ruleFilter } : {}),
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      }),
  })

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(key === "hostname" || key === "platform" ? "asc" : "desc")
    }
  }

  const renderSortTh = (key: SortKey, label: string, isNumeric = false) => (
    <Th
      cursor="pointer"
      onClick={() => toggleSort(key)}
      userSelect="none"
      isNumeric={isNumeric}
    >
      <HStack spacing={1} justify={isNumeric ? "flex-end" : "flex-start"}>
        <Text>{label}</Text>
        {sortKey === key && (
          <Icon
            as={sortDir === "asc" ? FiChevronUp : FiChevronDown}
            boxSize={3}
          />
        )}
      </HStack>
    </Th>
  )

  // Sorting stays client-side over the current page: the API orders by
  // hostname for stable pagination, and re-sorting the whole estate server-side
  // would mean paging every column separately.
  const rows = useMemo(() => {
    const sorted: ComplianceSummaryItem[] = [...(data?.data ?? [])]
    sorted.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return sortDir === "asc" ? -1 : 1
      if (bv == null) return sortDir === "asc" ? 1 : -1
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number)
    })
    return sorted
  }, [data, sortKey, sortDir])

  const total = data?.count ?? 0
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["compliance-summary"] })
    queryClient.invalidateQueries({ queryKey: ["compliance-overview"] })
  }

  const onApiError = (err: ApiError) => {
    const errDetail = (err.body as any)?.detail
    showToast("Request failed.", `${errDetail}`, "error")
  }

  const runMutation = useMutation({
    mutationFn: (deviceId: number) =>
      ComplianceService.runDeviceCheck({ id: deviceId }),
    onSuccess: () => {
      invalidate()
      showToast("Check complete", "Compliance check finished.", "success")
    },
    onError: onApiError,
  })

  const groupRunMutation = useMutation({
    mutationFn: () => ComplianceService.runGroupCheck({ groupName }),
    onSuccess: (res) => {
      invalidate()
      groupRunConfirm.onClose()
      const body = res as {
        run_ids?: Record<string, number>
        errors?: string[]
      }
      const succeeded = Object.keys(body?.run_ids ?? {}).length
      const errors = body?.errors ?? []
      showToast(
        "Group check complete",
        errors.length
          ? `${succeeded} checked, ${errors.length} failed — ${errors.join(
              "; ",
            )}`
          : `${succeeded} device(s) checked.`,
        errors.length ? "error" : "success",
      )
    },
    onError: onApiError,
  })

  const openDevice = (deviceId: number) =>
    navigate({
      to: "/compliance/devices/$deviceId",
      params: { deviceId: String(deviceId) },
    })

  return (
    <>
      <Flex gap={3} mb={4} wrap="wrap" align="center">
        <InputGroup size="sm" width={{ base: "100%", md: "260px" }}>
          <InputLeftElement pointerEvents="none">
            <Icon as={FiSearch} color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search hostname…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            borderRadius="md"
          />
        </InputGroup>

        <ChakraSelect
          size="sm"
          width="170px"
          value={statusFilter || "all"}
          onChange={(e) => onStatusFilterChange(e.target.value)}
        >
          <option value="all">All devices</option>
          <option value="failing">Failing only</option>
          <option value="compliant">Compliant only</option>
          <option value="never">Never checked</option>
        </ChakraSelect>

        {ruleFilter && (
          <Badge
            as="button"
            colorScheme="orange"
            variant="subtle"
            px={2}
            py={1}
            borderRadius="md"
            onClick={() => onRuleFilterChange("")}
            title="Clear rule filter"
          >
            rule: {ruleFilter} ✕
          </Badge>
        )}

        <Box flex="1" />

        {/* Group actions are explicit, so picking a group to *look at* can
            never be mistaken for arming a fleet-wide push. */}
        <Menu>
          <MenuButton
            as={Button}
            size="sm"
            variant="outline"
            rightIcon={<Icon as={FiMoreVertical} />}
            isDisabled={!groupName}
          >
            Group actions
          </MenuButton>
          <MenuList>
            <MenuItem
              icon={<Icon as={FiPlayCircle} />}
              onClick={groupRunConfirm.onOpen}
            >
              Run check on “{groupName}”
            </MenuItem>
            <MenuItem
              icon={<Icon as={FiShield} />}
              color="orange.500"
              onClick={groupApplyModal.onOpen}
            >
              Apply fixes to “{groupName}”…
            </MenuItem>
          </MenuList>
        </Menu>
      </Flex>

      {isError ? (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          Could not load compliance results. Check that the backend is reachable
          and try again.
        </Alert>
      ) : isLoading ? (
        <SkeletonRows columns={COLUMNS} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FiShield}
          title="No devices match these filters"
          description={
            debouncedSearch || statusFilter !== "all" || groupName
              ? "Try clearing the search, status or group filter."
              : "Add a device to start tracking compliance."
          }
        />
      ) : (
        <>
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  {renderSortTh("hostname", "Hostname")}
                  {renderSortTh("platform", "Platform")}
                  {renderSortTh("score", "Score")}
                  {renderSortTh("failed_count", "Failing", true)}
                  {renderSortTh("last_checked", "Last Checked")}
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {rows.map((row) => {
                  const chips = severityChips(row)
                  const remediable = row.remediable_failed_count ?? 0
                  const manualOnly = row.failed_count - remediable
                  return (
                    <Tr
                      key={row.device_id}
                      cursor="pointer"
                      _hover={{ bg: "blackAlpha.50" }}
                      onClick={() => openDevice(row.device_id)}
                    >
                      <Td fontWeight="medium">{row.hostname}</Td>
                      <Td fontSize="xs">{row.platform ?? "—"}</Td>
                      <Td width="140px">
                        {row.latest_run_id === null ? (
                          <Text fontSize="xs" color="gray.400">
                            —
                          </Text>
                        ) : (
                          <Tooltip label={SCORE_EXPLAINER}>
                            <Box>
                              <Text fontSize="xs" mb={1}>
                                {formatScore(row.score)}
                              </Text>
                              <Progress
                                value={row.score ?? 0}
                                size="xs"
                                borderRadius="full"
                                colorScheme={scoreColor(row.score)}
                              />
                            </Box>
                          </Tooltip>
                        )}
                      </Td>
                      <Td isNumeric>
                        {row.failed_count === 0 ? (
                          <Badge colorScheme="green" variant="subtle">
                            0
                          </Badge>
                        ) : (
                          <HStack spacing={1} justify="flex-end">
                            {chips.map((chip) => (
                              <Badge
                                key={chip.label}
                                colorScheme={chip.color}
                                variant="subtle"
                              >
                                {chip.label}
                              </Badge>
                            ))}
                          </HStack>
                        )}
                      </Td>
                      <Td fontSize="xs">
                        {row.last_checked ? (
                          formatTimestamp(row.last_checked)
                        ) : (
                          <Badge colorScheme="orange" variant="subtle">
                            Never
                          </Badge>
                        )}
                      </Td>
                      <Td onClick={(e) => e.stopPropagation()}>
                        <HStack spacing={1}>
                          <Button
                            size="xs"
                            variant="ghost"
                            leftIcon={<Icon as={FiPlayCircle} />}
                            isLoading={
                              runMutation.isPending &&
                              runMutation.variables === row.device_id
                            }
                            onClick={() => runMutation.mutate(row.device_id)}
                          >
                            Run
                          </Button>
                          <Tooltip
                            label={
                              manualOnly > 0
                                ? `${manualOnly} of ${row.failed_count} failures have no automatic fix — review them on the device page.`
                                : undefined
                            }
                          >
                            <Button
                              size="xs"
                              variant="ghost"
                              colorScheme="orange"
                              leftIcon={<Icon as={FiShield} />}
                              isDisabled={
                                remediable === 0 || row.latest_run_id === null
                              }
                              onClick={() => openDevice(row.device_id)}
                            >
                              Fix ({remediable})
                            </Button>
                          </Tooltip>
                        </HStack>
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          </TableContainer>

          <Flex justify="space-between" align="center" mt={3}>
            <Text fontSize="xs" color="gray.500">
              Showing {rangeStart}–{rangeEnd} of {total}
            </Text>
            <HStack spacing={2}>
              <IconButton
                aria-label="Previous page"
                size="xs"
                variant="outline"
                icon={<Icon as={FiChevronUp} transform="rotate(-90deg)" />}
                isDisabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              />
              <IconButton
                aria-label="Next page"
                size="xs"
                variant="outline"
                icon={<Icon as={FiChevronDown} transform="rotate(-90deg)" />}
                isDisabled={rangeEnd >= total}
                onClick={() => setPage((p) => p + 1)}
              />
            </HStack>
          </Flex>
        </>
      )}

      <ConfirmActionDialog
        isOpen={groupRunConfirm.isOpen}
        onClose={groupRunConfirm.onClose}
        onConfirm={() => groupRunMutation.mutate()}
        isLoading={groupRunMutation.isPending}
        title="Run compliance check on group"
        confirmLabel="Run check"
        confirmColorScheme="blue"
      >
        <Text>
          This opens an SSH session to every device in <b>{groupName}</b> and
          reads its running configuration. It does not change any configuration.
        </Text>
      </ConfirmActionDialog>

      {groupName && (
        <GroupRemediationModal
          groupName={groupName}
          isOpen={groupApplyModal.isOpen}
          onClose={groupApplyModal.onClose}
        />
      )}
    </>
  )
}

export default ComplianceDashboard
