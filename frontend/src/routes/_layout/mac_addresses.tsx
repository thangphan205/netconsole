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
  Button,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
} from "@chakra-ui/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { MacAddressesService, SwitchesService } from "../../client"
// import ActionsMenu from "../../components/Common/ActionsMenu"
// import Navbar from "../../components/Common/Navbar"
import { useState } from "react";
import { GroupBase, OptionBase, Select, SingleValue } from "chakra-react-select";
import { FaSearch, FaRegTimesCircle } from "react-icons/fa"


export const Route = createFileRoute("/_layout/mac_addresses")({
  component: MacAddresses,
})

interface SwitchOption extends OptionBase {
  label: string;
  value: string;
}


function MacAddressesTableBody() {
  const [switch_id, set_switch_id] = useState<number | undefined>(0);
  const [search_character, set_search_character] = useState('');
  const [search_string, set_search_string] = useState('');

  const { data: switches } = useSuspenseQuery({
    queryKey: ["switches"],
    queryFn: async () => await SwitchesService.readSwitches({}),
  })
  const { data: mac_addresses } = useSuspenseQuery({
    queryKey: ["mac_addresses", switch_id, search_string],
    queryFn: async () => await MacAddressesService.readMacAddresses({ switchId: switch_id, search: search_string }),
  })
  const handleSelectChange = (
    newValue: SingleValue<SwitchOption>) => {
    if (newValue) {
      set_switch_id(Number(newValue.value));
    }
  };
  const handleSearch = (e: any) => {
    if (e.code === "Enter") {
      set_search_string(search_character);
    }
  };
  const handleClear = () => {
    set_search_string('');
    set_search_character('');
  };

  const optionSwitches: SwitchOption[] = switches.data.map((item) => ({
    value: String(item.id),
    label: item.ipaddress + " - " + item.hostname + " - " + item.model,
  }));
  return (
    <>

      <Thead>
        <Tr>
          <Th colSpan={4}>
            <FormControl>
              <Select<SwitchOption, false, GroupBase<SwitchOption>> // <-- None of these generics should be required
                name="switch_id"
                options={optionSwitches}
                placeholder="Select switch..."
                isMulti={false}
                onChange={handleSelectChange}
              />
            </FormControl>
          </Th>
          <Th colSpan={4}>
            <InputGroup>
              <InputLeftElement pointerEvents='none'>
                <Icon as={FaSearch} color='ui.dim' />
              </InputLeftElement>
              <Input type='text' placeholder='Search' fontSize={{ base: 'sm', md: 'inherit' }} borderRadius='8px'
                value={search_character}
                onChange={(e) => set_search_character(e.target.value)}
                onKeyDown={handleSearch}
              />
              <InputRightElement >
                {search_character && (
                  <Button onClick={handleClear} borderRadius='10px'>
                    <Icon as={FaRegTimesCircle} />
                  </Button>
                )}
              </InputRightElement>
            </InputGroup>
          </Th>
        </Tr>
        <Tr>
          <Th>ID</Th>
          <Th> MAC Address</Th>
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
        MAC Addresses Management
      </Heading>
      {/* <Navbar type={"MacAddress"} onSearch={handleSearch} /> */}
      <MacAddressesTable />
    </Container>
  )
}
