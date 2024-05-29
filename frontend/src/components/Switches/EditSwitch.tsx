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
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type SubmitHandler, useForm } from "react-hook-form"

import {
  type ApiError,
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

const EditSwitch = ({ item, isOpen, onClose }: EditSwitchProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors, isDirty },
  } = useForm<SwitchUpdate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: item,
  })

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
    mutation.mutate(data)
  }
  const onClickUpdateMetadata: SubmitHandler<any> = async (data) => {
    mutation_update_metadata.mutate(data)
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
                <InputGroup>
                  <InputLeftAddon>Platform</InputLeftAddon>
                  <Input
                    id="platform"
                    {...register("platform", {
                      required: "Platform is required.",
                    })}
                    placeholder="Platform"
                    type="text"
                    disabled
                  />
                </InputGroup>
                {errors.platform && (
                  <FormErrorMessage>{errors.platform.message}</FormErrorMessage>
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
              isDisabled={!isDirty}
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
