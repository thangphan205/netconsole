import {
  Badge,
  Button,
  Container,
  Flex,
  FormControl,
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
import { FaRegTimesCircle, FaSearch } from "react-icons/fa"
import { GroupBase, OptionBase, Select, SingleValue } from "chakra-react-select"

import { MacAddressesService, SwitchesService } from "../../client"
import ActionsMenu from "../../components/Common/ActionsMenu"

export const Route = createFileRoute("/_layout/mac_addresses")({
  component: MacAddresses,
})

interface SwitchOption extends OptionBase {
  label: string
  value: string
}

function formatTs(ts: string | null | undefined): string {
  if (!ts) return ""
  return new Date(ts).toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

interface TableBodyProps {
  switch_id: number
  search_string: string
  showNew: boolean
}

function MacAddressesTableBody({ switch_id, search_string, showNew }: TableBodyProps) {
  // Compute fresh ISO string each fetch so the window doesn't drift
  const since24hBucket = showNew ? new Date(Date.now() - 86400000).toDateString() : null

  const { data: mac_addresses } = useSuspenseQuery({
    queryKey: ["mac_addresses", switch_id, search_string, since24hBucket],
    queryFn: async () =>
      await MacAddressesService.readMacAddresses({
        switchId: switch_id,
        search: search_string,
        since: showNew ? new Date(Date.now() - 86400000).toISOString() : undefined,
      }),
  })

  return (
    <Tbody>
      {mac_addresses.data.length === 0 ? (
        <Tr>
          <Td colSpan={7} textAlign="center" color="gray.400" py={8}>
            {showNew
              ? "No new MAC entries in the last 24 hours"
              : "No MAC entries found"}
          </Td>
        </Tr>
      ) : (
        mac_addresses.data.map((item) => {
          // Only show NEW badge in all-mode — in showNew mode every row is new
          const isNew =
            !showNew &&
            new Date(item.created_at).getTime() > Date.now() - 86400000
          return (
            <Tr key={item.id} _hover={{ bg: "gray.50" }}>
              <Td>
                {item.mac}
                {isNew && (
                  <Badge ml={2} colorScheme="green" fontSize="2xs">
                    NEW
                  </Badge>
                )}
              </Td>
              <Td>{item.interface}</Td>
              <Td>{item.vlan}</Td>
              <Td>
                {item.static === true ? (
                  <Badge colorScheme="green" variant="subtle" borderRadius="full">
                    Static
                  </Badge>
                ) : (
                  <Badge colorScheme="gray" variant="subtle" borderRadius="full">
                    Dynamic
                  </Badge>
                )}
              </Td>
              {switch_id === 0 ? (
                <Td>{item.switch_hostname}</Td>
              ) : (
                <Td>{formatTs(item.created_at)}</Td>
              )}
              <Td>{formatTs(item.updated_at)}</Td>
              <Td>
                <ActionsMenu
                  type={"MacAddress"}
                  value={item}
                  name={item.mac}
                />
              </Td>
            </Tr>
          )
        })
      )}
    </Tbody>
  )
}

function MacAddressesContent() {
  const [switch_id, set_switch_id] = useState<number>(0)
  const [search_character, set_search_character] = useState("")
  const [search_string, set_search_string] = useState("")
  const [showNew, setShowNew] = useState(false)

  const { data: switches } = useSuspenseQuery({
    queryKey: ["switches"],
    queryFn: async () => await SwitchesService.readSwitches({}),
  })

  const optionSwitches: SwitchOption[] = [
    { value: "0", label: "All switches" },
    ...switches.data.map((item) => ({
      value: String(item.id),
      label: item.ipaddress + " - " + item.hostname + " - " + item.model,
    })),
  ]

  const handleSelectChange = (newValue: SingleValue<SwitchOption>) => {
    if (newValue) set_switch_id(Number(newValue.value))
  }

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.code === "Enter") set_search_string(search_character)
  }

  const handleClear = () => {
    set_search_string("")
    set_search_character("")
  }

  return (
    <>
      {/* Toolbar */}
      <Flex gap={3} mb={4} flexWrap="wrap" align="center">
        {/* Switch selector — left, maxW 420px */}
        <FormControl maxW="420px">
          <Select<SwitchOption, false, GroupBase<SwitchOption>>
            name="switch_id"
            options={optionSwitches}
            placeholder="Select switch..."
            isMulti={false}
            onChange={handleSelectChange}
          />
        </FormControl>

        {/* New (24h) toggle button — middle */}
        <Button
          size="sm"
          colorScheme={showNew ? "green" : "gray"}
          variant={showNew ? "solid" : "outline"}
          onClick={() => setShowNew((v) => !v)}
          whiteSpace="nowrap"
        >
          New (24h)
        </Button>

        {/* Search input — right, ml="auto" */}
        <InputGroup maxW="280px" ml="auto">
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

      {/* Table */}
      <TableContainer>
        <Table size={{ base: "sm", md: "md" }}>
          <Thead>
            <Tr _hover={{ bg: "gray.50" }}>
              <Th>MAC Address</Th>
              <Th>Interface</Th>
              <Th>VLAN</Th>
              <Th>Static</Th>
              {switch_id === 0 ? <Th>Switch</Th> : <Th>First Seen</Th>}
              <Th>Last Seen</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <ErrorBoundary
            fallbackRender={({ error }) => (
              <Tbody>
                <Tr>
                  <Td colSpan={7}>Something went wrong: {error.message}</Td>
                </Tr>
              </Tbody>
            )}
          >
            <Suspense
              fallback={
                <Tbody>
                  {new Array(5).fill(null).map((_, index) => (
                    <Tr key={index} _hover={{ bg: "gray.50" }}>
                      {new Array(7).fill(null).map((_, i) => (
                        <Td key={i}>
                          <Skeleton height="16px" />
                        </Td>
                      ))}
                    </Tr>
                  ))}
                </Tbody>
              }
            >
              <MacAddressesTableBody
                switch_id={switch_id}
                search_string={search_string}
                showNew={showNew}
              />
            </Suspense>
          </ErrorBoundary>
        </Table>
      </TableContainer>
    </>
  )
}

function MacAddresses() {
  return (
    <Container maxW="full">
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12} pb={4}>
        MAC Address Table
      </Heading>
      <ErrorBoundary
        fallbackRender={({ error }) => (
          <Td colSpan={7}>Something went wrong: {error.message}</Td>
        )}
      >
        <Suspense fallback={<Skeleton height="16px" />}>
          <MacAddressesContent />
        </Suspense>
      </ErrorBoundary>
    </Container>
  )
}
