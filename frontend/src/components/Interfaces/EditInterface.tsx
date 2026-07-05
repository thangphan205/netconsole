import {
  Badge,
  Box,
  Button,
  Divider,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Grid,
  Heading,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"
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

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <Box>
      <Text fontSize="xs" color="gray.400" mb={0.5}>
        {label}
      </Text>
      <Text fontSize="sm" fontWeight="medium" color="gray.700">
        {value || "—"}
      </Text>
    </Box>
  )
}

function ModeBadge({ mode }: { mode?: string | null }) {
  const colorMap: Record<string, string> = {
    access: "blue",
    trunk: "purple",
    routed: "teal",
  }
  const color = mode ? colorMap[mode] ?? "gray" : "gray"
  return (
    <Badge
      colorScheme={color}
      variant="subtle"
      borderRadius="full"
      fontSize="xs"
    >
      {mode ?? "—"}
    </Badge>
  )
}

const EditInterface = ({ item, isOpen, onClose }: EditInterfaceProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const [interfaceMode, setInterfaceMode] = useState(item.mode ?? "access")

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
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
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent as="form" onSubmit={handleSubmit(onSubmit)}>
        <ModalHeader pb={2}>
          <Text fontSize="lg" fontWeight="bold">
            Edit Interface
          </Text>
          <Text fontSize="sm" color="gray.500" fontWeight="normal">
            {item.port}
          </Text>
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody pb={6}>
          <VStack spacing={5} align="stretch">
            {/* Current state info card */}
            <Box
              bg="gray.50"
              border="1px solid"
              borderColor="gray.200"
              borderRadius="lg"
              p={4}
            >
              <Text
                fontSize="xs"
                fontWeight="semibold"
                color="gray.500"
                textTransform="uppercase"
                letterSpacing="wide"
                mb={3}
              >
                Current State
              </Text>
              <Grid templateColumns="repeat(2, 1fr)" gap={3}>
                <Box>
                  <Text fontSize="xs" color="gray.400" mb={1}>
                    Mode
                  </Text>
                  <ModeBadge mode={item.mode} />
                </Box>
                <InfoItem label="Speed" value={item.speed} />
                <InfoItem label="Duplex" value={item.duplex} />
                <InfoItem label="Type" value={item.type} />
                {item.mode === "trunk" && (
                  <>
                    <InfoItem label="Native VLAN" value={item.native_vlan} />
                    <InfoItem label="Allowed VLANs" value={item.allowed_vlan} />
                  </>
                )}
                {item.mode === "access" && (
                  <InfoItem label="VLAN" value={item.vlan} />
                )}
              </Grid>
            </Box>

            <Divider />

            {/* Description */}
            <FormControl isInvalid={!!errors.description}>
              <FormLabel fontSize="sm" fontWeight="medium">
                Description
              </FormLabel>
              <Input
                {...register("description")}
                placeholder="Interface description"
                size="md"
              />
              {errors.description && (
                <FormErrorMessage>
                  {errors.description.message}
                </FormErrorMessage>
              )}
            </FormControl>

            {/* Mode */}
            <FormControl isInvalid={!!errors.mode}>
              <FormLabel fontSize="sm" fontWeight="medium">
                Mode
              </FormLabel>
              <Controller
                name="mode"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    value={field.value ?? "access"}
                    onChange={(val) => {
                      field.onChange(val)
                      setInterfaceMode(val)
                    }}
                  >
                    <Stack direction="row" spacing={5}>
                      <Radio value="access" colorScheme="blue" size="sm">
                        <Text fontSize="sm">Access</Text>
                      </Radio>
                      <Radio value="trunk" colorScheme="purple" size="sm">
                        <Text fontSize="sm">Trunk</Text>
                      </Radio>
                    </Stack>
                  </RadioGroup>
                )}
              />
              {errors.mode && (
                <FormErrorMessage>{errors.mode.message}</FormErrorMessage>
              )}
            </FormControl>

            {/* Mode-specific config */}
            {interfaceMode === "access" ? (
              <Box
                bg="blue.50"
                border="1px solid"
                borderColor="blue.100"
                borderRadius="lg"
                p={4}
              >
                <Heading size="xs" color="blue.600" mb={3}>
                  Access Port Config
                </Heading>
                <FormControl isInvalid={!!errors.vlan}>
                  <FormLabel fontSize="sm" fontWeight="medium">
                    Access VLAN
                  </FormLabel>
                  <Input
                    {...register("vlan")}
                    placeholder="e.g. 23"
                    bg="white"
                    size="sm"
                  />
                  {errors.vlan && (
                    <FormErrorMessage>{errors.vlan.message}</FormErrorMessage>
                  )}
                </FormControl>
              </Box>
            ) : (
              <Box
                bg="purple.50"
                border="1px solid"
                borderColor="purple.100"
                borderRadius="lg"
                p={4}
              >
                <Heading size="xs" color="purple.600" mb={3}>
                  Trunk Port Config
                </Heading>
                <VStack spacing={3} align="stretch">
                  <FormControl isInvalid={!!errors.native_vlan}>
                    <FormLabel fontSize="sm" fontWeight="medium">
                      Native VLAN
                    </FormLabel>
                    <Input
                      {...register("native_vlan")}
                      placeholder="e.g. 1"
                      type="number"
                      bg="white"
                      size="sm"
                    />
                    {errors.native_vlan && (
                      <FormErrorMessage>
                        {errors.native_vlan.message}
                      </FormErrorMessage>
                    )}
                  </FormControl>

                  <FormControl>
                    <FormLabel fontSize="sm" fontWeight="medium">
                      Current Allowed VLANs
                      <Text
                        as="span"
                        fontSize="xs"
                        color="gray.400"
                        fontWeight="normal"
                        ml={2}
                      >
                        read-only
                      </Text>
                    </FormLabel>
                    <Input
                      value={item.allowed_vlan ?? ""}
                      isReadOnly
                      bg="gray.100"
                      size="sm"
                      color="gray.500"
                    />
                  </FormControl>

                  <FormControl isInvalid={!!errors.allowed_vlan_add}>
                    <FormLabel fontSize="sm" fontWeight="medium">
                      Allowed VLANs
                      <Text
                        as="span"
                        fontSize="xs"
                        color="gray.400"
                        fontWeight="normal"
                        ml={2}
                      >
                        replaces current list
                      </Text>
                    </FormLabel>
                    <Input
                      {...register("allowed_vlan_add")}
                      placeholder="e.g. 10,20,100"
                      bg="white"
                      size="sm"
                    />
                    {errors.allowed_vlan_add && (
                      <FormErrorMessage>
                        {errors.allowed_vlan_add.message}
                      </FormErrorMessage>
                    )}
                  </FormControl>
                </VStack>
              </Box>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter gap={3}>
          <Button
            colorScheme="blue"
            type="submit"
            isLoading={mutation.isPending}
            isDisabled={!isDirty}
          >
            Save
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default EditInterface
