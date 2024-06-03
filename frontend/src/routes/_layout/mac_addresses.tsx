import {
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
  Select,
  FormControl,
  InputGroup,
  InputLeftAddon,
  Input,
  InputLeftElement,
  Icon
} from "@chakra-ui/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { MacAddressesService, SwitchesService } from "../../client"
// import ActionsMenu from "../../components/Common/ActionsMenu"
// import Navbar from "../../components/Common/Navbar"
import { useState, ChangeEvent } from "react";
import { FaSearch, } from "react-icons/fa"



export const Route = createFileRoute("/_layout/mac_addresses")({
  component: MacAddresses,
})



function MacAddressesTableBody() {
  const [switch_id, set_switch_id] = useState<number | undefined>(0);
  const [input_search, set_input_search] = useState('');
  const [mac_search, set_mac_search] = useState('');

  const { data: switches } = useSuspenseQuery({
    queryKey: ["switches"],
    queryFn: async () => await SwitchesService.readSwitches({}),
  })
  const { data: mac_addresses } = useSuspenseQuery({
    queryKey: ["mac_addresses", switch_id, mac_search],
    queryFn: async () => await MacAddressesService.readMacAddresses({ switchId: switch_id, mac: mac_search }),
  })
  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    set_switch_id(Number(event.target.value));
  };

  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
    set_input_search(event.target.value)

  }
  const handleKeyDown = (e: any) => {
    console.log(e.target.value);
    if (e.code === "Enter") {
      set_mac_search(e.target.value)
    }
  };
  return (
    <>

      <Thead>
        <Tr>
          <Th colSpan={8}>
            <FormControl mt={4}>
              <InputGroup>
                <InputLeftAddon>Switch: </InputLeftAddon>
                <Select
                  placeholder="Select Switch"
                  value={switch_id}
                  onChange={handleSelectChange}
                >
                  <option key="0" value="0">All Switches</option>
                  {
                    switches ? (switches.data.map((item) => (
                      item.id === Number(switch_id) ?
                        (<option key={item.id} value={item.id} style={{ color: "blue" }}>Current data: {item.hostname} - {item.ipaddress}</option>)
                        : (<option key={item.id} value={item.id} style={{ color: "red" }}>{item.hostname} - {item.ipaddress}</option>)
                    ))) : null
                  }
                </Select>
              </InputGroup>
            </FormControl>
          </Th>
        </Tr>
        <Tr>
          <Th>ID</Th>
          <Th>
            <InputGroup w={{ base: '100%', md: 'auto' }}>
              <InputLeftElement pointerEvents='none'>
                <Icon as={FaSearch} color='ui.dim' />
              </InputLeftElement>
              <Input type='text' placeholder='MAC Search' onChange={handleSearch} onKeyDown={handleKeyDown} value={input_search} />
            </InputGroup>
          </Th>
          <Th>Interface</Th>
          <Th>vlan</Th>
          <Th>Static</Th>
          {
            switch_id === 0 ? (
              <Th>Switch</Th>
            ) : (
              <Th>First Seen</Th>
            )
          }
          <Th>Last Seen</Th>
        </Tr>
      </Thead>
      <Tbody>
        {mac_addresses.data.map((item) => (
          <Tr key={item.id}>
            <Td>{item.id}</Td>
            <Td>{item.mac}</Td>
            <Td>{item.interface}</Td>
            <Td>{item.vlan}</Td>
            <Td>{String(item.static)}</Td>
            {
              switch_id === 0 ? (
                <Td>{item.switch_hostname}</Td>
              ) : (
                <Td>{item.created_at}</Td>

              )
            }
            <Td>{item.updated_at}</Td>
          </Tr>
        ))}
      </Tbody>

    </>
  )
}
function MacAddressesTable() {

  return (
    <TableContainer>
      <Table size={{ base: "sm", md: "md" }}>
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
            <MacAddressesTableBody />
          </Suspense>
        </ErrorBoundary>
      </Table>
    </TableContainer>
  )
}

function MacAddresses() {
  return (
    <Container maxW="full">
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        MacAddresses Management
      </Heading>
      {/* <Navbar type={"MacAddress"} /> */}
      <MacAddressesTable />
    </Container>
  )
}
