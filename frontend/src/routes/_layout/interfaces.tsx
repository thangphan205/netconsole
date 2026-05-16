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
  HStack,
  VStack,
  Text,
  Alert,
  AlertIcon,
  Tooltip,
} from "@chakra-ui/react"
import { useMutation, useQueryClient, useSuspenseQuery, } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { ApiError, InterfacesService, SwitchesService, } from "../../client"
import ActionsMenu from "../../components/Common/ActionsMenuInterface"
// import Navbar from "../../components/Common/Navbar"
import { useState } from "react";
import { GroupBase, OptionBase, Select, SingleValue } from "chakra-react-select";
import { FaSearch, FaRegTimesCircle } from "react-icons/fa"
import useCustomToast from "../../hooks/useCustomToast"


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
  const [sync_running, set_sync_running] = useState(false);

  const { data: switches } = useSuspenseQuery({
    queryKey: ["switches"],
    queryFn: async () => await SwitchesService.readSwitches({}),
  })

  const { data: interfaces } = useSuspenseQuery({
    queryKey: ["interfaces", switch_id, search_string, sync_running],
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
  const [runConfig, setRunConfig] = useState<string>("");
  const [selectedInterface, setSelectedInterface] = useState<any>(null);

  const fetchInterfaceRunning = async (id: number) => {
    try {
      const result: any = await InterfacesService.readInterfaceRunning({ id });
      setRunConfig(result?.data ?? "");
      setIsLoading(false);
    } catch (error) {
      setRunConfig("Error fetching running config.");
      setIsLoading(false);
    }
  };

  const handleButtonClick = (item: any) => {
    setIsLoading(true);
    setRunConfig("");
    setSelectedInterface(item);
    fetchInterfaceRunning(item.id);
    onOpen();
  };

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(runConfig);
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
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const mutation_update_metadata = useMutation({
    mutationFn: () =>
      SwitchesService.updateSwitchMetadata({ id: switch_id }),
    onSuccess: () => {
      showToast("Success!", "Syncing Running Config Done.", "success")
      onClose()
      set_sync_running(!sync_running);
    },
    onError: (err: ApiError) => {
      const errDetail = (err.body as any)?.detail
      showToast("Something went wrong.", `${errDetail}`, "error")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["switches"] })
    },
  })
  const handleSyncRunningConfig = async () => {
    showToast("Success!", "Syncing Running Config. Please wait!", "success")
    mutation_update_metadata.mutate()
  }

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
          {
            switch_id > 0 ? (
              <Th colSpan={2}>
                <FormControl>
                  <Button onClick={handleSyncRunningConfig}
                    colorScheme="blue"
                  >
                    Sync Switch Running Config
                  </Button>
                </FormControl>
              </Th>
            ) : null
          }

          <Th colSpan={2}>
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
                    item.status === "disabled" ? (
                      <Td><Tag colorScheme='red'>{item.status}</Tag></Td>
                    ) : (
                      <Td>{item.status}</Td>
                    )
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
                  <Button
                    colorScheme='blue'
                    onClick={() => handleButtonClick(item)}
                    isLoading={isLoading}
                    mr={3}
                  >
                    Show run-config
                  </Button>
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
          <ModalHeader>
            {isLoading ? (
              <HStack spacing={2}><Spinner size="sm" /><Text>Loading config…</Text></HStack>
            ) : (
              <VStack align="start" spacing={1}>
                <Text fontSize="lg" fontWeight="bold">{selectedInterface?.port}</Text>
                {selectedInterface?.description && (
                  <Text fontSize="sm" color="gray.500" fontWeight="normal">{selectedInterface.description}</Text>
                )}
              </VStack>
            )}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {isLoading ? (
              <Box textAlign="center" py={6}><Spinner size="lg" /></Box>
            ) : (
              <VStack align="stretch" spacing={4}>
                <HStack spacing={2} flexWrap="wrap">
                  {selectedInterface?.status === "connected" || selectedInterface?.status === "up" ? (
                    <Tag colorScheme="green">{selectedInterface.status}</Tag>
                  ) : selectedInterface?.status === "disabled" ? (
                    <Tag colorScheme="red">{selectedInterface?.status}</Tag>
                  ) : (
                    <Tag>{selectedInterface?.status}</Tag>
                  )}
                  {selectedInterface?.mode === "access" ? (
                    <Tag colorScheme="green">access</Tag>
                  ) : (
                    <Tag colorScheme="orange">{selectedInterface?.mode}</Tag>
                  )}
                  {selectedInterface?.vlan && <Tag colorScheme="blue">VLAN {selectedInterface.vlan}</Tag>}
                  {selectedInterface?.speed && <Tag variant="outline">{selectedInterface.speed}</Tag>}
                </HStack>
                {runConfig.startsWith("%") ? (
                  <Alert status="error" borderRadius="md">
                    <AlertIcon />
                    <Text fontSize="sm" whiteSpace="pre-wrap">{runConfig}</Text>
                  </Alert>
                ) : runConfig === "Error fetching running config." ? (
                  <Alert status="error" borderRadius="md">
                    <AlertIcon />
                    <Text fontSize="sm">Failed to fetch running config from device.</Text>
                  </Alert>
                ) : (
                  <Box maxH="400px" overflowY="auto" borderRadius="md" border="1px solid" borderColor="gray.200">
                    <Code display="block" whiteSpace="pre" p={4} fontSize="sm" bg="gray.50" w="full">
                      {runConfig || "(empty)"}
                    </Code>
                  </Box>
                )}
              </VStack>
            )}
          </ModalBody>
          <ModalFooter gap={3}>
            <Tooltip label="Copy to clipboard">
              <Button onClick={handleCopyConfig} isDisabled={isLoading || !runConfig} variant="outline">
                Copy
              </Button>
            </Tooltip>
            <Button colorScheme="blue" onClick={onClose}>
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
