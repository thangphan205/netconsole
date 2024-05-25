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
import { InterfacesService } from "../../client"
import ActionsMenu from "../../components/Common/ActionsMenu"
import Navbar from "../../components/Common/Navbar"

export const Route = createFileRoute("/_layout/interfaces")({
  component: Interfaces,
})

function InterfacesTableBody() {
  const { data: interfaces } = useSuspenseQuery({
    queryKey: ["interfaces"],
    queryFn: () => InterfacesService.readInterfaces({}),
  })

  return (
    <Tbody>
      {interfaces.data.map((item) => (
        <Tr key={item.id}>
          <Td>{item.id}</Td>
          <Td>{item.port}</Td>
          <Td>{item.description}</Td>
          <Td>{item.status}</Td>
          <Td>{item.vlan}</Td>
          <Td>{item.mode}</Td>
          <Td>{item.native_vlan}</Td>
          <Td>{item.allowed_vlan}</Td>
          <Td>
            <ActionsMenu type={"Interface"} value={item} />
          </Td>
        </Tr>
      ))}
    </Tbody>
  )
}
function InterfacesTable() {
  return (
    <TableContainer>
      <Table size={{ base: "sm", md: "md" }}>
        <Thead>
          <Tr>
            <Th>ID</Th>
            <Th>Port</Th>
            <Th>Description</Th>
            <Th>Status</Th>
            <Th>Vlan</Th>
            <Th>Mode</Th>
            <Th>Native VLAN</Th>
            <Th>Allowed VLAN</Th>
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
            <InterfacesTableBody />
          </Suspense>
        </ErrorBoundary>
      </Table>
    </TableContainer>
  )
}

function Interfaces() {
  return (
    <Container maxW="full">
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        Interfaces Management
      </Heading>

      <Navbar type={"Interface"} />
      <InterfacesTable />
    </Container>
  )
}
