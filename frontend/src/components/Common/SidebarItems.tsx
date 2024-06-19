import { Box, Flex, Icon, Text, useColorModeValue } from "@chakra-ui/react"
import { useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { FiHome, FiSettings, FiUsers, FiActivity, FiServer, FiList, FiAirplay, FiArchive, FiCoffee, FiLock } from "react-icons/fi"

import type { UserPublic } from "../../client"

const items = [
  { icon: FiHome, title: "Dashboard", path: "/" },
  // { icon: FiBriefcase, title: "Items", path: "/items" },
  { icon: FiArchive, title: "Groups", path: "/groups" },
  { icon: FiLock, title: "Credentials", path: "/credentials" },
  { icon: FiServer, title: "Switches", path: "/switches" },
  { icon: FiAirplay, title: "Interfaces", path: "/interfaces" },
  { icon: FiList, title: "MAC", path: "/mac_addresses" },
  { icon: FiList, title: "ARP", path: "/arps" },
  { icon: FiList, title: "IP Intf", path: "/ip_interfaces" },
  { icon: FiCoffee, title: "Group Config", path: "/group_config" },
  { icon: FiActivity, title: "Logs", path: "/logs" },
  { icon: FiSettings, title: "User Settings", path: "/settings" },
]

interface SidebarItemsProps {
  onClose?: () => void
}

const SidebarItems = ({ onClose }: SidebarItemsProps) => {
  const queryClient = useQueryClient()
  const textColor = useColorModeValue("ui.main", "ui.light")
  const bgActive = useColorModeValue("#E2E8F0", "#4A5568")
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])

  const finalItems = currentUser?.is_superuser
    ? [...items, { icon: FiUsers, title: "Admin", path: "/admin" }]
    : items

  const listItems = finalItems.map(({ icon, title, path }) => (
    <Flex
      as={Link}
      to={path}
      w="100%"
      p={2}
      key={title}
      activeProps={{
        style: {
          background: bgActive,
          borderRadius: "12px",
        },
      }}
      color={textColor}
      onClick={onClose}
    >
      <Icon as={icon} alignSelf="center" />
      <Text ml={2}>{title}</Text>
    </Flex>
  ))

  return (
    <>
      <Box>{listItems}</Box>
    </>
  )
}

export default SidebarItems
