import {
  Badge,
  Box,
  Button,
  Code,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Icon,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  Stack,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import {
  FiCheckCircle,
  FiPlay,
  FiServer,
  FiTerminal,
  FiXCircle,
} from "react-icons/fi"

import { type ApiError, type SwitchPublic, SwitchesService } from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

interface PushSwitchConfigProps {
  item: SwitchPublic
  isOpen: boolean
  onClose: () => void
}

type HostResults = Record<string, string>

function parseResults(message: string): HostResults {
  try {
    return JSON.parse(message)
  } catch {
    return { error: message }
  }
}

function HostResultCard({
  hostname,
  output,
}: { hostname: string; output: string }) {
  const isError = output.startsWith("ERROR:")
  return (
    <Box
      border="1px solid"
      borderColor={isError ? "red.200" : "green.200"}
      borderRadius="lg"
      overflow="hidden"
    >
      <Flex
        px={4}
        py={2}
        bg={isError ? "red.50" : "green.50"}
        align="center"
        justify="space-between"
      >
        <HStack spacing={2}>
          <Icon
            as={FiServer}
            boxSize={4}
            color={isError ? "red.500" : "green.600"}
          />
          <Text
            fontWeight="semibold"
            fontSize="sm"
            color={isError ? "red.700" : "green.700"}
          >
            {hostname}
          </Text>
        </HStack>
        <Badge
          colorScheme={isError ? "red" : "green"}
          variant="solid"
          fontSize="xs"
        >
          <HStack spacing={1}>
            <Icon as={isError ? FiXCircle : FiCheckCircle} boxSize={3} />
            <Text>{isError ? "Error" : "Success"}</Text>
          </HStack>
        </Badge>
      </Flex>
      <Code
        display="block"
        whiteSpace="pre-wrap"
        p={4}
        fontSize="xs"
        bg={isError ? "red.50" : "gray.50"}
        color={isError ? "red.800" : "gray.800"}
        borderTop="1px solid"
        borderColor={isError ? "red.200" : "gray.200"}
        maxH="280px"
        overflowY="auto"
        fontFamily="mono"
      >
        {isError ? output.replace(/^ERROR:\s*/, "") : output || "(no output)"}
      </Code>
    </Box>
  )
}

const PushSwitchConfig = ({ item, isOpen, onClose }: PushSwitchConfigProps) => {
  const [commands, setCommands] = useState("")
  const [command_type, setCommandType] = useState("config")
  const [show_command, setShowCommand] = useState("show version")
  const [results, setResults] = useState<HostResults | null>(null)
  const showToast = useCustomToast()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (data: { commands: string; command_type: string }) => {
      return await SwitchesService.createSwitchConfig({
        id: item.id,
        requestBody: data,
      })
    },
    onSuccess: (res: any) => {
      const parsed = parseResults(res?.message ?? "{}")
      setResults(parsed)
      const total = Object.keys(parsed).length
      const errors = Object.values(parsed).filter((v) =>
        v.startsWith("ERROR:"),
      ).length
      if (errors > 0) {
        showToast("Done with errors", `${errors}/${total} failed.`, "error")
      } else {
        showToast("Success", `Applied to ${item.hostname}.`, "success")
      }
    },
    onError: (err: ApiError) => {
      const errDetail = (err.body as any)?.detail
      showToast("Request failed.", `${errDetail}`, "error")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["switches"] })
    },
  })

  const onSubmit = () => {
    mutation.mutate({
      commands: command_type === "show" ? show_command : commands,
      command_type,
    })
  }

  const onModalClose = () => {
    setResults(null)
    onClose()
  }

  const canSubmit =
    command_type === "show" ? !!show_command.trim() : !!commands.trim()

  const resultEntries = results ? Object.entries(results) : []
  const errorCount = resultEntries.filter(([, v]) =>
    v.startsWith("ERROR:"),
  ).length
  const successCount = resultEntries.length - errorCount

  return (
    <Modal
      isOpen={isOpen}
      onClose={onModalClose}
      size={{ base: "sm", md: "lg" }}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Push Config — {item.hostname}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={5} align="stretch">
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="medium">
                Operation
              </FormLabel>
              <RadioGroup value={command_type} onChange={setCommandType}>
                <Stack direction="row" spacing={5}>
                  <Radio value="config" colorScheme="blue" size="sm">
                    <Text fontSize="sm">Apply Config</Text>
                  </Radio>
                  <Radio value="show" colorScheme="teal" size="sm">
                    <Text fontSize="sm">Show Command</Text>
                  </Radio>
                </Stack>
              </RadioGroup>
            </FormControl>

            {command_type === "config" ? (
              <FormControl isRequired>
                <FormLabel fontSize="sm" fontWeight="medium">
                  Config Commands
                  <Text
                    as="span"
                    fontSize="xs"
                    color="gray.400"
                    fontWeight="normal"
                    ml={2}
                  >
                    one per line
                  </Text>
                </FormLabel>
                <Textarea
                  placeholder={
                    "interface GigabitEthernet0/1\n description uplink\n no shutdown"
                  }
                  rows={8}
                  value={commands}
                  onChange={(e) => setCommands(e.target.value)}
                  fontFamily="mono"
                  fontSize="sm"
                  resize="vertical"
                />
              </FormControl>
            ) : (
              <FormControl isRequired>
                <FormLabel fontSize="sm" fontWeight="medium">
                  Show Command
                </FormLabel>
                <Input
                  placeholder="show version"
                  value={show_command}
                  onChange={(e) => setShowCommand(e.target.value)}
                  fontFamily="mono"
                  fontSize="sm"
                />
              </FormControl>
            )}

            {results && !mutation.isPending && (
              <VStack align="stretch" spacing={3}>
                <Flex justify="space-between" align="center">
                  <HStack spacing={3}>
                    <Text fontSize="sm" fontWeight="semibold" color="gray.700">
                      Results
                    </Text>
                    {successCount > 0 && (
                      <Badge colorScheme="green" variant="subtle">
                        {successCount} success
                      </Badge>
                    )}
                    {errorCount > 0 && (
                      <Badge colorScheme="red" variant="subtle">
                        {errorCount} error
                      </Badge>
                    )}
                  </HStack>
                </Flex>
                <Divider />
                {resultEntries.map(([hostname, output]) => (
                  <HostResultCard
                    key={hostname}
                    hostname={hostname}
                    output={output}
                  />
                ))}
              </VStack>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter gap={3}>
          <Button onClick={onModalClose} variant="ghost">
            Close
          </Button>
          <Button
            colorScheme="blue"
            leftIcon={
              <Icon as={command_type === "show" ? FiTerminal : FiPlay} />
            }
            isLoading={mutation.isPending}
            loadingText={command_type === "show" ? "Running…" : "Applying…"}
            onClick={onSubmit}
            isDisabled={!canSubmit}
          >
            {command_type === "show" ? "Run Command" : "Apply Config"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default PushSwitchConfig
