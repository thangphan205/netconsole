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
  Stack,
  Text,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type SubmitHandler, useForm } from "react-hook-form"

import {
  type ApiError,
  type CredentialPublic,
  type CredentialUpdate,
  CredentialsService,
} from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

interface EditCredentialProps {
  item: CredentialPublic
  isOpen: boolean
  onClose: () => void
}

const SectionBox = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={4}>
    <Text fontSize="xs" fontWeight="semibold" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={3}>
      {title}
    </Text>
    {children}
  </Box>
)

const EditCredential = ({ item, isOpen, onClose }: EditCredentialProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors, isDirty },
  } = useForm<CredentialUpdate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: item,
  })

  const mutation = useMutation({
    mutationFn: (data: CredentialUpdate) =>
      CredentialsService.updateCredential({ id: item.id, requestBody: data }),
    onSuccess: () => {
      showToast("Success!", "Credential updated successfully.", "success")
      onClose()
    },
    onError: (err: ApiError) => {
      const errDetail = (err.body as any)?.detail
      showToast("Something went wrong.", `${errDetail}`, "error")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["credentials"] })
    },
  })

  const onSubmit: SubmitHandler<CredentialUpdate> = async (data) => {
    mutation.mutate(data)
  }

  const onCancel = () => {
    reset()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size={{ base: "sm", md: "md" }} isCentered>
      <ModalOverlay />
      <ModalContent as="form" onSubmit={handleSubmit(onSubmit)}>
        <ModalHeader>Edit Credential</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <Stack spacing={4}>
            <FormControl isRequired isInvalid={!!errors.username}>
              <FormLabel htmlFor="username" fontSize="sm" fontWeight="medium">Username</FormLabel>
              <Input
                id="username"
                {...register("username", { required: "Username is required." })}
                placeholder="e.g. netadmin"
                type="text"
                autoComplete="off"
              />
              {errors.username && <FormErrorMessage>{errors.username.message}</FormErrorMessage>}
            </FormControl>

            <SectionBox title="Authentication">
              <Stack spacing={3}>
                <FormControl isRequired isInvalid={!!errors.password}>
                  <FormLabel htmlFor="password" fontSize="sm" fontWeight="medium">Password</FormLabel>
                  <Input
                    id="password"
                    {...register("password", { required: "Password is required." })}
                    placeholder="Login password"
                    type="password"
                    autoComplete="new-password"
                  />
                  {errors.password && <FormErrorMessage>{errors.password.message}</FormErrorMessage>}
                </FormControl>
                <FormControl>
                  <FormLabel htmlFor="enable_password" fontSize="sm" fontWeight="medium">Enable Password</FormLabel>
                  <Input
                    id="enable_password"
                    {...register("enable_password")}
                    placeholder="Leave blank to use login password"
                    type="password"
                    autoComplete="new-password"
                  />
                </FormControl>
              </Stack>
            </SectionBox>

            <FormControl>
              <FormLabel htmlFor="description" fontSize="sm" fontWeight="medium">Description</FormLabel>
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
          <Button variant="primary" type="submit" isLoading={isSubmitting} isDisabled={!isDirty}>
            Save
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default EditCredential
