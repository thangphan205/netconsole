import {
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
  Select,
  Stack,
  Text,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"

import { CidrInput } from "../Common/CidrInput"

import {
  type ApiError,
  type ApiKeyPublic,
  type ApiKeyUpdate,
  ApiKeysService,
} from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

interface EditApiKeyProps {
  item: ApiKeyPublic
  isOpen: boolean
  onClose: () => void
}

const EditApiKey = ({ item, isOpen, onClose }: EditApiKeyProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors, isDirty },
  } = useForm<ApiKeyUpdate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: item,
  })

  const mutation = useMutation({
    mutationFn: (data: ApiKeyUpdate) =>
      ApiKeysService.updateApiKey({ id: item.id, requestBody: data }),
    onSuccess: () => {
      showToast("Success!", "API key updated successfully.", "success")
      onClose()
    },
    onError: (err: ApiError) => {
      const errDetail = (err.body as any)?.detail
      showToast("Something went wrong.", `${errDetail}`, "error")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["api_keys"] })
    },
  })

  const onSubmit: SubmitHandler<ApiKeyUpdate> = async (data) => {
    // Only submit the fields this form actually exposes — `item` (used as
    // defaultValues) carries the full row, and forwarding it wholesale would
    // silently resubmit is_active/expires_at on every save, clobbering any
    // concurrent change to those fields.
    mutation.mutate({
      name: data.name,
      role: data.role,
      allowed_ips: data.allowed_ips,
    })
  }

  const onCancel = () => {
    reset()
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={{ base: "sm", md: "md" }}
      isCentered
    >
      <ModalOverlay />
      <ModalContent as="form" onSubmit={handleSubmit(onSubmit)}>
        <ModalHeader>Edit API Key</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <Stack spacing={4}>
            <FormControl isInvalid={!!errors.name}>
              <FormLabel htmlFor="name" fontSize="sm" fontWeight="medium">
                Name
              </FormLabel>
              <Input
                id="name"
                {...register("name")}
                placeholder="e.g. claude-mcp"
                type="text"
              />
              {errors.name && (
                <FormErrorMessage>{errors.name.message}</FormErrorMessage>
              )}
            </FormControl>

            <FormControl isRequired>
              <FormLabel htmlFor="role" fontSize="sm" fontWeight="medium">
                Role
              </FormLabel>
              <Select id="role" {...register("role")}>
                <option value="read_write">Read-write</option>
                <option value="read_only">Read-only</option>
              </Select>
            </FormControl>

            <FormControl isInvalid={!!errors.allowed_ips}>
              <FormLabel
                htmlFor="allowed_ips"
                fontSize="sm"
                fontWeight="medium"
              >
                Allowed IPs{" "}
                <Text as="span" fontSize="xs" color="gray.400">
                  comma-separated CIDRs
                </Text>
              </FormLabel>
              <Controller
                name="allowed_ips"
                control={control}
                render={({ field }) => (
                  <CidrInput
                    value={field.value || ""}
                    onChange={field.onChange}
                    placeholder="e.g. 10.0.0.0/24, 203.0.113.5/32 (default: 0.0.0.0/0 = allow all)"
                    isInvalid={!!errors.allowed_ips}
                  />
                )}
              />
              {errors.allowed_ips && (
                <FormErrorMessage>
                  {errors.allowed_ips.message}
                </FormErrorMessage>
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
    </Modal>
  )
}

export default EditApiKey
