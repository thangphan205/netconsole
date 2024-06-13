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
import { ArpsService, SwitchesService } from "../../client"
// import ActionsMenu from "../../components/Common/ActionsMenu"
// import Navbar from "../../components/Common/Navbar"
import { useState, ChangeEvent } from "react";
import { FaSearch, } from "react-icons/fa"
import { GroupBase, OptionBase, Select, SingleValue } from "chakra-react-select";

export const Route = createFileRoute("/_layout/arps")({
  component: Arps,
})
interface SwitchOption extends OptionBase {
  label: string;
  value: string;
}
function ArpsTableBody() {

  const [switch_id, set_switch_id] = useState<number | undefined>(0);
  const [input_search, set_input_search] = useState('');
  const [ip_search, set_ip_search] = useState('');
  const { data: switches } = useSuspenseQuery({
    queryKey: ["switches"],
    queryFn: async () => await SwitchesService.readSwitches({}),
  })

  const { data: arps } = useSuspenseQuery({
    queryKey: ["arps", switch_id, ip_search],
    queryFn: async () => await ArpsService.readArps({ switchId: switch_id, ip: ip_search }),
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
      set_ip_search(e.target.value)
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
              <Input type='text' placeholder='IPv4 Search' onChange={handleSearch} onKeyDown={handleKeyDown} value={input_search} />
            </InputGroup>
          </Th>
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
