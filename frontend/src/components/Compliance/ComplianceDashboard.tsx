import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  Skeleton,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type OptionBase, Select, type SingleValue } from "chakra-react-select"
import { useState } from "react"
import { FiPlayCircle, FiSearch, FiShield } from "react-icons/fi"

import { type ApiError, ComplianceService, GroupsService } from "../../client"
import useCustomToast from "../../hooks/useCustomToast"
import { formatTimestamp } from "../../utils"
import DeviceComplianceModal from "./DeviceComplianceModal"
import GroupRemediationModal from "./GroupRemediationModal"

interface GroupOption extends OptionBase {
  label: string
  value: string
}

const ComplianceDashboard = () => {
  const showToast = useCustomToast()
  const queryClient = useQueryClient()
  const [groupName, setGroupName] = useState("")

  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: () => GroupsService.readGroups({}),
  })

  const groupOptions: GroupOption[] = (groups?.data ?? []).map((g) => ({
    value: g.name,
    label: `${g.name} - ${g.site}`,
  }))

  const handleGroupChange = (newValue: SingleValue<GroupOption>) => {
    setGroupName(newValue ? newValue.value : "")
  }
  const [selected, setSelected] = useState<{
    id: number
    hostname: string
  } | null>(null)
  const [fixMode, setFixMode] = useState(false)
  const modal = useDisclosure()
  const groupApplyModal = useDisclosure()

  const { data, isLoading } = useQuery({
    queryKey: ["compliance-summary"],
    queryFn: () => ComplianceService.readSummary(),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["compliance-summary"] })

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
    onSuccess: (res: any) => {
      invalidate()
      const succeeded = Object.keys(res?.run_ids ?? {}).length
      const failed = (res?.errors ?? []).length
      showToast(
        "Group check complete",
        `${succeeded} device(s) checked, ${failed} failed.`,
        failed ? "error" : "success",
      )
    },
    onError: onApiError,
  })

  const openModal = (id: number, hostname: string, fix = false) => {
    setSelected({ id, hostname })
    setFixMode(fix)
    modal.onOpen()
  }

  const closeModal = () => {
    setFixMode(false)
    modal.onClose()
  }

  return (
    <>
      <Flex gap={3} mb={4} align="flex-end" wrap="wrap">
        <Flex direction="column">
          <Text fontSize="xs" color="gray.500" mb={1}>
            Run check or apply fixes for a whole group
          </Text>
          <HStack>
            <Box width="220px">
              <Select<GroupOption>
                size="sm"
                options={groupOptions}
                placeholder="Select group…"
                isClearable
                value={
                  groupName
                    ? groupOptions.find((opt) => opt.value === groupName)
                    : null
                }
                onChange={handleGroupChange}
              />
            </Box>
            <Button
              size="sm"
              leftIcon={<Icon as={FiPlayCircle} />}
              isDisabled={!groupName}
              isLoading={groupRunMutation.isPending}
              onClick={() => groupRunMutation.mutate()}
            >
              Run Group
            </Button>
            <Button
              size="sm"
              colorScheme="orange"
              variant="outline"
              leftIcon={<Icon as={FiShield} />}
              isDisabled={!groupName}
              onClick={groupApplyModal.onOpen}
            >
              Apply Group
            </Button>
          </HStack>
        </Flex>
      </Flex>

      {isLoading ? (
        <Skeleton height="200px" />
      ) : (
        <TableContainer>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Hostname</Th>
                <Th>Platform</Th>
                <Th>Passed</Th>
                <Th>Failed</Th>
                <Th>Skipped</Th>
                <Th>Last Checked</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {(data?.data ?? []).map((row) => (
                <Tr key={row.device_id}>
                  <Td fontWeight="medium">{row.hostname}</Td>
                  <Td fontSize="xs">{row.platform ?? "—"}</Td>
                  <Td>
                    <Badge colorScheme="green" variant="subtle">
                      {row.passed_count}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge
                      colorScheme={row.failed_count > 0 ? "red" : "gray"}
                      variant="subtle"
                    >
                      {row.failed_count}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge colorScheme="gray" variant="subtle">
                      {row.skipped_count}
                    </Badge>
                  </Td>
                  <Td fontSize="xs">
                    {row.last_checked
                      ? formatTimestamp(row.last_checked)
                      : "Never"}
                  </Td>
                  <Td>
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
                      <Button
                        size="xs"
                        variant="ghost"
                        colorScheme="orange"
                        leftIcon={<Icon as={FiShield} />}
                        isDisabled={
                          row.failed_count === 0 || row.latest_run_id === null
                        }
                        onClick={() =>
                          openModal(row.device_id, row.hostname, true)
                        }
                      >
                        Fix ({row.failed_count})
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        leftIcon={<Icon as={FiSearch} />}
                        onClick={() => openModal(row.device_id, row.hostname)}
                      >
                        Details
                      </Button>
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}

      {selected && (
        <DeviceComplianceModal
          deviceId={selected.id}
          hostname={selected.hostname}
          isOpen={modal.isOpen}
          onClose={closeModal}
          autoRemediate={fixMode}
        />
      )}

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
