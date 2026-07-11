import {
  Badge,
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

import { Suspense, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { type ApiKeyPublic, ApiKeysService } from "../../client"
import { IntegrationGuide } from "../../components/ApiKeys/IntegrationGuide"
import ActionsMenu from "../../components/Common/ActionsMenu"
import Navbar from "../../components/Common/Navbar"
import { formatTimestamp } from "../../utils"

export const Route = createFileRoute("/_layout/keys")({
  component: ApiKeys,
})

function ApiKeysTableBody() {
  const { data: apiKeys } = useSuspenseQuery({
    queryKey: ["api_keys"],
    queryFn: () => ApiKeysService.readApiKeys({}),
  })

  return (
    <>
      <Thead>
        <Tr>
          <Th>Name</Th>
          <Th>Role</Th>
          <Th>Allowed IPs</Th>
          <Th>Prefix</Th>
          <Th>Created</Th>
          <Th>Last Used</Th>
          <Th>Actions</Th>
        </Tr>
      </Thead>
      <Tbody>
        {apiKeys.data.map((item: ApiKeyPublic) => (
          <Tr key={item.id}>
            <Td>{item.name || "(unnamed)"}</Td>
            <Td>
              <Badge
                colorScheme={item.role === "read_only" ? "orange" : "green"}
              >
                {item.role === "read_only" ? "Read-only" : "Read-write"}
              </Badge>
            </Td>
            <Td>
              <code>{item.allowed_ips || "0.0.0.0/0"}</code>
            </Td>
            <Td>
              <code>{item.prefix}...</code>
            </Td>
            <Td whiteSpace="nowrap">{formatTimestamp(item.created_at)}</Td>
            <Td whiteSpace="nowrap">
              {formatTimestamp(item.last_used_at, "Never")}
            </Td>
            <Td>
              <ActionsMenu
                type="ApiKey"
                value={item}
                name={item.name || `key #${item.id}`}
              />
            </Td>
          </Tr>
        ))}
      </Tbody>
    </>
  )
}

function ApiKeysTable() {
  return (
    <TableContainer>
      <Table size={{ base: "sm", md: "md" }}>
        <ErrorBoundary
          fallbackRender={({ error }) => (
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
                {new Array(3).fill(null).map((_, index) => (
                  <Tr key={index}>
                    {new Array(7).fill(null).map((_, index) => (
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
            <ApiKeysTableBody />
          </Suspense>
        </ErrorBoundary>
      </Table>
    </TableContainer>
  )
}

function ApiKeys() {
  const [, setSearchResults] = useState("")
  const handleSearch = (searchTerm: string) => {
    setSearchResults(searchTerm)
  }
  return (
    <Container maxW="full">
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        API Keys
      </Heading>
      <Navbar type={"ApiKey"} onSearch={handleSearch} />
      <ApiKeysTable />
      <IntegrationGuide />
    </Container>
  )
}
