import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Code,
  Container,
  Flex,
  HStack,
  Heading,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Skeleton,
  Spinner,
  Table,
  TableContainer,
  Tag,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  VStack,
  useDisclosure,
} from "@chakra-ui/react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  type GroupBase,
  type OptionBase,
  Select,
  type SingleValue,
} from "chakra-react-select"
import { Suspense, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { FaRegTimesCircle, FaSearch } from "react-icons/fa"
import { FiRefreshCw, FiTerminal } from "react-icons/fi"

import { type ApiError, InterfacesService, SwitchesService } from "../../client"
import type { InterfacePublic } from "../../client/models"
import ActionsMenu from "../../components/Common/ActionsMenuInterface"
import useCustomToast from "../../hooks/useCustomToast"

export const Route = createFileRoute("/_layout/interfaces")({
  component: Interfaces,
})

interface SwitchOption extends OptionBase {
  label: string
  value: string
}

// ── Badges ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string | null }) {
  if (!status)
    return (
      <Text color="gray.300" fontSize="xs">
        —
      </Text>
    )
  const s = status.toLowerCase()
  if (s === "connected" || s === "up")
    return (
      <Badge colorScheme="green" variant="subtle" borderRadius="full">
        {status}
      </Badge>
    )
  if (s === "notconnect" || s === "notconnected" || s === "down")
    return (
      <Badge colorScheme="orange" variant="subtle" borderRadius="full">
        {status}
      </Badge>
    )
  if (s === "disabled" || s === "err-disabled")
    return (
      <Badge colorScheme="red" variant="subtle" borderRadius="full">
        {status}
      </Badge>
    )
  return (
    <Badge colorScheme="gray" variant="subtle" borderRadius="full">
      {status}
    </Badge>
  )
}

function ModeBadge({ mode }: { mode?: string | null }) {
  if (!mode)
    return (
      <Text color="gray.300" fontSize="xs">
        —
      </Text>
    )
  const m = mode.toLowerCase()
  if (m === "access")
    return (
      <Badge colorScheme="blue" variant="subtle" borderRadius="full">
        access
      </Badge>
    )
  if (m === "trunk")
    return (
      <Badge colorScheme="purple" variant="subtle" borderRadius="full">
        trunk
      </Badge>
    )
  if (m === "routed")
    return (
      <Badge colorScheme="teal" variant="subtle" borderRadius="full">
        routed
      </Badge>
    )
  return (
    <Badge colorScheme="gray" variant="subtle" borderRadius="full">
      {mode}
    </Badge>
  )
}

// ── Run-config modal ─────────────────────────────────────────────────────────

function RunConfigModal({
  isOpen,
  onClose,
  isLoading,
  runConfig,
  selectedInterface,
}: {
  isOpen: boolean
  onClose: () => void
  isLoading: boolean
  runConfig: string
  selectedInterface: InterfacePublic | null
}) {
  const handleCopy = () => navigator.clipboard.writeText(runConfig)

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {isLoading ? (
            <HStack spacing={2}>
              <Spinner size="sm" />
              <Text>Loading…</Text>
            </HStack>
          ) : (
            <VStack align="start" spacing={1}>
              <Text fontSize="lg" fontWeight="bold">
                {selectedInterface?.port}
              </Text>
              {selectedInterface?.description && (
                <Text fontSize="sm" color="gray.500" fontWeight="normal">
                  {selectedInterface.description}
                </Text>
              )}
            </VStack>
          )}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {isLoading ? (
            <Box textAlign="center" py={8}>
              <Spinner size="lg" />
            </Box>
          ) : (
            <VStack align="stretch" spacing={4}>
              <HStack spacing={2} flexWrap="wrap">
                <StatusBadge status={selectedInterface?.status} />
                <ModeBadge mode={selectedInterface?.mode} />
                {selectedInterface?.vlan && (
                  <Tag colorScheme="blue" size="sm">
                    VLAN {selectedInterface.vlan}
                  </Tag>
                )}
                {selectedInterface?.speed && (
                  <Tag variant="outline" size="sm">
                    {selectedInterface.speed}
                  </Tag>
                )}
              </HStack>
              {runConfig.startsWith("%") ||
              runConfig === "Error fetching running config." ? (
                <Alert status="error" borderRadius="md">
                  <AlertIcon />
                  <Text fontSize="sm" whiteSpace="pre-wrap">
                    {runConfig === "Error fetching running config."
                      ? "Failed to fetch running config from device."
                      : runConfig}
                  </Text>
                </Alert>
              ) : (
                <Box
                  maxH="420px"
                  overflowY="auto"
                  borderRadius="md"
                  border="1px solid"
                  borderColor="gray.200"
                >
                  <Code
                    display="block"
                    whiteSpace="pre"
                    p={4}
                    fontSize="sm"
                    bg="gray.50"
                    w="full"
                  >
                    {runConfig || "(empty)"}
                  </Code>
                </Box>
              )}
            </VStack>
          )}
        </ModalBody>
        <ModalFooter gap={3}>
          <Tooltip label="Copy to clipboard">
            <Button
              onClick={handleCopy}
              isDisabled={isLoading || !runConfig}
              variant="outline"
            >
              Copy
            </Button>
          </Tooltip>
          <Button colorScheme="blue" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

// ── Table body ───────────────────────────────────────────────────────────────

function InterfacesTableBody({
  switch_id,
  search_string,
  sync_tick,
  onShowRunConfig,
  loadingId,
}: {
  switch_id: number
  search_string: string
  sync_tick: number
  onShowRunConfig: (item: InterfacePublic) => void
  loadingId: number | null
}) {
  const { data: interfaces } = useSuspenseQuery({
    queryKey: ["interfaces", switch_id, search_string, sync_tick],
    queryFn: async () =>
      await InterfacesService.readInterfaces({
        switchId: switch_id,
        search: search_string,
      }),
  })

  if (switch_id === 0) {
    return (
      <Tbody>
        <Tr>
          <Td colSpan={7}>
            <Box py={10} textAlign="center" color="gray.400">
              <Icon as={FiTerminal} boxSize={8} mb={2} />
              <Text fontSize="sm">Select a switch to view interfaces</Text>
            </Box>
          </Td>
        </Tr>
      </Tbody>
    )
  }

  if (interfaces.data.length === 0) {
    return (
      <Tbody>
        <Tr>
          <Td colSpan={7}>
            <Box py={10} textAlign="center" color="gray.400">
              <Text fontSize="sm">
                No interfaces match{search_string ? ` "${search_string}"` : ""}
              </Text>
            </Box>
          </Td>
        </Tr>
      </Tbody>
    )
  }

  return (
    <Tbody>
      {interfaces.data.map((item) => (
        <Tr key={item.id} _hover={{ bg: "gray.50" }}>
          <Td>
            <Text fontWeight="medium" fontSize="sm">
              {item.port}
            </Text>
          </Td>
          <Td>
            <Text
              fontSize="sm"
              color={!item.description ? "gray.300" : "gray.700"}
            >
              {item.description || "—"}
            </Text>
          </Td>
          <Td>
            <StatusBadge status={item.status} />
          </Td>
          <Td>
            <ModeBadge mode={item.mode} />
          </Td>
          <Td>
            {item.mode === "trunk" ? (
              <VStack align="flex-start" spacing={0}>
                {item.native_vlan && (
                  <Text fontSize="xs" color="gray.500">
                    Native: {item.native_vlan}
                  </Text>
                )}
                {item.allowed_vlan ? (
                  <Text
                    fontSize="xs"
                    color="gray.700"
                    maxW="140px"
                    isTruncated
                    title={item.allowed_vlan}
                  >
                    {item.allowed_vlan}
                  </Text>
                ) : (
                  <Text fontSize="xs" color="gray.300">
                    —
                  </Text>
                )}
              </VStack>
            ) : item.mode === "access" ? (
              <Text fontSize="sm">{item.vlan || "—"}</Text>
            ) : (
              <Text fontSize="sm" color="gray.300">
                —
              </Text>
            )}
          </Td>
          <Td>
            <VStack align="flex-start" spacing={0}>
              <Text fontSize="sm">{item.speed || "—"}</Text>
              {item.duplex && item.duplex !== "n/a" && (
                <Text fontSize="xs" color="gray.400">
                  {item.duplex}
                </Text>
              )}
            </VStack>
          </Td>
          <Td>
            <HStack spacing={1}>
              <Tooltip label="Show running config">
                <IconButton
                  aria-label="Show running config"
                  icon={<Icon as={FiTerminal} />}
                  size="sm"
                  variant="ghost"
                  colorScheme="blue"
                  isLoading={loadingId === item.id}
                  onClick={() => onShowRunConfig(item)}
                />
              </Tooltip>
              <ActionsMenu type={"Interface"} value={item} name={item.port} />
            </HStack>
          </Td>
        </Tr>
      ))}
    </Tbody>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

function InterfacesContent() {
  const [switch_id, set_switch_id] = useState<number>(0)
  const [search_character, set_search_character] = useState("")
  const [search_string, set_search_string] = useState("")
  const [sync_tick, set_sync_tick] = useState(0)
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [runConfig, setRunConfig] = useState("")
  const [selectedInterface, setSelectedInterface] =
    useState<InterfacePublic | null>(null)
  const [modalLoading, setModalLoading] = useState(false)

  const { isOpen, onOpen, onClose } = useDisclosure()
  const showToast = useCustomToast()
  const queryClient = useQueryClient()

  const { data: switches } = useSuspenseQuery({
    queryKey: ["switches"],
    queryFn: async () => await SwitchesService.readSwitches({}),
  })

  const optionSwitches: SwitchOption[] = switches.data.map((item) => ({
    value: String(item.id),
    label: `${item.hostname}  ·  ${item.ipaddress}${
      item.model ? `  ·  ${item.model}` : ""
    }`,
  }))

  const syncMutation = useMutation({
    mutationFn: () => SwitchesService.updateSwitchMetadata({ id: switch_id }),
    onSuccess: () => {
      showToast("Success!", "Interface sync complete.", "success")
      set_sync_tick((t) => t + 1)
    },
    onError: (err: ApiError) => {
      const errDetail = (err.body as any)?.detail
      showToast("Sync failed.", `${errDetail}`, "error")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["switches"] })
    },
  })

  const handleShowRunConfig = async (item: InterfacePublic) => {
    setSelectedInterface(item)
    setRunConfig("")
    setModalLoading(true)
    setLoadingId(item.id)
    onOpen()
    try {
      const result: any = await InterfacesService.readInterfaceRunning({
        id: item.id,
      })
      setRunConfig(result?.data ?? "")
    } catch {
      setRunConfig("Error fetching running config.")
    } finally {
      setModalLoading(false)
      setLoadingId(null)
    }
  }

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") set_search_string(search_character)
  }

  const handleClear = () => {
    set_search_character("")
    set_search_string("")
  }

  return (
    <>
      {/* Toolbar */}
      <Flex gap={3} mb={4} flexWrap="wrap" align="center">
        <Box flex="1" minW="240px" maxW="420px">
          <Select<SwitchOption, false, GroupBase<SwitchOption>>
            name="switch_id"
            options={optionSwitches}
            placeholder="Select switch…"
            isMulti={false}
            onChange={(v: SingleValue<SwitchOption>) =>
              v && set_switch_id(Number(v.value))
            }
            chakraStyles={{ container: (p) => ({ ...p, fontSize: "sm" }) }}
          />
        </Box>

        {switch_id > 0 && (
          <Button
            size="sm"
            colorScheme="teal"
            variant="outline"
            leftIcon={<Icon as={FiRefreshCw} />}
            isLoading={syncMutation.isPending}
            loadingText="Syncing…"
            onClick={() => syncMutation.mutate()}
          >
            Sync Interfaces
          </Button>
        )}

        <Box ml="auto" minW="200px">
          <InputGroup size="sm">
            <InputLeftElement pointerEvents="none">
              <Icon as={FaSearch} color="gray.400" />
            </InputLeftElement>
            <Input
              placeholder="Search…"
              borderRadius="md"
              value={search_character}
              onChange={(e) => set_search_character(e.target.value)}
              onKeyDown={handleSearch}
            />
            {search_character && (
              <InputRightElement>
                <IconButton
                  aria-label="Clear search"
                  icon={<Icon as={FaRegTimesCircle} />}
                  size="xs"
                  variant="ghost"
                  onClick={handleClear}
                />
              </InputRightElement>
            )}
          </InputGroup>
        </Box>
      </Flex>

      {/* Table */}
      <TableContainer>
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Interface</Th>
              <Th>Description</Th>
              <Th>Status</Th>
              <Th>Mode</Th>
              <Th>VLAN / Allowed</Th>
              <Th>Speed / Duplex</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <ErrorBoundary
            fallbackRender={({ error }) => (
              <Tbody>
                <Tr>
                  <Td colSpan={7} color="red.500">
                    Something went wrong: {error.message}
                  </Td>
                </Tr>
              </Tbody>
            )}
          >
            <Suspense
              fallback={
                <Tbody>
                  {new Array(5).fill(null).map((_, i) => (
                    <Tr key={i}>
                      {new Array(7).fill(null).map((_, j) => (
                        <Td key={j}>
                          <Skeleton height="16px" />
                        </Td>
                      ))}
                    </Tr>
                  ))}
                </Tbody>
              }
            >
              <InterfacesTableBody
                switch_id={switch_id}
                search_string={search_string}
                sync_tick={sync_tick}
                onShowRunConfig={handleShowRunConfig}
                loadingId={loadingId}
              />
            </Suspense>
          </ErrorBoundary>
        </Table>
      </TableContainer>

      {/* Modal — outside table DOM */}
      <RunConfigModal
        isOpen={isOpen}
        onClose={onClose}
        isLoading={modalLoading}
        runConfig={runConfig}
        selectedInterface={selectedInterface}
      />
    </>
  )
}

function Interfaces() {
  return (
    <Container maxW="full">
      <Heading
        size="lg"
        textAlign={{ base: "center", md: "left" }}
        pt={12}
        mb={6}
      >
        Interfaces Management
      </Heading>
      <ErrorBoundary
        fallbackRender={({ error }) => (
          <Box color="red.500">Error: {error.message}</Box>
        )}
      >
        <Suspense
          fallback={
            <Box py={4}>
              <Skeleton height="40px" mb={4} />
              <Skeleton height="300px" />
            </Box>
          }
        >
          <InterfacesContent />
        </Suspense>
      </ErrorBoundary>
    </Container>
  )
}
