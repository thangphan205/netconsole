import {
  Badge,
  Box,
  Container,
  Flex,
  Heading,
  Skeleton,
  SkeletonText,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react"
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Suspense, useState } from "react"
import { type UserPublic, UsersService, UtilsService } from "../../client"
import ActionsMenu from "../../components/Common/ActionsMenu"
import Navbar from "../../components/Common/Navbar"

export const Route = createFileRoute("/_layout/admin")({
  component: Admin,
})

const METHOD_COLOR: Record<string, string> = {
  password: "blue",
  google: "red",
  microsoft: "purple",
  keycloak: "orange",
  passkey: "green",
}
interface ItemsProps {
  search_string: string
}

const MembersTableBody = ({ search_string }: ItemsProps) => {
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])

  const { data: users } = useSuspenseQuery({
    queryKey: ["users", search_string],
    queryFn: () => UsersService.readUsers({ search: search_string }),
  })

  return (
    <Tbody>
      {users.data.map((user) => (
        <Tr key={user.id}>
          <Td color={!user.full_name ? "ui.dim" : "inherit"}>
            {user.full_name || "N/A"}
            {currentUser?.id === user.id && (
              <Badge ml="1" colorScheme="teal">
                You
              </Badge>
            )}
          </Td>
          <Td>{user.email}</Td>
          <Td>{user.is_superuser ? "Superuser" : "User"}</Td>
          <Td>
            <Flex gap={1} flexWrap="wrap">
              {((user as any).auth_methods as string[] ?? []).map((m) => (
                <Badge key={m} colorScheme={METHOD_COLOR[m] ?? "gray"} fontSize="xs">
                  {m}
                </Badge>
              ))}
            </Flex>
          </Td>
          <Td>
            <Flex gap={2}>
              <Box
                w="2"
                h="2"
                borderRadius="50%"
                bg={user.is_active ? "ui.success" : "ui.danger"}
                alignSelf="center"
              />
              {user.is_active ? "Active" : "Inactive"}
            </Flex>
          </Td>
          <Td>
            <ActionsMenu
              type="User"
              value={user}
              disabled={currentUser?.id === user.id ? true : false}
              name={user.email}
            />
          </Td>
        </Tr>
      ))}
    </Tbody>
  )
}

const MembersBodySkeleton = () => {
  return (
    <Tbody>
      <Tr>
        {new Array(6).fill(null).map((_, index) => (
          <Td key={index}>
            <SkeletonText noOfLines={1} paddingBlock="16px" />
          </Td>
        ))}
      </Tr>
    </Tbody>
  )
}

function ServerInfoBar() {
  const { data, isLoading } = useQuery({
    queryKey: ["serverInfo"],
    queryFn: () => UtilsService.serverInfo(),
    staleTime: 60_000,
  })
  if (isLoading) return <Skeleton height="20px" width="300px" mb={2} />
  if (!data) return null
  return (
    <Flex gap={4} mb={4} fontSize="sm" color="gray.500" flexWrap="wrap">
      <Text>Timezone: <strong>{data.timezone}</strong></Text>
      <Text>Server time: <strong>{data.current_time}</strong></Text>
      <Text>UTC: <strong>{data.utc_time}</strong></Text>
    </Flex>
  )
}

function Admin() {
  const [searchResults, setSearchResults] = useState("");
  const handleSearch = (searchTerm: string) => {
    setSearchResults(searchTerm);
  };
  return (
    <Container maxW="full">
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        User Management
      </Heading>
      <ServerInfoBar />
      <Navbar type={"User"} onSearch={handleSearch} />
      <TableContainer>
        <Table fontSize="md" size={{ base: "sm", md: "md" }}>
          <Thead>
            <Tr>
              <Th width="20%">Full name</Th>
              <Th width="50%">Email</Th>
              <Th width="10%">Role</Th>
              <Th width="20%">Auth methods</Th>
              <Th width="10%">Status</Th>
              <Th width="10%">Actions</Th>
            </Tr>
          </Thead>
          <Suspense fallback={<MembersBodySkeleton />}>
            <MembersTableBody search_string={searchResults} />
          </Suspense>
        </Table>
      </TableContainer>
    </Container>
  )
}
