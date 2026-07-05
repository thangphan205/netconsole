import {
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type SubmitHandler, useForm } from "react-hook-form"

import {
  type MultiValue,
  type OptionBase,
  Select,
  type SingleValue,
} from "chakra-react-select"
import { useState } from "react"
import {
  type ApiError,
  CredentialsService,
  GroupsService,
  type SwitchCreate,
  SwitchesService,
} from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

interface AddSwitchProps {
  isOpen: boolean
  onClose: () => void
}
interface GroupOption extends OptionBase {
  label: string
  value: string
}
interface CredentialOption extends OptionBase {
  label: string
  value: number
}

const SectionBox = ({
  title,
  children,
}: { title: string; children: React.ReactNode }) => (
  <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={4}>
    <Text
      fontSize="xs"
      fontWeight="semibold"
      color="gray.500"
      textTransform="uppercase"
      letterSpacing="wider"
      mb={3}
    >
      {title}
    </Text>
    {children}
  </Box>
)

const AddSwitch = ({ isOpen, onClose }: AddSwitchProps) => {
  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => await GroupsService.readGroups({}),
  })
  const { data: credentials } = useQuery({
    queryKey: ["credentials"],
    queryFn: async () => await CredentialsService.readCredentials({}),
  })
  const [credential_id, set_credential_id] = useState<number>(0)
  const [platform, set_platform] = useState<string>("")
  const [device_type, set_device_type] = useState<string>("")
  const [groups_list, set_groups_list] = useState<string>("")

  const handleSelectChangeCredential = (
    newValue: SingleValue<CredentialOption>,
  ) => {
    if (newValue) set_credential_id(newValue.value)
  }
  const handleSelectChangePlatform = (newValue: SingleValue<GroupOption>) => {
    if (newValue) set_platform(newValue.value)
  }
  const handleSelectChangeDeviceType = (newValue: SingleValue<GroupOption>) => {
    if (newValue) set_device_type(newValue.value)
  }
  const handleSelectChangeGroups = (newValues: MultiValue<GroupOption>) => {
    if (newValues) {
      set_groups_list(newValues.map((item) => item.value).join())
    }
  }

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
    const pattern = /^[a-zA-Z0-9_]+$/
    if (!pattern.test(data.hostname)) {
      showToast(
        "ERROR!",
        "Switch hostname include [a-z],[A-Z], [0-9] and _ only.",
        "error",
      )
      return true
    }
    data.credential_id = credential_id
    data.platform = platform
    data.device_type = device_type
    data.groups = groups_list
    mutation.mutate(data)
  }

  const optionPlatform: GroupOption[] = [
    { label: "Cisco IOS", value: "ios" },
    { label: "Cisco Nexus SSH", value: "nxos_ssh" },
    { label: "Juniper JunOS", value: "junos" },
    { label: "Arista EOS", value: "eos" },
  ]
  const optionDeviceType: GroupOption[] = [
    { label: "Cisco IOS", value: "cisco_ios" },
    { label: "Cisco Nexus", value: "cisco_nxos" },
    { label: "Juniper JunOS", value: "juniper_junos" },
    { label: "Arista EOS", value: "arista_eos" },
  ]
  let optionGroups: GroupOption[] = []
  if (groups && groups.data.length > 0) {
    optionGroups = optionDeviceType.concat(
      groups.data.map((item) => ({
        value: item.name,
        label: `${item.name} - ${item.site}`,
      })),
    )
  }
  let optionCredentials: CredentialOption[] = []
  if (credentials && credentials.data.length > 0) {
    optionCredentials = credentials.data.map((item) => ({
      value: item.id,
      label: `${item.id} - ${item.username}`,
    }))
  }

  return (
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
              <FormLabel htmlFor="hostname" fontSize="sm" fontWeight="medium">
                Hostname
              </FormLabel>
              <Input
                id="hostname"
                {...register("hostname", { required: "Hostname is required." })}
                placeholder="e.g. core-sw-01"
                type="text"
              />
              {errors.hostname && (
                <FormErrorMessage>{errors.hostname.message}</FormErrorMessage>
              )}
            </FormControl>

            <SectionBox title="Connection">
              <Stack spacing={3}>
                <SimpleGrid columns={2} spacing={3}>
                  <FormControl isRequired isInvalid={!!errors.ipaddress}>
                    <FormLabel
                      htmlFor="ipaddress"
                      fontSize="sm"
                      fontWeight="medium"
                    >
                      IP Address
                    </FormLabel>
                    <Input
                      id="ipaddress"
                      {...register("ipaddress", {
                        required: "IP Address is required.",
                      })}
                      placeholder="192.168.1.1"
                      type="text"
                    />
                    {errors.ipaddress && (
                      <FormErrorMessage>
                        {errors.ipaddress.message}
                      </FormErrorMessage>
                    )}
                  </FormControl>
                  <FormControl isRequired isInvalid={!!errors.port}>
                    <FormLabel htmlFor="port" fontSize="sm" fontWeight="medium">
                      Port
                    </FormLabel>
                    <Input
                      id="port"
                      {...register("port", { required: "Port is required." })}
                      placeholder="22"
                      type="number"
                    />
                    {errors.port && (
                      <FormErrorMessage>{errors.port.message}</FormErrorMessage>
                    )}
                  </FormControl>
                </SimpleGrid>
                <FormControl>
                  <FormLabel fontSize="sm" fontWeight="medium">
                    Credentials
                  </FormLabel>
                  <Box zIndex={101} position="relative">
                    <Select
                      name="credential_id"
                      options={optionCredentials}
                      placeholder="Select credential…"
                      isMulti={false}
                      onChange={handleSelectChangeCredential}
                    />
                  </Box>
                </FormControl>
              </Stack>
            </SectionBox>

            <SectionBox title="Device">
              <Stack spacing={3}>
                <SimpleGrid columns={2} spacing={3}>
                  <FormControl isRequired isInvalid={!!errors.platform}>
                    <FormLabel fontSize="sm" fontWeight="medium">
                      Platform
                    </FormLabel>
                    <Box zIndex={100} position="relative">
                      <Select
                        name="platform"
                        options={optionPlatform}
                        placeholder="Select platform…"
                        isMulti={false}
                        onChange={handleSelectChangePlatform}
                      />
                    </Box>
                    {errors.platform && (
                      <FormErrorMessage>
                        {errors.platform.message}
                      </FormErrorMessage>
                    )}
                  </FormControl>
                  <FormControl isRequired isInvalid={!!errors.device_type}>
                    <FormLabel fontSize="sm" fontWeight="medium">
                      Device Type
                    </FormLabel>
                    <Box zIndex={99} position="relative">
                      <Select
                        name="device_type"
                        options={optionDeviceType}
                        placeholder="Select device type…"
                        isMulti={false}
                        onChange={handleSelectChangeDeviceType}
                      />
                    </Box>
                    {errors.device_type && (
                      <FormErrorMessage>
                        {errors.device_type.message}
                      </FormErrorMessage>
                    )}
                  </FormControl>
                </SimpleGrid>
                <FormControl>
                  <FormLabel fontSize="sm" fontWeight="medium">
                    Groups
                  </FormLabel>
                  <Box zIndex={98} position="relative">
                    <Select
                      name="groups"
                      options={optionGroups}
                      placeholder="Select groups…"
                      isMulti={true}
                      onChange={handleSelectChangeGroups}
                    />
                  </Box>
                </FormControl>
              </Stack>
            </SectionBox>

            <FormControl>
              <FormLabel
                htmlFor="description"
                fontSize="sm"
                fontWeight="medium"
              >
                Description
              </FormLabel>
              <Input
                id="description"
                {...register("description")}
                placeholder="Optional description"
                type="text"
              />
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
    </Modal>
  )
}

export default AddSwitch
