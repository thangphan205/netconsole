import {
  Badge,
  Button,
  Container,
  Flex,
  Heading,
  Select,
  Skeleton,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { type ChangeEvent, Suspense, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { type LogPublic, LogsService } from "../../client"
import Navbar from "../../components/Common/Navbar"

export const Route = createFileRoute("/_layout/logs")({
  component: Logs,
})

const SEVERITY_COLOR: Record<string, string> = {
  INFO: "blue",
  WARNING: "yellow",
  ERROR: "red",
}

const PAGE_SIZE = 100

interface LogsTableBodyProps {
  search: string
  severity: string
  skip: number
}

function LogsTableBody({ search, severity, skip }: LogsTableBodyProps) {
  const { data: logs } = useSuspenseQuery({
    queryKey: ["logs", search, severity, skip],
    queryFn: () =>
      LogsService.readLogs({
        search,
        severity: severity || undefined,
        skip,
        limit: PAGE_SIZE,
      }),
  })

  return (
    <Tbody>
      {logs.data.map((item: LogPublic) => (
        <Tr key={item.id}>
          <Td>{item.timestamp}</Td>
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
      ))}
    </Tbody>
  )
}

function LogsTable() {
  const [search, setSearch] = useState("")
  const [severity, setSeverity] = useState("")
  const [skip, setSkip] = useState(0)

  const handleSearch = (term: string) => {
    setSearch(term)
    setSkip(0)
  }

  return (
    <>
      <Flex gap={3} mb={4} align="center">
        <Navbar type={"Log"} onSearch={handleSearch} />
        <Select
          placeholder="All severities"
          maxW="180px"
          value={severity}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => { setSeverity(e.target.value); setSkip(0) }}
        >
          <option value="INFO">INFO</option>
          <option value="WARNING">WARNING</option>
          <option value="ERROR">ERROR</option>
        </Select>
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
              <LogsTableBody search={search} severity={severity} skip={skip} />
            </Suspense>
          </ErrorBoundary>
        </Table>
      </TableContainer>
      <Flex gap={3} mt={4} justify="flex-end">
        <Button size="sm" isDisabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}>
          Prev
        </Button>
        <Button size="sm" onClick={() => setSkip(skip + PAGE_SIZE)}>
          Next
        </Button>
      </Flex>
    </>
  )
}

function Logs() {
  return (
    <Container maxW="full">
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        Audit Logs
      </Heading>
      <LogsTable />
    </Container>
  )
}
