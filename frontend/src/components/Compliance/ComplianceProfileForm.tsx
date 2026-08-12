import {
  Alert,
  AlertIcon,
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Input,
  SimpleGrid,
  Skeleton,
  Text,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"

import {
  type ApiError,
  type ComplianceProfileUpdate,
  ComplianceService,
} from "../../client"
import useCustomToast from "../../hooks/useCustomToast"
import DisabledRulesPicker from "./DisabledRulesPicker"

const ComplianceProfileForm = () => {
  const showToast = useCustomToast()
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ["compliance-profiles"],
    queryFn: () => ComplianceService.readProfiles(),
  })

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty, errors },
  } = useForm<ComplianceProfileUpdate>({ mode: "onBlur" })

  useEffect(() => {
    if (data?.global_profile) {
      reset({
        ntp_server: data.global_profile.ntp_server,
        syslog_server: data.global_profile.syslog_server,
        syslog_severity: data.global_profile.syslog_severity,
        dns_server: data.global_profile.dns_server,
        password_min_length: data.global_profile.password_min_length,
        exec_timeout_minutes: data.global_profile.exec_timeout_minutes,
        disabled_rules: data.global_profile.disabled_rules,
      })
    }
  }, [data, reset])

  const mutation = useMutation({
    mutationFn: (payload: ComplianceProfileUpdate) =>
      ComplianceService.updateGlobalProfile({ requestBody: payload }),
    onSuccess: () => {
      showToast("Saved", "Global compliance profile updated.", "success")
      queryClient.invalidateQueries({ queryKey: ["compliance-profiles"] })
    },
    onError: (err: ApiError) => {
      const errDetail = (err.body as any)?.detail
      showToast("Something went wrong.", `${errDetail}`, "error")
    },
  })

  const onSubmit: SubmitHandler<ComplianceProfileUpdate> = (values) => {
    mutation.mutate({
      ...values,
      password_min_length: values.password_min_length
        ? Number(values.password_min_length)
        : null,
      exec_timeout_minutes: values.exec_timeout_minutes
        ? Number(values.exec_timeout_minutes)
        : null,
      disabled_rules: values.disabled_rules || null,
    })
  }

  if (isError) {
    return (
      <Alert status="error" borderRadius="md">
        <AlertIcon />
        Could not load the compliance profile. Saving now would overwrite the
        stored values with an empty form, so the form is hidden until the fetch
        succeeds.
      </Alert>
    )
  }

  return (
    <Box maxW="2xl" as="form" onSubmit={handleSubmit(onSubmit)}>
      <Heading size="sm" mb={1}>
        Global profile
      </Heading>
      <Text fontSize="xs" color="gray.500" mb={4}>
        Default values used by hardening rules unless a group overrides them.
        Server fields accept a comma-separated list — every listed server must
        be present for the rule to pass.
      </Text>

      <Skeleton isLoaded={!isLoading}>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <FormControl>
            <FormLabel fontSize="sm">NTP server</FormLabel>
            <Input
              size="sm"
              placeholder="10.0.0.1, 10.0.0.4"
              {...register("ntp_server")}
            />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Syslog server</FormLabel>
            <Input
              size="sm"
              placeholder="10.0.0.2, 10.0.0.5"
              {...register("syslog_server")}
            />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Syslog severity</FormLabel>
            <Input
              size="sm"
              placeholder="any notice"
              {...register("syslog_severity")}
            />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">DNS server</FormLabel>
            <Input
              size="sm"
              placeholder="10.0.0.3, 10.0.0.6"
              {...register("dns_server")}
            />
          </FormControl>
          <FormControl isInvalid={!!errors.password_min_length}>
            <FormLabel fontSize="sm">Password min length</FormLabel>
            <Input
              size="sm"
              type="number"
              placeholder="12"
              {...register("password_min_length", {
                min: { value: 1, message: "Must be at least 1" },
                max: { value: 127, message: "Must be 127 or less" },
              })}
            />
            <FormErrorMessage fontSize="xs">
              {errors.password_min_length?.message}
            </FormErrorMessage>
          </FormControl>
          <FormControl isInvalid={!!errors.exec_timeout_minutes}>
            <FormLabel fontSize="sm">Exec timeout (minutes)</FormLabel>
            <Input
              size="sm"
              type="number"
              placeholder="10"
              {...register("exec_timeout_minutes", {
                min: { value: 0, message: "Cannot be negative" },
                max: { value: 1440, message: "Must be 1440 or less" },
              })}
            />
            <FormErrorMessage fontSize="xs">
              {errors.exec_timeout_minutes?.message}
            </FormErrorMessage>
          </FormControl>
          <FormControl gridColumn={{ md: "span 2" }}>
            <FormLabel fontSize="sm">Bypassed rules</FormLabel>
            <Controller
              control={control}
              name="disabled_rules"
              render={({ field }) => (
                <DisabledRulesPicker
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </FormControl>
        </SimpleGrid>
      </Skeleton>

      <Button
        mt={5}
        variant="primary"
        type="submit"
        isLoading={isSubmitting || mutation.isPending}
        isDisabled={!isDirty || isLoading}
      >
        Save global profile
      </Button>
    </Box>
  )
}

export default ComplianceProfileForm
