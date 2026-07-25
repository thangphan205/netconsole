import {
  Container,
  Flex,
  Heading,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Skeleton,
  Table,
  TableContainer,
  Tag,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  type GroupBase,
  type OptionBase,
  Select,
  type SingleValue,
} from "chakra-react-select"
import type React from "react"
import { Suspense, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { FaRegTimesCircle, FaSearch } from "react-icons/fa"
import { DevicesService, IpInterfacesService } from "../../client"
import ActionsMenu from "../../components/Common/ActionsMenu"
import { formatTimestamp } from "../../utils"

export const Route = createFileRoute("/_layout/ip_interfaces")({
  component: IpInterfaces,
})

interface DeviceOption extends OptionBase {
  label: string
  value: string
}

interface TableBodyProps {
  device_id: number
  search_string: string
}

function IpInterfacesTableBody({ device_id, search_string }: TableBodyProps) {
  const { data: ip_interfaces } = useSuspenseQuery({
    queryKey: ["ip_interfaces", device_id, search_string],
    queryFn: async () =>
      await IpInterfacesService.readIpInterfaces({
        deviceId: device_id || undefined,
        search: search_string,
      }),
  })

  if (!ip_interfaces.data.length) {
    return (
      <Tbody>
        <Tr>
          <Td colSpan={5} textAlign="center" color="gray.500">
            No IP interfaces found.
          </Td>
        </Tr>
      </Tbody>
    )
  }

  return (
    <Tbody>
      {ip_interfaces.data.map((item) => (
        <Tr key={item.id} _hover={{ bg: "gray.50" }}>
          <Td>{item.device_hostname}</Td>
          <Td>{item.interface}</Td>
          <Td>
            <Flex gap={1} flexWrap="wrap">
              {item.ipv4
                ? item.ipv4.split(",").map((ip, idx) => (
                    <Tag key={idx} colorScheme="blue" size="sm">
                      {ip.trim()}
                    </Tag>
                  ))
                : null}
            </Flex>
          </Td>
          <Td>{formatTimestamp(item.updated_at)}</Td>
          <Td>
            <ActionsMenu type={"IpInterface"} value={item} name={item.ipv4} />
          </Td>
        </Tr>
      ))}
    </Tbody>
  )
}

function IpInterfacesContent() {
  const [device_id, set_device_id] = useState<number>(0)
  const [search_character, set_search_character] = useState("")
  const [search_string, set_search_string] = useState("")

  const { data: devices } = useSuspenseQuery({
    queryKey: ["devices"],
    queryFn: async () => await DevicesService.readDevices({}),
  })

  const optionDevices: DeviceOption[] = devices.data.map((item) => ({
    value: String(item.id),
    label: `${item.hostname} · ${item.ipaddress}`,
  }))

  const handleSelectChange = (newValue: SingleValue<DeviceOption>) => {
    if (newValue) {
      set_device_id(Number(newValue.value))
    } else {
      set_device_id(0)
    }
  }

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      set_search_string(search_character)
    }
  }

  const handleClear = () => {
    set_search_string("")
    set_search_character("")
  }

  return (
    <>
      <Flex gap={3} mb={4} flexWrap="wrap" align="center">
        <Select<DeviceOption, false, GroupBase<DeviceOption>>
          name="device_id"
          options={optionDevices}
          placeholder="Select device..."
          isMulti={false}
          isClearable
          onChange={handleSelectChange}
          chakraStyles={{
            container: (provided) => ({
              ...provided,
              maxW: "420px",
              flex: "1",
            }),
          }}
        />
        <InputGroup ml="auto" maxW="260px">
          <InputLeftElement pointerEvents="none">
            <Icon as={FaSearch} color="ui.dim" />
          </InputLeftElement>
          <Input
            type="text"
            placeholder="Search"
            fontSize={{ base: "sm", md: "inherit" }}
            borderRadius="8px"
            value={search_character}
            onChange={(e) => set_search_character(e.target.value)}
            onKeyDown={handleSearch}
          />
          <InputRightElement>
            {search_character && (
              <IconButton
                aria-label="Clear"
                icon={<Icon as={FaRegTimesCircle} />}
                size="xs"
                variant="ghost"
                onClick={handleClear}
              />
            )}
          </InputRightElement>
        </InputGroup>
      </Flex>

      {device_id === 0 && (
        <Text fontSize="sm" color="gray.400" mb={3}>
          Showing all IP interfaces across all devices. Select a device to
          filter.
        </Text>
      )}

      <TableContainer>
        <Table size={{ base: "sm", md: "md" }}>
          <Thead>
            <Tr>
              <Th>Device</Th>
              <Th>Interface</Th>
              <Th>IPv4</Th>
              <Th>Last Sync</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <ErrorBoundary
            fallbackRender={({ error }) => (
              <Tbody>
                <Tr>
                  <Td colSpan={5}>Something went wrong: {error.message}</Td>
                </Tr>
              </Tbody>
            )}
          >
            <Suspense
              fallback={
                <Tbody>
                  {new Array(5).fill(null).map((_, rowIdx) => (
                    <Tr key={rowIdx}>
                      {new Array(5).fill(null).map((_, colIdx) => (
                        <Td key={colIdx}>
                          <Skeleton height="16px" width="100%" />
                        </Td>
                      ))}
                    </Tr>
                  ))}
                </Tbody>
              }
            >
              <IpInterfacesTableBody
                device_id={device_id}
                search_string={search_string}
              />
            </Suspense>
          </ErrorBoundary>
        </Table>
      </TableContainer>
    </>
  )
}

function IpInterfaces() {
  return (
    <Container maxW="full">
      <Heading
        size="lg"
        textAlign={{ base: "center", md: "left" }}
        pt={12}
        mb={4}
      >
        IP Interfaces
      </Heading>
      <Suspense fallback={null}>
        <IpInterfacesContent />
      </Suspense>
    </Container>
  )
}
