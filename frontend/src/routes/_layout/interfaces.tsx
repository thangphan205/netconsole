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
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useDisclosure,
  Tag
} from "@chakra-ui/react"
import { useSuspenseQuery, } from "@tanstack/react-query"
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

  const [switch_id, set_switch_id] = useState<number | undefined>(0);

  const { data: switches } = useSuspenseQuery({
    queryKey: ["switches"],
    queryFn: async () => await SwitchesService.readSwitches({}),
  })

  const { data: interfaces } = useSuspenseQuery({
    queryKey: ["interfaces", switch_id],
    queryFn: async () => await InterfacesService.readInterfaces({ switchId: switch_id }),
  })

  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    set_switch_id(Number(event.target.value));

  };

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isLoading, setIsLoading] = useState(false);
  const [interface_info, set_interface_info] = useState<string>(JSON.stringify({ "data": "" }));


  const fetchInterfaceRunning = async (id: number) => {
    try {
      const result = await InterfacesService.readInterfaceRunning({ id });
      set_interface_info(JSON.stringify(result));
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
    setIsLoading(false);
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
            {
              item.status === "connected" ? (
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
              <ActionsMenu type={"Interface"} value={item} />
            </Td>
          </Tr>
        ))}
      </Tbody>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Loading config</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {
              JSON.parse(interface_info).data.split("\n").map((item: string) => (
                <div>{item}</div>
              ))
            }
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
      <Navbar type={"Interface"} />
      <InterfacesTable />
    </Container>
  )
}
