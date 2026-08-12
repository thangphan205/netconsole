import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  HStack,
  Icon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useDisclosure,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { FiShield } from "react-icons/fi"

import {
  type ApiError,
  ComplianceService,
  type GroupRemediationPreviewPublic,
  type GroupRemediationResultPublic,
} from "../../client"
import useCustomToast from "../../hooks/useCustomToast"
import ConfirmActionDialog from "../Common/ConfirmActionDialog"
import { CommandBlock } from "./RemediationPreview"

interface GroupRemediationModalProps {
  groupName: string
  isOpen: boolean
  onClose: () => void
}

const PLAN_STATUS_COLORS: Record<string, string> = {
  ready: "green",
  no_failures: "gray",
  no_run: "orange",
  unsupported_platform: "red",
}

const RESULT_STATUS_COLORS: Record<string, string> = {
  pushed: "green",
  skipped: "gray",
  error: "red",
}

const GroupRemediationModal = ({
  groupName,
  isOpen,
  onClose,
}: GroupRemediationModalProps) => {
  const showToast = useCustomToast()
  const queryClient = useQueryClient()
  const [preview, setPreview] = useState<GroupRemediationPreviewPublic | null>(
    null,
  )
  const [result, setResult] = useState<GroupRemediationResultPublic | null>(
    null,
  )
  const [excluded, setExcluded] = useState<number[]>([])
  const pushConfirm = useDisclosure()

  const onApiError = (err: ApiError) => {
    const errDetail = (err.body as any)?.detail
    showToast("Request failed.", `${errDetail}`, "error")
  }

  const readyDevices = (preview?.devices ?? []).filter(
    (device) => device.status === "ready",
  )
  const selectedIds = readyDevices
    .map((device) => device.device_id)
    .filter((deviceId) => !excluded.includes(deviceId))

  // A push plan must never come from the query cache — staleness is exactly
  // what the sha256 token guards against — so this is a mutation, not a query.
  const previewMutation = useMutation({
    mutationFn: (deviceIds: number[]) =>
      ComplianceService.groupRemediationPreview({
        groupName,
        requestBody: { rule_ids: [], device_ids: deviceIds },
      }),
    onSuccess: (res) => setPreview(res),
    onError: onApiError,
  })

  const applyMutation = useMutation({
    mutationFn: () =>
      ComplianceService.groupRemediate({
        groupName,
        requestBody: {
          rule_ids: [],
          // The same device set the preview hashed — narrowing it here without
          // re-previewing would change the plan and be rejected with a 409.
          device_ids: selectedIds,
          confirm: true,
          expected_commands_sha256: preview!.commands_sha256,
        },
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["compliance-summary"] })
      queryClient.invalidateQueries({ queryKey: ["compliance-overview"] })
      queryClient.invalidateQueries({ queryKey: ["compliance-latest"] })
      pushConfirm.onClose()
      // Keep the modal open on the results — per-device failures used to be
      // collapsed into a single toast and thrown away.
      setResult(res)
      setPreview(null)
    },
    onError: (err: ApiError) => {
      pushConfirm.onClose()
      if (err.status === 409) {
        setPreview(null)
        showToast(
          "Results changed since preview",
          "Re-run the preview before pushing.",
          "error",
        )
      } else {
        onApiError(err)
      }
    },
  })

  // Builds the plan once per open; Refresh rebuilds it on demand.
  // biome-ignore lint/correctness/useExhaustiveDependencies: must fire on open only
  useEffect(() => {
    if (isOpen && !preview && !result && !previewMutation.isPending) {
      previewMutation.mutate([])
    }
  }, [isOpen])

  const onModalClose = () => {
    setPreview(null)
    setResult(null)
    setExcluded([])
    onClose()
  }

  const toggleDevice = (deviceId: number) =>
    setExcluded((current) =>
      current.includes(deviceId)
        ? current.filter((id) => id !== deviceId)
        : [...current, deviceId],
    )

  // Re-preview against the selection so the token covers exactly what we push.
  const refreshForSelection = () => previewMutation.mutate(selectedIds)

  const devices = preview?.devices ?? []
  const selectedCount = selectedIds.length
  const previewCoversSelection =
    preview !== null && readyDevices.length === selectedCount

  return (
    <Modal
      isOpen={isOpen}
      onClose={onModalClose}
      size={{ base: "full", md: "3xl", lg: "5xl" }}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Apply remediation — group {groupName}</ModalHeader>
        <ModalCloseButton />
        <ModalBody maxH="65vh" overflowY="auto">
          {previewMutation.isPending && !preview && (
            <Flex justify="center" py={8}>
              <Spinner />
            </Flex>
          )}

          {result && (
            <VStack spacing={4} align="stretch">
              <Alert
                status={result.error_count ? "error" : "success"}
                borderRadius="md"
                fontSize="sm"
              >
                <AlertIcon />
                {result.pushed_count} pushed, {result.error_count} failed,{" "}
                {result.skipped_count} skipped.
              </Alert>

              {result.snapshot_warning && (
                <Alert status="warning" borderRadius="md" fontSize="xs">
                  <AlertIcon />
                  {result.snapshot_warning}
                </Alert>
              )}

              <TableContainer>
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>Device</Th>
                      <Th>Outcome</Th>
                      <Th>Rules</Th>
                      <Th>Detail</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {result.results.map((row) => (
                      <Tr key={row.device_id}>
                        <Td fontWeight="medium">{row.hostname}</Td>
                        <Td>
                          <Badge
                            colorScheme={
                              RESULT_STATUS_COLORS[row.status] ?? "gray"
                            }
                            variant="subtle"
                          >
                            {row.status}
                          </Badge>
                        </Td>
                        <Td fontSize="xs">
                          {(row.rule_ids ?? []).join(", ") || "—"}
                        </Td>
                        <Td fontSize="xs" whiteSpace="normal">
                          {row.message || "—"}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            </VStack>
          )}

          {preview && !result && (
            <VStack spacing={4} align="stretch">
              <Alert status="warning" borderRadius="md" fontSize="sm">
                <AlertIcon />
                Pushing merges these commands into the selected devices in group{" "}
                {groupName}. Each device receives only its own failing rules,
                and pre/post config revisions are recorded automatically.
              </Alert>

              {preview.caveats && (
                <Alert status="info" borderRadius="md" fontSize="xs">
                  <AlertIcon />
                  {preview.caveats}
                </Alert>
              )}

              {selectedCount > 10 && (
                <Alert status="warning" borderRadius="md" fontSize="xs">
                  <AlertIcon />
                  {selectedCount} devices are pushed one at a time — this
                  request may take several minutes.
                </Alert>
              )}

              {devices.length === 0 && (
                <Alert status="info" borderRadius="md" fontSize="sm">
                  <AlertIcon />
                  No devices found in group “{groupName}”.
                </Alert>
              )}

              {!previewCoversSelection && (
                <Alert status="info" borderRadius="md" fontSize="xs">
                  <AlertIcon />
                  Selection changed. Refresh the preview so the confirmation
                  covers exactly the devices you picked.
                </Alert>
              )}

              <Accordion allowMultiple defaultIndex={[]}>
                {devices.map((device) => {
                  const isReady = device.status === "ready"
                  const isSelected = !excluded.includes(device.device_id)
                  return (
                    <AccordionItem key={device.device_id}>
                      <h2>
                        <AccordionButton px={2}>
                          <HStack flex="1" spacing={3} textAlign="left">
                            <Checkbox
                              isChecked={isReady && isSelected}
                              isDisabled={!isReady}
                              onChange={(e) => {
                                e.stopPropagation()
                                toggleDevice(device.device_id)
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <Text fontWeight="medium">{device.hostname}</Text>
                            <Badge variant="subtle" fontSize="xs">
                              {device.platform ?? "—"}
                            </Badge>
                            <Badge
                              colorScheme={
                                PLAN_STATUS_COLORS[device.status ?? ""] ??
                                "gray"
                              }
                              variant="subtle"
                              fontSize="xs"
                            >
                              {isReady
                                ? `${device.rule_ids?.length ?? 0} rule(s)`
                                : device.status}
                            </Badge>
                          </HStack>
                          <AccordionIcon />
                        </AccordionButton>
                      </h2>
                      <AccordionPanel pb={4}>
                        {isReady ? (
                          <Box>
                            <Text fontSize="xs" color="gray.500" mb={2}>
                              {(device.rule_ids ?? []).join(", ")}
                            </Text>
                            <CommandBlock
                              commands={device.commands ?? ""}
                              label={`${device.hostname} commands`}
                            />
                          </Box>
                        ) : (
                          <Text fontSize="xs" color="gray.500">
                            {device.message}
                          </Text>
                        )}
                      </AccordionPanel>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            </VStack>
          )}
        </ModalBody>
        <ModalFooter gap={3}>
          <Button onClick={onModalClose} variant="ghost">
            Close
          </Button>
          {!result && (
            <>
              <Button
                variant="outline"
                isDisabled={applyMutation.isPending}
                isLoading={previewMutation.isPending}
                onClick={refreshForSelection}
              >
                Refresh preview
              </Button>
              <Button
                leftIcon={<Icon as={FiShield} />}
                colorScheme="red"
                isDisabled={selectedCount === 0 || !previewCoversSelection}
                isLoading={applyMutation.isPending}
                loadingText="Pushing…"
                onClick={pushConfirm.onOpen}
              >
                Push to {selectedCount} device(s)
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>

      <ConfirmActionDialog
        isOpen={pushConfirm.isOpen}
        onClose={pushConfirm.onClose}
        onConfirm={() => applyMutation.mutate()}
        isLoading={applyMutation.isPending}
        title={`Push configuration to ${selectedCount} device(s)?`}
        confirmLabel="Push configuration"
      >
        <Text mb={2}>
          This changes the live running configuration of every selected device
          in <b>{groupName}</b>, then re-runs each device's compliance check.
        </Text>
        <Text color="gray.500">
          {readyDevices
            .filter((device) => selectedIds.includes(device.device_id))
            .map((device) => device.hostname)
            .join(", ")}
        </Text>
      </ConfirmActionDialog>
    </Modal>
  )
}

export default GroupRemediationModal
