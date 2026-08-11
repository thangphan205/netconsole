import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Input,
  SimpleGrid,
  Text,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { type SubmitHandler, useForm } from "react-hook-form"

import {
  type ApiError,
  type ComplianceProfileUpdate,
  ComplianceService,
} from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

const ComplianceProfileForm = () => {
  const showToast = useCustomToast()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["compliance-profiles"],
    queryFn: () => ComplianceService.readProfiles(),
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty },
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

  if (isLoading) return null

  return (
    <Box maxW="lg" as="form" onSubmit={handleSubmit(onSubmit)}>
      <Heading size="sm" mb={1}>
        Global Profile
      </Heading>
      <Text fontSize="xs" color="gray.500" mb={4}>
        Default values used by hardening rules unless a group overrides them.
        Server fields accept a comma-separated list — every listed server must
        be present for the rule to pass.
      </Text>
      <SimpleGrid columns={2} spacing={4}>
        <FormControl>
          <FormLabel fontSize="sm">NTP Server</FormLabel>
          <Input
            size="sm"
            placeholder="10.0.0.1, 10.0.0.4"
            {...register("ntp_server")}
          />
        </FormControl>
        <FormControl>
          <FormLabel fontSize="sm">Syslog Server</FormLabel>
          <Input
            size="sm"
            placeholder="10.0.0.2, 10.0.0.5"
            {...register("syslog_server")}
          />
        </FormControl>
        <FormControl>
          <FormLabel fontSize="sm">Syslog Severity</FormLabel>
          <Input
            size="sm"
            placeholder="any notice"
            {...register("syslog_severity")}
          />
        </FormControl>
        <FormControl>
          <FormLabel fontSize="sm">DNS Server</FormLabel>
          <Input
            size="sm"
            placeholder="10.0.0.3, 10.0.0.6"
            {...register("dns_server")}
          />
        </FormControl>
        <FormControl>
          <FormLabel fontSize="sm">Password Min Length</FormLabel>
          <Input
            size="sm"
            type="number"
            placeholder="12"
            {...register("password_min_length")}
          />
        </FormControl>
        <FormControl>
          <FormLabel fontSize="sm">Exec Timeout (minutes)</FormLabel>
          <Input
            size="sm"
            type="number"
            placeholder="10"
            {...register("exec_timeout_minutes")}
          />
        </FormControl>
        <FormControl gridColumn="span 2">
          <FormLabel fontSize="sm">Disabled Rules (Bypass)</FormLabel>
          <Input
            size="sm"
            placeholder="PWD-02, SNMP-01"
            {...register("disabled_rules")}
          />
          <Text fontSize="xs" color="gray.500" mt={1}>
            Comma-separated rule IDs to mark as NOT_APPLICABLE (e.g., PWD-02).
          </Text>
        </FormControl>
      </SimpleGrid>
      <Button
        mt={5}
        variant="primary"
        type="submit"
        isLoading={isSubmitting || mutation.isPending}
        isDisabled={!isDirty}
      >
        Save Global Profile
      </Button>
    </Box>
  )
}

export default ComplianceProfileForm
