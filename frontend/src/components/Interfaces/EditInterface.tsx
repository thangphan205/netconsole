import {
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
  Select,
  Divider,
  Flex,
  Text
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type SubmitHandler, useForm } from "react-hook-form"

import {
  type ApiError,
  type InterfacePublic,
  type InterfaceUpdate,
  InterfacesService,
} from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

interface EditInterfaceProps {
  item: InterfacePublic
  isOpen: boolean
  onClose: () => void
}

const EditInterface = ({ item, isOpen, onClose }: EditInterfaceProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors, isDirty },
  } = useForm<InterfaceUpdate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: item,
  })

  const mutation = useMutation({
    mutationFn: (data: InterfaceUpdate) =>
      InterfacesService.updateInterface({ id: item.id, requestBody: data }),
    onSuccess: () => {
      showToast("Success!", "Interface updated successfully.", "success")
      onClose()
    },
    onError: (err: ApiError) => {
      const errDetail = (err.body as any)?.detail
      showToast("Something went wrong.", `${errDetail}`, "error")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["interfaces"] })
    },
  })

  const onSubmit: SubmitHandler<InterfaceUpdate> = async (data) => {
    mutation.mutate(data)
  }

  const onCancel = () => {
    reset()
    onClose()
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
          <ModalHeader>Edit Interface {item.port}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Stack spacing={2}>
              <Flex align="center" mb={4}>
                <Divider flex="1" borderColor="gray.400" />
                <Text mx={4} color="gray.500" fontWeight="medium">
                  Interface {item.port} info:
                </Text>
                <Divider flex="1" borderColor="gray.400" />
              </Flex>
              <FormControl >
                <Text mx={4} fontWeight="medium">
                  Speed: {item.speed}; Duplex: {item.duplex}; Type: {item.type}
                </Text>
                {
                  item.mode === "trunk" ? (
                    <>
                      <Text mx={4} fontWeight="medium">
                        Native VLAN: {item.native_vlan}
                      </Text>
                      <Text mx={4} fontWeight="medium">
                        Allowed VLAN: {item.allowed_vlan}
                      </Text>
                    </>
                  ) : null
                }
              </FormControl>
              <FormControl isRequired isInvalid={!!errors.description}>
                <InputGroup>
                  <InputLeftAddon>Description</InputLeftAddon>
                  <Input
                    id="description"
                    {...register("description", {
                      required: "description is required.",
                    })}
                    placeholder="description"
                    type="text"
                  />
                </InputGroup>

                {errors.duplex && (
                  <FormErrorMessage>{errors.duplex.message}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl isRequired isInvalid={!!errors.vlan}>
                <InputGroup>
                  <InputLeftAddon>Mode</InputLeftAddon>
                  <Select placeholder='Select interface mode' id="mode" {...register("mode", {
                    required: "Mode is required.",
                  })}>
                    <option value='access'>access</option>
                    <option value='trunk'>trunk</option>
                  </Select>

                </InputGroup>
                {errors.mode && (
                  <FormErrorMessage>{errors.mode.message}</FormErrorMessage>
                )}
              </FormControl>
              <Flex align="center" mb={4}>
                <Divider flex="1" borderColor="gray.400" />
                <Text mx={4} color="gray.500" fontWeight="medium">
                  Port Access config only
                </Text>
                <Divider flex="1" borderColor="gray.400" />
              </Flex>

              <FormControl isRequired isInvalid={!!errors.vlan}>
                <InputGroup>
                  <InputLeftAddon>VLAN</InputLeftAddon>
                  <Input
                    id="vlan"
                    {...register("vlan", {
                    })}
                    placeholder="VLAN for mode access only"
                    type="text"
                  />
                </InputGroup>
                {errors.vlan && (
                  <FormErrorMessage>{errors.vlan.message}</FormErrorMessage>
                )}
              </FormControl>

              <Flex align="center" mb={4}>
                <Divider flex="1" borderColor="gray.400" />
                <Text mx={4} color="gray.500" fontWeight="medium">
                  Port Trunk config only
                </Text>
                <Divider flex="1" borderColor="gray.400" />
              </Flex>

              <FormControl isRequired isInvalid={!!errors.native_vlan}>
                <InputGroup>
                  <InputLeftAddon>Native VLAN</InputLeftAddon>
                  <Input
                    id="native_vlan"
                    {...register("native_vlan", {
                    })}
                    placeholder="Native VLAN port mode trunk only"
                    type="text"
                  />
                </InputGroup>
                {errors.native_vlan && (
                  <FormErrorMessage>{errors.native_vlan.message}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl isRequired isInvalid={!!errors.allowed_vlan}>
                <InputGroup>
                  <InputLeftAddon>Allowed VLAN</InputLeftAddon>
                  <Input
                    id="allowed_vlan"
                    {...register("allowed_vlan", {
                    })}
                    placeholder="Allowed VLAN port mode trunk only"
                    type="text"
                    disabled={true}
                  />
                </InputGroup>
                {errors.allowed_vlan && (
                  <FormErrorMessage>{errors.allowed_vlan.message}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl isRequired isInvalid={!!errors.allowed_vlan_add}>
                <InputGroup>
                  <InputLeftAddon>Allowed VLAN ADD</InputLeftAddon>
                  <Input
                    id="allowed_vlan_add"
                    {...register("allowed_vlan_add", {
                    })}
                    placeholder="Allowed VLAN port mode trunk only"
                    type="text"
                  />
                </InputGroup>
                {errors.allowed_vlan_add && (
                  <FormErrorMessage>{errors.allowed_vlan_add.message}</FormErrorMessage>
                )}
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmitting}
              isDisabled={!isDirty}
            >
              Save
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal >
    </>
  )
}

export default EditInterface
