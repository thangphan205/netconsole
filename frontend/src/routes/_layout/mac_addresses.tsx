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
} from "@chakra-ui/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { MacAddressesService, SwitchesService } from "../../client"
// import ActionsMenu from "../../components/Common/ActionsMenu"
// import Navbar from "../../components/Common/Navbar"
import { useState, ChangeEvent } from "react";



export const Route = createFileRoute("/_layout/mac_addresses")({
  component: MacAddresses,
})

function MacAddressesTableBody() {

  let switch_id = "0";
  if (localStorage.getItem("switch_id")) {
    switch_id = String(localStorage.getItem("switch_id"));
  }

  const [selectedValue, setSelectedValue] = useState<string | undefined>(switch_id);;

  const { data: switches } = useSuspenseQuery({
    queryKey: ["switches"],
    queryFn: async () => await SwitchesService.readSwitches({}),
  })

  const { data: mac_addresses } = useSuspenseQuery({
    queryKey: ["mac_addresses", selectedValue],
    queryFn: async () => await MacAddressesService.readMacAddresses({ switchId: Number(switch_id) }),
  })

  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedValue(event.target.value);
    localStorage.setItem("switch_id", event.target.value);
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
                  value={selectedValue}
                  onChange={handleSelectChange}
                >
                  <option key="0" value="0">All Switches</option>
                  {
                    switches ? (switches.data.map((item) => (
                      item.id === Number(switch_id) ?
                        (<option key={item.id} value={item.id} style={{ color: "blue" }}>Current data: {item.hostname} - {item.ipaddress}</option>)
                        : (<option key={item.id} value={item.id} style={{ color: "red" }}>Need refresh Data: {item.hostname} - {item.ipaddress}</option>)
                    ))) : null
                  }
                </Select>
              </InputGroup>
            </FormControl>
          </Th>
        </Tr>
        <Tr>
          <Th>ID</Th>
          <Th>MAC</Th>
          <Th>Interface</Th>
          <Th>vlan</Th>
          <Th>Static</Th>
          <Th>First Seen</Th>
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
            <Td>{item.created_at}</Td>
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
