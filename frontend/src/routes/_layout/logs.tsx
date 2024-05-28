import {
  Container,
  Flex,
  Heading,
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

import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { LogsService } from "../../client"
import Navbar from "../../components/Common/Navbar"

export const Route = createFileRoute("/_layout/logs")({
  component: Logs,
})

function LogsTableBody() {
  const { data: logs } = useSuspenseQuery({
    queryKey: ["logs"],
    queryFn: () => LogsService.readLogs(),
  })

  return (
    <Tbody>
      {logs.data.map((item) => (
        <Tr key={item.id}>
          <Td>{item.id}</Td>
          <Td>{item.datetime}</Td>
          <Td>{item.severity}</Td>
          <Td>{item.username}</Td>
          <Td>{item.client_ip}</Td>
          <Td>{item.message}</Td>
        </Tr>
      ))}
    </Tbody>
  )
}
function LogsTable() {
  return (
    <TableContainer>
      <Table size={{ base: "sm", md: "md" }}>
        <Thead>
          <Tr>
            <Th>ID</Th>
            <Th>Severity</Th>
            <Th>DateTime</Th>
            <Th>Username</Th>
            <Th>Client IP</Th>
            <Th>Message</Th>
          </Tr>
        </Thead>
        <ErrorBoundary
          fallbackRender={({ error }) => (
            <Tbody>
              <Tr>
                <Td colSpan={4}>Something went wrong: {error.message}</Td>
              </Tr>
            </Tbody>
          )}
        >
          <Suspense
            fallback={
              <Tbody>
                {new Array(5).fill(null).map((_, index) => (
                  <Tr key={index}>
                    {new Array(4).fill(null).map((_, index) => (
                      <Td key={index}>
                        <Flex>
                          <Skeleton height="20px" width="20px" />
                        </Flex>
                      </Td>
                    ))}
                  </Tr>
                ))}
              </Tbody>
            }
          >
            <LogsTableBody />
          </Suspense>
        </ErrorBoundary>
      </Table>
    </TableContainer>
  )
}

function Logs() {
  return (
    <Container maxW="full">
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        Logs Management
      </Heading>

      <Navbar type={"Log"} />
      <LogsTable />
    </Container>
  )
}
