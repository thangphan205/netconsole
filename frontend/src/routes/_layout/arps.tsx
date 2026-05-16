import {
  Badge,
  Button,
  Container,
  Flex,
  FormControl,
  Heading,
  Icon,
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

import { ArpsService, SwitchesService } from "../../client"
import ActionsMenu from "../../components/Common/ActionsMenu"

export const Route = createFileRoute("/_layout/arps")({
  component: Arps,
})

interface SwitchOption extends OptionBase {
  label: string
  value: string
}

function ArpsTableBody() {
  const [switch_id, set_switch_id] = useState<number | undefined>(0)
  const [search_character, set_search_character] = useState("")
  const [search_string, set_search_string] = useState("")
  const [showNew, setShowNew] = useState(false)

  // Daily bucket so the key advances at midnight — prevents stale 24h window
  const since24hBucket = showNew ? new Date(Date.now() - 86400000).toDateString() : null

  const { data: switches } = useSuspenseQuery({
    queryKey: ["switches"],
    queryFn: async () => await SwitchesService.readSwitches({}),
  })

  const { data: arps } = useSuspenseQuery({
    queryKey: ["arps", switch_id, search_string, since24hBucket],
    queryFn: async () =>
      await ArpsService.readArps({
        switchId: switch_id,
        search: search_string,
        // Compute fresh ISO string each fetch so the window doesn't drift
        since: showNew ? new Date(Date.now() - 86400000).toISOString() : undefined,
      }),
  })

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

  const optionSwitches: SwitchOption[] = switches.data.map((item) => ({
    value: String(item.id),
    label: item.ipaddress + " - " + item.hostname + " - " + item.model,
  }))

  return (
    <>
      <Thead>
        <Tr>
          <Th colSpan={4}>
            <FormControl>
              <Select<SwitchOption, false, GroupBase<SwitchOption>>
                name="switch_id"
                options={optionSwitches}
                placeholder="Select switch..."
                isMulti={false}
                onChange={handleSelectChange}
              />
            </FormControl>
          </Th>
          <Th colSpan={4}>
            <Flex gap={2} align="center">
              <InputGroup flex={1}>
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
                    <Button onClick={handleClear} borderRadius="10px">
                      <Icon as={FaRegTimesCircle} />
                    </Button>
                  )}
                </InputRightElement>
              </InputGroup>
              <Button
                size="sm"
                colorScheme={showNew ? "green" : "gray"}
                variant={showNew ? "solid" : "outline"}
                onClick={() => setShowNew((v) => !v)}
                whiteSpace="nowrap"
              >
                New (24h)
                {showNew && arps.count > 0 && (
                  <Badge ml={2} colorScheme="green" variant="solid">
                    {arps.count}
                  </Badge>
                )}
              </Button>
            </Flex>
          </Th>
        </Tr>
        <Tr>
          <Th>ID</Th>
          <Th>IP Address</Th>
          <Th>MAC Address</Th>
          <Th>Interface</Th>
          {switch_id === 0 ? <Th>Switch</Th> : <Th>Age</Th>}
          <Th>Action</Th>
          <Th>First Seen</Th>
          <Th>Last Seen</Th>
        </Tr>
      </Thead>
      <Tbody>
        {arps.data.length === 0 ? (
          <Tr>
            <Td colSpan={8} textAlign="center" color="gray.400" py={8}>
              {showNew
                ? "No new ARP entries in the last 24 hours"
                : "No ARP entries found"}
            </Td>
          </Tr>
        ) : (
          arps.data.map((item) => {
            // Only show NEW badge in all-mode — in showNew mode every row is new
            const isNew =
              !showNew &&
              new Date(item.created_at).getTime() > Date.now() - 86400000
            return (
              <Tr key={item.id}>
                <Td>{item.id}</Td>
                <Td>
                  {item.ip}
                  {isNew && (
                    <Badge ml={2} colorScheme="green" fontSize="2xs">
                      NEW
                    </Badge>
                  )}
                </Td>
                <Td>{item.mac}</Td>
                <Td>{item.interface}</Td>
                {switch_id === 0 ? (
                  <Td>{item.switch_hostname}</Td>
                ) : (
                  <Td>{item.age}</Td>
                )}
                <Td>
                  <ActionsMenu type={"Arp"} value={item} name={item.ip} />
                </Td>
                <Td>{item.created_at}</Td>
                <Td>{item.updated_at}</Td>
              </Tr>
            )
          })
        )}
      </Tbody>
    </>
  )
}

function ArpsTable() {
  return (
    <TableContainer>
      <Table size={{ base: "sm", md: "md" }}>
        <ErrorBoundary
          fallbackRender={({ error }) => (
            <Tbody>
              <Tr>
                <Td colSpan={8}>Something went wrong: {error.message}</Td>
              </Tr>
            </Tbody>
          )}
        >
          <Suspense
            fallback={
              <Tbody>
                {new Array(5).fill(null).map((_, index) => (
                  <Tr key={index}>
                    {new Array(8).fill(null).map((_, i) => (
                      <Td key={i}>
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
            <ArpsTableBody />
          </Suspense>
        </ErrorBoundary>
      </Table>
    </TableContainer>
  )
}

function Arps() {
  return (
    <Container maxW="full">
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        Arps Management
      </Heading>
      <ArpsTable />
    </Container>
  )
}
