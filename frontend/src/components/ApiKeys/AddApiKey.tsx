import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Code,
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
  Tooltip,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"

import { CidrInput } from "../Common/CidrInput"

import {
  type ApiError,
  type ApiKeyCreate,
  type ApiKeyCreateResponse,
  ApiKeysService,
} from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

interface AddApiKeyProps {
  isOpen: boolean
  onClose: () => void
}

const AddApiKey = ({ isOpen, onClose }: AddApiKeyProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const [created, setCreated] = useState<ApiKeyCreateResponse | null>(null)
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ApiKeyCreate>({
    mode: "onBlur",
    defaultValues: {
      name: "",
      role: "read_write",
      allowed_ips: "0.0.0.0/0",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: ApiKeyCreate) =>
      ApiKeysService.createApiKey({ requestBody: data }),
    onSuccess: (data) => {
      setCreated(data)
    },
    onError: (err: ApiError) => {
      const errDetail = (err.body as any)?.detail
      showToast("Something went wrong.", `${errDetail}`, "error")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["api_keys"] })
    },
  })

  const onSubmit: SubmitHandler<ApiKeyCreate> = (data) => {
    mutation.mutate(data)
  }

  const handleClose = () => {
    reset()
    setCreated(null)
    onClose()
  }

  const handleCopy = () => {
    if (created) {
      navigator.clipboard.writeText(created.key)
      showToast("Copied", "API key copied to clipboard.", "success")
    }
  }

  if (created) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        size={{ base: "sm", md: "md" }}
        isCentered
        closeOnOverlayClick={false}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>API Key Created</ModalHeader>
          <ModalBody pb={6}>
            <Stack spacing={4}>
              <Alert status="warning" borderRadius="md">
                <AlertIcon />
                <Text fontSize="sm">
                  This key is shown only once. Copy it now — it cannot be
                  retrieved again.
                </Text>
              </Alert>
              <Box
                borderRadius="md"
                border="1px solid"
                borderColor="gray.200"
                p={2}
              >
                <Code
                  display="block"
                  whiteSpace="pre-wrap"
                  wordBreak="break-all"
                  p={2}
                  fontSize="sm"
                  bg="gray.50"
                  w="full"
                >
                  {created.key}
                </Code>
              </Box>
            </Stack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Tooltip label="Copy to clipboard">
              <Button variant="primary" onClick={handleCopy}>
                Copy
              </Button>
            </Tooltip>
            <Button onClick={handleClose}>Done</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size={{ base: "sm", md: "md" }}
      isCentered
    >
      <ModalOverlay />
      <ModalContent as="form" onSubmit={handleSubmit(onSubmit)}>
        <ModalHeader>Add API Key</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <Stack spacing={4}>
            <FormControl isRequired isInvalid={!!errors.name}>
              <FormLabel htmlFor="name" fontSize="sm" fontWeight="medium">
                Name
              </FormLabel>
              <Input
                id="name"
                {...register("name", { required: "Name is required." })}
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
          <Button variant="primary" type="submit" isLoading={isSubmitting}>
            Create
          </Button>
          <Button onClick={handleClose}>Cancel</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default AddApiKey
