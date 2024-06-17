import {
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  Input,
  InputGroup,
  InputLeftAddon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type SubmitHandler, useForm } from "react-hook-form"

import {
  type ApiError,
  type SwitchPublic,
  type SwitchUpdate,
  SwitchesService,
  GroupsService
} from "../../client"
import useCustomToast from "../../hooks/useCustomToast"
import { useState } from "react"
import { OptionBase, Select, SingleValue, } from "chakra-react-select";

interface EditSwitchProps {
  item: SwitchPublic
  isOpen: boolean
  onClose: () => void
}
interface GroupOption extends OptionBase {
  label: string;
  value: string;
}

const EditSwitch = ({ item, isOpen, onClose }: EditSwitchProps) => {
  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => await GroupsService.readGroups({}),
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

  const [selectedPlatform, set_selectedPlatform] = useState({ "label": "Cisco IOS", "value": "ios" });
  const [is_selectedPlatform, set_is_selectedPlatform] = useState(false);
  const [selectedDeviceType, set_selectedDeviceType] = useState({ "label": "Cisco IOS", "value": "cisco_ios" });
  const [is_selectedDeviceType, set_is_selectedDeviceType] = useState(false);

  const [groups_list, set_groups_list] = useState([{ "label": "Cisco IOS", "value": "cisco_ios" }]);
  const [is_groups_list, set_is_groups_list] = useState(false);
  const handleSelectChangePlatform = (
    newValue: SingleValue<GroupOption>) => {
    if (newValue) {
      set_selectedPlatform(newValue);
    }
  };
  const handleSelectChangeDeviceType = (
    newValue: SingleValue<GroupOption>) => {
    if (newValue) {
      set_selectedDeviceType(newValue);
    }
  };
  const handleSelectChangeGroups = (
    newValues: any) => {
    if (newValues) {
      set_groups_list(newValues);
    }
  };
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
    mutationFn: () =>
      SwitchesService.updateSwitchMetadata({ id: item.id }),
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
    data.platform = selectedPlatform.value;
    data.device_type = selectedDeviceType.value;
    let selectedGroups: any = [];
    groups_list.map((item) => {
      selectedGroups.push(item.value);
    })
    data.groups = selectedGroups.join();
    mutation.mutate(data)
  }
  const onClickUpdateMetadata: SubmitHandler<any> = async (data) => {
    mutation_update_metadata.mutate(data)
  }
  const onCancel = () => {
    reset()
    onClose()
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
  optionPlatform.map((itemPlatform) => {
    if (itemPlatform.value === item.platform && !is_selectedPlatform) {
      set_selectedPlatform(itemPlatform);
      set_is_selectedPlatform(true);
    }
  })
  optionDeviceType.map((itemDeviceType) => {
    if (itemDeviceType.value === item.device_type && !is_selectedDeviceType) {
      set_selectedDeviceType(itemDeviceType);
      set_is_selectedDeviceType(true);
    }
  })
  let optionGroups: GroupOption[] = [];
  if (groups && groups.data.length > 0) {
    optionGroups = optionDeviceType.concat(groups.data.map((item) => ({
      value: item.name,
      label: item.name + " - " + item.site
    })));
  }
  let defaultselectedGroups: any = [];
  optionGroups.map((itemGroup) => {
    if (item && item.groups) {
      item.groups.split(",").map((itemselectedGroup) => {
        if (itemGroup.value === itemselectedGroup) {
          defaultselectedGroups.push(itemGroup)
        }
      })
    }
  })
  if (!is_groups_list) {
    set_groups_list(defaultselectedGroups);
    set_is_groups_list(true);
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
          <ModalHeader>Edit Switch</ModalHeader>
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
                    placeholder="hostname"
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
                    placeholder="IP Address"
                    type="text"
                  />
                </InputGroup>
                {errors.ipaddress && (
                  <FormErrorMessage>{errors.ipaddress.message}</FormErrorMessage>
                )}
              </FormControl>

              <FormControl isRequired isInvalid={!!errors.platform}>
                <Box position="relative" w="100%" zIndex={100} >
                  <InputGroup>
                    <InputLeftAddon>Platform</InputLeftAddon>
                    <Box position="relative" w="100%" zIndex={100} >
                      <Select
                        name="flatform"
                        value={selectedPlatform}
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
                        value={selectedDeviceType}
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
                        value={groups_list}
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
            <Button
              variant="primary"
              onClick={onClickUpdateMetadata}
            >
              Update RunningConfig
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmitting}
            >
              Save
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}

export default EditSwitch
