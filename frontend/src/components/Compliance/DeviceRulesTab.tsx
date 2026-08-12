import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Flex,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  SimpleGrid,
  Tag,
  Text,
  Textarea,
  Tooltip,
  VStack,
  useDisclosure,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { FiEyeOff, FiPower, FiSearch, FiShield } from "react-icons/fi"

import {
  type ApiError,
  type ComplianceResultPublic,
  ComplianceService,
  type RemediationPreviewPublic,
} from "../../client"
import useCustomToast from "../../hooks/useCustomToast"
import ConfirmActionDialog from "../Common/ConfirmActionDialog"
import EmptyState from "../Common/EmptyState"
import RemediationPreview, { CommandBlock } from "./RemediationPreview"
import { severityColor, statusColor, statusLabel } from "./constants"

type Filter = "failing" | "all" | "attested" | "bypassed"

const FILTERS: { key: Filter; label: string }[] = [
  { key: "failing", label: "Failing" },
  { key: "all", label: "All" },
  { key: "attested", label: "Attested" },
  { key: "bypassed", label: "Bypassed" },
]

interface DeviceRulesTabProps {
  deviceId: number
  hostname: string
  runId: number | null
  results: ComplianceResultPublic[]
  disabledRules: string[]
  /** Preselect every remediable failure and jump straight to the preview. */
  autoFix?: boolean
  onAutoFixHandled?: () => void
}

function DeviceRulesTab({
  deviceId,
  hostname,
  runId,
  results,
  disabledRules,
  autoFix,
  onAutoFixHandled,
}: DeviceRulesTabProps) {
  const showToast = useCustomToast()
  const queryClient = useQueryClient()

  const [filter, setFilter] = useState<Filter>("failing")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [preview, setPreview] = useState<RemediationPreviewPublic | null>(null)
  const [attestDraft, setAttestDraft] = useState<Record<string, string>>({})
  const pushConfirm = useDisclosure()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["compliance-latest", deviceId] })
    queryClient.invalidateQueries({ queryKey: ["compliance-runs", deviceId] })
    queryClient.invalidateQueries({ queryKey: ["compliance-summary"] })
    queryClient.invalidateQueries({ queryKey: ["compliance-overview"] })
    queryClient.invalidateQueries({ queryKey: ["device", deviceId] })
  }

  const onApiError = (err: ApiError) => {
    const errDetail = (err.body as any)?.detail
    showToast("Request failed.", `${errDetail}`, "error")
  }

  const remediableFailures = useMemo(
    () =>
      results.filter(
        (result) => result.status === "fail" && result.remediation_commands,
      ),
    [results],
  )

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return results.filter((result) => {
      if (filter === "failing" && result.status !== "fail") return false
      if (filter === "attested" && !result.is_manual) return false
      if (filter === "bypassed" && !disabledRules.includes(result.rule_id))
        return false
      if (!needle) return true
      return (
        result.rule_id.toLowerCase().includes(needle) ||
        (result.title ?? "").toLowerCase().includes(needle) ||
        (result.evidence ?? "").toLowerCase().includes(needle)
      )
    })
  }, [results, filter, search, disabledRules])

  const previewMutation = useMutation({
    mutationFn: (ruleIds: string[]) =>
      ComplianceService.remediationPreview({
        id: deviceId,
        requestBody: { run_id: runId as number, rule_ids: ruleIds },
      }),
    onSuccess: (data) => setPreview(data),
    onError: onApiError,
  })

  const remediateMutation = useMutation({
    mutationFn: () =>
      ComplianceService.remediate({
        id: deviceId,
        requestBody: {
          run_id: runId as number,
          rule_ids: preview?.rule_ids ?? [],
          confirm: true,
          expected_commands_sha256: preview?.commands_sha256 ?? "",
        },
      }),
    onSuccess: (res) => {
      pushConfirm.onClose()
      setPreview(null)
      setSelected([])
      invalidate()
      showToast(
        "Remediation pushed",
        res.message ?? "Configuration applied.",
        "success",
      )
    },
    onError: (err: ApiError) => {
      pushConfirm.onClose()
      if (err.status === 409) {
        // The stored run moved under us — force a fresh preview rather than
        // pushing commands the operator never saw.
        setPreview(null)
        showToast(
          "Preview is stale",
          "The device was re-checked since this preview. Re-run the preview before pushing.",
          "error",
        )
        return
      }
      onApiError(err)
    },
  })

  const attestMutation = useMutation({
    mutationFn: ({ ruleId, evidence }: { ruleId: string; evidence: string }) =>
      ComplianceService.setManualEvidence({
        id: deviceId,
        ruleId,
        requestBody: { evidence },
      }),
    onSuccess: (_data, variables) => {
      setAttestDraft((draft) => ({ ...draft, [variables.ruleId]: "" }))
      invalidate()
      showToast(
        "Rule attested",
        `${variables.ruleId} now reports PASS.`,
        "success",
      )
    },
    onError: onApiError,
  })

  const clearAttestationMutation = useMutation({
    mutationFn: (ruleId: string) =>
      ComplianceService.clearManualEvidence({ id: deviceId, ruleId }),
    onSuccess: (_data, ruleId) => {
      invalidate()
      showToast(
        "Attestation cleared",
        `${ruleId} reverted to the automated result.`,
        "success",
      )
    },
    onError: onApiError,
  })

  const toggleDisabledMutation = useMutation({
    mutationFn: (ruleId: string) => {
      const next = disabledRules.includes(ruleId)
        ? disabledRules.filter((id) => id !== ruleId)
        : [...disabledRules, ruleId]
      return ComplianceService.setDeviceDisabledRules({
        id: deviceId,
        requestBody: { rule_ids: next },
      })
    },
    onSuccess: (_data, ruleId) => {
      const wasDisabled = disabledRules.includes(ruleId)
      invalidate()
      showToast(
        wasDisabled ? "Rule re-enabled" : "Rule bypassed",
        `${ruleId} is now ${
          wasDisabled ? "evaluated" : "reported as not applicable"
        } on ${hostname}.`,
        "success",
      )
    },
    onError: onApiError,
  })

  const startPreview = (ruleIds: string[]) => {
    if (!runId || ruleIds.length === 0) return
    setSelected(ruleIds)
    previewMutation.mutate(ruleIds)
  }

  // The "Fix" entry point from the device list: preselect everything that has
  // commands and show the preview immediately. The rule ids are passed as
  // mutation args rather than read from state, which has not flushed yet.
  const previewMutate = previewMutation.mutate
  // biome-ignore lint/correctness/useExhaustiveDependencies: fires once per autoFix entry
  useEffect(() => {
    if (!autoFix || !runId) return
    onAutoFixHandled?.()
    if (remediableFailures.length === 0) {
      showToast(
        "Nothing to fix automatically",
        "None of this device's failures ship remediation commands. Review them below.",
        "error",
      )
      return
    }
    const ruleIds = remediableFailures.map((result) => result.rule_id)
    setSelected(ruleIds)
    previewMutate(ruleIds)
  }, [autoFix, runId])

  const toggleSelected = (ruleId: string) =>
    setSelected((current) =>
      current.includes(ruleId)
        ? current.filter((id) => id !== ruleId)
        : [...current, ruleId],
    )

  if (preview) {
    return (
      <VStack align="stretch" spacing={4}>
        <RemediationPreview
          commands={preview.commands}
          blocks={preview.blocks}
          caveats={preview.caveats}
          warning={`These commands will be merged into the running configuration of ${hostname} over SSH. A pre- and post-push config revision is recorded automatically.`}
        />
        <Flex gap={3} justify="flex-end">
          <Button variant="ghost" onClick={() => setPreview(null)}>
            Back
          </Button>
          <Button colorScheme="red" onClick={pushConfirm.onOpen}>
            Push {preview.rule_ids.length} fix
            {preview.rule_ids.length === 1 ? "" : "es"}
          </Button>
        </Flex>

        <ConfirmActionDialog
          isOpen={pushConfirm.isOpen}
          onClose={pushConfirm.onClose}
          onConfirm={() => remediateMutation.mutate()}
          isLoading={remediateMutation.isPending}
          title={`Push configuration to ${hostname}?`}
          confirmLabel="Push configuration"
        >
          <Text mb={2}>
            This changes the live running configuration of <b>{hostname}</b> and
            then re-runs the compliance check.
          </Text>
          <Text color="gray.500">Rules: {preview.rule_ids.join(", ")}</Text>
        </ConfirmActionDialog>
      </VStack>
    )
  }

  return (
    <VStack align="stretch" spacing={4}>
      <Flex gap={3} wrap="wrap" align="center">
        <HStack spacing={1}>
          {FILTERS.map((entry) => {
            const count =
              entry.key === "failing"
                ? results.filter((r) => r.status === "fail").length
                : entry.key === "attested"
                  ? results.filter((r) => r.is_manual).length
                  : entry.key === "bypassed"
                    ? disabledRules.length
                    : results.length
            return (
              <Button
                key={entry.key}
                size="xs"
                variant={filter === entry.key ? "solid" : "outline"}
                colorScheme={filter === entry.key ? "teal" : "gray"}
                onClick={() => setFilter(entry.key)}
              >
                {entry.label} ({count})
              </Button>
            )
          })}
        </HStack>

        <InputGroup size="sm" width={{ base: "100%", md: "240px" }}>
          <InputLeftElement pointerEvents="none">
            <Icon as={FiSearch} color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search rules or evidence…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            borderRadius="md"
          />
        </InputGroup>

        <Box flex="1" />

        <Button
          size="sm"
          colorScheme="orange"
          variant="outline"
          leftIcon={<Icon as={FiShield} />}
          isDisabled={selected.length === 0 || !runId}
          isLoading={previewMutation.isPending}
          onClick={() => startPreview(selected)}
        >
          Preview fix ({selected.length})
        </Button>
      </Flex>

      {visible.length === 0 ? (
        <EmptyState
          icon={FiShield}
          title={
            filter === "failing"
              ? "No failing rules"
              : "No rules match this view"
          }
          description={
            filter === "failing"
              ? "Every evaluated rule passes on this device."
              : "Try a different filter or search term."
          }
        />
      ) : (
        <Accordion allowMultiple>
          {visible.map((result) => {
            const isDisabled = disabledRules.includes(result.rule_id)
            const canFix =
              result.status === "fail" && !!result.remediation_commands
            return (
              <AccordionItem key={result.rule_id}>
                <h2>
                  <AccordionButton px={2} py={3}>
                    <HStack
                      flex="1"
                      spacing={3}
                      textAlign="left"
                      wrap={{ base: "wrap", md: "nowrap" }}
                    >
                      <Checkbox
                        isChecked={selected.includes(result.rule_id)}
                        isDisabled={!canFix}
                        onChange={(e) => {
                          e.stopPropagation()
                          toggleSelected(result.rule_id)
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Box flex="1" minW="200px">
                        <Text fontWeight="medium" fontSize="sm">
                          {result.title || result.rule_id}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          {result.rule_id}
                        </Text>
                      </Box>
                      <Badge
                        colorScheme={severityColor(result.severity ?? "")}
                        variant="outline"
                        fontSize="2xs"
                      >
                        {(result.severity ?? "").toUpperCase() || "—"}
                      </Badge>
                      <Badge
                        colorScheme={statusColor(result.status)}
                        variant="subtle"
                      >
                        {statusLabel(result.status)}
                      </Badge>
                      {result.is_manual && (
                        <Tooltip label="Status forced to PASS by an operator attestation">
                          <Badge colorScheme="purple" variant="outline">
                            Attested
                          </Badge>
                        </Tooltip>
                      )}
                      {result.status === "fail" && !result.remediable && (
                        <Tooltip label="This rule ships no remediation commands for this platform — fix it by hand or attest it">
                          <Badge colorScheme="gray" variant="outline">
                            No auto-fix
                          </Badge>
                        </Tooltip>
                      )}
                      {isDisabled && (
                        <Badge colorScheme="gray" variant="subtle">
                          Bypassed
                        </Badge>
                      )}
                    </HStack>
                    <AccordionIcon />
                  </AccordionButton>
                </h2>
                <AccordionPanel pb={4} px={{ base: 2, md: 6 }}>
                  <VStack align="stretch" spacing={3}>
                    {result.description && (
                      <Text fontSize="sm" color="gray.500">
                        {result.description}
                      </Text>
                    )}

                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                      <Box>
                        <Text fontSize="xs" color="gray.500" mb={1}>
                          Evidence
                        </Text>
                        {result.evidence ? (
                          <CommandBlock
                            commands={result.evidence}
                            label="Evidence"
                          />
                        ) : (
                          <Text fontSize="sm" color="gray.400">
                            —
                          </Text>
                        )}
                      </Box>
                      <Box>
                        <Text fontSize="xs" color="gray.500" mb={1}>
                          Standards
                        </Text>
                        <HStack spacing={1} wrap="wrap">
                          {(result.pci_dss ?? []).map((control) => (
                            <Tag key={control} size="sm" colorScheme="blue">
                              PCI {control}
                            </Tag>
                          ))}
                          {(result.iso27001 ?? []).map((control) => (
                            <Tag key={control} size="sm" colorScheme="purple">
                              ISO {control}
                            </Tag>
                          ))}
                        </HStack>
                      </Box>
                    </SimpleGrid>

                    {result.remediation_commands && (
                      <Box>
                        <Text fontSize="xs" color="gray.500" mb={1}>
                          Remediation
                        </Text>
                        <CommandBlock
                          commands={result.remediation_commands}
                          label="Would be pushed"
                        />
                      </Box>
                    )}

                    <Divider />

                    <Flex gap={3} wrap="wrap" align="flex-start">
                      {canFix && (
                        <Button
                          size="xs"
                          colorScheme="orange"
                          leftIcon={<Icon as={FiShield} />}
                          isLoading={
                            previewMutation.isPending &&
                            previewMutation.variables?.length === 1 &&
                            previewMutation.variables[0] === result.rule_id
                          }
                          onClick={() => startPreview([result.rule_id])}
                        >
                          Fix this rule
                        </Button>
                      )}

                      <Button
                        size="xs"
                        variant="outline"
                        colorScheme={isDisabled ? "teal" : "gray"}
                        leftIcon={<Icon as={isDisabled ? FiPower : FiEyeOff} />}
                        isLoading={
                          toggleDisabledMutation.isPending &&
                          toggleDisabledMutation.variables === result.rule_id
                        }
                        onClick={() =>
                          toggleDisabledMutation.mutate(result.rule_id)
                        }
                      >
                        {isDisabled ? "Re-enable rule" : "Bypass rule"}
                      </Button>

                      {result.is_manual ? (
                        <Button
                          size="xs"
                          colorScheme="purple"
                          variant="outline"
                          isLoading={
                            clearAttestationMutation.isPending &&
                            clearAttestationMutation.variables ===
                              result.rule_id
                          }
                          onClick={() =>
                            clearAttestationMutation.mutate(result.rule_id)
                          }
                        >
                          Clear attestation
                        </Button>
                      ) : (
                        <Box flex="1" minW="260px">
                          <Textarea
                            size="sm"
                            fontSize="xs"
                            rows={2}
                            placeholder="Evidence for attesting this rule as passing, e.g. “Verified via TACACS+ config, out of band”"
                            value={attestDraft[result.rule_id] ?? ""}
                            onChange={(e) =>
                              setAttestDraft((draft) => ({
                                ...draft,
                                [result.rule_id]: e.target.value,
                              }))
                            }
                          />
                          <Button
                            mt={2}
                            size="xs"
                            colorScheme="purple"
                            isDisabled={
                              !(attestDraft[result.rule_id] ?? "").trim()
                            }
                            isLoading={
                              attestMutation.isPending &&
                              attestMutation.variables?.ruleId ===
                                result.rule_id
                            }
                            onClick={() =>
                              attestMutation.mutate({
                                ruleId: result.rule_id,
                                evidence: attestDraft[result.rule_id] ?? "",
                              })
                            }
                          >
                            Attest as passing
                          </Button>
                        </Box>
                      )}
                    </Flex>
                  </VStack>
                </AccordionPanel>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}
    </VStack>
  )
}

export default DeviceRulesTab
