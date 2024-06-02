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
import { ArpsService, SwitchesService } from "../../client"
// import ActionsMenu from "../../components/Common/ActionsMenu"
// import Navbar from "../../components/Common/Navbar"
import { useState, ChangeEvent } from "react";



export const Route = createFileRoute("/_layout/arps")({
  component: Arps,
})

function ArpsTableBody() {

  const [switch_id, set_switch_id] = useState<number | undefined>(0);
  const { data: switches } = useSuspenseQuery({
    queryKey: ["switches"],
    queryFn: async () => await SwitchesService.readSwitches({}),
  })

  const { data: arps } = useSuspenseQuery({
    queryKey: ["arps", switch_id],
    queryFn: async () => await ArpsService.readArps({ switchId: switch_id }),
  })

  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    set_switch_id(Number(event.target.value));

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
          <Th>IP Address</Th>
          <Th>MAC Address</Th>
          <Th>Interface</Th>
          {
            switch_id === 0 ? (
              <Th>Switch</Th>
            ) : (
              <Th>Age</Th>
            )
          }
          <Th>First Seen</Th>
          <Th>Last Seen</Th>
        </Tr>
      </Thead>
      <Tbody>
        {arps.data.map((item) => (
          <Tr key={item.id}>
            <Td>{item.id}</Td>
            <Td>{item.ip}</Td>
            <Td>{item.mac}</Td>
            <Td>{item.interface}</Td>
            {
              switch_id === 0 ? (
                <Td>{item.switch_hostname}</Td>
              ) : (
                <Td>{item.age}</Td>

              )
            }
            <Td>{item.created_at}</Td>
            <Td>{item.updated_at}</Td>
          </Tr>
        ))}
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
      {/* <Navbar type={"Arp"} /> */}
      <ArpsTable />
    </Container>
  )
}
