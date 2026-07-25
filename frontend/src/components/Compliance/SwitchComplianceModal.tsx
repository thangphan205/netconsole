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
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { FiPlayCircle, FiShield } from "react-icons/fi"

import {
  type ApiError,
  type ComplianceResultPublic,
  ComplianceService,
  type RemediationPreviewPublic,
} from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

interface SwitchComplianceModalProps {
  switchId: number
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

const SwitchComplianceModal = ({
  switchId,
  hostname,
  isOpen,
  onClose,
  autoRemediate = false,
}: SwitchComplianceModalProps) => {
  const showToast = useCustomToast()
  const queryClient = useQueryClient()
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([])
  const [preview, setPreview] = useState<RemediationPreviewPublic | null>(null)
  const [autoApplied, setAutoApplied] = useState(false)

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
    queryKey: ["compliance-latest", switchId],
    queryFn: () => ComplianceService.readLatestRun({ id: switchId }),
    enabled: isOpen,
    retry: false,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["compliance-latest", switchId] })
    queryClient.invalidateQueries({ queryKey: ["compliance-summary"] })
  }

  const onApiError = (err: ApiError) => {
    const errDetail = (err.body as any)?.detail
    showToast("Request failed.", `${errDetail}`, "error")
  }

  const runMutation = useMutation({
    mutationFn: () => ComplianceService.runSwitchCheck({ id: switchId }),
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
        id: switchId,
        requestBody: { run_id: runDetail!.run.id, rule_ids: ruleIds },
      }),
    onSuccess: (res) => setPreview(res),
    onError: onApiError,
  })

  const remediateMutation = useMutation({
    mutationFn: (ruleIds: string[]) =>
      ComplianceService.remediate({
        id: switchId,
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
    onClose()
  }

  const results: ComplianceResultPublic[] = runDetail?.results ?? []

  return (
    <Modal
      isOpen={isOpen}
      onClose={onModalClose}
      size={{ base: "full", md: "3xl", lg: "5xl" }}
    >
      <ModalOverlay />
      <ModalContent>
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
                switch.
              </Alert>
            )}

            {!isLoading && runDetail && (
              <TableContainer>
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th />
                      <Th>Rule</Th>
                      <Th>Severity</Th>
                      <Th>Status</Th>
                      <Th>PCI DSS</Th>
                      <Th>ISO 27001</Th>
                      <Th>Evidence</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {results.map((result) => {
                      const rule = ruleMap.get(result.rule_id)
                      return (
                        <Tr key={result.id}>
                          <Td>
                            {result.status === "fail" && (
                              <Checkbox
                                isChecked={selectedRuleIds.includes(
                                  result.rule_id,
                                )}
                                onChange={() => toggleRule(result.rule_id)}
                              />
                            )}
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
                            <Badge
                              colorScheme={
                                STATUS_COLORS[result.status] ?? "gray"
                              }
                              variant="subtle"
                            >
                              {result.status}
                            </Badge>
                          </Td>
                          <Td fontSize="xs">{rule?.pci_dss.join(", ")}</Td>
                          <Td fontSize="xs">{rule?.iso27001.join(", ")}</Td>
                          <Td fontSize="xs" maxW="200px" isTruncated>
                            {result.evidence}
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

export default SwitchComplianceModal
