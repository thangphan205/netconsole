import {
  Alert,
  AlertIcon,
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
  Skeleton,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type OptionBase, Select, type SingleValue } from "chakra-react-select"
import { useEffect, useState } from "react"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"
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
  DevicesService,
  GroupsService,
} from "../../client"
import useCustomToast from "../../hooks/useCustomToast"
import ConfirmActionDialog from "../Common/ConfirmActionDialog"
import DisabledRulesPicker from "./DisabledRulesPicker"

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
  const [pendingDelete, setPendingDelete] = useState<number | null>(null)
  const deleteConfirm = useDisclosure()

  // Panel chrome as tokens — these were hard-coded to white/gray, which made
  // the whole section unreadable in dark mode.
  const cardBg = useColorModeValue("white", "gray.700")
  const cardBorder = useColorModeValue("gray.200", "gray.600")
  const headBg = useColorModeValue("gray.50", "gray.800")
  const headingColor = useColorModeValue("gray.700", "gray.100")
  const labelColor = useColorModeValue("gray.600", "gray.300")
  const mutedColor = useColorModeValue("gray.600", "gray.400")
  const overrideColor = useColorModeValue("blue.600", "blue.300")
  const selectedRowBg = useColorModeValue("teal.50", "teal.900")
  const hoverRowBg = useColorModeValue("gray.50", "gray.600")

  const {
    data: groups,
    isLoading: groupsLoading,
    isError: groupsError,
  } = useQuery({
    queryKey: ["groups"],
    queryFn: () => GroupsService.readGroups({}),
  })
  const {
    data: profiles,
    isLoading: profilesLoading,
    isError: profilesError,
  } = useQuery({
    queryKey: ["compliance-profiles"],
    queryFn: () => ComplianceService.readProfiles(),
  })
  const { data: devices } = useQuery({
    queryKey: ["devices"],
    queryFn: () => DevicesService.readDevices({}),
  })

  const isLoading = groupsLoading || profilesLoading
  const isError = groupsError || profilesError

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty },
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
      syslog_severity: currentOverride?.syslog_severity ?? null,
      dns_server: currentOverride?.dns_server ?? null,
      password_min_length: currentOverride?.password_min_length ?? null,
      exec_timeout_minutes: currentOverride?.exec_timeout_minutes ?? null,
      disabled_rules: currentOverride?.disabled_rules ?? null,
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
      deleteConfirm.onClose()
      setPendingDelete(null)
    },
    onError: (err: ApiError) => {
      deleteConfirm.onClose()
      onApiError(err)
    },
  })

  const askDelete = (targetGroupId: number | null) => {
    setPendingDelete(targetGroupId)
    deleteConfirm.onOpen()
  }

  const onSubmit: SubmitHandler<ComplianceProfileUpdate> = (values) => {
    saveMutation.mutate({
      ...values,
      password_min_length: values.password_min_length
        ? Number(values.password_min_length)
        : null,
      exec_timeout_minutes: values.exec_timeout_minutes
        ? Number(values.exec_timeout_minutes)
        : null,
      disabled_rules: values.disabled_rules || null,
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
      key: "syslog_severity",
      label: "Syslog Severity",
      overrideValue: currentOverride?.syslog_severity ?? null,
      globalValue: globalProfile?.syslog_severity ?? null,
      effectiveValue:
        currentOverride?.syslog_severity ||
        globalProfile?.syslog_severity ||
        "—",
      isOverridden: Boolean(currentOverride?.syslog_severity),
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
    {
      key: "disabled_rules",
      label: "Disabled Rules",
      overrideValue: currentOverride?.disabled_rules ?? null,
      globalValue: globalProfile?.disabled_rules ?? null,
      effectiveValue:
        currentOverride?.disabled_rules || globalProfile?.disabled_rules || "—",
      isOverridden: Boolean(currentOverride?.disabled_rules),
    },
  ]

  // Devices in current group
  const groupDevices = (devices?.data ?? []).filter((s) => {
    if (!selectedGroup || !s.groups) return false
    const sGroups = s.groups.split(",").map((g) => g.trim())
    return sGroups.includes(selectedGroup.name)
  })

  const allGroups = groups?.data ?? []

  if (isError) {
    return (
      <Alert status="error" borderRadius="md">
        <AlertIcon />
        Could not load groups or compliance profiles. Saving an override now
        could overwrite stored values, so the editor is hidden until the fetch
        succeeds.
      </Alert>
    )
  }

  return (
    <VStack align="stretch" spacing={6}>
      <Box>
        <Heading size="sm" mb={1}>
          Group Overrides
        </Heading>
        <Text fontSize="xs" color="gray.500" mb={4}>
          Only fields set here override the global profile for devices in this
          group. Leave a field blank to inherit the global value. Server fields
          accept a comma-separated list — every listed server must be present
          for the rule to pass.
        </Text>

        <Skeleton isLoaded={!isLoading}>
          <FormControl maxW="md">
            <FormLabel fontSize="sm" fontWeight="medium">
              Select Group
            </FormLabel>
            <Select
              options={groupOptions}
              placeholder="Select group…"
              isMulti={false}
              value={
                groupId
                  ? groupOptions.find((opt) => opt.value === groupId)
                  : null
              }
              onChange={handleGroupChange}
            />
          </FormControl>
        </Skeleton>
      </Box>

      {groupId && selectedGroup && (
        <Grid templateColumns={{ base: "1fr", xl: "420px 1fr" }} gap={6}>
          {/* Edit Form */}
          <Box
            bg={cardBg}
            border="1px solid"
            borderColor={cardBorder}
            borderRadius="xl"
            p={5}
            shadow="sm"
          >
            <HStack spacing={2} mb={4}>
              <Icon as={FiShield} color="teal.500" boxSize={4} />
              <Heading size="xs" color={headingColor}>
                Override Settings for {selectedGroup.name}
              </Heading>
            </HStack>

            <Box as="form" onSubmit={handleSubmit(onSubmit)}>
              <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                <FormControl>
                  <FormLabel fontSize="xs" color={labelColor}>
                    NTP Server
                  </FormLabel>
                  <Input
                    size="sm"
                    placeholder="inherit"
                    {...register("ntp_server")}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="xs" color={labelColor}>
                    Syslog Server
                  </FormLabel>
                  <Input
                    size="sm"
                    placeholder="inherit"
                    {...register("syslog_server")}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="xs" color={labelColor}>
                    Syslog Severity
                  </FormLabel>
                  <Input
                    size="sm"
                    placeholder="inherit"
                    {...register("syslog_severity")}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="xs" color={labelColor}>
                    DNS Server
                  </FormLabel>
                  <Input
                    size="sm"
                    placeholder="inherit"
                    {...register("dns_server")}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="xs" color={labelColor}>
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
                    <FormLabel fontSize="xs" color={labelColor}>
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
                <GridItem colSpan={{ base: 1, sm: 2 }}>
                  <FormControl>
                    <FormLabel fontSize="xs" color={labelColor}>
                      Bypassed rules
                    </FormLabel>
                    <Controller
                      control={control}
                      name="disabled_rules"
                      render={({ field }) => (
                        <DisabledRulesPicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Inherit global bypass list"
                        />
                      )}
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
                  isDisabled={!isDirty}
                >
                  Save Override
                </Button>
                {currentOverride && (
                  <Button
                    size="sm"
                    variant="outline"
                    colorScheme="red"
                    leftIcon={<Icon as={FiTrash2} />}
                    isLoading={
                      deleteMutation.isPending && pendingDelete === groupId
                    }
                    onClick={() => askDelete(groupId)}
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
              bg={cardBg}
              border="1px solid"
              borderColor={cardBorder}
              borderRadius="xl"
              p={5}
              shadow="sm"
            >
              <Flex justify="space-between" align="center" mb={4}>
                <HStack spacing={2}>
                  <Icon as={FiList} color="blue.500" boxSize={4} />
                  <Heading size="xs" color={headingColor}>
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
                  <Thead bg={headBg}>
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
                        <Td fontSize="xs" color={mutedColor}>
                          {cfg.overrideValue !== null &&
                          cfg.overrideValue !== "" ? (
                            <Text
                              as="span"
                              fontWeight="medium"
                              color={overrideColor}
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
              bg={cardBg}
              border="1px solid"
              borderColor={cardBorder}
              borderRadius="xl"
              p={5}
              shadow="sm"
            >
              <Flex justify="space-between" align="center" mb={3}>
                <HStack spacing={2}>
                  <Icon as={FiServer} color="purple.500" boxSize={4} />
                  <Heading size="xs" color={headingColor}>
                    Devices in Group ({groupDevices.length})
                  </Heading>
                </HStack>
              </Flex>

              {groupDevices.length === 0 ? (
                <Text fontSize="xs" color="gray.500" fontStyle="italic" py={2}>
                  No devices assigned to this group.
                </Text>
              ) : (
                <TableContainer maxH="220px" overflowY="auto">
                  <Table size="sm">
                    <Thead bg={headBg}>
                      <Tr>
                        <Th fontSize="xs">Hostname</Th>
                        <Th fontSize="xs">IP Address</Th>
                        <Th fontSize="xs">Platform</Th>
                        <Th fontSize="xs">Health Status</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {groupDevices.map((sw) => (
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
        bg={cardBg}
        border="1px solid"
        borderColor={cardBorder}
        borderRadius="xl"
        p={5}
        shadow="sm"
        mt={4}
      >
        <Flex justify="space-between" align="center" mb={4}>
          <HStack spacing={2}>
            <Icon as={FiLayers} color="teal.600" boxSize={4} />
            <Heading size="xs" color={headingColor}>
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
              <Thead bg={headBg}>
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
                      color={isOverride ? overrideColor : mutedColor}
                    >
                      {val}
                    </Text>
                  )

                  return (
                    <Tr
                      key={grp.id}
                      bg={isSelected ? selectedRowBg : undefined}
                      _hover={{ bg: hoverRowBg }}
                    >
                      <Td fontWeight="semibold" fontSize="xs">
                        <Text>{grp.name}</Text>
                        <Text
                          fontSize="2xs"
                          color="gray.400"
                          fontWeight="normal"
                        >
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
                          <Badge
                            colorScheme="blue"
                            variant="subtle"
                            fontSize="2xs"
                          >
                            {overrideCount} Overrides
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
                      <Td textAlign="right">
                        <HStack spacing={1} justify="flex-end">
                          <Button
                            size="xs"
                            variant="ghost"
                            colorScheme="teal"
                            leftIcon={<Icon as={FiEdit2} />}
                            onClick={() => setGroupId(grp.id)}
                          >
                            Select
                          </Button>
                          {ov && (
                            <Button
                              size="xs"
                              variant="ghost"
                              colorScheme="red"
                              isLoading={
                                deleteMutation.isPending &&
                                pendingDelete === grp.id
                              }
                              onClick={() => askDelete(grp.id)}
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

      <ConfirmActionDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => {
          deleteConfirm.onClose()
          setPendingDelete(null)
        }}
        onConfirm={() =>
          pendingDelete !== null && deleteMutation.mutate(pendingDelete)
        }
        isLoading={deleteMutation.isPending}
        title="Remove group override?"
        confirmLabel="Remove override"
      >
        <Text>
          Devices in{" "}
          <b>
            {allGroups.find((grp) => grp.id === pendingDelete)?.name ??
              "this group"}
          </b>{" "}
          will fall back to the global compliance profile on their next check.
        </Text>
      </ConfirmActionDialog>
    </VStack>
  )
}

export default GroupProfileOverrides
