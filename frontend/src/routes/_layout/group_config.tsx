import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Code,
  Container,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  HStack,
  Heading,
  Icon,
  Input,
  Radio,
  RadioGroup,
  Stack,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { type OptionBase, Select, type SingleValue } from "chakra-react-select"
import { useState } from "react"
import {
  FiCheckCircle,
  FiPlay,
  FiServer,
  FiTerminal,
  FiXCircle,
} from "react-icons/fi"

import { type ApiError, GroupConfigService, GroupsService } from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

export const Route = createFileRoute("/_layout/group_config")({
  component: GroupConfigs,
})

interface GroupOption extends OptionBase {
  label: string
  value: string
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

function GroupConfigBody() {
  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => await GroupsService.readGroups({}),
  })

  const [commands, setCommands] = useState("")
  const [results, setResults] = useState<HostResults | null>(null)
  const [group_name, setGroupName] = useState("")
  const [command_type, setCommandType] = useState("config")
  const [show_command, setShowCommand] = useState("show version")
  const showToast = useCustomToast()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (data: {
      group_name: string
      commands: string
      command_type: string
    }) => {
      return await GroupConfigService.createGroupConfig({
        requestBody: data as any,
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
        showToast(
          "Done with errors",
          `${errors}/${total} hosts failed.`,
          "error",
        )
      } else {
        showToast(
          "Success",
          `Applied to ${total} host${total !== 1 ? "s" : ""}.`,
          "success",
        )
      }
    },
    onError: (err: ApiError) => {
      const errDetail = (err.body as any)?.detail
      showToast("Request failed.", `${errDetail}`, "error")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] })
    },
  })

  const onSubmit = () => {
    mutation.mutate({
      group_name,
      commands: command_type === "show" ? show_command : commands,
      command_type,
    })
  }

  const optionGroups: GroupOption[] =
    groups?.data.map((item) => ({
      value: item.name,
      label: `${item.name}  ·  ${item.site}`,
    })) ?? []

  const canSubmit =
    !!group_name &&
    (command_type === "show" ? !!show_command.trim() : !!commands.trim())

  const resultEntries = results ? Object.entries(results) : []
  const errorCount = resultEntries.filter(([, v]) =>
    v.startsWith("ERROR:"),
  ).length
  const successCount = resultEntries.length - errorCount

  return (
    <Grid
      templateColumns={{ base: "1fr", lg: "400px 1fr" }}
      gap={6}
      mt={6}
      alignItems="flex-start"
    >
      {/* Form panel */}
      <Box
        bg="white"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="xl"
        p={6}
        shadow="sm"
      >
        <Heading size="sm" mb={5} color="gray.700">
          Command Configuration
        </Heading>

        <VStack spacing={5} align="stretch">
          <FormControl isRequired>
            <FormLabel fontSize="sm" fontWeight="medium">
              Target Group
            </FormLabel>
            {groupsLoading ? (
              <Box h="38px" bg="gray.100" borderRadius="md" />
            ) : groups?.data.length === 0 ? (
              <Alert status="warning" borderRadius="md" fontSize="sm">
                <AlertIcon />
                No groups configured.
              </Alert>
            ) : (
              <Select
                name="group_name"
                options={optionGroups}
                placeholder="Select a group…"
                isMulti={false}
                onChange={(v: SingleValue<GroupOption>) =>
                  v && setGroupName(v.value)
                }
                chakraStyles={{ container: (p) => ({ ...p, fontSize: "sm" }) }}
              />
            )}
          </FormControl>

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
                rows={10}
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

          <Button
            colorScheme="blue"
            leftIcon={
              <Icon as={command_type === "show" ? FiTerminal : FiPlay} />
            }
            isLoading={mutation.isPending}
            loadingText={command_type === "show" ? "Running…" : "Applying…"}
            onClick={onSubmit}
            isDisabled={!canSubmit}
            w="full"
          >
            {command_type === "show" ? "Run Command" : "Apply Config"}
          </Button>
        </VStack>
      </Box>

      {/* Results panel */}
      <Box>
        {!results && !mutation.isPending && (
          <Flex
            align="center"
            justify="center"
            h="220px"
            border="2px dashed"
            borderColor="gray.200"
            borderRadius="xl"
            color="gray.400"
            flexDirection="column"
            gap={2}
          >
            <Icon as={FiTerminal} boxSize={8} />
            <Text fontSize="sm">Results appear here after running</Text>
          </Flex>
        )}

        {mutation.isPending && (
          <Flex
            align="center"
            justify="center"
            h="220px"
            color="gray.500"
            flexDirection="column"
            gap={2}
          >
            <Icon as={FiTerminal} boxSize={8} />
            <Text fontSize="sm">Running on {group_name}…</Text>
          </Flex>
        )}

        {results && !mutation.isPending && (
          <VStack align="stretch" spacing={3}>
            <Flex justify="space-between" align="center">
              <HStack spacing={3}>
                <Heading size="sm" color="gray.700">
                  Results
                </Heading>
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
              <Button
                size="xs"
                variant="ghost"
                colorScheme="gray"
                onClick={() => setResults(null)}
              >
                Clear
              </Button>
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
      </Box>
    </Grid>
  )
}

function GroupConfigs() {
  return (
    <Container maxW="full">
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        Group Config
      </Heading>
      <Text color="gray.500" fontSize="sm" mt={1} mb={0}>
        Push config or run show commands across all devices in a group
      </Text>
      <GroupConfigBody />
    </Container>
  )
}
