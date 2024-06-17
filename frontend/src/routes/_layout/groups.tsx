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
import { GroupsService } from "../../client"
import ActionsMenu from "../../components/Common/ActionsMenu"
import { useState } from "react";
import Navbar from "../../components/Common/Navbar"

export const Route = createFileRoute("/_layout/groups")({
  component: Groups,
})
interface ItemsProps {
  search_string: string
}
function GroupsTableBody({ search_string }: ItemsProps) {


  const { data: groups } = useSuspenseQuery({
    queryKey: ["groups", search_string],
    queryFn: async () => await GroupsService.readGroups({ search: search_string }),
  })


  return (
    <>
      <Thead>
        <Tr>
          <Th>ID</Th>
          <Th>Name</Th>
          <Th>Description</Th>
          <Th>Action</Th>
        </Tr>
      </Thead>
      <Tbody>
        {groups.data.map((item) => (
          <Tr key={item.id}>
            <Td>{item.id}</Td>
            <Td>{item.name}</Td>
            <Td>{item.description}</Td>
            <Td>
              <ActionsMenu type={"Group"} value={item} name={item.name} />
            </Td>
          </Tr>
        ))}
      </Tbody>

    </>
  )
}
function GroupsTable({ search_string }: ItemsProps) {

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
            <GroupsTableBody search_string={search_string} />
          </Suspense>
        </ErrorBoundary>
      </Table>
    </TableContainer>
  )
}

function Groups() {
  const [searchResults, setSearchResults] = useState("");
  const handleSearch = (searchTerm: string) => {
    setSearchResults(searchTerm);
  };
  return (
    <Container maxW="full">
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        Groups Management
      </Heading>
      <Navbar type={"Group"} onSearch={handleSearch} />
      <GroupsTable search_string={searchResults} />
    </Container>
  )
}
