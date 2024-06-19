import {
  Button,
  FormControl,
  FormErrorMessage,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  InputGroup,
  InputLeftAddon,
  Stack,
  Box,

} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type SubmitHandler, useForm } from "react-hook-form"

import { type ApiError, type SwitchCreate, SwitchesService, GroupsService, CredentialsService } from "../../client"
import useCustomToast from "../../hooks/useCustomToast"
import { OptionBase, Select, SingleValue, MultiValue } from "chakra-react-select";
import { useState } from "react"

interface AddSwitchProps {
  isOpen: boolean
  onClose: () => void
}
interface GroupOption extends OptionBase {
  label: string;
  value: string;
}
interface CredentialOption extends OptionBase {
  label: string;
  value: number;
}
const AddSwitch = ({ isOpen, onClose }: AddSwitchProps) => {
  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => await GroupsService.readGroups({}),
  })
  const { data: credentials } = useQuery({
    queryKey: ["credentials"],
    queryFn: async () => await CredentialsService.readCredentials({}),
  })
  const [credential_id, set_credential_id] = useState<number>(0);
  const [platform, set_platform] = useState<string>("");
  const [device_type, set_device_type] = useState<string>("");
  const [groups_list, set_groups_list] = useState<string>("");
  const handleSelectChangeCredential = (
    newValue: SingleValue<CredentialOption>) => {
    if (newValue) {
      set_credential_id(newValue.value);
    }
  };
  const handleSelectChangePlatform = (
    newValue: SingleValue<GroupOption>) => {
    if (newValue) {
      set_platform(newValue.value);
    }
  };
  const handleSelectChangeDeviceType = (
    newValue: SingleValue<GroupOption>) => {
    if (newValue) {
      set_device_type(newValue.value);
    }
  };
  const handleSelectChangeGroups = (
    newValues: MultiValue<GroupOption>) => {

    let groups_in_change: string[] = [];
    if (newValues) {
      newValues.map((item) => {
        groups_in_change.push(item.value);
      });
      set_groups_list(groups_in_change.join());
    }
  };
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SwitchCreate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      hostname: "",
      ipaddress: "",
      platform: "",
      device_type: "",
      groups: "",
      description: "",
      port: 22,
      credential_id: 0,
    },
  })

  const mutation = useMutation({
    mutationFn: (data: SwitchCreate) =>
      SwitchesService.createSwitch({ requestBody: data }),
    onSuccess: () => {
      showToast("Success!", "Switch created successfully.", "success")
      reset()
      onClose()
    },
    onError: (err: ApiError) => {
      const errDetail = (err.body as any)?.detail
      showToast("Something went wrong.", `${errDetail}`, "error")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["switches"] })
    },
  })

  const onSubmit: SubmitHandler<SwitchCreate> = (data) => {
    const pattern = /^[a-zA-Z0-9_]+$/;
    if (!pattern.test(data.hostname)) {
      showToast("ERROR!", "Switch hostname include [a-z],[A-Z], [0-9] and _ only.", "error");
      return true;
    }
    data.credential_id = credential_id;
    data.platform = platform;
    data.device_type = device_type;
    data.groups = groups_list;

    mutation.mutate(data)
  }
  const optionPlatform: GroupOption[] = [
    { "label": "Cisco IOS", "value": "ios" },
    { "label": "Cisco Nexus SSH", "value": "nxos_ssh" },
    { "label": "Juniper Junos", "value": "junos" },
  ];
  const optionDeviceType: GroupOption[] = [
    { "label": "Cisco IOS", "value": "cisco_ios" },
    { "label": "Cisco Nexus", "value": "cisco_nxos" },
    { "label": "Juniper Junos", "value": "juniper_junos" },
  ];
  let optionGroups: GroupOption[] = [];
  if (groups && groups.data.length > 0) {
    optionGroups = optionDeviceType.concat(groups.data.map((item) => ({
      value: item.name,
      label: item.name + " - " + item.site
    })));
  }
  let optionCredentials: CredentialOption[] = [];
  if (credentials && credentials.data.length > 0) {
    optionCredentials = credentials.data.map((item) => ({
      value: item.id,
      label: item.id + " - " + item.username
    }));
  }
  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size={{ base: "sm", md: "2xl" }}
        isCentered
      >
        <ModalOverlay />
        <ModalContent as="form" onSubmit={handleSubmit(onSubmit)}>
          <ModalHeader>Add Switch</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Stack spacing={4}>
              <FormControl isRequired isInvalid={!!errors.hostname}>
                {/* <FormLabel htmlFor="hostname">Hostname</FormLabel> */}
                <InputGroup>
                  <InputLeftAddon>Hostname</InputLeftAddon>
                  <Input
                    id="hostname"
                    {...register("hostname", {
                      required: "hostname is required.",
                    })}
                    placeholder="Hostname only include [A-Z],[a-z],[0-9],_"
                    type="text"
                  />
                </InputGroup>

                {errors.hostname && (
                  <FormErrorMessage>{errors.hostname.message}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl isRequired isInvalid={!!errors.ipaddress}>
                <InputGroup>
                  <InputLeftAddon>IP Address</InputLeftAddon>
                  <Input
                    id="ipaddress"
                    {...register("ipaddress", {
                      required: "IP Address is required.",
                    })}
                    placeholder="192.168.1.1"
                    type="text"
                  />
                </InputGroup>
                {errors.ipaddress && (
                  <FormErrorMessage>{errors.ipaddress.message}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl isRequired isInvalid={!!errors.port}>
                <InputGroup>
                  <InputLeftAddon>Port</InputLeftAddon>
                  <Input
                    id="port"
                    {...register("port", {
                      required: "Port is required.",
                    })}
                    placeholder="22"
                    type="number"
                  />
                </InputGroup>
                {errors.port && (
                  <FormErrorMessage>{errors.port.message}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl isRequired isInvalid={!!errors.credential_id}>
                <Box position="relative" w="100%" zIndex={101} >
                  <InputGroup>
                    <InputLeftAddon>Credentials</InputLeftAddon>
                    <Box position="relative" w="100%" zIndex={101} >
                      <Select
                        name="credential_id"
                        options={optionCredentials}
                        placeholder="Select Credential to authenticate"
                        isMulti={false}
                        onChange={handleSelectChangeCredential}
                      />
                    </Box>
                  </InputGroup>
                </Box>
                {errors.platform && (
                  <FormErrorMessage>{errors.platform.message}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl isRequired isInvalid={!!errors.platform}>
                <Box position="relative" w="100%" zIndex={100} >
                  <InputGroup>
                    <InputLeftAddon>Platform</InputLeftAddon>
                    <Box position="relative" w="100%" zIndex={100} >
                      <Select
                        name="flatform"
                        options={optionPlatform}
                        placeholder="Select Flatform..."
                        isMulti={false}
                        onChange={handleSelectChangePlatform}
                      />
                    </Box>
                  </InputGroup>
                </Box>
                {errors.platform && (
                  <FormErrorMessage>{errors.platform.message}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl isRequired isInvalid={!!errors.device_type}>
                <Box position="relative" w="100%" zIndex={99} >
                  <InputGroup>
                    <InputLeftAddon>Device Type</InputLeftAddon>
                    <Box position="relative" w="100%" zIndex={99} >
                      <Select
                        name="device_type"
                        options={optionDeviceType}
                        placeholder="Select device-type..."
                        isMulti={false}
                        onChange={handleSelectChangeDeviceType}
                      />
                    </Box>
                  </InputGroup>
                </Box>
                {errors.device_type && (
                  <FormErrorMessage>{errors.device_type.message}</FormErrorMessage>
                )}
              </FormControl>

              <FormControl isRequired isInvalid={!!errors.groups}>
                <Box position="relative" w="100%" zIndex={98}>
                  <InputGroup>
                    <InputLeftAddon>Groups</InputLeftAddon>
                    <Box position="relative" w="100%" zIndex={98}>
                      <Select
                        name="group"
                        options={optionGroups}
                        placeholder="Select group..."
                        isMulti={true}
                        onChange={handleSelectChangeGroups}
                      />
                    </Box>
                  </InputGroup>
                </Box>
                {errors.groups && (
                  <FormErrorMessage>{errors.groups.message}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl mt={4}>
                <InputGroup>
                  <InputLeftAddon>Description</InputLeftAddon>
                  <Input
                    id="description"
                    {...register("description")}
                    placeholder="Description"
                    type="text"
                  />
                </InputGroup>
              </FormControl>
            </Stack>
          </ModalBody>

          <ModalFooter gap={3}>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Save
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal >
    </>
  )
}

export default AddSwitch
