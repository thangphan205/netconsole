import {
  Button,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  useDisclosure,
} from "@chakra-ui/react"
import { useNavigate } from "@tanstack/react-router"
import { FiClock, FiEdit, FiShield, FiTerminal, FiTrash } from "react-icons/fi"

import { ChevronDownIcon } from "@chakra-ui/icons"
import type {
  ApiKeyPublic,
  ArpPublic,
  CredentialPublic,
  DevicePublic,
  GroupPublic,
  InterfacePublic,
  IpInterfacePublic,
  ItemPublic,
  MacAddressPublic,
  UserPublic,
} from "../../client"
import EditUser from "../Admin/EditUser"
import EditApiKey from "../ApiKeys/EditApiKey"
import EditCredential from "../Credentials/EditCredential"
import ConfigRevisions from "../Devices/ConfigRevisions"
import EditDevice from "../Devices/EditDevice"
import PushDeviceConfig from "../Devices/PushDeviceConfig"
import EditGroup from "../Groups/EditGroup"
import EditInterface from "../Interfaces/EditInterface"
import EditItem from "../Items/EditItem"
import Delete from "./DeleteAlert"

interface ActionsMenuProps {
  type: string
  name: string
  value:
    | ItemPublic
    | UserPublic
    | DevicePublic
    | InterfacePublic
    | ArpPublic
    | IpInterfacePublic
    | MacAddressPublic
    | GroupPublic
    | CredentialPublic
    | ApiKeyPublic
  disabled?: boolean
}

const ActionsMenu = ({ type, name, value }: ActionsMenuProps) => {
  const navigate = useNavigate()
  const editUserModal = useDisclosure()
  const deleteModal = useDisclosure()
  const pushConfigModal = useDisclosure()
  const configRevisionsModal = useDisclosure()

  let onEditFunction = null
  switch (type) {
    case "User": {
      onEditFunction = (
        <EditUser
          user={value as UserPublic}
          isOpen={editUserModal.isOpen}
          onClose={editUserModal.onClose}
        />
      )
      break
    }

    case "Item": {
      onEditFunction = (
        <EditItem
          item={value as ItemPublic}
          isOpen={editUserModal.isOpen}
          onClose={editUserModal.onClose}
        />
      )
      break
    }
    case "Device": {
      onEditFunction = (
        <EditDevice
          item={value as DevicePublic}
          isOpen={editUserModal.isOpen}
          onClose={editUserModal.onClose}
        />
      )
      break
    }
    case "Interface": {
      onEditFunction = (
        <EditInterface
          item={value as InterfacePublic}
          isOpen={editUserModal.isOpen}
          onClose={editUserModal.onClose}
        />
      )
      break
    }
    case "Arp": {
      onEditFunction = <></>
      break
    }
    case "IpInterface": {
      onEditFunction = <></>
      break
    }
    case "MacAddress": {
      onEditFunction = <></>
      break
    }
    case "Group": {
      onEditFunction = (
        <EditGroup
          item={value as GroupPublic}
          isOpen={editUserModal.isOpen}
          onClose={editUserModal.onClose}
        />
      )
      break
    }
    case "Credential": {
      onEditFunction = (
        <EditCredential
          item={value as CredentialPublic}
          isOpen={editUserModal.isOpen}
          onClose={editUserModal.onClose}
        />
      )
      break
    }
    case "ApiKey": {
      onEditFunction = (
        <EditApiKey
          item={value as ApiKeyPublic}
          isOpen={editUserModal.isOpen}
          onClose={editUserModal.onClose}
        />
      )
      break
    }
  }

  return (
    <>
      <Menu>
        <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
          Actions
        </MenuButton>
        <MenuList>
          {type === "Device" ||
          type === "User" ||
          type === "Interface" ||
          type === "Group" ||
          type === "Credential" ||
          type === "ApiKey" ? (
            <MenuItem
              onClick={editUserModal.onOpen}
              icon={<FiEdit fontSize="16px" />}
            >
              Edit {type}
            </MenuItem>
          ) : null}
          {type === "Device" ? (
            <MenuItem
              onClick={pushConfigModal.onOpen}
              icon={<FiTerminal fontSize="16px" />}
            >
              Push Config
            </MenuItem>
          ) : null}
          {type === "Device" ? (
            <MenuItem
              onClick={configRevisionsModal.onOpen}
              icon={<FiClock fontSize="16px" />}
            >
              Config History
            </MenuItem>
          ) : null}
          {type === "Device" ? (
            <MenuItem
              onClick={() =>
                navigate({
                  to: "/compliance/devices/$deviceId",
                  params: { deviceId: String((value as DevicePublic).id) },
                })
              }
              icon={<FiShield fontSize="16px" />}
            >
              Compliance
            </MenuItem>
          ) : null}
          <MenuItem
            onClick={deleteModal.onOpen}
            icon={<FiTrash fontSize="16px" />}
            color="ui.danger"
          >
            Delete {type}
          </MenuItem>
        </MenuList>
        {onEditFunction}
        {type === "Device" ? (
          <PushDeviceConfig
            item={value as DevicePublic}
            isOpen={pushConfigModal.isOpen}
            onClose={pushConfigModal.onClose}
          />
        ) : null}
        {type === "Device" ? (
          <ConfigRevisions
            item={value as DevicePublic}
            isOpen={configRevisionsModal.isOpen}
            onClose={configRevisionsModal.onClose}
          />
        ) : null}
        <Delete
          type={type}
          id={value.id}
          name={name}
          isOpen={deleteModal.isOpen}
          onClose={deleteModal.onClose}
        />
      </Menu>
    </>
  )
}

export default ActionsMenu
