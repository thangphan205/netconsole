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
import { CredentialsService, } from "../../client"
import ActionsMenu from "../../components/Common/ActionsMenu"
import { useState } from "react";
import Navbar from "../../components/Common/Navbar"

export const Route = createFileRoute("/_layout/credentials")({
  component: Credentials,
})
interface ItemsProps {
  search_string: string
}
function CredentialsTableBody({ search_string }: ItemsProps) {

  const { data: credentials } = useSuspenseQuery({
    queryKey: ["credentials", search_string],
    queryFn: async () => await CredentialsService.readCredentials({ search: search_string }),
  })


  return (
    <>
      <Thead>
        <Tr>
          <Th>ID</Th>
          <Th>Username</Th>
          <Th>Action</Th>
          <Th>First Seen</Th>
          <Th>Last Seen</Th>
        </Tr>
      </Thead>
      <Tbody>
        {credentials.data.map((item) => (
          <Tr key={item.id}>
            <Td>{item.id}</Td>
            <Td>{item.username}</Td>
            <Td>
              <ActionsMenu type={"Credential"} value={item} name={String(item.username)} />
            </Td>
            <Td>{item.created_at}</Td>
            <Td>{item.updated_at}</Td>
          </Tr>
        ))}
      </Tbody>

    </>
  )
}
function CredentialsTable({ search_string }: ItemsProps) {

  return (
    <TableContainer>
      <Table size={{ base: "sm", md: "md" }}>
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
            <CredentialsTableBody search_string={search_string} />
          </Suspense>
        </ErrorBoundary>
      </Table>
    </TableContainer>
  )
}

function Credentials() {
  const [searchResults, setSearchResults] = useState("");
  const handleSearch = (searchTerm: string) => {
    setSearchResults(searchTerm);
  };
  return (
    <Container maxW="full">
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        Credentials Management
      </Heading>
      <Navbar type={"Credential"} onSearch={handleSearch} />
      <CredentialsTable search_string={searchResults} />
    </Container>
  )
}
