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
  Select

} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type SubmitHandler, useForm } from "react-hook-form"

import { type ApiError, type SwitchCreate, SwitchesService } from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

interface AddSwitchProps {
  isOpen: boolean
  onClose: () => void
}

const AddSwitch = ({ isOpen, onClose }: AddSwitchProps) => {
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
      description: "",
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
    mutation.mutate(data)
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size={{ base: "sm", md: "md" }}
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
                <InputGroup>
                  <InputLeftAddon>Platform</InputLeftAddon>
                  <Select placeholder='Select OS Platform' id="platform" {...register("platform", {
                    required: "Platform is required.",
                  })}>
                    <option value='nxos_ssh'>Cisco Nexus SSH</option>
                    <option value='ios'>Cisco IOS</option>
                    <option value='junos'>Juniper Junos</option>
                  </Select>
                </InputGroup>
                {errors.platform && (
                  <FormErrorMessage>{errors.platform.message}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl isRequired isInvalid={!!errors.device_type}>
                <InputGroup>
                  <InputLeftAddon>Device Type</InputLeftAddon>
                  <Select placeholder='Select Device Type' id="device_type" {...register("device_type", {
                    required: "Device Type is required.",
                  })}>
                    <option value='cisco_nxos'>Cisco Nexus</option>
                    <option value='cisco_ios'>Cisco IOS</option>
                    <option value='juniper_junos'>Juniper Junos</option>
                  </Select>
                </InputGroup>
                {errors.device_type && (
                  <FormErrorMessage>{errors.device_type.message}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl isRequired isInvalid={!!errors.groups}>
                <InputGroup>
                  <InputLeftAddon>Groups</InputLeftAddon>
                  <Select placeholder='Select Device Type' id="groups" {...register("groups", {
                    required: "groups is required.",
                  })}>
                    <option value='cisco_nxos'>Cisco Nexus</option>
                    <option value='cisco_ios'>Cisco IOS</option>
                    <option value='juniper_junos'>Juniper Junos</option>
                  </Select>
                </InputGroup>
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
      </Modal>
    </>
  )
}

export default AddSwitch
