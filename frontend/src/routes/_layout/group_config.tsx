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
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { type ApiError, GroupConfigCreate, GroupConfigService, GroupsService } from "../../client"
import { useState } from "react";
import useCustomToast from "../../hooks/useCustomToast"
import { useForm } from "react-hook-form"
import { OptionBase, Select, SingleValue } from "chakra-react-select";

export const Route = createFileRoute("/_layout/group_config")({
  component: GroupConfigs,
})
interface GroupOption extends OptionBase {
  label: string;
  value: string;
}

function GroupConfigBody() {
  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => await GroupsService.readGroups({}),
  })

  const [commands, set_commands] = useState("");
  const [result, set_result] = useState({
    "status": false, "message": JSON.stringify({ "<Hostname>": "Result" })
  });
  const [group_name, set_group_name] = useState("");
  const [command_type, set_command_type] = useState("config");
  const [command_type_string, set_command_type_string] = useState("show version");
  const showToast = useCustomToast();
  const {
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GroupConfigCreate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      group_name: "",
      commands: ""
    },
  })
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (data: GroupConfigCreate) => {
      const response = GroupConfigService.createGroupConfig({ requestBody: data });
      response.then((response_data: any) => {
        if (response_data) {
          set_result(response_data)
        }
      })

    },
    onSuccess: () => {
      showToast("Success!", "Load config successfully.", "success")
      reset()
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
    const data = {
      "group_name": group_name,
      "commands": commands,
      "command_type": command_type
    }
    if (command_type === "show") {
      data.commands = command_type_string;
    }
    showToast("Success!", "Config sent successfully. Please wait!", "success")
    mutation.mutate(data)
  }
  const handleSelectChange = (
    newValue: SingleValue<GroupOption>) => {
    if (newValue) {
      set_group_name(newValue.value);
    }
  };
  const handleSelectCommand = (
    newValue: SingleValue<GroupOption>) => {
    if (newValue) {
      set_command_type(newValue.value);
    }
  };
  let optionGroups: GroupOption[] = [];
  if (groups) {
    optionGroups = groups.data.map((item) => ({
      value: item.name,
      label: item.name + " - " + item.site,
    }));
  }
  const optionCommand = [
    {
      "label": "Show config",
      "value": "show",
    },
    {
      "label": "Set config",
      "value": "config",
    },
  ]
  return (
    <Box w="100%" mx="auto" mt={10} >
      {
        groups && groups.data.length > 0 ? (
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
                defaultValue={[{
                  "label": "Set config",
                  "value": "config",
                },]}
                options={optionCommand}
                placeholder="Select Command type"
                isMulti={false}
                onChange={handleSelectCommand}
              />
            </FormControl>
            {
              command_type == "config" ? (
                <FormControl isRequired isInvalid={!!errors.commands}>
                  <Textarea
                    placeholder="Enter commands line by line"
                    rows={10}
                    value={commands}
                    onChange={(e) => set_commands(e.target.value)}
                  />
                </FormControl>
              ) : (
                <FormControl isRequired isInvalid={!!errors.commands}>
                  <Input
                    placeholder="Enter show command"
                    value={command_type_string}
                    onChange={(e) => set_command_type_string(e.target.value)}
                  />
                </FormControl>
              )
            }

            <FormControl>
              <Button colorScheme="blue" type="submit" isLoading={isSubmitting} onClick={onSubmit}>
                Submit
              </Button>
            </FormControl>


          </VStack>
        ) : (<>loading</>)
      }
      <Heading fontSize='xl'>Result:</Heading>
      <Box>
        {
          Object.entries(JSON.parse(result.message)).map(([key, v]) => (
            <VStack
              spacing={4}
              align='stretch'
            >
              <Divider />
              <Badge>Hostname: {key}</Badge>
              <Code colorScheme="blue" whiteSpace="pre" p={4}>{String(v)} </Code>
            </VStack>
          ))
        }
      </Box>
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
