import {
  Button,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  useDisclosure,
} from "@chakra-ui/react"
import { BsThreeDotsVertical } from "react-icons/bs"
import { FiEdit, FiTrash } from "react-icons/fi"

import type { ItemPublic, UserPublic, SwitchPublic, InterfacePublic, ArpPublic, IpInterfacePublic, MacAddressPublic, GroupPublic } from "../../client"
import EditUser from "../Admin/EditUser"
import EditItem from "../Items/EditItem"
import EditGroup from "../Groups/EditGroup"
import EditSwitch from "../Switches/EditSwitch"
import EditInterface from "../Interfaces/EditInterface"
import Delete from "./DeleteAlert"

interface ActionsMenuProps {
  type: string
  name: string
  value: ItemPublic | UserPublic | SwitchPublic | InterfacePublic | ArpPublic | IpInterfacePublic | MacAddressPublic | GroupPublic
  disabled?: boolean
}

const ActionsMenu = ({ type, name, value, disabled }: ActionsMenuProps) => {
  const editUserModal = useDisclosure()
  const deleteModal = useDisclosure()

  let onEditFunction = null;
  switch (type) {
    case "User": {
      onEditFunction = (<EditUser
        user={value as UserPublic}
        isOpen={editUserModal.isOpen}
        onClose={editUserModal.onClose}
      />);
      break;
    }

    case "Item": {
      onEditFunction = (<EditItem
        item={value as ItemPublic}
        isOpen={editUserModal.isOpen}
        onClose={editUserModal.onClose}
      />);
      break;
    }
    case "Switch": {
      onEditFunction = (
        <EditSwitch
          item={value as SwitchPublic}
          isOpen={editUserModal.isOpen}
          onClose={editUserModal.onClose}
        />
      );
      break;
    }
    case "Interface": {
      onEditFunction = (
        <EditInterface
          item={value as InterfacePublic}
          isOpen={editUserModal.isOpen}
          onClose={editUserModal.onClose}
        />
      );
      break;
    }
    case "Arp": {
      onEditFunction = (
        <></>
      );
      break;
    }
    case "IpInterface": {
      onEditFunction = (
        <></>
      );
      break;
    }
    case "MacAddress": {
      onEditFunction = (
        <></>
      );
      break;
    }
    case "Group": {
      onEditFunction = (
        <EditGroup
          item={value as GroupPublic}
          isOpen={editUserModal.isOpen}
          onClose={editUserModal.onClose}
        />
      );
      break;
    }
  }

  return (
    <>
      <Menu>
        <MenuButton
          isDisabled={disabled}
          as={Button}
          rightIcon={<BsThreeDotsVertical />}
          variant="unstyled"
        />
        <MenuList>
          {
            type === "Switch" || type == "User" || type == "Interface" || type == "Group" ? (
              <MenuItem
                onClick={editUserModal.onOpen}
                icon={<FiEdit fontSize="16px" />}
              >
                Edit {type}
              </MenuItem>
            ) : null
          }
          <MenuItem
            onClick={deleteModal.onOpen}
            icon={<FiTrash fontSize="16px" />}
            color="ui.danger"
          >
            Delete {type}
          </MenuItem>
        </MenuList>
        {onEditFunction}
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
