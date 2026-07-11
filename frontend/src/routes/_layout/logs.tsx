import {
  Badge,
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Icon,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Select,
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
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { type ChangeEvent, Suspense, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { FaSearch } from "react-icons/fa"
import { type LogPublic, LogsService } from "../../client"
import { formatTimestamp } from "../../utils"

export const Route = createFileRoute("/_layout/logs")({
  component: Logs,
})

const SEVERITY_COLOR: Record<string, string> = {
  INFO: "blue",
  WARNING: "orange",
  ERROR: "red",
}

function actionColor(action: string): string {
  if (action.startsWith("create")) return "green"
  if (action.startsWith("delete")) return "red"
  if (action.startsWith("update") || action.startsWith("edit")) return "blue"
  if (action.startsWith("sync") || action.includes("metadata")) return "purple"
  if (action.startsWith("login") || action.startsWith("logout")) return "teal"
  return "gray"
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]

interface Filters {
  search: string
  severity: string
  fromDate: string
  toDate: string
  skip: number
  pageSize: number
}

interface LogsTableBodyProps extends Filters {
  setSkip: (n: number) => void
}

function buildApiParams(f: Filters) {
  return {
    search: f.search,
    severity: f.severity || undefined,
    skip: f.skip,
    limit: f.pageSize,
    fromDate: f.fromDate ? `${f.fromDate}T00:00:00` : undefined,
    toDate: f.toDate ? `${f.toDate}T23:59:59` : undefined,
  }
}

function LogDetail({
  log,
  isOpen,
  onClose,
}: { log: LogPublic | null; isOpen: boolean; onClose: () => void }) {
  if (!log) return null
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader fontSize="md">
          <Badge colorScheme={actionColor(log.action)} mr={2}>
            {log.action}
          </Badge>
          <Badge colorScheme={SEVERITY_COLOR[log.severity] ?? "gray"}>
            {log.severity}
          </Badge>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <Table size="sm" variant="simple">
            <Tbody>
              <Tr>
                <Td fontWeight="semibold" w="110px" color="gray.500">
                  ID
                </Td>
                <Td>{log.id}</Td>
              </Tr>
              <Tr>
                <Td fontWeight="semibold" color="gray.500">
                  DateTime
                </Td>
                <Td fontFamily="mono" fontSize="xs">
                  {formatTimestamp(log.timestamp)}
                </Td>
              </Tr>
              <Tr>
                <Td fontWeight="semibold" color="gray.500">
                  Username
                </Td>
                <Td>{log.username}</Td>
              </Tr>
              <Tr>
                <Td fontWeight="semibold" color="gray.500">
                  Client IP
                </Td>
                <Td fontFamily="mono">{log.client_ip}</Td>
              </Tr>
              <Tr>
                <Td fontWeight="semibold" color="gray.500" verticalAlign="top">
                  Message
                </Td>
                <Td whiteSpace="pre-wrap" wordBreak="break-all" fontSize="sm">
                  {log.message}
                </Td>
              </Tr>
            </Tbody>
          </Table>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

function LogsTableBody({
  search,
  severity,
  fromDate,
  toDate,
  skip,
  pageSize,
  setSkip,
}: LogsTableBodyProps) {
  const { data: logs } = useSuspenseQuery({
    queryKey: ["logs", search, severity, fromDate, toDate, skip, pageSize],
    queryFn: () =>
      LogsService.readLogs(
        buildApiParams({ search, severity, fromDate, toDate, skip, pageSize }),
      ),
  })

  const [selectedLog, setSelectedLog] = useState<LogPublic | null>(null)
  const { isOpen, onOpen, onClose } = useDisclosure()

  const totalPages = Math.ceil(logs.count / pageSize)
  const currentPage = Math.floor(skip / pageSize) + 1
  const isLastPage = skip + pageSize >= logs.count

  const handleDetail = (item: LogPublic) => {
    setSelectedLog(item)
    onOpen()
  }

  return (
    <>
      <Tbody>
        {logs.data.length === 0 ? (
          <Tr>
            <Td colSpan={7} textAlign="center" color="gray.400" py={8}>
              No log entries found
            </Td>
          </Tr>
        ) : (
          logs.data.map((item: LogPublic) => (
            <Tr
              key={item.id}
              onClick={() => handleDetail(item)}
              cursor="pointer"
              _hover={{ bg: "gray.50" }}
            >
              <Td whiteSpace="nowrap" fontSize="xs" fontFamily="mono">
                {formatTimestamp(item.timestamp)}
              </Td>
              <Td>
                <Badge
                  colorScheme={SEVERITY_COLOR[item.severity] ?? "gray"}
                  variant="subtle"
                >
                  {item.severity}
                </Badge>
              </Td>
              <Td>
                <Badge
                  colorScheme={actionColor(item.action)}
                  variant="outline"
                  fontSize="xs"
                >
                  {item.action}
                </Badge>
              </Td>
              <Td
                fontSize="xs"
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
              >
                {item.username}
              </Td>
              <Td fontSize="xs" fontFamily="mono" whiteSpace="nowrap">
                {item.client_ip}
              </Td>
              <Td
                fontSize="xs"
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
                title={item.message}
              >
                {item.message}
              </Td>
              <Td />
            </Tr>
          ))
        )}
      </Tbody>
      <tfoot>
        <tr>
          <td colSpan={7}>
            <Flex justify="space-between" align="center" px={2} py={3}>
              <Text fontSize="sm" color="gray.500">
                {logs.count === 0
                  ? "No entries"
                  : `Showing ${skip + 1}–${Math.min(
                      skip + pageSize,
                      logs.count,
                    )} of ${logs.count}`}
              </Text>
              <Flex gap={2} align="center">
                <Text fontSize="sm" color="gray.500">
                  Page {currentPage} / {totalPages || 1}
                </Text>
                <Button
                  size="sm"
                  isDisabled={skip === 0}
                  onClick={() => setSkip(Math.max(0, skip - pageSize))}
                >
                  Prev
                </Button>
                <Button
                  size="sm"
                  isDisabled={isLastPage}
                  onClick={() => setSkip(skip + pageSize)}
                >
                  Next
                </Button>
              </Flex>
            </Flex>
          </td>
        </tr>
      </tfoot>
      <LogDetail log={selectedLog} isOpen={isOpen} onClose={onClose} />
    </>
  )
}

function LogsTable() {
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [severity, setSeverity] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [skip, setSkip] = useState(0)
  const [pageSize, setPageSize] = useState(50)

  const resetSkip = () => setSkip(0)

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setSearch(searchInput)
      resetSkip()
    }
  }

  const handleClearDates = () => {
    setFromDate("")
    setToDate("")
    resetSkip()
  }

  return (
    <>
      {/* Filter bar */}
      <Flex gap={3} mb={4} align="center" wrap="wrap">
        {/* Search */}
        <Flex align="center" gap={1} flex={1} minW="200px">
          <Icon as={FaSearch} color="gray.400" />
          <Input
            placeholder="Search username or message…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearch}
            size="sm"
            borderRadius="md"
          />
        </Flex>

        {/* Severity */}
        <Select
          placeholder="All severities"
          size="sm"
          maxW="160px"
          value={severity}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
            setSeverity(e.target.value)
            resetSkip()
          }}
        >
          <option value="INFO">INFO</option>
          <option value="WARNING">WARNING</option>
          <option value="ERROR">ERROR</option>
        </Select>

        {/* Date range */}
        <Flex align="center" gap={1}>
          <Text fontSize="sm" color="gray.500" whiteSpace="nowrap">
            From
          </Text>
          <Input
            type="date"
            size="sm"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => {
              setFromDate(e.target.value)
              resetSkip()
            }}
            w="150px"
          />
        </Flex>
        <Flex align="center" gap={1}>
          <Text fontSize="sm" color="gray.500" whiteSpace="nowrap">
            To
          </Text>
          <Input
            type="date"
            size="sm"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => {
              setToDate(e.target.value)
              resetSkip()
            }}
            w="150px"
          />
        </Flex>
        {(fromDate || toDate) && (
          <Button size="sm" variant="ghost" onClick={handleClearDates}>
            Clear dates
          </Button>
        )}

        {/* Page size */}
        <Flex align="center" gap={1} ml="auto">
          <Text fontSize="sm" color="gray.500" whiteSpace="nowrap">
            Per page
          </Text>
          <Select
            size="sm"
            maxW="90px"
            value={pageSize}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => {
              setPageSize(Number(e.target.value))
              resetSkip()
            }}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Flex>
      </Flex>

      <TableContainer w="100%" overflowX="auto">
        <Table
          size={{ base: "sm", md: "md" }}
          style={{ tableLayout: "fixed", width: "100%" }}
        >
          <colgroup>
            <col style={{ width: "195px" }} />
            <col style={{ width: "90px" }} />
            <col style={{ width: "190px" }} />
            <col style={{ width: "160px" }} />
            <col style={{ width: "115px" }} />
            <col />
            <col style={{ width: "0px" }} />
          </colgroup>
          <Thead>
            <Tr>
              <Th>DateTime</Th>
              <Th>Severity</Th>
              <Th>Action</Th>
              <Th>Username</Th>
              <Th>Client IP</Th>
              <Th>Message</Th>
              <Th />
            </Tr>
          </Thead>
          <ErrorBoundary
            fallbackRender={({ error }: { error: Error }) => (
              <Tbody>
                <Tr>
                  <Td colSpan={7}>Something went wrong: {error.message}</Td>
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
                          <Skeleton height="20px" />
                        </Td>
                      ))}
                    </Tr>
                  ))}
                </Tbody>
              }
            >
              <LogsTableBody
                search={search}
                severity={severity}
                fromDate={fromDate}
                toDate={toDate}
                skip={skip}
                pageSize={pageSize}
                setSkip={setSkip}
              />
            </Suspense>
          </ErrorBoundary>
        </Table>
      </TableContainer>
    </>
  )
}

function Logs() {
  return (
    <Container maxW="full" w="100%" px={4}>
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        Audit Logs
      </Heading>
      <Box mt={6}>
        <LogsTable />
      </Box>
    </Container>
  )
}
