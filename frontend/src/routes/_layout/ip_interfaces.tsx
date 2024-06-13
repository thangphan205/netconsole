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
  FormControl,
  InputGroup,
  Input,
  InputLeftElement,
  Icon
} from "@chakra-ui/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { IpInterfacesService, SwitchesService } from "../../client"
// import ActionsMenu from "../../components/Common/ActionsMenu"
// import Navbar from "../../components/Common/Navbar"
import { useState, ChangeEvent } from "react";
import { FaSearch, } from "react-icons/fa"
import { GroupBase, OptionBase, Select, SingleValue } from "chakra-react-select";


export const Route = createFileRoute("/_layout/ip_interfaces")({
  component: IpInterfaces,
})
interface SwitchOption extends OptionBase {
  label: string;
  value: string;
}
function IpInterfacesTableBody() {

  const [switch_id, set_switch_id] = useState<number | undefined>(0);
  const [input_search, set_input_search] = useState('');
  const [interface_search, set_interface_search] = useState('');
  const { data: switches } = useSuspenseQuery({
    queryKey: ["switches"],
    queryFn: async () => await SwitchesService.readSwitches({}),
  })

  const { data: ip_interfaces } = useSuspenseQuery({
    queryKey: ["ip_interfaces", switch_id, interface_search],
    queryFn: async () => await IpInterfacesService.readIpInterfaces({ switchId: switch_id, _interface: interface_search }),
  })

  const handleSelectChange = (
    newValue: SingleValue<SwitchOption>) => {
    if (newValue) {
      set_switch_id(Number(newValue.value));
    }
  };
  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
    set_input_search(event.target.value)
  }
  const handleKeyDown = (e: any) => {
    console.log(e.target.value);
    if (e.code === "Enter") {
      set_interface_search(e.target.value)
    }
  };
  const optionSwitches: SwitchOption[] = switches.data.map((item) => ({
    value: String(item.id),
    label: item.ipaddress + " - " + item.hostname + " - " + item.model,
  }));
  return (
    <>
      <Thead>
        <Tr>
          <Th colSpan={8}>
            <FormControl mt={4}>
              <Select<SwitchOption, false, GroupBase<SwitchOption>> // <-- None of these generics should be required
                name="switch_id"
                options={optionSwitches}
                placeholder="Select switch..."
                isMulti={false}
                onChange={handleSelectChange}
              />
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
              <Input type='text' placeholder='IP Search' onChange={handleSearch} onKeyDown={handleKeyDown} value={input_search} />
            </InputGroup>
          </Th>
          <Th>IPv4</Th>
          <Th>Hostname</Th>
          <Th>Last Seen</Th>
        </Tr>
      </Thead>
      <Tbody>
        {ip_interfaces.data.map((item) => (
          <Tr key={item.id}>
            <Td>{item.id}</Td>
            <Td>{item.interface}</Td>
            <Td>{item.ipv4}</Td>
            <Td>{item.switch_hostname}</Td>
            <Td>{item.updated_at}</Td>
          </Tr>
        ))}
      </Tbody>

    </>
  )
}
function IpInterfacesTable() {

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
            <IpInterfacesTableBody />
          </Suspense>
        </ErrorBoundary>
      </Table>
    </TableContainer>
  )
}

function IpInterfaces() {
  return (
    <Container maxW="full">
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        IpInterfaces Management
      </Heading>
      {/* <Navbar type={"IpInterface"} /> */}
      <IpInterfacesTable />
    </Container>
  )
}
