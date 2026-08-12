import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Container,
  Flex,
  HStack,
  Heading,
  Icon,
  Progress,
  Skeleton,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { FiArrowLeft, FiPlayCircle, FiShield } from "react-icons/fi"

import { type ApiError, ComplianceService, DevicesService } from "../../client"
import DeviceHistoryTab from "../../components/Compliance/DeviceHistoryTab"
import DeviceRulesTab from "../../components/Compliance/DeviceRulesTab"
import {
  SCORE_EXPLAINER,
  SEVERITY_WEIGHTS,
  formatScore,
  scoreColor,
} from "../../components/Compliance/constants"
import useCustomToast from "../../hooks/useCustomToast"
import { formatTimestamp } from "../../utils"

interface DeviceComplianceSearch {
  fix?: boolean
}

export const Route = createFileRoute("/_layout/compliance/devices/$deviceId")({
  component: DeviceCompliance,
  validateSearch: (
    search: Record<string, unknown>,
  ): DeviceComplianceSearch => ({
    fix: search.fix === true || search.fix === "true",
  }),
})

/** Mirrors compliance_score() in backend/app/automation/compliance_rules.py. */
function scoreFromResults(
  results: { severity?: string; status: string }[],
): number | null {
  let earned = 0
  let total = 0
  for (const result of results) {
    if (result.status !== "pass" && result.status !== "fail") continue
    const weight = SEVERITY_WEIGHTS[result.severity ?? ""] ?? 1
    total += weight
    if (result.status === "pass") earned += weight
  }
  return total ? Math.round((1000 * earned) / total) / 10 : null
}

function DeviceCompliance() {
  const { deviceId } = Route.useParams()
  const { fix } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const id = Number(deviceId)

  const showToast = useCustomToast()
  const queryClient = useQueryClient()
  const [autoFix, setAutoFix] = useState(Boolean(fix))

  const { data: device } = useQuery({
    queryKey: ["device", id],
    queryFn: () => DevicesService.readDevice({ id }),
  })

  const {
    data: latest,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["compliance-latest", id],
    queryFn: () => ComplianceService.readLatestRun({ id }),
    retry: false, // a 404 means "never checked", not a transient failure
  })

  const disabledRules = useMemo(
    () =>
      (device?.disabled_rules ?? "")
        .split(",")
        .map((rule) => rule.trim())
        .filter(Boolean),
    [device],
  )

  const results = latest?.results ?? []
  const score = scoreFromResults(results)
  const failing = results.filter((result) => result.status === "fail")
  const remediable = failing.filter((result) => result.remediation_commands)

  const runMutation = useMutation({
    mutationFn: () => ComplianceService.runDeviceCheck({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-latest", id] })
      queryClient.invalidateQueries({ queryKey: ["compliance-runs", id] })
      queryClient.invalidateQueries({ queryKey: ["compliance-summary"] })
      queryClient.invalidateQueries({ queryKey: ["compliance-overview"] })
      showToast("Check complete", "Compliance check finished.", "success")
    },
    onError: (err: ApiError) => {
      const errDetail = (err.body as any)?.detail
      showToast("Check failed.", `${errDetail}`, "error")
    },
  })

  const clearFixFlag = () => {
    setAutoFix(false)
    navigate({ search: {}, replace: true })
  }

  return (
    <Container maxW="full" pt={6} pb={10}>
      <Button
        size="xs"
        variant="ghost"
        leftIcon={<Icon as={FiArrowLeft} />}
        mb={3}
        onClick={() =>
          navigate({ to: "/compliance", search: { tab: "devices" } })
        }
      >
        Back to compliance
      </Button>

      <Flex
        justify="space-between"
        align={{ base: "stretch", md: "flex-end" }}
        direction={{ base: "column", md: "row" }}
        gap={4}
        mb={6}
      >
        <Box>
          <Heading size="lg">{device?.hostname ?? `Device ${id}`}</Heading>
          <HStack spacing={2} mt={2} wrap="wrap">
            {device?.platform && <Tag size="sm">{device.platform}</Tag>}
            {device?.ipaddress && (
              <Text fontSize="sm" color="gray.500">
                {device.ipaddress}
              </Text>
            )}
            <Text fontSize="sm" color="gray.500">
              {latest?.run?.created_at
                ? `Last checked ${formatTimestamp(latest.run.created_at)}`
                : "Never checked"}
            </Text>
          </HStack>
        </Box>

        <HStack spacing={4} align="flex-end">
          <Box minW="140px">
            <Text fontSize="xs" color="gray.500">
              Score
            </Text>
            <Skeleton isLoaded={!isLoading}>
              <Tooltip label={SCORE_EXPLAINER}>
                <Box>
                  <Text
                    fontSize="2xl"
                    fontWeight="bold"
                    color={`${scoreColor(score)}.500`}
                  >
                    {formatScore(score)}
                  </Text>
                  <Progress
                    value={score ?? 0}
                    size="xs"
                    borderRadius="full"
                    colorScheme={scoreColor(score)}
                  />
                </Box>
              </Tooltip>
            </Skeleton>
          </Box>

          <Button
            size="sm"
            variant="outline"
            colorScheme="blue"
            leftIcon={<Icon as={FiPlayCircle} />}
            isLoading={runMutation.isPending}
            onClick={() => runMutation.mutate()}
          >
            Run check
          </Button>
          <Tooltip
            label={
              failing.length > remediable.length
                ? `${failing.length - remediable.length} of ${
                    failing.length
                  } failures have no automatic fix`
                : undefined
            }
          >
            <Button
              size="sm"
              colorScheme="orange"
              leftIcon={<Icon as={FiShield} />}
              isDisabled={remediable.length === 0}
              onClick={() => setAutoFix(true)}
            >
              Fix all ({remediable.length})
            </Button>
          </Tooltip>
        </HStack>
      </Flex>

      {isError ? (
        <Alert status="info" borderRadius="md" mb={4}>
          <AlertIcon />
          <Box>
            <Text fontWeight="medium">No compliance run yet</Text>
            <Text fontSize="sm">
              Run a check to evaluate this device against the hardening catalog.
            </Text>
          </Box>
        </Alert>
      ) : null}

      {disabledRules.length > 0 && (
        <Alert status="warning" borderRadius="md" mb={4} fontSize="sm">
          <AlertIcon />
          <Box>
            {disabledRules.length} rule
            {disabledRules.length === 1 ? " is" : "s are"} bypassed on this
            device and always report not applicable:{" "}
            <HStack as="span" spacing={1} display="inline-flex">
              {disabledRules.map((rule) => (
                <Badge key={rule} colorScheme="gray">
                  {rule}
                </Badge>
              ))}
            </HStack>
          </Box>
        </Alert>
      )}

      <Tabs variant="enclosed" isLazy>
        <TabList>
          <Tab>Rules</Tab>
          <Tab>History</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            {isLoading ? (
              <VStack align="stretch" spacing={2}>
                {new Array(6).fill(null).map((_, index) => (
                  <Skeleton key={index} height="44px" />
                ))}
              </VStack>
            ) : (
              <DeviceRulesTab
                deviceId={id}
                hostname={device?.hostname ?? `Device ${id}`}
                runId={latest?.run?.id ?? null}
                results={results}
                disabledRules={disabledRules}
                autoFix={autoFix}
                onAutoFixHandled={clearFixFlag}
              />
            )}
          </TabPanel>
          <TabPanel px={0}>
            <DeviceHistoryTab deviceId={id} />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Container>
  )
}
