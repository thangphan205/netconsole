import {
  Container,
  Heading,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  VStack,
} from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"

import ComplianceDashboard from "../../components/Compliance/ComplianceDashboard"
import ComplianceProfileForm from "../../components/Compliance/ComplianceProfileForm"
import GroupProfileOverrides from "../../components/Compliance/GroupProfileOverrides"

export const Route = createFileRoute("/_layout/compliance")({
  component: Compliance,
})

function Compliance() {
  return (
    <Container maxW="full">
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} py={12}>
        Compliance
      </Heading>
      <Tabs variant="enclosed">
        <TabList>
          <Tab>Dashboard</Tab>
          <Tab>Profiles</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <ComplianceDashboard />
          </TabPanel>
          <TabPanel>
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
