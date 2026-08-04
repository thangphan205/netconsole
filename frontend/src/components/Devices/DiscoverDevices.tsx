import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormLabel,
  HStack,
  Icon,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Progress,
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
import { type MultiValue, type OptionBase, Select } from "chakra-react-select"
import { useRef, useState } from "react"
import { FiSearch } from "react-icons/fi"

import {
  type ApiError,
  CredentialsService,
  type DeviceCreate,
  DevicesService,
  type DiscoveryCandidatePublic,
  type DiscoveryHostPublic,
  GroupsService,
} from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

interface DiscoverDevicesProps {
  isOpen: boolean
  onClose: () => void
}

interface Option extends OptionBase {
  label: string
  value: string
}

const optionPlatform: Option[] = [
  { label: "Cisco IOS", value: "ios" },
  { label: "Cisco Nexus SSH", value: "nxos_ssh" },
  { label: "Juniper JunOS", value: "junos" },
  { label: "Arista EOS", value: "eos" },
]
const DEVICE_TYPE_FOR_PLATFORM: Record<string, string> = {
  ios: "cisco_ios",
  nxos_ssh: "cisco_nxos",
  junos: "juniper_junos",
  eos: "arista_eos",
}

const STATUS_COLORS: Record<string, string> = {
  identified: "green",
  unknown_platform: "yellow",
  auth_failed: "red",
  unreachable: "gray",
  error: "red",
}

const IDENTIFY_CHUNK = 10

type Phase = "form" | "identifying" | "review"

// Local editable candidate row
interface Row extends DiscoveryCandidatePublic {
  editHostname: string
  editPlatform: string
}

const DiscoverDevices = ({ isOpen, onClose }: DiscoverDevicesProps) => {
  const showToast = useCustomToast()
  const queryClient = useQueryClient()
  const cancelRef = useRef(false)

  const [phase, setPhase] = useState<Phase>("form")
  const [cidr, setCidr] = useState("")
  const [port, setPort] = useState(22)
  const [credentialIds, setCredentialIds] = useState<number[]>([])
  const [groupsList, setGroupsList] = useState<string>("")
  const [existingHosts, setExistingHosts] = useState<DiscoveryHostPublic[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [log, setLog] = useState<string[]>([])
  const [addErrors, setAddErrors] = useState<
    { hostname: string; ipaddress: string; detail: string }[]
  >([])

  const { data: credentials } = useQuery({
    queryKey: ["credentials"],
    queryFn: () => CredentialsService.readCredentials({}),
    enabled: isOpen,
  })
  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: () => GroupsService.readGroups({}),
    enabled: isOpen,
  })

  const optionCredentials: { label: string; value: number }[] = (
    credentials?.data ?? []
  ).map((c) => ({ label: `${c.id} - ${c.username}`, value: c.id }))
  const defaultCredentials = (credentials?.data ?? [])
    .filter((c) => c.default)
    .map((c) => ({ label: `${c.id} - ${c.username}`, value: c.id }))

  const optionGroups: Option[] = (groups?.data ?? []).map((g) => ({
    label: `${g.name} - ${g.site}`,
    value: g.name,
  }))

  const onApiError = (err: ApiError) => {
    const errDetail = (err.body as any)?.detail
    showToast("Request failed.", `${errDetail}`, "error")
  }

  const appendLog = (lines: string[]) =>
    setLog((prev) => [...prev, ...lines])

  const runIdentify = async (hosts: DiscoveryHostPublic[]) => {
    const targets = hosts.filter((h) => !h.existing).map((h) => h.ip)
    setProgress({ done: 0, total: targets.length })
    setLog([])
    const collected: Row[] = []
    for (let i = 0; i < targets.length; i += IDENTIFY_CHUNK) {
      if (cancelRef.current) return
      const chunk = targets.slice(i, i + IDENTIFY_CHUNK)
      appendLog([`Trying ${chunk.join(", ")}…`])
      try {
        const res = await DevicesService.discoveryIdentify({
          requestBody: { ips: chunk, port, credential_ids: credentialIds },
        })
        for (const c of res.candidates) {
          collected.push({
            ...c,
            editHostname: c.hostname ?? "",
            editPlatform: c.platform ?? "",
          })
        }
        setRows([...collected])
        appendLog(
          res.candidates.map((c) => {
            const parts = [`${c.ip}: ${c.status}`]
            if (c.platform) parts.push(`platform=${c.platform}`)
            if (c.hostname) parts.push(`hostname=${c.hostname}`)
            if (c.error) parts.push(`error=${c.error}`)
            return parts.join(" — ")
          }),
        )
      } catch (err) {
        onApiError(err as ApiError)
        appendLog([`Chunk ${chunk.join(", ")} failed: request error`])
      }
      setProgress({
        done: Math.min(i + IDENTIFY_CHUNK, targets.length),
        total: targets.length,
      })
    }
    // Preselect identified rows with a hostname + platform
    const preselect = new Set<string>()
    for (const r of collected) {
      if (r.status === "identified" && r.editHostname && r.editPlatform) {
        preselect.add(r.ip)
      }
    }
    setSelected(preselect)
    if (!cancelRef.current) setPhase("review")
  }

  const scanMutation = useMutation({
    mutationFn: () =>
      DevicesService.discoveryScan({
        requestBody: { cidr, port, tcp_timeout: 1.0 },
      }),
    onSuccess: async (res) => {
      setExistingHosts(res.hosts.filter((h) => h.existing))
      const openNew = res.hosts.filter((h) => !h.existing)
      if (openNew.length === 0) {
        showToast(
          "Scan complete",
          `${res.open_count} open, none new to identify.`,
          "success",
        )
        setPhase("review")
        setRows([])
        return
      }
      setPhase("identifying")
      cancelRef.current = false
      await runIdentify(res.hosts)
    },
    onError: onApiError,
  })

  const addMutation = useMutation({
    mutationFn: (payload: DeviceCreate[]) =>
      DevicesService.discoveryAdd({ requestBody: { devices: payload } }),
    onSuccess: (res) => {
      setAddErrors(res.errors)
      showToast(
        "Discovery add",
        `${res.created.length} added, ${res.errors.length} skipped.`,
        res.errors.length ? "error" : "success",
      )
      queryClient.invalidateQueries({ queryKey: ["devices"] })
      if (res.errors.length === 0) onModalClose()
    },
    onError: onApiError,
  })

  const toggle = (ip: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(ip) ? next.delete(ip) : next.add(ip)
      return next
    })
  }

  const updateRow = (ip: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.ip === ip ? { ...r, ...patch } : r)))
  }

  const canAddRow = (r: Row) =>
    !!r.editHostname &&
    !!r.editPlatform &&
    /^[a-zA-Z0-9_]+$/.test(r.editHostname)

  const onAdd = () => {
    const payload: DeviceCreate[] = rows
      .filter((r) => selected.has(r.ip) && canAddRow(r))
      .map((r) => ({
        hostname: r.editHostname,
        ipaddress: r.ip,
        port: r.port,
        platform: r.editPlatform,
        device_type: DEVICE_TYPE_FOR_PLATFORM[r.editPlatform] ?? "",
        vendor: r.vendor ?? "",
        model: r.model ?? "",
        os_version: r.os_version ?? "",
        serial_number: r.serial_number ?? "",
        credential_id: r.credential_id ?? 0,
        groups: groupsList,
      }))
    if (payload.length === 0) {
      showToast("Nothing to add", "Select at least one valid row.", "error")
      return
    }
    addMutation.mutate(payload)
  }

  const onModalClose = () => {
    cancelRef.current = true
    setPhase("form")
    setCidr("")
    setRows([])
    setExistingHosts([])
    setSelected(new Set())
    setAddErrors([])
    setProgress({ done: 0, total: 0 })
    setLog([])
    onClose()
  }

  const selectableCount = rows.filter(
    (r) => selected.has(r.ip) && canAddRow(r),
  ).length

  return (
    <Modal
      isOpen={isOpen}
      onClose={onModalClose}
      size={{ base: "full", md: "4xl", lg: "6xl" }}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Discover Devices</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {phase === "form" && (
            <VStack spacing={4} align="stretch">
              <FormControl isRequired>
                <FormLabel fontSize="sm">Subnet (CIDR)</FormLabel>
                <Input
                  placeholder="10.0.0.0/24"
                  value={cidr}
                  onChange={(e) => setCidr(e.target.value)}
                  fontFamily="mono"
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">SSH Port</FormLabel>
                <Input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value) || 22)}
                  maxW="140px"
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="sm">Credentials to try</FormLabel>
                <Select
                  isMulti
                  options={optionCredentials}
                  defaultValue={defaultCredentials}
                  placeholder="Select credentials…"
                  onChange={(
                    vals: MultiValue<{ label: string; value: number }>,
                  ) => setCredentialIds(vals.map((v) => v.value))}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">
                  Groups (applied to all added)
                </FormLabel>
                <Select
                  isMulti
                  options={optionGroups}
                  placeholder="Select groups…"
                  onChange={(vals: MultiValue<Option>) =>
                    setGroupsList(vals.map((v) => v.value).join())
                  }
                />
              </FormControl>
            </VStack>
          )}

          {phase === "identifying" && (
            <VStack spacing={4} align="stretch">
              <Text fontSize="sm">
                Identifying {progress.done}/{progress.total} hosts…
              </Text>
              <Progress
                value={
                  progress.total ? (progress.done / progress.total) * 100 : 0
                }
                size="sm"
                colorScheme="blue"
                borderRadius="md"
              />
              <Box
                fontFamily="mono"
                fontSize="xs"
                bg="gray.900"
                color="gray.100"
                borderRadius="md"
                p={3}
                maxH="300px"
                overflowY="auto"
                whiteSpace="pre-wrap"
              >
                {log.length === 0 ? (
                  <Text color="gray.500">Waiting for results…</Text>
                ) : (
                  log.map((line, i) => <Text key={i}>{line}</Text>)
                )}
              </Box>
            </VStack>
          )}

          {phase === "review" && (
            <VStack spacing={4} align="stretch">
              {existingHosts.length > 0 && (
                <Alert status="info" borderRadius="md" fontSize="sm">
                  <AlertIcon />
                  {existingHosts.length} scanned host(s) already registered and
                  skipped.
                </Alert>
              )}
              {addErrors.length > 0 && (
                <Alert status="warning" borderRadius="md" fontSize="sm">
                  <AlertIcon />
                  <VStack align="start" spacing={0}>
                    {addErrors.map((e) => (
                      <Text key={e.ipaddress}>
                        {e.ipaddress} ({e.hostname}): {e.detail}
                      </Text>
                    ))}
                  </VStack>
                </Alert>
              )}
              {rows.length === 0 ? (
                <Alert status="info" borderRadius="md" fontSize="sm">
                  <AlertIcon />
                  No new candidates identified.
                </Alert>
              ) : (
                <TableContainer>
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th />
                        <Th>IP</Th>
                        <Th>Hostname</Th>
                        <Th>Platform</Th>
                        <Th>Vendor / Model</Th>
                        <Th>OS</Th>
                        <Th>Serial</Th>
                        <Th>Status</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {rows.map((r) => (
                        <Tr key={r.ip}>
                          <Td>
                            <Checkbox
                              isChecked={selected.has(r.ip)}
                              isDisabled={!canAddRow(r)}
                              onChange={() => toggle(r.ip)}
                            />
                          </Td>
                          <Td fontFamily="mono" fontSize="xs">
                            {r.ip}
                          </Td>
                          <Td>
                            <Input
                              size="xs"
                              value={r.editHostname}
                              onChange={(e) =>
                                updateRow(r.ip, {
                                  editHostname: e.target.value,
                                })
                              }
                              minW="120px"
                            />
                          </Td>
                          <Td minW="180px">
                            {r.platform ? (
                              <Text fontSize="xs">{r.platform}</Text>
                            ) : (
                              <Select<Option>
                                size="sm"
                                options={optionPlatform}
                                placeholder="Pick…"
                                chakraStyles={{
                                  menuList: (provided) => ({
                                    ...provided,
                                    minW: "max-content",
                                  }),
                                  option: (provided) => ({
                                    ...provided,
                                    whiteSpace: "nowrap",
                                  }),
                                }}
                                onChange={(v) =>
                                  updateRow(r.ip, {
                                    editPlatform: (v as Option)?.value ?? "",
                                  })
                                }
                              />
                            )}
                          </Td>
                          <Td fontSize="xs">
                            {r.vendor ?? "—"} / {r.model ?? "—"}
                          </Td>
                          <Td fontSize="xs">{r.os_version ?? "—"}</Td>
                          <Td fontSize="xs">{r.serial_number ?? "—"}</Td>
                          <Td>
                            <Badge
                              colorScheme={STATUS_COLORS[r.status] ?? "gray"}
                              variant="subtle"
                            >
                              {r.status}
                            </Badge>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>
              )}
            </VStack>
          )}
        </ModalBody>

        <ModalFooter gap={3}>
          <Button variant="ghost" onClick={onModalClose}>
            Close
          </Button>
          {phase === "form" && (
            <Button
              colorScheme="blue"
              leftIcon={<Icon as={FiSearch} />}
              isLoading={scanMutation.isPending}
              loadingText="Scanning…"
              isDisabled={!cidr || credentialIds.length === 0}
              onClick={() => scanMutation.mutate()}
            >
              Scan
            </Button>
          )}
          {phase === "review" && (
            <HStack>
              <Button
                variant="outline"
                onClick={() => {
                  setPhase("form")
                  setRows([])
                  setSelected(new Set())
                }}
              >
                New Scan
              </Button>
              <Button
                colorScheme="blue"
                isLoading={addMutation.isPending}
                loadingText="Adding…"
                isDisabled={selectableCount === 0}
                onClick={onAdd}
              >
                Add {selectableCount} selected
              </Button>
            </HStack>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default DiscoverDevices
