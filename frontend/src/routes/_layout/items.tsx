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

import { Suspense, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { ItemsService } from "../../client"
import ActionsMenu from "../../components/Common/ActionsMenu"
import Navbar from "../../components/Common/Navbar"

export const Route = createFileRoute("/_layout/items")({
  component: Items,
})
interface ItemsProps {
  search_string: string
}

function ItemsTableBody({ search_string }: ItemsProps) {
  const { data: items } = useSuspenseQuery({
    queryKey: ["items", search_string],
    queryFn: () => ItemsService.readItems({ search: search_string }),
  })
  return (
    <Tbody>
      {items.data.map((item) => (
        <Tr key={item.id}>
          <Td>{item.id}</Td>
          <Td>{item.title}</Td>
          <Td color={!item.description ? "ui.dim" : "inherit"}>
            {item.description || "N/A"}
          </Td>
          <Td>
            <ActionsMenu type={"Item"} value={item} name={item.title} />
          </Td>
        </Tr>
      ))}
    </Tbody>
  )
}

function ItemsTable({ search_string }: ItemsProps) {
  return (
    <TableContainer>
      <Table size={{ base: "sm", md: "md" }}>
        <Thead>
          <Tr>
            <Th>ID</Th>
            <Th>Title</Th>
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
            <ItemsTableBody search_string={search_string} />
          </Suspense>
        </ErrorBoundary>
      </Table>
    </TableContainer>
  )
}

function Items() {
  const [searchResults, setSearchResults] = useState("");
  const handleSearch = (searchTerm: string) => {
    setSearchResults(searchTerm);
  };
  return (
    <Container maxW="full">
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        Items Management
      </Heading>

      <Navbar type={"Item"} onSearch={handleSearch} />
      <ItemsTable search_string={searchResults} />
    </Container>
  )
}
