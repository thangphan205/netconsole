import {
  Badge,
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Icon,
  Input,
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
} from "@chakra-ui/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { type ChangeEvent, Suspense, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { FaSearch } from "react-icons/fa"
import { type LogPublic, LogsService } from "../../client"

export const Route = createFileRoute("/_layout/logs")({
  component: Logs,
})

const SEVERITY_COLOR: Record<string, string> = {
  INFO: "blue",
  WARNING: "yellow",
  ERROR: "red",
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

function LogsTableBody({ search, severity, fromDate, toDate, skip, pageSize, setSkip }: LogsTableBodyProps) {
  const { data: logs } = useSuspenseQuery({
    queryKey: ["logs", search, severity, fromDate, toDate, skip, pageSize],
    queryFn: () => LogsService.readLogs(buildApiParams({ search, severity, fromDate, toDate, skip, pageSize })),
  })

  const totalPages = Math.ceil(logs.count / pageSize)
  const currentPage = Math.floor(skip / pageSize) + 1
  const isLastPage = skip + pageSize >= logs.count

  return (
    <>
      <Tbody>
        {logs.data.length === 0 ? (
          <Tr>
            <Td colSpan={6} textAlign="center" color="gray.400" py={8}>
              No log entries found
            </Td>
          </Tr>
        ) : (
          logs.data.map((item: LogPublic) => (
            <Tr key={item.id}>
              <Td whiteSpace="nowrap">{item.timestamp}</Td>
              <Td>
                <Badge colorScheme={SEVERITY_COLOR[item.severity] ?? "gray"}>
                  {item.severity}
                </Badge>
              </Td>
              <Td>{item.action}</Td>
              <Td>{item.username}</Td>
              <Td>{item.client_ip}</Td>
              <Td maxW="400px" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                {item.message}
              </Td>
            </Tr>
          ))
        )}
      </Tbody>
      <tfoot>
        <tr>
          <td colSpan={6}>
            <Flex justify="space-between" align="center" px={2} py={3}>
              <Text fontSize="sm" color="gray.500">
                {logs.count === 0
                  ? "No entries"
                  : `Showing ${skip + 1}–${Math.min(skip + pageSize, logs.count)} of ${logs.count}`}
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
  const [pageSize, setPageSize] = useState(100)

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
          <Text fontSize="sm" color="gray.500" whiteSpace="nowrap">From</Text>
          <Input
            type="date"
            size="sm"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => { setFromDate(e.target.value); resetSkip() }}
            w="150px"
          />
        </Flex>
        <Flex align="center" gap={1}>
          <Text fontSize="sm" color="gray.500" whiteSpace="nowrap">To</Text>
          <Input
            type="date"
            size="sm"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => { setToDate(e.target.value); resetSkip() }}
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
          <Text fontSize="sm" color="gray.500" whiteSpace="nowrap">Per page</Text>
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
              <option key={n} value={n}>{n}</option>
            ))}
          </Select>
        </Flex>
      </Flex>

      <TableContainer>
        <Table size={{ base: "sm", md: "md" }}>
          <Thead>
            <Tr>
              <Th>DateTime</Th>
              <Th>Severity</Th>
              <Th>Action</Th>
              <Th>Username</Th>
              <Th>Client IP</Th>
              <Th>Message</Th>
            </Tr>
          </Thead>
          <ErrorBoundary
            fallbackRender={({ error }: { error: Error }) => (
              <Tbody>
                <Tr>
                  <Td colSpan={6}>Something went wrong: {error.message}</Td>
                </Tr>
              </Tbody>
            )}
          >
            <Suspense
              fallback={
                <Tbody>
                  {new Array(5).fill(null).map((_, i) => (
                    <Tr key={i}>
                      {new Array(6).fill(null).map((_, j) => (
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
    <Container maxW="full">
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        Audit Logs
      </Heading>
      <Box mt={6}>
        <LogsTable />
      </Box>
    </Container>
  )
}
