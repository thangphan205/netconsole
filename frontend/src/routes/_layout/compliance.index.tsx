import {
  Container,
  Flex,
  Heading,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack,
} from "@chakra-ui/react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

import GroupSelect from "../../components/Common/GroupSelect"
import ComplianceDashboard from "../../components/Compliance/ComplianceDashboard"
import ComplianceOverview from "../../components/Compliance/ComplianceOverview"
import ComplianceProfileForm from "../../components/Compliance/ComplianceProfileForm"
import ComplianceRulesCatalog from "../../components/Compliance/ComplianceRulesCatalog"
import GroupProfileOverrides from "../../components/Compliance/GroupProfileOverrides"

const TABS = ["overview", "devices", "rules", "profiles"] as const
type TabName = (typeof TABS)[number]

interface ComplianceSearch {
  tab?: TabName
  group?: string
  status?: string
  rule?: string
}

export const Route = createFileRoute("/_layout/compliance/")({
  component: Compliance,
  validateSearch: (search: Record<string, unknown>): ComplianceSearch => ({
    tab: TABS.includes(search.tab as TabName)
      ? (search.tab as TabName)
      : undefined,
    group: typeof search.group === "string" ? search.group : undefined,
    status: typeof search.status === "string" ? search.status : undefined,
    rule: typeof search.rule === "string" ? search.rule : undefined,
  }),
})

function Compliance() {
  const navigate = useNavigate({ from: Route.fullPath })
  const { tab, group, status, rule } = Route.useSearch()

  // Tab and filters live in the URL so a view can be linked, bookmarked and
  // survives a refresh — and so the overview can hand off a filtered device list.
  const setSearch = (next: Partial<ComplianceSearch>) =>
    navigate({
      search: (prev: ComplianceSearch) => ({ ...prev, ...next }),
      replace: true,
    })

  const tabIndex = Math.max(0, TABS.indexOf(tab ?? "overview"))
  const groupName = group ?? ""
  const statusFilter = status ?? "all"
  const ruleFilter = rule ?? ""

  const drillDown = (filter: { status?: string; ruleId?: string }) =>
    setSearch({
      tab: "devices",
      status: filter.status ?? "all",
      rule: filter.ruleId ?? "",
    })

  return (
    <Container maxW="full">
      <Flex
        justify="space-between"
        align={{ base: "stretch", md: "flex-end" }}
        direction={{ base: "column", md: "row" }}
        gap={3}
        pt={8}
        pb={4}
      >
        <Heading size="lg">Compliance</Heading>
        <Flex direction="column" gap={1}>
          <Text fontSize="xs" color="gray.500">
            Scope
          </Text>
          <GroupSelect
            value={groupName}
            onChange={(value) => setSearch({ group: value })}
            placeholder="All groups"
            width="260px"
          />
        </Flex>
      </Flex>

      <Tabs
        variant="enclosed"
        index={tabIndex}
        onChange={(index) => setSearch({ tab: TABS[index] })}
        isLazy
      >
        <TabList>
          <Tab>Overview</Tab>
          <Tab>Devices</Tab>
          <Tab>Rules</Tab>
          <Tab>Profiles</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            <ComplianceOverview groupName={groupName} onDrillDown={drillDown} />
          </TabPanel>
          <TabPanel px={0}>
            <ComplianceDashboard
              groupName={groupName}
              statusFilter={statusFilter}
              ruleFilter={ruleFilter}
              onStatusFilterChange={(value) => setSearch({ status: value })}
              onRuleFilterChange={(value) => setSearch({ rule: value })}
            />
          </TabPanel>
          <TabPanel px={0}>
            <ComplianceRulesCatalog
              groupName={groupName}
              onDrillDown={(ruleId) => drillDown({ ruleId })}
            />
          </TabPanel>
          <TabPanel px={0}>
            <VStack align="stretch" spacing={10}>
              <ComplianceProfileForm />
              <GroupProfileOverrides />
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Container>
  )
}
