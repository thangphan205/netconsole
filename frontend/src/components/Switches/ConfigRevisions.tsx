import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
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
  Tooltip,
  Tr,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { FiCamera, FiEye, FiGitCommit, FiRotateCcw } from "react-icons/fi"

import {
  type ApiError,
  type ConfigRevisionPublic,
  RevisionsService,
  type RollbackPreviewPublic,
  type SwitchPublic,
} from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

interface ConfigRevisionsProps {
  item: SwitchPublic
  isOpen: boolean
  onClose: () => void
}

const ACTION_COLORS: Record<string, string> = {
  manual: "blue",
  scheduled: "cyan",
  pre_push: "orange",
  post_push: "purple",
  rollback: "red",
}

function DiffBlock({ diff }: { diff: string }) {
  if (!diff.trim()) {
    return (
      <Alert status="info" borderRadius="md" fontSize="sm">
        <AlertIcon />
        No differences.
      </Alert>
    )
  }
  return (
    <Box
      border="1px solid"
      borderColor="gray.200"
      borderRadius="lg"
      p={3}
      bg="gray.50"
      maxH="400px"
      overflowY="auto"
      overflowX="auto"
      fontFamily="mono"
      fontSize="xs"
    >
      {diff.split("\n").map((line, i) => (
        <Text
          key={i}
          whiteSpace="pre"
          color={
            line.startsWith("+")
              ? "green.600"
              : line.startsWith("-")
                ? "red.600"
                : line.startsWith("@@")
                  ? "purple.600"
                  : "gray.700"
          }
        >
          {line || " "}
        </Text>
      ))}
    </Box>
  )
}

const ConfigRevisions = ({ item, isOpen, onClose }: ConfigRevisionsProps) => {
  const showToast = useCustomToast()
  const queryClient = useQueryClient()
  const [viewConfig, setViewConfig] = useState<string | null>(null)
  const [viewDiff, setViewDiff] = useState<string | null>(null)
  const [selected, setSelected] = useState<ConfigRevisionPublic | null>(null)
  const [preview, setPreview] = useState<RollbackPreviewPublic | null>(null)

  const { data: revisions, isLoading } = useQuery({
    queryKey: ["revisions", item.id],
    queryFn: () => RevisionsService.readRevisions({ id: item.id, limit: 100 }),
    enabled: isOpen,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["revisions", item.id] })

  const onApiError = (err: ApiError) => {
    const errDetail = (err.body as any)?.detail
    showToast("Request failed.", `${errDetail}`, "error")
  }

  const snapshotMutation = useMutation({
    mutationFn: () => RevisionsService.createRevision({ id: item.id }),
    onSuccess: (res) => {
      if (res) {
        showToast("Snapshot saved", `Revision #${res.id} created.`, "success")
      } else {
        showToast(
          "No change",
          "Config unchanged since last revision.",
          "success",
        )
      }
      invalidate()
    },
    onError: onApiError,
  })

  const viewMutation = useMutation({
    mutationFn: (rev: ConfigRevisionPublic) =>
      RevisionsService.readRevision({ id: item.id, revId: rev.id }),
    onSuccess: (res) => {
      setViewDiff(null)
      setPreview(null)
      setViewConfig(res.config)
    },
    onError: onApiError,
  })

  const diffMutation = useMutation({
    mutationFn: ({
      rev,
      against,
    }: { rev: ConfigRevisionPublic; against: string }) =>
      RevisionsService.readRevisionDiff({
        id: item.id,
        revId: rev.id,
        against,
      }),
    onSuccess: (res) => {
      setViewConfig(null)
      setPreview(null)
      setViewDiff(res.diff)
    },
    onError: onApiError,
  })

  const previewMutation = useMutation({
    mutationFn: (rev: ConfigRevisionPublic) =>
      RevisionsService.rollbackPreview({ id: item.id, revId: rev.id }),
    onSuccess: (res, rev) => {
      setViewConfig(null)
      setViewDiff(null)
      setSelected(rev)
      setPreview(res)
    },
    onError: onApiError,
  })

  const rollbackMutation = useMutation({
    mutationFn: () =>
      RevisionsService.rollback({
        id: item.id,
        revId: selected!.id,
        requestBody: {
          confirm: true,
          expected_diff_sha256: preview!.diff_sha256,
        },
      }),
    onSuccess: (res) => {
      setPreview(null)
      setSelected(null)
      showToast(
        "Rollback applied",
        res.message || `Rolled back ${item.hostname}.`,
        "success",
      )
      invalidate()
    },
    onError: (err: ApiError) => {
      if (err.status === 409) {
        setPreview(null)
        showToast(
          "Device changed since preview",
          "Config drifted — run the preview again.",
          "error",
        )
      } else {
        onApiError(err)
      }
    },
  })

  const onModalClose = () => {
    setViewConfig(null)
    setViewDiff(null)
    setPreview(null)
    setSelected(null)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onModalClose}
      size={{ base: "full", md: "3xl", lg: "5xl" }}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Config History — {item.hostname}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Flex justify="flex-end">
              <Button
                size="sm"
                leftIcon={<Icon as={FiCamera} />}
                colorScheme="blue"
                variant="outline"
                isLoading={snapshotMutation.isPending}
                loadingText="Snapshotting…"
                onClick={() => snapshotMutation.mutate()}
              >
                Snapshot Now
              </Button>
            </Flex>

            {isLoading ? (
              <Flex justify="center" py={8}>
                <Spinner />
              </Flex>
            ) : (
              <TableContainer>
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>#</Th>
                      <Th>Action</Th>
                      <Th>User</Th>
                      <Th>Date</Th>
                      <Th>Commit</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {(revisions?.data ?? []).map((rev) => (
                      <Tr key={rev.id}>
                        <Td>{rev.id}</Td>
                        <Td>
                          <Badge
                            colorScheme={ACTION_COLORS[rev.action] ?? "gray"}
                            variant="subtle"
                          >
                            {rev.action}
                          </Badge>
                        </Td>
                        <Td fontSize="xs">{rev.username}</Td>
                        <Td fontSize="xs">
                          {new Date(rev.created_at).toLocaleString()}
                        </Td>
                        <Td>
                          <Code fontSize="xs">
                            {rev.commit_hash.slice(0, 8)}
                          </Code>
                        </Td>
                        <Td>
                          <HStack spacing={1}>
                            <Tooltip label="View config">
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => viewMutation.mutate(rev)}
                              >
                                <Icon as={FiEye} />
                              </Button>
                            </Tooltip>
                            <Tooltip label="Diff vs previous">
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() =>
                                  diffMutation.mutate({
                                    rev,
                                    against: "previous",
                                  })
                                }
                              >
                                <Icon as={FiGitCommit} />
                              </Button>
                            </Tooltip>
                            <Tooltip label="Rollback to this revision">
                              <Button
                                size="xs"
                                variant="ghost"
                                colorScheme="red"
                                isLoading={
                                  previewMutation.isPending &&
                                  selected?.id === rev.id
                                }
                                onClick={() => previewMutation.mutate(rev)}
                              >
                                <Icon as={FiRotateCcw} />
                              </Button>
                            </Tooltip>
                          </HStack>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            )}

            {!isLoading && (revisions?.data ?? []).length === 0 && (
              <Alert status="info" borderRadius="md" fontSize="sm">
                <AlertIcon />
                No revisions yet. Take a snapshot or push a config change.
              </Alert>
            )}

            {viewConfig !== null && (
              <VStack align="stretch" spacing={2}>
                <Text fontSize="sm" fontWeight="semibold">
                  Stored Config
                </Text>
                <Code
                  display="block"
                  whiteSpace="pre"
                  overflowX="auto"
                  overflowY="auto"
                  p={4}
                  fontSize="xs"
                  maxH="400px"
                  fontFamily="mono"
                >
                  {viewConfig}
                </Code>
              </VStack>
            )}

            {viewDiff !== null && (
              <VStack align="stretch" spacing={2}>
                <Text fontSize="sm" fontWeight="semibold">
                  Diff vs previous revision
                </Text>
                <DiffBlock diff={viewDiff} />
              </VStack>
            )}

            {preview && selected && (
              <VStack align="stretch" spacing={3}>
                <Alert status="warning" borderRadius="md" fontSize="sm">
                  <AlertIcon />
                  Rolling back {item.hostname} to revision #{selected.id} will
                  replace its running configuration with the changes below.
                </Alert>
                {preview.caveats && (
                  <Alert status="info" borderRadius="md" fontSize="xs">
                    <AlertIcon />
                    {preview.caveats}
                  </Alert>
                )}
                <DiffBlock diff={preview.diff} />
              </VStack>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter gap={3}>
          <Button onClick={onModalClose} variant="ghost">
            Close
          </Button>
          {preview && selected && (
            <Button
              colorScheme="red"
              leftIcon={<Icon as={FiRotateCcw} />}
              isLoading={rollbackMutation.isPending}
              loadingText="Rolling back…"
              onClick={() => rollbackMutation.mutate()}
            >
              Confirm Rollback to #{selected.id}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ConfigRevisions
