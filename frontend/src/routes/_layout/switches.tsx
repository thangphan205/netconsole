import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Container,
  Divider,
  Flex,
  Grid,
  HStack,
  Heading,
  Icon,
  IconButton,
  Skeleton,
  SkeletonText,
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
} from "@chakra-ui/react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Suspense, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import {
  FiActivity,
  FiClock,
  FiCpu,
  FiGlobe,
  FiGrid,
  FiHash,
  FiLayers,
  FiList,
  FiRefreshCw,
  FiServer,
  FiTag,
} from "react-icons/fi"
import { type ApiError, SwitchesService } from "../../client"
import type { SwitchPublic } from "../../client/models"
import ActionsMenu from "../../components/Common/ActionsMenu"
import Navbar from "../../components/Common/Navbar"
import useCustomToast from "../../hooks/useCustomToast"
import { formatTimestamp } from "../../utils"

export const Route = createFileRoute("/_layout/switches")({
  component: Switches,
})

type ViewMode = "card" | "list"

const VIEW_MODE_KEY = "switches_view_mode"

interface ItemsProps {
  search_string: string
}

// ── Shared sub-components ────────────────────────────────────────────────────

function HealthBadge({ status }: { status?: string | null }) {
  if (status === "UP")
    return (
      <Badge
        colorScheme="green"
        variant="solid"
        px={2}
        py={0.5}
        borderRadius="full"
        fontSize="xs"
      >
        ● UP
      </Badge>
    )
  if (status === "AUTH_ERROR")
    return (
      <Badge
        colorScheme="orange"
        variant="solid"
        px={2}
        py={0.5}
        borderRadius="full"
        fontSize="xs"
      >
        ● AUTH ERROR
      </Badge>
    )
  if (status === "DOWN")
    return (
      <Badge
        colorScheme="red"
        variant="solid"
        px={2}
        py={0.5}
        borderRadius="full"
        fontSize="xs"
      >
        ● DOWN
      </Badge>
    )
  return (
    <Badge
      colorScheme="gray"
      variant="outline"
      px={2}
      py={0.5}
      borderRadius="full"
      fontSize="xs"
    >
      ○ Unknown
    </Badge>
  )
}

function PlatformBadge({ platform }: { platform?: string | null }) {
  const colorMap: Record<string, string> = {
    ios: "blue",
    nxos_ssh: "purple",
    eos: "teal",
    junos: "orange",
  }
  const color = platform ? colorMap[platform] ?? "gray" : "gray"
  return (
    <Badge colorScheme={color} variant="subtle" fontSize="xs">
      {platform ?? "—"}
    </Badge>
  )
}

function InfoRow({
  icon,
  label,
  value,
  truncate,
}: {
  icon: React.ElementType
  label: string
  value?: string | null
  truncate?: number
}) {
  const display = value
    ? truncate && value.length > truncate
      ? `${value.slice(0, truncate)}…`
      : value
    : "—"
  return (
    <HStack spacing={2} align="flex-start">
      <Icon as={icon} boxSize={3.5} color="gray.400" mt={0.5} flexShrink={0} />
      <Text fontSize="xs" color="gray.500" minW="60px" flexShrink={0}>
        {label}
      </Text>
      <Tooltip
        label={value ?? ""}
        isDisabled={!value || (truncate ? value.length <= truncate : true)}
      >
        <Text
          fontSize="xs"
          color={!value ? "gray.300" : "gray.700"}
          fontWeight={!value ? "normal" : "medium"}
          wordBreak="break-word"
        >
          {display}
        </Text>
      </Tooltip>
    </HStack>
  )
}

// ── Card View ────────────────────────────────────────────────────────────────

function SwitchCard({
  item,
  onSync,
  isSyncing,
}: { item: SwitchPublic; onSync: (id: number) => void; isSyncing: boolean }) {
  const groups = item.groups
    ? item.groups
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean)
    : []

  return (
    <Box
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="xl"
      p={4}
      shadow="sm"
      _hover={{ shadow: "md", borderColor: "gray.300" }}
      transition="all 0.15s"
      display="flex"
      flexDirection="column"
      gap={3}
    >
      <Flex justify="space-between" align="flex-start">
        <VStack align="flex-start" spacing={1} flex={1} minW={0}>
          <HStack spacing={2} flexWrap="wrap">
            <HealthBadge status={item.health_status} />
            <PlatformBadge platform={item.platform} />
          </HStack>
          <Tooltip label={item.hostname}>
            <Text
              fontWeight="bold"
              fontSize="md"
              color="gray.800"
              noOfLines={1}
            >
              {item.hostname}
            </Text>
          </Tooltip>
          <HStack spacing={1}>
            <Icon as={FiGlobe} boxSize={3} color="gray.400" />
            <Text fontSize="xs" color="gray.500" fontFamily="mono">
              {item.ipaddress}
              {item.port && item.port !== 22 ? `:${item.port}` : ""}
            </Text>
          </HStack>
        </VStack>
        <Box ml={2} flexShrink={0}>
          <ActionsMenu type={"Switch"} value={item} name={item.hostname} />
        </Box>
      </Flex>

      <Divider />

      <VStack align="stretch" spacing={1.5}>
        <InfoRow icon={FiServer} label="Vendor" value={item.vendor} />
        <InfoRow icon={FiCpu} label="Model" value={item.model} truncate={20} />
        <InfoRow
          icon={FiActivity}
          label="Version"
          value={item.os_version}
          truncate={24}
        />
        <InfoRow
          icon={FiHash}
          label="Serial"
          value={item.serial_number}
          truncate={20}
        />
        <InfoRow
          icon={FiTag}
          label="Desc"
          value={item.description}
          truncate={30}
        />
      </VStack>

      {groups.length > 0 && (
        <>
          <Divider />
          <Flex gap={1} flexWrap="wrap" align="center">
            <Icon as={FiLayers} boxSize={3} color="gray.400" mr={1} />
            {groups.map((g) => (
              <Tag
                key={g}
                size="sm"
                colorScheme="gray"
                variant="outline"
                borderRadius="full"
                fontSize="xs"
              >
                {g}
              </Tag>
            ))}
          </Flex>
        </>
      )}

      <Divider />

      <Flex justify="space-between" align="center">
        <HStack spacing={1} color="gray.400">
          <Icon as={FiClock} boxSize={3} />
          <Text fontSize="xs">Synced {formatTimestamp(item.updated_at)}</Text>
        </HStack>
        <Button
          size="xs"
          colorScheme="blue"
          variant="outline"
          leftIcon={<Icon as={FiRefreshCw} boxSize={3} />}
          isLoading={isSyncing}
          onClick={() => onSync(item.id)}
        >
          Sync
        </Button>
      </Flex>
    </Box>
  )
}

// ── List View ────────────────────────────────────────────────────────────────

function SwitchRow({
  item,
  onSync,
  isSyncing,
}: { item: SwitchPublic; onSync: (id: number) => void; isSyncing: boolean }) {
  const groups = item.groups
    ? item.groups
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean)
    : []

  return (
    <Tr _hover={{ bg: "gray.50" }}>
      <Td>
        <HealthBadge status={item.health_status} />
      </Td>
      <Td>
        <VStack align="flex-start" spacing={0}>
          <Text fontWeight="semibold" fontSize="sm">
            {item.hostname}
          </Text>
          <Text fontSize="xs" color="gray.500" fontFamily="mono">
            {item.ipaddress}
            {item.port && item.port !== 22 ? `:${item.port}` : ""}
          </Text>
        </VStack>
      </Td>
      <Td>
        <PlatformBadge platform={item.platform} />
      </Td>
      <Td>
        <VStack align="flex-start" spacing={0}>
          <Tooltip label={item.vendor ?? ""} isDisabled={!item.vendor}>
            <Text fontSize="xs" fontWeight="medium">
              {item.model ?? "—"}
            </Text>
          </Tooltip>
          <Text fontSize="xs" color="gray.500">
            {item.vendor ?? ""}
          </Text>
        </VStack>
      </Td>
      <Td>
        <Tooltip
          label={item.os_version ?? ""}
          isDisabled={!item.os_version || item.os_version.length <= 18}
        >
          <Text fontSize="xs">
            {item.os_version
              ? item.os_version.slice(0, 18) +
                (item.os_version.length > 18 ? "…" : "")
              : "—"}
          </Text>
        </Tooltip>
      </Td>
      <Td>
        <Tooltip
          label={item.serial_number ?? ""}
          isDisabled={!item.serial_number}
        >
          <Text fontSize="xs" fontFamily="mono" color="gray.600">
            {item.serial_number
              ? item.serial_number.slice(0, 14) +
                (item.serial_number.length > 14 ? "…" : "")
              : "—"}
          </Text>
        </Tooltip>
      </Td>
      <Td>
        <Flex gap={1} flexWrap="wrap">
          {groups.length > 0 ? (
            groups.map((g) => (
              <Tag
                key={g}
                size="sm"
                colorScheme="gray"
                variant="outline"
                borderRadius="full"
                fontSize="xs"
              >
                {g}
              </Tag>
            ))
          ) : (
            <Text fontSize="xs" color="gray.300">
              —
            </Text>
          )}
        </Flex>
      </Td>
      <Td>
        <Tooltip label={item.description ?? ""} isDisabled={!item.description}>
          <Text
            fontSize="xs"
            color={!item.description ? "gray.300" : "gray.700"}
          >
            {item.description
              ? item.description.slice(0, 25) +
                (item.description.length > 25 ? "…" : "")
              : "—"}
          </Text>
        </Tooltip>
      </Td>
      <Td>
        <Text fontSize="xs" color="gray.500">
          {formatTimestamp(item.updated_at)}
        </Text>
      </Td>
      <Td>
        <HStack spacing={1}>
          <Button
            size="xs"
            colorScheme="blue"
            variant="outline"
            leftIcon={<Icon as={FiRefreshCw} boxSize={3} />}
            isLoading={isSyncing}
            onClick={() => onSync(item.id)}
          >
            Sync
          </Button>
          <ActionsMenu type={"Switch"} value={item} name={item.hostname} />
        </HStack>
      </Td>
    </Tr>
  )
}

// ── Data containers (Suspense boundaries) ───────────────────────────────────

function SwitchesData({
  search_string,
  viewMode,
}: ItemsProps & { viewMode: ViewMode }) {
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [is_refresh, set_is_refresh] = useState(false)

  const { data: switches } = useSuspenseQuery({
    queryKey: ["switches", search_string, is_refresh],
    queryFn: () => SwitchesService.readSwitches({ search: search_string }),
  })

  const showToast = useCustomToast()

  const mutation = useMutation({
    mutationFn: (switch_id: number) =>
      SwitchesService.updateSwitchMetadata({ id: switch_id }),
    onSuccess: () => {
      showToast("Success!", "Metadata synced.", "success")
      set_is_refresh(!is_refresh)
    },
    onError: (err: ApiError) => {
      const errDetail = (err.body as any)?.detail
      showToast("Sync failed.", `${errDetail}`, "error")
    },
    onSettled: () => setUpdatingId(null),
  })

  const onSync = (switch_id: number) => {
    setUpdatingId(switch_id)
    mutation.mutate(switch_id)
  }

  if (switches.data.length === 0) {
    return (
      <Box textAlign="center" py={16} color="gray.400">
        <Text fontSize="lg">No switches found</Text>
      </Box>
    )
  }

  if (viewMode === "card") {
    return (
      <Grid
        templateColumns={{
          base: "1fr",
          md: "repeat(2, 1fr)",
          xl: "repeat(3, 1fr)",
        }}
        gap={4}
      >
        {switches.data.map((item) => (
          <SwitchCard
            key={item.id}
            item={item}
            onSync={onSync}
            isSyncing={updatingId === item.id && mutation.isPending}
          />
        ))}
      </Grid>
    )
  }

  return (
    <TableContainer>
      <Table size="sm">
        <Thead>
          <Tr>
            <Th>Status</Th>
            <Th>Host / IP</Th>
            <Th>Platform</Th>
            <Th>Model / Vendor</Th>
            <Th>Version</Th>
            <Th>Serial</Th>
            <Th>Groups</Th>
            <Th>Description</Th>
            <Th>Last Sync</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {switches.data.map((item) => (
            <SwitchRow
              key={item.id}
              item={item}
              onSync={onSync}
              isSyncing={updatingId === item.id && mutation.isPending}
            />
          ))}
        </Tbody>
      </Table>
    </TableContainer>
  )
}

function SkeletonCards() {
  return (
    <Grid
      templateColumns={{
        base: "1fr",
        md: "repeat(2, 1fr)",
        xl: "repeat(3, 1fr)",
      }}
      gap={4}
    >
      {new Array(4).fill(null).map((_, i) => (
        <Box
          key={i}
          bg="white"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="xl"
          p={4}
          shadow="sm"
        >
          <Skeleton height="20px" mb={2} />
          <Skeleton height="16px" width="60%" mb={4} />
          <SkeletonText noOfLines={5} spacing={2} mb={4} />
          <Skeleton height="24px" />
        </Box>
      ))}
    </Grid>
  )
}

function SkeletonRows() {
  return (
    <TableContainer>
      <Table size="sm">
        <Thead>
          <Tr>
            {[
              "Status",
              "Host / IP",
              "Platform",
              "Model / Vendor",
              "Version",
              "Serial",
              "Groups",
              "Description",
              "Last Sync",
              "Actions",
            ].map((h) => (
              <Th key={h}>{h}</Th>
            ))}
          </Tr>
        </Thead>
        <Tbody>
          {new Array(5).fill(null).map((_, i) => (
            <Tr key={i}>
              {new Array(10).fill(null).map((_, j) => (
                <Td key={j}>
                  <Skeleton height="16px" />
                </Td>
              ))}
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableContainer>
  )
}

// ── Top-level content ────────────────────────────────────────────────────────

function SwitchesContent({ search_string }: ItemsProps) {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY)
    return saved === "list" ? "list" : "card"
  })

  const switchView = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem(VIEW_MODE_KEY, mode)
  }

  const healthMutation = useMutation({
    mutationFn: () => SwitchesService.healthCheckAll(),
    onSuccess: () => {
      showToast("Done", "Health check complete.", "success")
      queryClient.invalidateQueries({ queryKey: ["switches"] })
    },
    onError: (err: ApiError) => {
      const errDetail = (err.body as any)?.detail
      showToast("Health check failed.", `${errDetail}`, "error")
    },
  })

  return (
    <>
      <Flex justify="space-between" align="center" mb={4}>
        <ButtonGroup size="sm" isAttached variant="outline">
          <IconButton
            aria-label="Card view"
            icon={<Icon as={FiGrid} />}
            onClick={() => switchView("card")}
            colorScheme={viewMode === "card" ? "teal" : "gray"}
            variant={viewMode === "card" ? "solid" : "outline"}
          />
          <IconButton
            aria-label="List view"
            icon={<Icon as={FiList} />}
            onClick={() => switchView("list")}
            colorScheme={viewMode === "list" ? "teal" : "gray"}
            variant={viewMode === "list" ? "solid" : "outline"}
          />
        </ButtonGroup>

        <Button
          colorScheme="teal"
          size="sm"
          leftIcon={<Icon as={FiActivity} />}
          isLoading={healthMutation.isPending}
          loadingText="Checking…"
          onClick={() => healthMutation.mutate()}
        >
          Check Health
        </Button>
      </Flex>

      <ErrorBoundary
        fallbackRender={({ error }) => (
          <Box p={4} color="red.500">
            Something went wrong: {error.message}
          </Box>
        )}
      >
        <Suspense
          fallback={viewMode === "card" ? <SkeletonCards /> : <SkeletonRows />}
        >
          <SwitchesData search_string={search_string} viewMode={viewMode} />
        </Suspense>
      </ErrorBoundary>
    </>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

function Switches() {
  const [searchResults, setSearchResults] = useState("")
  return (
    <Container maxW="full">
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        Switches Management
      </Heading>
      <Navbar type={"Switch"} onSearch={setSearchResults} />
      <SwitchesContent search_string={searchResults} />
    </Container>
  )
}
