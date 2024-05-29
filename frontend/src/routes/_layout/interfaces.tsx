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
import { InterfacesService, SwitchesService } from "../../client"
import ActionsMenu from "../../components/Common/ActionsMenu"
import Navbar from "../../components/Common/Navbar"
import { useState, ChangeEvent } from "react";



export const Route = createFileRoute("/_layout/interfaces")({
  component: Interfaces,
})

function InterfacesTableBody() {

  let switch_id = "0";
  if (localStorage.getItem("switch_id")) {
    switch_id = String(localStorage.getItem("switch_id"));
  }

  const [selectedValue, setSelectedValue] = useState<string | undefined>(switch_id);;

  const { data: switches } = useSuspenseQuery({
    queryKey: ["switches"],
    queryFn: async () => await SwitchesService.readSwitches({}),
  })

  const { data: interfaces } = useSuspenseQuery({
    queryKey: ["interfaces", selectedValue],
    queryFn: async () => await InterfacesService.readInterfaces({ switchId: Number(switch_id) }),
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
          <Th>Port</Th>
          <Th>Description</Th>
          <Th>Status</Th>
          <Th>Vlan</Th>
          <Th>Mode</Th>
          <Th>Speed</Th>
          <Th>Actions</Th>
        </Tr>
      </Thead>
      <Tbody>
        {interfaces.data.map((item) => (
          <Tr key={item.id}>
            <Td>{item.id}</Td>
            <Td>{item.port}</Td>
            <Td>{item.description}</Td>
            <Td>{item.status}</Td>
            <Td>{item.vlan}</Td>
            <Td>{item.mode}</Td>
            <Td>{item.speed}</Td>
            <Td>
              <ActionsMenu type={"Interface"} value={item} />
            </Td>
          </Tr>
        ))}
      </Tbody>

    </>
  )
}
function InterfacesTable() {

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
            <InterfacesTableBody />
          </Suspense>
        </ErrorBoundary>
      </Table>
    </TableContainer>
  )
}

function Interfaces() {
  return (
    <Container maxW="full">
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        Interfaces Management
      </Heading>
      <Navbar type={"Interface"} />
      <InterfacesTable />
    </Container>
  )
}
