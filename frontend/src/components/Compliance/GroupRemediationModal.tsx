import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Code,
  Divider,
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
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { FiShield } from "react-icons/fi"

import {
  type ApiError,
  ComplianceService,
  type GroupRemediationPreviewPublic,
} from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

interface GroupRemediationModalProps {
  groupName: string
  isOpen: boolean
  onClose: () => void
}

const STATUS_COLORS: Record<string, string> = {
  ready: "green",
  no_failures: "gray",
  no_run: "orange",
  unsupported_platform: "red",
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

  const onApiError = (err: ApiError) => {
    const errDetail = (err.body as any)?.detail
    showToast("Request failed.", `${errDetail}`, "error")
  }

  // A push plan must never come from the query cache — staleness is exactly
  // what the sha256 token guards against — so this is a mutation, not a query.
  const previewMutation = useMutation({
    mutationFn: () =>
      ComplianceService.groupRemediationPreview({
        groupName,
        requestBody: { rule_ids: [] },
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
          confirm: true,
          expected_commands_sha256: preview!.commands_sha256,
        },
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["compliance-summary"] })
      queryClient.invalidateQueries({ queryKey: ["compliance-latest"] })
      showToast(
        "Group remediation complete",
        `${res.pushed_count} pushed, ${res.error_count} failed, ${res.skipped_count} skipped.`,
        res.error_count ? "error" : "success",
      )
      if (res.snapshot_warning) {
        showToast("Snapshot warning", res.snapshot_warning, "error")
      }
      setPreview(null)
      onClose()
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

  // Builds the plan once per open; Refresh rebuilds it on demand.
  // biome-ignore lint/correctness/useExhaustiveDependencies: must fire on open only
  useEffect(() => {
    if (isOpen && !preview && !previewMutation.isPending) {
      previewMutation.mutate()
    }
  }, [isOpen])

  const onModalClose = () => {
    setPreview(null)
    onClose()
  }

  const devices = preview?.devices ?? []
  const readyCount = preview?.total_devices ?? 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={onModalClose}
      size={{ base: "full", md: "3xl", lg: "5xl" }}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Apply Remediation — group {groupName}</ModalHeader>
        <ModalCloseButton />
        <ModalBody maxH="60vh" overflowY="auto">
          {previewMutation.isPending && !preview && (
            <Flex justify="center" py={8}>
              <Spinner />
            </Flex>
          )}

          {preview && (
            <VStack spacing={4} align="stretch">
              <Alert status="warning" borderRadius="md" fontSize="sm">
                <AlertIcon />
                Pushing will merge these commands into {readyCount} device(s) in
                group {groupName}. Each device gets only its own failing rules.
              </Alert>

              {preview.caveats && (
                <Alert status="info" borderRadius="md" fontSize="xs">
                  <AlertIcon />
                  {preview.caveats}
                </Alert>
              )}

              {readyCount > 10 && (
                <Alert status="warning" borderRadius="md" fontSize="xs">
                  <AlertIcon />
                  {readyCount} devices are pushed one at a time — this request
                  may take several minutes.
                </Alert>
              )}

              {devices.length === 0 && (
                <Alert status="info" borderRadius="md" fontSize="sm">
                  <AlertIcon />
                  No devices found in group "{groupName}".
                </Alert>
              )}

              {devices.map((sw, index) => (
                <Box key={sw.device_id}>
                  {index > 0 && <Divider mb={4} />}
                  <HStack mb={2} spacing={2}>
                    <Text fontWeight="medium">{sw.hostname}</Text>
                    <Badge variant="subtle" fontSize="xs">
                      {sw.platform ?? "—"}
                    </Badge>
                    <Badge
                      colorScheme={STATUS_COLORS[sw.status ?? ""] ?? "gray"}
                      variant="subtle"
                      fontSize="xs"
                    >
                      {sw.status === "ready"
                        ? `${sw.rule_ids?.length ?? 0} rule(s)`
                        : sw.status}
                    </Badge>
                  </HStack>
                  {sw.status === "ready" ? (
                    <Code
                      display="block"
                      whiteSpace="pre"
                      overflowX="auto"
                      p={3}
                      fontSize="xs"
                      borderRadius="md"
                    >
                      {sw.commands}
                    </Code>
                  ) : (
                    <Text fontSize="xs" color="gray.500">
                      {sw.message}
                    </Text>
                  )}
                </Box>
              ))}
            </VStack>
          )}
        </ModalBody>
        <ModalFooter gap={3}>
          <Button onClick={onModalClose} variant="ghost">
            Close
          </Button>
          <Button
            variant="outline"
            isDisabled={applyMutation.isPending}
            isLoading={previewMutation.isPending}
            onClick={() => previewMutation.mutate()}
          >
            Refresh preview
          </Button>
          <Button
            leftIcon={<Icon as={FiShield} />}
            colorScheme="red"
            isDisabled={readyCount === 0}
            isLoading={applyMutation.isPending}
            loadingText="Pushing…"
            onClick={() => applyMutation.mutate()}
          >
            Confirm &amp; Push ({readyCount} device(s))
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default GroupRemediationModal
