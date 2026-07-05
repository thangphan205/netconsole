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

import { type OptionBase, Select, type SingleValue } from "chakra-react-select"
import { useState } from "react"
import {
  type ApiError,
  CredentialsService,
  GroupsService,
  type SwitchPublic,
  type SwitchUpdate,
  SwitchesService,
} from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

interface EditSwitchProps {
  item: SwitchPublic
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

const EditSwitch = ({ item, isOpen, onClose }: EditSwitchProps) => {
  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => await GroupsService.readGroups({}),
  })
  const { data: credentials } = useQuery({
    queryKey: ["credentials"],
    queryFn: async () => await CredentialsService.readCredentials({}),
  })
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<SwitchUpdate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: item,
  })

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

  const [selectedCredential, set_selectedCredential] = useState({
    label: "",
    value: 0,
  } as CredentialOption)
  const [is_selectedCredential, set_is_selectedCredential] = useState(false)
  const [selectedPlatform, set_selectedPlatform] = useState(
    optionPlatform.find((o) => o.value === item.platform) ?? optionPlatform[0],
  )
  const [selectedDeviceType, set_selectedDeviceType] = useState(
    optionDeviceType.find((o) => o.value === item.device_type) ??
      optionDeviceType[0],
  )
  const [groups_list, set_groups_list] = useState<GroupOption[]>([])
  const [is_groups_list, set_is_groups_list] = useState(false)

  const handleSelectChangePlatform = (newValue: SingleValue<GroupOption>) => {
    if (newValue) set_selectedPlatform(newValue)
  }
  const handleSelectChangeDeviceType = (newValue: SingleValue<GroupOption>) => {
    if (newValue) set_selectedDeviceType(newValue)
  }
  const handleSelectChangeGroups = (newValues: any) => {
    if (newValues) set_groups_list(newValues)
  }
  const handleSelectChangeCredential = (
    newValue: SingleValue<CredentialOption>,
  ) => {
    if (newValue) set_selectedCredential(newValue)
  }

  const mutation = useMutation({
    mutationFn: (data: SwitchUpdate) =>
      SwitchesService.updateSwitch({ id: item.id, requestBody: data }),
    onSuccess: () => {
      showToast("Success!", "Switch updated successfully.", "success")
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
  const mutation_update_metadata = useMutation({
    mutationFn: () => SwitchesService.updateSwitchMetadata({ id: item.id }),
    onSuccess: () => {
      showToast("Success!", "Switch metadata updated successfully.", "success")
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

  const onSubmit: SubmitHandler<SwitchUpdate> = async (data) => {
    data.platform = selectedPlatform.value
    data.device_type = selectedDeviceType.value
    data.groups = groups_list.map((g) => g.value).join()
    data.credential_id = selectedCredential.value
    mutation.mutate(data)
  }
  const onClickUpdateMetadata: SubmitHandler<any> = async (data) => {
    mutation_update_metadata.mutate(data)
  }
  const onCancel = () => {
    reset()
    onClose()
  }

  let optionGroups: GroupOption[] = []
  if (groups && groups.data.length > 0) {
    optionGroups = optionDeviceType.concat(
      groups.data.map((itemGroup) => ({
        value: itemGroup.name,
        label: `${itemGroup.name} - ${itemGroup.site}`,
      })),
    )
  }

  const defaultselectedGroups: GroupOption[] = []
  optionGroups.forEach((itemGroup) => {
    if (item?.groups) {
      item.groups.split(",").forEach((sel) => {
        if (itemGroup.value === sel) defaultselectedGroups.push(itemGroup)
      })
    }
  })
  if (!is_groups_list) {
    set_groups_list(defaultselectedGroups)
    set_is_groups_list(true)
  }

  const optionCredentials: CredentialOption[] = []
  let defaultselectedCredential: CredentialOption = { label: "", value: 0 }
  if (credentials && credentials.data.length > 0) {
    credentials.data.forEach((itemCredential) => {
      const opt = {
        value: itemCredential.id,
        label: `${itemCredential.id} - ${itemCredential.username}`,
      }
      optionCredentials.push(opt)
      if (itemCredential.id === item.credential_id)
        defaultselectedCredential = opt
    })
  }
  if (!is_selectedCredential) {
    set_selectedCredential(defaultselectedCredential)
    set_is_selectedCredential(true)
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
        <ModalHeader>Edit Switch</ModalHeader>
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
                placeholder="hostname"
                type="text"
                isDisabled
                bg="gray.50"
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
                      value={selectedCredential}
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
                        value={selectedPlatform}
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
                        value={selectedDeviceType}
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
                      value={groups_list}
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
          <Button variant="primary" onClick={onClickUpdateMetadata}>
            Update Running Config
          </Button>
          <Button variant="primary" type="submit" isLoading={isSubmitting}>
            Save
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default EditSwitch
