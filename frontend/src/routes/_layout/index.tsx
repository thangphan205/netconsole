import {
  Badge,
  Box,
  Container,
  Divider,
  Heading,
  SimpleGrid,
  Skeleton,
  Stat,
  StatLabel,
  StatNumber,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import {
  ArpsService,
  CredentialsService,
  GroupsService,
  IpInterfacesService,
  LogsService,
  MacAddressesService,
  SwitchesService,
  UsersService,
} from "../../client/services"
import useAuth from "../../hooks/useAuth"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
})

function severityColor(severity: string): string {
  if (severity === "ERROR") return "red"
  if (severity === "WARNING") return "orange"
  return "green"
}

function StatCard({
  label,
  count,
  isLoading,
}: {
  label: string
  count: number | undefined
  isLoading: boolean
}) {
  return (
    <Box borderWidth="1px" borderRadius="lg" p={5}>
      <Stat>
        <StatLabel fontSize="sm" color="gray.500">
          {label}
        </StatLabel>
        <Skeleton isLoaded={!isLoading} mt={1}>
          <StatNumber fontSize="3xl">{count ?? 0}</StatNumber>
        </Skeleton>
      </Stat>
    </Box>
  )
}

function Dashboard() {
  const { user: currentUser } = useAuth()
  const isSuperuser = currentUser?.is_superuser

  const { data: switchesData, isLoading: switchesLoading } = useQuery({
    queryKey: ["switches-count"],
    queryFn: () => SwitchesService.readSwitches({ limit: 1 }),
  })

  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ["groups-count"],
    queryFn: () => GroupsService.readGroups({ limit: 1 }),
  })

  const { data: arpsData, isLoading: arpsLoading } = useQuery({
    queryKey: ["arps-count"],
    queryFn: () => ArpsService.readArps({ limit: 1 }),
  })

  const { data: macsData, isLoading: macsLoading } = useQuery({
    queryKey: ["macs-count"],
    queryFn: () => MacAddressesService.readMacAddresses({ limit: 1 }),
  })

  const { data: ipifData, isLoading: ipifLoading } = useQuery({
    queryKey: ["ipinterfaces-count"],
    queryFn: () => IpInterfacesService.readIpInterfaces({ limit: 1 }),
  })

  const { data: credData, isLoading: credLoading } = useQuery({
    queryKey: ["credentials-count"],
    queryFn: () => CredentialsService.readCredentials({ limit: 1 }),
  })

  // Daily bucket — key advances at midnight so cache doesn't serve stale counts indefinitely
  const since24hBucket = new Date(Date.now() - 86400000).toDateString()

  const { data: newArpsData, isLoading: newArpsLoading } = useQuery({
    queryKey: ["arps-new-count", since24hBucket],
    queryFn: () =>
      ArpsService.readArps({ limit: 1, since: new Date(Date.now() - 86400000).toISOString() }),
    staleTime: 300_000,
  })

  const { data: newMacsData, isLoading: newMacsLoading } = useQuery({
    queryKey: ["macs-new-count", since24hBucket],
    queryFn: () =>
      MacAddressesService.readMacAddresses({ limit: 1, since: new Date(Date.now() - 86400000).toISOString() }),
    staleTime: 300_000,
  })

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["users-count"],
    queryFn: () => UsersService.readUsers({ limit: 1 }),
    enabled: !!isSuperuser,
  })

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ["recent-logs"],
    queryFn: () => LogsService.readLogs({ limit: 20, skip: 0 }),
    enabled: !!isSuperuser,
  })

  return (
    <Container maxW="full">
      <Box pt={8} px={4}>
        <Text fontSize="2xl" fontWeight="bold" mb={1}>
          Hi, {currentUser?.full_name || currentUser?.email} 👋
        </Text>
        <Text color="gray.500" mb={8}>
          Network overview
        </Text>

        <Heading size="sm" mb={4} textTransform="uppercase" color="gray.500">
          Network Summary
        </Heading>
        <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4} mb={8}>
          <StatCard
            label="Switches"
            count={switchesData?.count}
            isLoading={switchesLoading}
          />
          <StatCard
            label="Groups"
            count={groupsData?.count}
            isLoading={groupsLoading}
          />
          <StatCard
            label="ARP Entries"
            count={arpsData?.count}
            isLoading={arpsLoading}
          />
          <StatCard
            label="MAC Addresses"
            count={macsData?.count}
            isLoading={macsLoading}
          />
          <StatCard
            label="IP Interfaces"
            count={ipifData?.count}
            isLoading={ipifLoading}
          />
          <StatCard
            label="Credentials"
            count={credData?.count}
            isLoading={credLoading}
          />
          <StatCard
            label="New ARPs (24h)"
            count={newArpsData?.count}
            isLoading={newArpsLoading}
          />
          <StatCard
            label="New MACs (24h)"
            count={newMacsData?.count}
            isLoading={newMacsLoading}
          />
        </SimpleGrid>

        {isSuperuser && (
          <>
            <Divider mb={8} />
            <Heading
              size="sm"
              mb={4}
              textTransform="uppercase"
              color="gray.500"
            >
              Admin
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={8}>
              <StatCard
                label="Users"
                count={usersData?.count}
                isLoading={usersLoading}
              />
            </SimpleGrid>

            <Heading size="sm" mb={4}>
              Recent Audit Events
            </Heading>
            <Box borderWidth="1px" borderRadius="lg" overflowX="auto">
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Time</Th>
                    <Th>Severity</Th>
                    <Th>User</Th>
                    <Th>Action</Th>
                    <Th>Message</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {logsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <Tr key={i}>
                        {Array.from({ length: 5 }).map((__, j) => (
                          <Td key={j}>
                            <Skeleton height="16px" />
                          </Td>
                        ))}
                      </Tr>
                    ))
                  ) : logsData?.data.length === 0 ? (
                    <Tr>
                      <Td colSpan={5} textAlign="center" color="gray.400">
                        No audit events yet
                      </Td>
                    </Tr>
                  ) : (
                    logsData?.data.map((log) => (
                      <Tr key={log.id}>
                        <Td whiteSpace="nowrap" fontSize="xs">
                          {new Date(log.timestamp).toLocaleString()}
                        </Td>
                        <Td>
                          <Badge colorScheme={severityColor(log.severity)}>
                            {log.severity}
                          </Badge>
                        </Td>
                        <Td fontSize="xs">{log.username}</Td>
                        <Td fontSize="xs">{log.action}</Td>
                        <Td fontSize="xs" maxW="260px" isTruncated>
                          {log.message}
                        </Td>
                      </Tr>
                    ))
                  )}
                </Tbody>
              </Table>
            </Box>
          </>
        )}
      </Box>
    </Container>
  )
}
