import {
  Button,
  FormControl,
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

} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type SubmitHandler, useForm } from "react-hook-form"

import { type ApiError, type InterfaceCreate, InterfacesService } from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

interface AddInterfaceProps {
  isOpen: boolean
  onClose: () => void
}

const AddInterface = ({ isOpen, onClose }: AddInterfaceProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<InterfaceCreate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      description: "",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: InterfaceCreate) =>
      InterfacesService.createInterface({ requestBody: data }),
    onSuccess: () => {
      showToast("Success!", "Interface created successfully.", "success")
      reset()
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

  const onSubmit: SubmitHandler<InterfaceCreate> = (data) => {
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
          <ModalHeader>Add Interface</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Stack spacing={4}>


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

export default AddInterface
