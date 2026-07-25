import {
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  HStack,
  Heading,
  Icon,
  Input,
  SimpleGrid,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type OptionBase, Select, type SingleValue } from "chakra-react-select"
import { useEffect, useState } from "react"
import { type SubmitHandler, useForm } from "react-hook-form"
import {
  FiEdit2,
  FiLayers,
  FiList,
  FiServer,
  FiShield,
  FiTrash2,
} from "react-icons/fi"

import {
  type ApiError,
  type ComplianceProfileUpdate,
  ComplianceService,
  GroupsService,
  SwitchesService,
} from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

interface GroupOption extends OptionBase {
  label: string
  value: number
}

interface ConfigItem {
  key: string
  label: string
  overrideValue: string | number | null
  globalValue: string | number | null
  effectiveValue: string | number
  isOverridden: boolean
}

const GroupProfileOverrides = () => {
  const showToast = useCustomToast()
  const queryClient = useQueryClient()
  const [groupId, setGroupId] = useState<number | null>(null)

  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: () => GroupsService.readGroups({}),
  })
  const { data: profiles } = useQuery({
    queryKey: ["compliance-profiles"],
    queryFn: () => ComplianceService.readProfiles(),
  })
  const { data: switches } = useQuery({
    queryKey: ["switches"],
    queryFn: () => SwitchesService.readSwitches({}),
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<ComplianceProfileUpdate>({ mode: "onBlur" })

  const selectedGroup = (groups?.data ?? []).find((g) => g.id === groupId)

  const currentOverride = profiles?.group_profiles.find(
    (p) => p.group_id === groupId,
  )

  const globalProfile = profiles?.global_profile

  useEffect(() => {
    reset({
      ntp_server: currentOverride?.ntp_server ?? null,
      syslog_server: currentOverride?.syslog_server ?? null,
      dns_server: currentOverride?.dns_server ?? null,
      password_min_length: currentOverride?.password_min_length ?? null,
      exec_timeout_minutes: currentOverride?.exec_timeout_minutes ?? null,
    })
  }, [currentOverride, reset])

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["compliance-profiles"] })

  const onApiError = (err: ApiError) => {
    const errDetail = (err.body as any)?.detail
    showToast("Something went wrong.", `${errDetail}`, "error")
  }

  const saveMutation = useMutation({
    mutationFn: (payload: ComplianceProfileUpdate) =>
      ComplianceService.updateGroupProfile({
        groupId: groupId!,
        requestBody: payload,
      }),
    onSuccess: () => {
      showToast("Saved", "Group compliance override updated.", "success")
      invalidate()
    },
    onError: onApiError,
  })

  const deleteMutation = useMutation({
    mutationFn: (gId?: number) =>
      ComplianceService.deleteGroupProfile({ groupId: gId ?? groupId! }),
    onSuccess: () => {
      showToast("Removed", "Group falls back to the global profile.", "success")
      invalidate()
    },
    onError: onApiError,
  })

  const onSubmit: SubmitHandler<ComplianceProfileUpdate> = (values) => {
    saveMutation.mutate({
      ...values,
      password_min_length: values.password_min_length
        ? Number(values.password_min_length)
        : null,
      exec_timeout_minutes: values.exec_timeout_minutes
        ? Number(values.exec_timeout_minutes)
        : null,
    })
  }

  const groupOptions: GroupOption[] = (groups?.data ?? []).map((g) => ({
    value: g.id,
    label: `${g.name} - ${g.site}`,
  }))

  const handleGroupChange = (newValue: SingleValue<GroupOption>) => {
    setGroupId(newValue ? newValue.value : null)
  }

  // Effective configuration table for selected group
  const effectiveConfigs: ConfigItem[] = [
    {
      key: "ntp_server",
      label: "NTP Server",
      overrideValue: currentOverride?.ntp_server ?? null,
      globalValue: globalProfile?.ntp_server ?? null,
      effectiveValue:
        currentOverride?.ntp_server || globalProfile?.ntp_server || "—",
      isOverridden: Boolean(currentOverride?.ntp_server),
    },
    {
      key: "syslog_server",
      label: "Syslog Server",
      overrideValue: currentOverride?.syslog_server ?? null,
      globalValue: globalProfile?.syslog_server ?? null,
      effectiveValue:
        currentOverride?.syslog_server || globalProfile?.syslog_server || "—",
      isOverridden: Boolean(currentOverride?.syslog_server),
    },
    {
      key: "dns_server",
      label: "DNS Server",
      overrideValue: currentOverride?.dns_server ?? null,
      globalValue: globalProfile?.dns_server ?? null,
      effectiveValue:
        currentOverride?.dns_server || globalProfile?.dns_server || "—",
      isOverridden: Boolean(currentOverride?.dns_server),
    },
    {
      key: "password_min_length",
      label: "Password Min Length",
      overrideValue: currentOverride?.password_min_length ?? null,
      globalValue: globalProfile?.password_min_length ?? null,
      effectiveValue:
        currentOverride?.password_min_length ??
        globalProfile?.password_min_length ??
        "—",
      isOverridden:
        currentOverride?.password_min_length !== null &&
        currentOverride?.password_min_length !== undefined,
    },
    {
      key: "exec_timeout_minutes",
      label: "Exec Timeout (minutes)",
      overrideValue: currentOverride?.exec_timeout_minutes ?? null,
      globalValue: globalProfile?.exec_timeout_minutes ?? null,
      effectiveValue:
        currentOverride?.exec_timeout_minutes ??
        globalProfile?.exec_timeout_minutes ??
        "—",
      isOverridden:
        currentOverride?.exec_timeout_minutes !== null &&
        currentOverride?.exec_timeout_minutes !== undefined,
    },
  ]

  // Switches in current group
  const groupSwitches = (switches?.data ?? []).filter((s) => {
    if (!selectedGroup || !s.groups) return false
    const sGroups = s.groups.split(",").map((g) => g.trim())
    return sGroups.includes(selectedGroup.name)
  })

  const allGroups = groups?.data ?? []

  return (
    <VStack align="stretch" spacing={6}>
      <Box>
        <Heading size="sm" mb={1}>
          Group Overrides
        </Heading>
        <Text fontSize="xs" color="gray.500" mb={4}>
          Only fields set here override the global profile for switches in this
          group. Leave a field blank to inherit the global value. Server fields
          accept a comma-separated list — every listed server must be present
          for the rule to pass.
        </Text>

        <FormControl maxW="md">
          <FormLabel fontSize="sm" fontWeight="medium">
            Select Group
          </FormLabel>
          <Select
            options={groupOptions}
            placeholder="Select group…"
            isMulti={false}
            value={
              groupId ? groupOptions.find((opt) => opt.value === groupId) : null
            }
            onChange={handleGroupChange}
          />
        </FormControl>
      </Box>

      {groupId && selectedGroup && (
        <Grid templateColumns={{ base: "1fr", xl: "420px 1fr" }} gap={6}>
          {/* Edit Form */}
          <Box
            bg="white"
            border="1px solid"
            borderColor="gray.200"
            borderRadius="xl"
            p={5}
            shadow="sm"
          >
            <HStack spacing={2} mb={4}>
              <Icon as={FiShield} color="teal.500" boxSize={4} />
              <Heading size="xs" color="gray.700">
                Override Settings for {selectedGroup.name}
              </Heading>
            </HStack>

            <Box as="form" onSubmit={handleSubmit(onSubmit)}>
              <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                <FormControl>
                  <FormLabel fontSize="xs" color="gray.600">
                    NTP Server
                  </FormLabel>
                  <Input
                    size="sm"
                    placeholder="inherit"
                    {...register("ntp_server")}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="xs" color="gray.600">
                    Syslog Server
                  </FormLabel>
                  <Input
                    size="sm"
                    placeholder="inherit"
                    {...register("syslog_server")}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="xs" color="gray.600">
                    DNS Server
                  </FormLabel>
                  <Input
                    size="sm"
                    placeholder="inherit"
                    {...register("dns_server")}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="xs" color="gray.600">
                    Password Min Length
                  </FormLabel>
                  <Input
                    size="sm"
                    type="number"
                    placeholder="inherit"
                    {...register("password_min_length")}
                  />
                </FormControl>
                <GridItem colSpan={{ base: 1, sm: 2 }}>
                  <FormControl>
                    <FormLabel fontSize="xs" color="gray.600">
                      Exec Timeout (minutes)
                    </FormLabel>
                    <Input
                      size="sm"
                      type="number"
                      placeholder="inherit"
                      {...register("exec_timeout_minutes")}
                    />
                  </FormControl>
                </GridItem>
              </SimpleGrid>

              <HStack mt={5} justify="space-between">
                <Button
                  size="sm"
                  variant="primary"
                  type="submit"
                  isLoading={isSubmitting || saveMutation.isPending}
                >
                  Save Override
                </Button>
                {currentOverride && (
                  <Button
                    size="sm"
                    variant="outline"
                    colorScheme="red"
                    leftIcon={<Icon as={FiTrash2} />}
                    isLoading={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(groupId)}
                  >
                    Remove Override
                  </Button>
                )}
              </HStack>
            </Box>
          </Box>

          {/* Current Group Effective Configuration & Devices */}
          <VStack align="stretch" spacing={6}>
            {/* Effective Configuration Table */}
            <Box
              bg="white"
              border="1px solid"
              borderColor="gray.200"
              borderRadius="xl"
              p={5}
              shadow="sm"
            >
              <Flex justify="space-between" align="center" mb={4}>
                <HStack spacing={2}>
                  <Icon as={FiList} color="blue.500" boxSize={4} />
                  <Heading size="xs" color="gray.700">
                    Current Group Configuration ({selectedGroup.name})
                  </Heading>
                </HStack>
                <Badge colorScheme="blue" variant="subtle" fontSize="xs">
                  {effectiveConfigs.filter((c) => c.isOverridden).length} /{" "}
                  {effectiveConfigs.length} Overridden
                </Badge>
              </Flex>

              <TableContainer>
                <Table size="sm" variant="simple">
                  <Thead bg="gray.50">
                    <Tr>
                      <Th fontSize="xs">Parameter</Th>
                      <Th fontSize="xs">Group Override</Th>
                      <Th fontSize="xs">Effective Value</Th>
                      <Th fontSize="xs">Source</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {effectiveConfigs.map((cfg) => (
                      <Tr key={cfg.key}>
                        <Td fontWeight="medium" fontSize="xs">
                          {cfg.label}
                        </Td>
                        <Td fontSize="xs" color="gray.600">
                          {cfg.overrideValue !== null &&
                          cfg.overrideValue !== "" ? (
                            <Text
                              as="span"
                              fontWeight="medium"
                              color="blue.600"
                            >
                              {cfg.overrideValue}
                            </Text>
                          ) : (
                            <Text as="span" fontStyle="italic" color="gray.400">
                              Inherits Global
                            </Text>
                          )}
                        </Td>
                        <Td fontSize="xs" fontWeight="semibold">
                          {cfg.effectiveValue}
                        </Td>
                        <Td>
                          {cfg.isOverridden ? (
                            <Badge
                              colorScheme="blue"
                              variant="subtle"
                              fontSize="2xs"
                            >
                              Group Override
                            </Badge>
                          ) : (
                            <Badge
                              colorScheme="gray"
                              variant="subtle"
                              fontSize="2xs"
                            >
                              Global Default
                            </Badge>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            </Box>

            {/* Devices in Group */}
            <Box
              bg="white"
              border="1px solid"
              borderColor="gray.200"
              borderRadius="xl"
              p={5}
              shadow="sm"
            >
              <Flex justify="space-between" align="center" mb={3}>
                <HStack spacing={2}>
                  <Icon as={FiServer} color="purple.500" boxSize={4} />
                  <Heading size="xs" color="gray.700">
                    Switches in Group ({groupSwitches.length})
                  </Heading>
                </HStack>
              </Flex>

              {groupSwitches.length === 0 ? (
                <Text fontSize="xs" color="gray.500" fontStyle="italic" py={2}>
                  No switches assigned to this group.
                </Text>
              ) : (
                <TableContainer maxH="220px" overflowY="auto">
                  <Table size="sm">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th fontSize="xs">Hostname</Th>
                        <Th fontSize="xs">IP Address</Th>
                        <Th fontSize="xs">Platform</Th>
                        <Th fontSize="xs">Health Status</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {groupSwitches.map((sw) => (
                        <Tr key={sw.id}>
                          <Td fontSize="xs" fontWeight="medium">
                            {sw.hostname}
                          </Td>
                          <Td fontSize="xs" fontFamily="mono">
                            {sw.ipaddress}
                          </Td>
                          <Td fontSize="xs">{sw.platform || "—"}</Td>
                          <Td>
                            <Badge
                              colorScheme={
                                sw.health_status === "online" ? "green" : "gray"
                              }
                              variant="subtle"
                              fontSize="2xs"
                            >
                              {sw.health_status || "unknown"}
                            </Badge>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          </VStack>
        </Grid>
      )}

      {/* All Group Configurations Table */}
      <Box
        bg="white"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="xl"
        p={5}
        shadow="sm"
        mt={4}
      >
        <Flex justify="space-between" align="center" mb={4}>
          <HStack spacing={2}>
            <Icon as={FiLayers} color="teal.600" boxSize={4} />
            <Heading size="xs" color="gray.700">
              All Group Configurations ({allGroups.length})
            </Heading>
          </HStack>
        </Flex>

        {allGroups.length === 0 ? (
          <Text fontSize="xs" color="gray.500" fontStyle="italic" py={2}>
            No groups configured.
          </Text>
        ) : (
          <TableContainer>
            <Table size="sm" variant="simple">
              <Thead bg="gray.50">
                <Tr>
                  <Th fontSize="xs">Group</Th>
                  <Th fontSize="xs">NTP Server</Th>
                  <Th fontSize="xs">Syslog Server</Th>
                  <Th fontSize="xs">DNS Server</Th>
                  <Th fontSize="xs">Password Min Length</Th>
                  <Th fontSize="xs">Exec Timeout</Th>
                  <Th fontSize="xs">Status</Th>
                  <Th fontSize="xs" textAlign="right">
                    Actions
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {allGroups.map((grp) => {
                  const ov = profiles?.group_profiles.find(
                    (p) => p.group_id === grp.id,
                  )
                  const isSelected = grp.id === groupId

                  const ntpIsOverride = Boolean(ov?.ntp_server)
                  const ntpVal =
                    ov?.ntp_server || globalProfile?.ntp_server || "—"

                  const syslogIsOverride = Boolean(ov?.syslog_server)
                  const syslogVal =
                    ov?.syslog_server || globalProfile?.syslog_server || "—"

                  const dnsIsOverride = Boolean(ov?.dns_server)
                  const dnsVal =
                    ov?.dns_server || globalProfile?.dns_server || "—"

                  const passIsOverride =
                    ov?.password_min_length !== null &&
                    ov?.password_min_length !== undefined
                  const passVal =
                    ov?.password_min_length ??
                    globalProfile?.password_min_length ??
                    "—"

                  const execIsOverride =
                    ov?.exec_timeout_minutes !== null &&
                    ov?.exec_timeout_minutes !== undefined
                  const execVal = ov?.exec_timeout_minutes
                    ? `${ov.exec_timeout_minutes}m`
                    : globalProfile?.exec_timeout_minutes
                      ? `${globalProfile.exec_timeout_minutes}m`
                      : "—"

                  const overrideCount = [
                    ntpIsOverride,
                    syslogIsOverride,
                    dnsIsOverride,
                    passIsOverride,
                    execIsOverride,
                  ].filter(Boolean).length

                  const renderConfigCell = (
                    val: string | number,
                    isOverride: boolean,
                  ) => (
                    <Text
                      fontSize="xs"
                      fontWeight={isOverride ? "semibold" : "normal"}
                      color={isOverride ? "blue.700" : "gray.600"}
                    >
                      {val}
                    </Text>
                  )

                  return (
                    <Tr
                      key={grp.id}
                      bg={isSelected ? "teal.50" : undefined}
                      _hover={{ bg: "gray.50" }}
                    >
                      <Td fontWeight="semibold" fontSize="xs">
                        <Text>{grp.name}</Text>
                        <Text fontSize="3xs" color="gray.400" fontWeight="normal">
                          {grp.site}
                        </Text>
                      </Td>
                      <Td>{renderConfigCell(ntpVal, ntpIsOverride)}</Td>
                      <Td>{renderConfigCell(syslogVal, syslogIsOverride)}</Td>
                      <Td>{renderConfigCell(dnsVal, dnsIsOverride)}</Td>
                      <Td>{renderConfigCell(passVal, passIsOverride)}</Td>
                      <Td>{renderConfigCell(execVal, execIsOverride)}</Td>
                      <Td>
                        {overrideCount > 0 ? (
                          <Badge colorScheme="blue" variant="subtle" fontSize="2xs">
                            {overrideCount} Overrides
                          </Badge>
                        ) : (
                          <Badge colorScheme="gray" variant="subtle" fontSize="2xs">
                            Global Default
                          </Badge>
                        )}
                      </Td>
                      <Td textAlign="right">
                        <HStack spacing={1} justify="flex-end">
                          <Button
                            size="2xs"
                            variant="ghost"
                            colorScheme="teal"
                            leftIcon={<Icon as={FiEdit2} />}
                            onClick={() => setGroupId(grp.id)}
                          >
                            Select
                          </Button>
                          {ov && (
                            <Button
                              size="2xs"
                              variant="ghost"
                              colorScheme="red"
                              isLoading={
                                deleteMutation.isPending &&
                                deleteMutation.variables === grp.id
                              }
                              onClick={() => deleteMutation.mutate(grp.id)}
                            >
                              Remove
                            </Button>
                          )}
                        </HStack>
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </VStack>
  )
}

export default GroupProfileOverrides
