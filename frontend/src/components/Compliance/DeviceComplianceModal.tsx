import {
  Alert,
  AlertIcon,
  Badge,
  Button,
  Checkbox,
  Code,
  Flex,
  HStack,
  Icon,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverFooter,
  PopoverTrigger,
  Portal,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tooltip,
  Tr,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import {
  FiEdit3,
  FiEyeOff,
  FiPlayCircle,
  FiPower,
  FiShield,
} from "react-icons/fi"

import {
  type ApiError,
  type ComplianceResultPublic,
  ComplianceService,
  DevicesService,
  type RemediationPreviewPublic,
} from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

interface DeviceComplianceModalProps {
  deviceId: number
  hostname: string
  isOpen: boolean
  onClose: () => void
  /** Opened from the dashboard "Fix" button: preselect every failed rule and
   * build the remediation preview straight away. */
  autoRemediate?: boolean
}

const STATUS_COLORS: Record<string, string> = {
  pass: "green",
  fail: "red",
  skipped: "gray",
  not_applicable: "gray",
  error: "orange",
}

const SEVERITY_COLORS: Record<string, string> = {
  high: "red",
  medium: "orange",
  low: "blue",
}

interface AttestControlProps {
  ruleId: string
  isManual: boolean
  isOpen: boolean
  draft: string
  onOpen: () => void
  onClosePopover: () => void
  onDraftChange: (value: string) => void
  onAttest: () => void
  onClear: () => void
  isAttesting: boolean
  isClearing: boolean
}

/** The rightmost per-row control for the manual-attestation override: an
 * "Attest" popover with an evidence textarea, or a "Clear Attestation"
 * button once the rule is already manually overridden. */
const AttestControl = ({
  ruleId,
  isManual,
  isOpen,
  draft,
  onOpen,
  onClosePopover,
  onDraftChange,
  onAttest,
  onClear,
  isAttesting,
  isClearing,
}: AttestControlProps) => {
  if (isManual) {
    return (
      <Tooltip
        label="Revert to the automated check result"
        placement="top"
        hasArrow
      >
        <Button
          size="xs"
          colorScheme="purple"
          variant="outline"
          isLoading={isClearing}
          onClick={onClear}
        >
          Clear Attestation
        </Button>
      </Tooltip>
    )
  }
  return (
    <Popover
      placement="top"
      isLazy
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={onClosePopover}
    >
      <Tooltip
        label="Manually attest this rule as passing"
        placement="top"
        hasArrow
      >
        <PopoverTrigger>
          <IconButton
            aria-label="Attest rule"
            size="xs"
            variant="ghost"
            icon={<Icon as={FiEdit3} />}
          />
        </PopoverTrigger>
      </Tooltip>
      <Portal>
        {/* Portaled to body to escape the sticky Actions cell's stacking
         * context; the popper wrapper's own z-index (10) would then land it
         * under the modal, so lift it to the popover token. */}
        <PopoverContent rootProps={{ zIndex: "popover" }}>
          <PopoverArrow />
          <PopoverCloseButton />
          <PopoverBody>
            <Text fontSize="xs" mb={2}>
              Evidence for manually attesting <b>{ruleId}</b> as passing:
            </Text>
            <Textarea
              size="sm"
              fontSize="xs"
              rows={3}
              placeholder="e.g. Verified via TACACS+ server config, out of band"
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
            />
          </PopoverBody>
          <PopoverFooter display="flex" justifyContent="flex-end">
            <Button
              size="xs"
              colorScheme="purple"
              isDisabled={!draft.trim()}
              isLoading={isAttesting}
              onClick={onAttest}
            >
              Attest
            </Button>
          </PopoverFooter>
        </PopoverContent>
      </Portal>
    </Popover>
  )
}

const DeviceComplianceModal = ({
  deviceId,
  hostname,
  isOpen,
  onClose,
  autoRemediate = false,
}: DeviceComplianceModalProps) => {
  const showToast = useCustomToast()
  const queryClient = useQueryClient()
  // The pinned Actions column needs an opaque background matching the modal
  // so rows scrolling underneath it stay hidden.
  const stickyBg = useColorModeValue("white", "gray.700")
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([])
  const [preview, setPreview] = useState<RemediationPreviewPublic | null>(null)
  const [autoApplied, setAutoApplied] = useState(false)

  const { data: deviceData } = useQuery({
    queryKey: ["device", deviceId],
    queryFn: () => DevicesService.readDevice({ id: deviceId }),
    enabled: isOpen,
  })

  const deviceDisabledRules = (deviceData?.disabled_rules || "")
    .split(",")
    .map((r: string) => r.trim())
    .filter(Boolean)

  const { data: rulesData } = useQuery({
    queryKey: ["compliance-rules"],
    queryFn: () => ComplianceService.readRules(),
    enabled: isOpen,
    staleTime: Number.POSITIVE_INFINITY,
  })
  const ruleMap = new Map((rulesData?.data ?? []).map((r) => [r.id, r]))

  const {
    data: runDetail,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["compliance-latest", deviceId],
    queryFn: () => ComplianceService.readLatestRun({ id: deviceId }),
    enabled: isOpen,
    retry: false,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["compliance-latest", deviceId] })
    queryClient.invalidateQueries({ queryKey: ["compliance-summary"] })
    queryClient.invalidateQueries({ queryKey: ["device", deviceId] })
  }

  const onApiError = (err: ApiError) => {
    const errDetail = (err.body as any)?.detail
    showToast("Request failed.", `${errDetail}`, "error")
  }

  const toggleDisableRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      if (!deviceData) return
      const isCurrentlyDisabled = deviceDisabledRules.includes(ruleId)
      const updatedList = isCurrentlyDisabled
        ? deviceDisabledRules.filter((id: string) => id !== ruleId)
        : [...deviceDisabledRules, ruleId]
      const disabled_rules = updatedList.join(",") || null

      await DevicesService.updateDevice({
        id: deviceId,
        requestBody: {
          ipaddress: deviceData.ipaddress,
          hostname: deviceData.hostname,
          groups: deviceData.groups,
          platform: deviceData.platform,
          device_type: deviceData.device_type,
          os_version: deviceData.os_version,
          model: deviceData.model,
          vendor: deviceData.vendor,
          serial_number: deviceData.serial_number,
          description: deviceData.description,
          more_info: deviceData.more_info,
          credential_id: deviceData.credential_id,
          port: deviceData.port,
          disabled_rules,
        },
      })
      try {
        await ComplianceService.runDeviceCheck({ id: deviceId })
      } catch {
        // The disable/enable toggle above already persisted — a device
        // that's unreachable for the follow-up refresh check shouldn't
        // make the toggle itself look like it failed.
      }
    },
    onSuccess: (_, ruleId) => {
      const wasDisabled = deviceDisabledRules.includes(ruleId)
      showToast(
        wasDisabled ? "Rule Enabled" : "Rule Disabled",
        `Rule ${ruleId} has been ${
          wasDisabled ? "enabled" : "disabled"
        } for ${hostname}.`,
        "success",
      )
      invalidate()
    },
    onError: onApiError,
  })

  // Only one row's attest popover can be open at a time, so a single draft
  // slot (rather than a map keyed by every rule_id ever opened) is enough —
  // it's reset by `onOpen` below and by `onModalClose`.
  const [attestingRuleId, setAttestingRuleId] = useState<string | null>(null)
  const [attestText, setAttestText] = useState("")

  const manualEvidenceMutation = useMutation({
    mutationFn: ({ ruleId, evidence }: { ruleId: string; evidence: string }) =>
      ComplianceService.setManualEvidence({
        id: deviceId,
        ruleId,
        requestBody: { evidence },
      }),
    onSuccess: (_, { ruleId }) => {
      setAttestingRuleId(null)
      setAttestText("")
      showToast(
        "Rule Attested",
        `Rule ${ruleId} manually marked as passing for ${hostname}.`,
        "success",
      )
      invalidate()
    },
    onError: onApiError,
  })

  const clearAttestationMutation = useMutation({
    mutationFn: (ruleId: string) =>
      ComplianceService.clearManualEvidence({ id: deviceId, ruleId }),
    onSuccess: (_, ruleId) => {
      showToast(
        "Attestation Cleared",
        `Rule ${ruleId} reverted to its automated result for ${hostname}.`,
        "success",
      )
      invalidate()
    },
    onError: onApiError,
  })

  const runMutation = useMutation({
    mutationFn: () => ComplianceService.runDeviceCheck({ id: deviceId }),
    onSuccess: () => {
      setSelectedRuleIds([])
      setPreview(null)
      invalidate()
      showToast(
        "Check complete",
        `Compliance check ran on ${hostname}.`,
        "success",
      )
    },
    onError: onApiError,
  })

  // Both mutations take the rule ids as an argument rather than closing over
  // `selectedRuleIds`: the auto-remediate effect fires in the same tick as
  // setSelectedRuleIds, and a closed-over value would still be the stale one.
  const previewMutation = useMutation({
    mutationFn: (ruleIds: string[]) =>
      ComplianceService.remediationPreview({
        id: deviceId,
        requestBody: { run_id: runDetail!.run.id, rule_ids: ruleIds },
      }),
    onSuccess: (res) => setPreview(res),
    onError: onApiError,
  })

  const remediateMutation = useMutation({
    mutationFn: (ruleIds: string[]) =>
      ComplianceService.remediate({
        id: deviceId,
        requestBody: {
          run_id: runDetail!.run.id,
          rule_ids: ruleIds,
          confirm: true,
          expected_commands_sha256: preview!.commands_sha256,
        },
      }),
    onSuccess: (res) => {
      setPreview(null)
      setSelectedRuleIds([])
      invalidate()
      showToast(
        "Remediation pushed",
        res.message || `Updated ${hostname}.`,
        "success",
      )
    },
    onError: (err: ApiError) => {
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

  // The autoApplied latch is what stops this re-firing when invalidate()
  // refetches runDetail after a push.
  // biome-ignore lint/correctness/useExhaustiveDependencies: latch-guarded
  useEffect(() => {
    if (!autoRemediate || !isOpen || !runDetail || autoApplied) return
    const failed = runDetail.results
      .filter((r) => r.status === "fail" && r.remediation_commands)
      .map((r) => r.rule_id)
    if (failed.length === 0) return
    setAutoApplied(true)
    setSelectedRuleIds(failed)
    previewMutation.mutate(failed)
  }, [autoRemediate, isOpen, runDetail, autoApplied])

  const toggleRule = (ruleId: string) => {
    setPreview(null)
    setSelectedRuleIds((prev) =>
      prev.includes(ruleId)
        ? prev.filter((id) => id !== ruleId)
        : [...prev, ruleId],
    )
  }

  const onModalClose = () => {
    setSelectedRuleIds([])
    setPreview(null)
    setAutoApplied(false)
    setAttestingRuleId(null)
    setAttestText("")
    onClose()
  }

  const results: ComplianceResultPublic[] = runDetail?.results ?? []

  return (
    <Modal
      isOpen={isOpen}
      onClose={onModalClose}
      size={{ base: "full", md: "5xl", lg: "6xl" }}
    >
      <ModalOverlay />
      <ModalContent maxW="95vw">
        <ModalHeader>Compliance — {hostname}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Flex justify="flex-end">
              <Button
                size="sm"
                leftIcon={<Icon as={FiPlayCircle} />}
                colorScheme="blue"
                variant="outline"
                isLoading={runMutation.isPending}
                loadingText="Running…"
                onClick={() => runMutation.mutate()}
              >
                Run Check
              </Button>
            </Flex>

            {isLoading && (
              <Flex justify="center" py={8}>
                <Spinner />
              </Flex>
            )}

            {!isLoading && isError && (
              <Alert status="info" borderRadius="md" fontSize="sm">
                <AlertIcon />
                No compliance run yet. Click "Run Check" to evaluate this
                device.
              </Alert>
            )}

            {!isLoading && runDetail && (
              <TableContainer>
                {/* TableContainer forces `white-space: nowrap`, which makes
                 * every column unshrinkable and pushes the table wider than
                 * the modal. The sticky Actions column then pins itself over
                 * the Evidence column and hides it. Allowing cells to wrap
                 * keeps the table inside the modal so nothing is covered. */}
                <Table size="sm" whiteSpace="normal">
                  <Thead>
                    <Tr>
                      <Th w="36px" px={2} />
                      <Th minW="140px">Rule</Th>
                      <Th minW="65px">Severity</Th>
                      <Th minW="75px">Status</Th>
                      <Th minW="85px">PCI DSS</Th>
                      <Th minW="80px">ISO 27001</Th>
                      <Th minW="150px">Evidence</Th>
                      <Th
                        minW="140px"
                        textAlign="right"
                        position="sticky"
                        right={0}
                        bg={stickyBg}
                        zIndex={1}
                      >
                        Actions
                      </Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {results.map((result) => {
                      const rule = ruleMap.get(result.rule_id)
                      const isRuleDisabled = deviceDisabledRules.includes(
                        result.rule_id,
                      )
                      return (
                        <Tr key={result.id}>
                          <Td px={2}>
                            {result.status === "fail" &&
                              (result.remediation_commands ? (
                                <Checkbox
                                  isChecked={selectedRuleIds.includes(
                                    result.rule_id,
                                  )}
                                  onChange={() => toggleRule(result.rule_id)}
                                />
                              ) : (
                                <Tooltip
                                  label="No safe auto-remediation for this rule — apply manually."
                                  placement="top"
                                  hasArrow
                                  openDelay={100}
                                >
                                  <Text
                                    fontSize="xs"
                                    color="gray.500"
                                    cursor="help"
                                  >
                                    Manual
                                  </Text>
                                </Tooltip>
                              ))}
                          </Td>
                          <Td>
                            <Text fontWeight="medium" fontSize="sm">
                              {rule?.title ?? result.rule_id}
                            </Text>
                            <Text fontSize="xs" color="gray.500">
                              {result.rule_id}
                            </Text>
                          </Td>
                          <Td>
                            {rule && (
                              <Badge
                                colorScheme={
                                  SEVERITY_COLORS[rule.severity] ?? "gray"
                                }
                                variant="outline"
                                fontSize="2xs"
                              >
                                {rule.severity}
                              </Badge>
                            )}
                          </Td>
                          <Td>
                            <HStack spacing={1}>
                              <Badge
                                colorScheme={
                                  STATUS_COLORS[result.status] ?? "gray"
                                }
                                variant="subtle"
                              >
                                {result.status}
                              </Badge>
                              {result.is_manual && (
                                <Tooltip
                                  label="Manually attested by an admin"
                                  placement="top"
                                  hasArrow
                                >
                                  <Badge
                                    colorScheme="purple"
                                    variant="outline"
                                    fontSize="2xs"
                                  >
                                    Manual
                                  </Badge>
                                </Tooltip>
                              )}
                            </HStack>
                          </Td>
                          <Td fontSize="xs">{rule?.pci_dss.join(", ")}</Td>
                          <Td fontSize="xs">{rule?.iso27001.join(", ")}</Td>
                          <Td fontSize="xs">
                            {result.evidence ? (
                              <Tooltip
                                label={result.evidence}
                                placement="top"
                                hasArrow
                                openDelay={100}
                              >
                                <Text noOfLines={2} maxW="220px" cursor="help">
                                  {result.evidence}
                                </Text>
                              </Tooltip>
                            ) : (
                              "—"
                            )}
                          </Td>
                          <Td
                            textAlign="right"
                            position="sticky"
                            right={0}
                            bg={stickyBg}
                          >
                            <HStack spacing={2} justify="flex-end">
                              <AttestControl
                                ruleId={result.rule_id}
                                isManual={result.is_manual}
                                isOpen={attestingRuleId === result.rule_id}
                                draft={
                                  attestingRuleId === result.rule_id
                                    ? attestText
                                    : ""
                                }
                                onOpen={() => {
                                  setAttestingRuleId(result.rule_id)
                                  setAttestText("")
                                }}
                                onClosePopover={() => {
                                  setAttestingRuleId(null)
                                  setAttestText("")
                                }}
                                onDraftChange={setAttestText}
                                onAttest={() =>
                                  manualEvidenceMutation.mutate({
                                    ruleId: result.rule_id,
                                    evidence: attestText,
                                  })
                                }
                                onClear={() =>
                                  clearAttestationMutation.mutate(
                                    result.rule_id,
                                  )
                                }
                                isAttesting={manualEvidenceMutation.isPending}
                                isClearing={clearAttestationMutation.isPending}
                              />
                              {isRuleDisabled ? (
                                <Tooltip
                                  label="Enable rule for this device"
                                  placement="top"
                                  hasArrow
                                >
                                  <Button
                                    size="xs"
                                    colorScheme="teal"
                                    variant="outline"
                                    leftIcon={<Icon as={FiPower} />}
                                    isLoading={
                                      toggleDisableRuleMutation.isPending
                                    }
                                    onClick={() =>
                                      toggleDisableRuleMutation.mutate(
                                        result.rule_id,
                                      )
                                    }
                                  >
                                    Enable
                                  </Button>
                                </Tooltip>
                              ) : (
                                <Tooltip
                                  label="Disable rule for this device"
                                  placement="top"
                                  hasArrow
                                >
                                  <Button
                                    size="xs"
                                    colorScheme="gray"
                                    variant="ghost"
                                    leftIcon={<Icon as={FiEyeOff} />}
                                    isLoading={
                                      toggleDisableRuleMutation.isPending
                                    }
                                    onClick={() =>
                                      toggleDisableRuleMutation.mutate(
                                        result.rule_id,
                                      )
                                    }
                                  >
                                    Disable
                                  </Button>
                                </Tooltip>
                              )}
                            </HStack>
                          </Td>
                        </Tr>
                      )
                    })}
                  </Tbody>
                </Table>
              </TableContainer>
            )}

            {preview && (
              <VStack align="stretch" spacing={3}>
                <Alert status="warning" borderRadius="md" fontSize="sm">
                  <AlertIcon />
                  Pushing will merge these commands into {hostname}'s running
                  configuration.
                </Alert>
                {preview.caveats && (
                  <Alert status="info" borderRadius="md" fontSize="xs">
                    <AlertIcon />
                    {preview.caveats}
                  </Alert>
                )}
                <Code
                  display="block"
                  whiteSpace="pre"
                  overflowX="auto"
                  p={4}
                  fontSize="xs"
                  fontFamily="mono"
                >
                  {preview.commands}
                </Code>
              </VStack>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter gap={3}>
          <Button onClick={onModalClose} variant="ghost">
            Close
          </Button>
          {!preview && (
            <Button
              leftIcon={<Icon as={FiShield} />}
              colorScheme="orange"
              isDisabled={selectedRuleIds.length === 0}
              isLoading={previewMutation.isPending}
              loadingText="Building preview…"
              onClick={() => previewMutation.mutate(selectedRuleIds)}
            >
              Preview Remediation ({selectedRuleIds.length})
            </Button>
          )}
          {preview && (
            <HStack spacing={3}>
              <Button
                variant="outline"
                onClick={() => setPreview(null)}
                isDisabled={remediateMutation.isPending}
              >
                Back
              </Button>
              <Button
                colorScheme="red"
                isLoading={remediateMutation.isPending}
                loadingText="Pushing…"
                onClick={() => remediateMutation.mutate(selectedRuleIds)}
              >
                Confirm & Push
              </Button>
            </HStack>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default DeviceComplianceModal
