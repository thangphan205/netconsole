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
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useDisclosure,
  Tag,
  Code,
  Box,
  Spinner,
  Divider,
  AbsoluteCenter,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
} from "@chakra-ui/react"
import { useSuspenseQuery, } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { InterfacesService, SwitchesService, } from "../../client"
import ActionsMenu from "../../components/Common/ActionsMenu"
// import Navbar from "../../components/Common/Navbar"
import { useState } from "react";
import { GroupBase, OptionBase, Select, SingleValue } from "chakra-react-select";
import { FaSearch, FaRegTimesCircle } from "react-icons/fa"


export const Route = createFileRoute("/_layout/interfaces")({
  component: Interfaces,
})


interface SwitchOption extends OptionBase {
  label: string;
  value: string;
}

function InterfacesTableBody() {

  const [switch_id, set_switch_id] = useState<number>(0);
  const [search_character, set_search_character] = useState('');
  const [search_string, set_search_string] = useState('');

  const { data: switches } = useSuspenseQuery({
    queryKey: ["switches"],
    queryFn: async () => await SwitchesService.readSwitches({}),
  })

  const { data: interfaces } = useSuspenseQuery({
    queryKey: ["interfaces", switch_id, search_string],
    queryFn: async () => await InterfacesService.readInterfaces({ switchId: switch_id, search: search_string }),
  })

  const handleSelectChange = (
    newValue: SingleValue<SwitchOption>) => {
    if (newValue) {
      set_switch_id(Number(newValue.value));
    }
  };

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isLoading, setIsLoading] = useState(false);
  const [interface_info, set_interface_info] = useState<string>(JSON.stringify({ "data": "", "interface": "" }));


  const fetchInterfaceRunning = async (id: number) => {
    try {
      const result = await InterfacesService.readInterfaceRunning({ id });
      set_interface_info(JSON.stringify(result));
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching interface running:', error);
      // Handle the error, e.g., display an error message to the user
    }
  };

  const handleButtonClick = (value: number) => {
    setIsLoading(true);
    // Add your logic here, e.g., make an API call
    // Once the logic is complete, close the modal
    fetchInterfaceRunning(value)
    onOpen();
    // setIsLoading(false);
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
          <Th>Interface</Th>
          <Th>Description</Th>
          <Th>Status</Th>
          <Th>Vlan</Th>
          <Th>Mode</Th>
          <Th>Speed</Th>
          <Th>Actions</Th>
        </Tr>
      </Thead>
      <Tbody>
        {switch_id !== 0 ? (
          interfaces.data.length === 0 ? (
            <Tr>
              <Td colSpan={8}>
                <Box position='relative' padding='10'>
                  <Divider />
                  <AbsoluteCenter bg='white' px='4'>
                    No data match searching: {search_string}
                  </AbsoluteCenter>
                </Box>
              </Td>
            </Tr>
          ) : (
            interfaces.data.map((item) => (
              <Tr key={item.id}>
                <Td>{item.id}</Td>
                <Td>{item.port}</Td>
                <Td>{item.description}</Td>
                {
                  item.status === "connected" || item.status === "up" ? (
                    <Td><Tag colorScheme='green'>{item.status}</Tag></Td>
                  ) : (
                    <Td>{item.status}</Td>

                  )
                }
                <Td>{item.vlan}</Td>
                {
                  item.mode === "access" ? (
                    <Td><Tag colorScheme='green'>{item.mode}</Tag></Td>
                  ) : (
                    <Td><Tag colorScheme='red'>{item.mode}</Tag></Td>
                  )
                }
                <Td>{item.speed}</Td>
                <Td>
                  <Button colorScheme='blue' onClick={() => handleButtonClick(item.id)} isLoading={isLoading}>Show run-config</Button>
                  <ActionsMenu type={"Interface"} value={item} name={item.port} />
                </Td>
              </Tr>
            )
            ))
        ) : (
          <Tr>
            <Td colSpan={8}>
              <Box position='relative' padding='10'>
                <Divider />
                <AbsoluteCenter bg='white' px='4'>
                  Choose switch to show interface status.
                </AbsoluteCenter>
              </Box>
            </Td>
          </Tr>
        )}
      </Tbody>
      <Modal isOpen={isOpen} onClose={onClose} size={"2xl"}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{isLoading ? (<>Loading config</>) : (JSON.parse(interface_info).interface)}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {isLoading ? (
              <>
                <Spinner />
                Loading
              </>
            ) : (
              <Box>
                <Code colorScheme="gray" whiteSpace="pre" p={4}>
                  {JSON.parse(interface_info).data}
                </Code>
              </Box>
            )}

          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
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
      {/* <Navbar type={"Interface"} onSearch={handleSearch} /> */}
      <InterfacesTable />
    </Container>
  )
}
