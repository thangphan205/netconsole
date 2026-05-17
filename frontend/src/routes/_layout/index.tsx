import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Container,
  Divider,
  Heading,
  HStack,
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
  Tag,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"

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

type TimeRange = "24h" | "7d"

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
    <Box borderWidth="1px" borderRadius="md" p={3}>
      <Stat>
        <StatLabel fontSize="xs" color="gray.500">
          {label}
        </StatLabel>
        <Skeleton isLoaded={!isLoading} mt={0.5}>
          <StatNumber fontSize="xl">{count ?? 0}</StatNumber>
        </Skeleton>
      </Stat>
    </Box>
  )
}

function Dashboard() {
  const { user: currentUser } = useAuth()
  const isSuperuser = currentUser?.is_superuser

  const [timeRange, setTimeRange] = useState<TimeRange>("24h")
  const rangeMs = timeRange === "24h" ? 86_400_000 : 7 * 86_400_000
  const rangeLabel = timeRange === "24h" ? "24h" : "7d"
  const sinceTs = new Date(Date.now() - rangeMs).toISOString()
  // Cache key advances on range change AND at least once per bucket period
  const bucket = `${timeRange}-${new Date(Date.now() - rangeMs).toDateString()}`

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

  const { data: newArpsData, isLoading: newArpsLoading } = useQuery({
    queryKey: ["arps-new-count", bucket],
    queryFn: () => ArpsService.readArps({ limit: 1, since: sinceTs }),
    staleTime: 300_000,
  })

  const { data: newMacsData, isLoading: newMacsLoading } = useQuery({
    queryKey: ["macs-new-count", bucket],
    queryFn: () => MacAddressesService.readMacAddresses({ limit: 1, since: sinceTs }),
    staleTime: 300_000,
  })

  const { data: newIpIfData, isLoading: newIpIfLoading } = useQuery({
    queryKey: ["ipif-new-count", bucket],
    queryFn: () => IpInterfacesService.readIpInterfaces({ limit: 1, since: sinceTs }),
    staleTime: 300_000,
  })

  const { data: newMacsRows, isLoading: newMacsRowsLoading } = useQuery({
    queryKey: ["macs-new-rows", bucket],
    queryFn: () => MacAddressesService.readMacAddresses({ limit: 100, since: sinceTs }),
    staleTime: 300_000,
  })

  const { data: newArpsRows, isLoading: newArpsRowsLoading } = useQuery({
    queryKey: ["arps-new-rows", bucket],
    queryFn: () => ArpsService.readArps({ limit: 100, since: sinceTs }),
    staleTime: 300_000,
  })

  const { data: newIpIfRows, isLoading: newIpIfRowsLoading } = useQuery({
    queryKey: ["ipif-new-rows", bucket],
    queryFn: () => IpInterfacesService.readIpInterfaces({ limit: 100, since: sinceTs }),
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

  const hasNewData =
    (newMacsRows?.data.length ?? 0) > 0 ||
    (newArpsRows?.data.length ?? 0) > 0 ||
    (newIpIfRows?.data.length ?? 0) > 0

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
          <StatCard label="Switches" count={switchesData?.count} isLoading={switchesLoading} />
          <StatCard label="Groups" count={groupsData?.count} isLoading={groupsLoading} />
          <StatCard label="ARP Entries" count={arpsData?.count} isLoading={arpsLoading} />
          <StatCard label="MAC Addresses" count={macsData?.count} isLoading={macsLoading} />
          <StatCard label="IP Interfaces" count={ipifData?.count} isLoading={ipifLoading} />
          <StatCard label="Credentials" count={credData?.count} isLoading={credLoading} />
          <StatCard label={`New ARPs (${rangeLabel})`} count={newArpsData?.count} isLoading={newArpsLoading} />
          <StatCard label={`New MACs (${rangeLabel})`} count={newMacsData?.count} isLoading={newMacsLoading} />
          <StatCard label={`New IP Interfaces (${rangeLabel})`} count={newIpIfData?.count} isLoading={newIpIfLoading} />
        </SimpleGrid>

        <Divider mb={6} />

        <HStack justify="space-between" align="center" mb={4}>
          <Heading size="sm" textTransform="uppercase" color="gray.500">
            New entries — last {rangeLabel}
          </Heading>
          <ButtonGroup size="sm" isAttached variant="outline">
            <Button
              onClick={() => setTimeRange("24h")}
              colorScheme={timeRange === "24h" ? "blue" : "gray"}
              variant={timeRange === "24h" ? "solid" : "outline"}
            >
              Last 24h
            </Button>
            <Button
              onClick={() => setTimeRange("7d")}
              colorScheme={timeRange === "7d" ? "blue" : "gray"}
              variant={timeRange === "7d" ? "solid" : "outline"}
            >
              Last 7 days
            </Button>
          </ButtonGroup>
        </HStack>

        {!hasNewData ? (
          <Box borderWidth="1px" borderRadius="lg" p={8} textAlign="center" color="gray.400" mb={6}>
            No new entries in the last {rangeLabel}
          </Box>
        ) : (
          <>
            {(newMacsRows?.data.length ?? 0) > 0 && (
              <Box mb={6}>
                <Heading size="xs" mb={2} color="gray.600">MAC Addresses</Heading>
                <Box borderWidth="1px" borderRadius="lg" overflowX="auto">
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>MAC</Th>
                        <Th>Interface</Th>
                        <Th>VLAN</Th>
                        <Th>Switch</Th>
                        <Th>First Seen</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {newMacsRowsLoading
                        ? Array.from({ length: 3 }).map((_, i) => (
                            <Tr key={i}>
                              {Array.from({ length: 5 }).map((__, j) => (
                                <Td key={j}><Skeleton height="14px" /></Td>
                              ))}
                            </Tr>
                          ))
                        : newMacsRows?.data.map((row) => (
                            <Tr key={row.id}>
                              <Td fontFamily="mono" fontSize="xs">{row.mac}</Td>
                              <Td fontSize="xs">{row.interface}</Td>
                              <Td><Tag size="sm" colorScheme="blue">{row.vlan ?? "—"}</Tag></Td>
                              <Td fontSize="xs">{row.switch_hostname}</Td>
                              <Td fontSize="xs" whiteSpace="nowrap">{new Date(row.created_at).toLocaleString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</Td>
                            </Tr>
                          ))}
                    </Tbody>
                  </Table>
                </Box>
              </Box>
            )}

            {(newArpsRows?.data.length ?? 0) > 0 && (
              <Box mb={6}>
                <Heading size="xs" mb={2} color="gray.600">ARP Entries</Heading>
                <Box borderWidth="1px" borderRadius="lg" overflowX="auto">
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>IP</Th>
                        <Th>MAC</Th>
                        <Th>Interface</Th>
                        <Th>Switch</Th>
                        <Th>First Seen</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {newArpsRowsLoading
                        ? Array.from({ length: 3 }).map((_, i) => (
                            <Tr key={i}>
                              {Array.from({ length: 5 }).map((__, j) => (
                                <Td key={j}><Skeleton height="14px" /></Td>
                              ))}
                            </Tr>
                          ))
                        : newArpsRows?.data.map((row) => (
                            <Tr key={row.id}>
                              <Td fontFamily="mono" fontSize="xs">{row.ip}</Td>
                              <Td fontFamily="mono" fontSize="xs">{row.mac ?? "—"}</Td>
                              <Td fontSize="xs">{row.interface}</Td>
                              <Td fontSize="xs">{row.switch_hostname}</Td>
                              <Td fontSize="xs" whiteSpace="nowrap">{new Date(row.created_at).toLocaleString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</Td>
                            </Tr>
                          ))}
                    </Tbody>
                  </Table>
                </Box>
              </Box>
            )}

            {(newIpIfRows?.data.length ?? 0) > 0 && (
              <Box mb={6}>
                <Heading size="xs" mb={2} color="gray.600">IP Interfaces</Heading>
                <Box borderWidth="1px" borderRadius="lg" overflowX="auto">
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>Interface</Th>
                        <Th>IPv4</Th>
                        <Th>Switch</Th>
                        <Th>First Seen</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {newIpIfRowsLoading
                        ? Array.from({ length: 3 }).map((_, i) => (
                            <Tr key={i}>
                              {Array.from({ length: 4 }).map((__, j) => (
                                <Td key={j}><Skeleton height="14px" /></Td>
                              ))}
                            </Tr>
                          ))
                        : newIpIfRows?.data.map((row) => (
                            <Tr key={row.id}>
                              <Td fontSize="xs">{row.interface}</Td>
                              <Td fontFamily="mono" fontSize="xs">{row.ipv4}</Td>
                              <Td fontSize="xs">{row.switch_hostname}</Td>
                              <Td fontSize="xs" whiteSpace="nowrap">{new Date(row.created_at).toLocaleString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</Td>
                            </Tr>
                          ))}
                    </Tbody>
                  </Table>
                </Box>
              </Box>
            )}
          </>
        )}

        {isSuperuser && (
          <>
            <Divider mb={8} />
            <Heading size="sm" mb={4} textTransform="uppercase" color="gray.500">
              Admin
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={8}>
              <StatCard label="Users" count={usersData?.count} isLoading={usersLoading} />
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
                          <Td key={j}><Skeleton height="16px" /></Td>
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
                          {new Date(log.timestamp).toLocaleString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
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
