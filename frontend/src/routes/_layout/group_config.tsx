import {
  Badge,
  Box,
  Button,
  Code,
  Container,
  Divider,
  FormControl,
  Heading,
  Input,
  Textarea,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { OptionBase, Select, SingleValue } from "chakra-react-select"

import { type ApiError, GroupConfigService, GroupsService } from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

export const Route = createFileRoute("/_layout/group_config")({
  component: GroupConfigs,
})

interface GroupOption extends OptionBase {
  label: string
  value: string
}

type ResultState = {
  status: boolean
  message: string
} | null

function GroupConfigBody() {
  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => await GroupsService.readGroups({}),
  })

  const [commands, setCommands] = useState("")
  const [result, setResult] = useState<ResultState>(null)
  const [group_name, setGroupName] = useState("")
  const [command_type, setCommandType] = useState("config")
  const [command_type_string, setCommandTypeString] = useState("show version")
  const showToast = useCustomToast()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (data: {
      group_name: string
      commands: string
      command_type: string
    }) => {
      const res = await GroupConfigService.createGroupConfig({ requestBody: data as any })
      setResult(res as ResultState)
      return res
    },
    onSuccess: () => {
      showToast("Success!", "Config applied successfully.", "success")
    },
    onError: (err: ApiError) => {
      const errDetail = (err.body as any)?.detail
      showToast("Something went wrong.", `${errDetail}`, "error")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] })
    },
  })

  const onSubmit = () => {
    mutation.mutate({
      group_name,
      commands: command_type === "show" ? command_type_string : commands,
      command_type,
    })
  }

  const handleSelectChange = (newValue: SingleValue<GroupOption>) => {
    if (newValue) setGroupName(newValue.value)
  }

  const handleSelectCommand = (newValue: SingleValue<GroupOption>) => {
    if (newValue) setCommandType(newValue.value)
  }

  const optionGroups: GroupOption[] =
    groups?.data.map((item) => ({
      value: item.name,
      label: item.name + " - " + item.site,
    })) ?? []

  const optionCommand: GroupOption[] = [
    { label: "Show config", value: "show" },
    { label: "Set config", value: "config" },
  ]

  let parsedResult: Record<string, unknown> = {}
  if (result) {
    try {
      parsedResult = JSON.parse(result.message)
    } catch {
      parsedResult = { error: result.message }
    }
  }

  return (
    <Box w="100%" mx="auto" mt={10}>
      {groups === undefined ? (
        <>Loading groups...</>
      ) : groups.data.length === 0 ? (
        <>No groups configured.</>
      ) : (
        <VStack spacing={4}>
          <FormControl>
            <Select
              name="group_name"
              options={optionGroups}
              placeholder="Select group to apply config"
              isMulti={false}
              onChange={handleSelectChange}
            />
          </FormControl>
          <FormControl>
            <Select
              name="command_type"
              defaultValue={[{ label: "Set config", value: "config" }]}
              options={optionCommand}
              placeholder="Select command type"
              isMulti={false}
              onChange={handleSelectCommand}
            />
          </FormControl>
          {command_type === "config" ? (
            <FormControl isRequired>
              <Textarea
                placeholder="Enter commands line by line"
                rows={10}
                value={commands}
                onChange={(e) => setCommands(e.target.value)}
              />
            </FormControl>
          ) : (
            <FormControl isRequired>
              <Input
                placeholder="Enter show command"
                value={command_type_string}
                onChange={(e) => setCommandTypeString(e.target.value)}
              />
            </FormControl>
          )}
          <FormControl>
            <Button
              colorScheme="blue"
              isLoading={mutation.isPending}
              onClick={onSubmit}
            >
              Submit
            </Button>
          </FormControl>
        </VStack>
      )}

      {result && (
        <>
          <Heading fontSize="xl" mt={6} mb={2}>
            Result:
          </Heading>
          <Box>
            {Object.entries(parsedResult).map(([key, v]) => (
              <VStack key={key} spacing={4} align="stretch">
                <Divider />
                <Badge>Hostname: {key}</Badge>
                <Code colorScheme="blue" whiteSpace="pre" p={4}>
                  {String(v)}
                </Code>
              </VStack>
            ))}
          </Box>
        </>
      )}
    </Box>
  )
}

function GroupConfigs() {
  return (
    <Container maxW="full">
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        Group Config Management (configure multiple switches)
      </Heading>
      <GroupConfigBody />
    </Container>
  )
}
