import {
  Button,
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
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Suspense, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { ApiError, SwitchesService } from "../../client"
import ActionsMenu from "../../components/Common/ActionsMenu"
import Navbar from "../../components/Common/Navbar"
import useCustomToast from "../../hooks/useCustomToast"

export const Route = createFileRoute("/_layout/switches")({
  component: Switches,
})
interface ItemsProps {
  search_string: string
}

function SwitchesTableBody({ search_string }: ItemsProps) {
  const [is_refresh, set_is_refresh] = useState(false);

  const { data: switches } = useSuspenseQuery({
    queryKey: ["switches", search_string, is_refresh],
    queryFn: () => SwitchesService.readSwitches({ search: search_string }),
  })

  const queryClient = useQueryClient()
  const showToast = useCustomToast();
  const mutation = useMutation({
    mutationFn: (switch_id: number) =>
      SwitchesService.updateSwitchMetadata({ id: switch_id }),
    onSuccess: () => {
      showToast("Success!", "Load config successfully.", "success")
      set_is_refresh(!is_refresh);
    },
    onError: (err: ApiError) => {
      const errDetail = (err.body as any)?.detail
      showToast("Something went wrong.", `${errDetail}`, "error")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] })
    },

  })
  const onSubmit = async (switch_id: number) => {
    showToast("Success!", "Updating switch metadata. Please wait!", "success")
    mutation.mutate(switch_id)
  }

  return (
    <Tbody>
      {switches.data.map((item) => (
        <Tr key={item.id}>
          <Td>{item.id}</Td>
          <Td>{item.hostname}</Td>
          <Td>{item.ipaddress}</Td>
          {
            String(item.model).length > 15 ? (
              <Td>{String(item.model).slice(0, 15)}...</Td>
            ) : (
              <Td>{item.model}</Td>
            )
          }
          {
            String(item.os_version).length > 15 ? (
              <Td>{String(item.os_version).slice(0, 15)}...</Td>
            ) : (
              <Td>{item.os_version}</Td>
            )
          }
          <Td>{item.groups}</Td>
          <Td color={!item.description ? "ui.dim" : "inherit"}>
            {String(item.description).slice(0, 30) || "N/A"}
          </Td>
          <Td>
            <Button colorScheme="blue" onClick={() => onSubmit(item.id)}>Update Metadata</Button>
            <ActionsMenu type={"Switch"} value={item} name={item.hostname} />
          </Td>
          <Td>{item.updated_at}</Td>
        </Tr>
      ))}
    </Tbody>
  )
}
function SwitchesTable({ search_string }: ItemsProps) {
  return (
    <TableContainer>
      <Table size={{ base: "sm", md: "md" }}>
        <Thead>
          <Tr>
            <Th>ID</Th>
            <Th>Hostname</Th>
            <Th>IP Address</Th>
            <Th>Model</Th>
            <Th>Version</Th>
            <Th>Groups</Th>
            <Th>Description</Th>
            <Th>Actions</Th>
            <Th>Last Sync</Th>
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
            <SwitchesTableBody search_string={search_string} />
          </Suspense>
        </ErrorBoundary>
      </Table>
    </TableContainer>
  )
}

function Switches() {
  const [searchResults, setSearchResults] = useState("");
  const handleSearch = (searchTerm: string) => {
    setSearchResults(searchTerm);
  };
  return (
    <Container maxW="full">
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        Switches Management
      </Heading>

      <Navbar type={"Switch"} onSearch={handleSearch} />
      <SwitchesTable search_string={searchResults} />
    </Container>
  )
}
