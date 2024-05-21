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
import { SwitchesService } from "../../client"
import ActionsMenu from "../../components/Common/ActionsMenu"
import Navbar from "../../components/Common/Navbar"

export const Route = createFileRoute("/_layout/switches")({
  component: Switches,
})

function SwitchesTableBody() {
  const { data: switches } = useSuspenseQuery({
    queryKey: ["switches"],
    queryFn: () => SwitchesService.readSwitches({}),
  })

  return (
    <Tbody>
      {switches.data.map((item) => (
        <Tr key={item.id}>
          <Td>{item.id}</Td>
          <Td>{item.hostname}</Td>
          <Td>{item.ipaddress}</Td>
          <Td>{item.platform}</Td>
          <Td>{item.os_version}</Td>
          <Td color={!item.description ? "ui.dim" : "inherit"}>
            {item.description || "N/A"}
          </Td>
          <Td>
            <ActionsMenu type={"Switch"} value={item} />
          </Td>
        </Tr>
      ))}
    </Tbody>
  )
}
function SwitchesTable() {
  return (
    <TableContainer>
      <Table size={{ base: "sm", md: "md" }}>
        <Thead>
          <Tr>
            <Th>ID</Th>
            <Th>Hostname</Th>
            <Th>IP Address</Th>
            <Th>Platform</Th>
            <Th>Version</Th>
            <Th>Description</Th>
            <Th>Actions</Th>
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
            <SwitchesTableBody />
          </Suspense>
        </ErrorBoundary>
      </Table>
    </TableContainer>
  )
}

function Switches() {
  return (
    <Container maxW="full">
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        Switches Management
      </Heading>

      <Navbar type={"Switch"} />
      <SwitchesTable />
    </Container>
  )
}
