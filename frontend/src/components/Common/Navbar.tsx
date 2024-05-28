import {
  Button, Flex, Icon, useDisclosure, InputGroup, Input, InputLeftElement
} from "@chakra-ui/react"
import { FaPlus, FaSearch } from "react-icons/fa"


import AddUser from "../Admin/AddUser"
import AddItem from "../Items/AddItem"
import AddSwitch from "../Switches/AddSwitch"
import AddInterface from "../Interfaces/AddInterface"

interface NavbarProps {
  type: string
}

const Navbar = ({ type }: NavbarProps) => {
  const addUserModal = useDisclosure()
  const addItemModal = useDisclosure()
  const addSwitchModal = useDisclosure()
  const addInterfacehModal = useDisclosure()

  let onClickFunction = addUserModal;
  switch (type) {
    case "User": {
      onClickFunction = addUserModal;
      break;
    }

    case "Item": {
      onClickFunction = addItemModal;
      break;
    }
    case "Switch": {
      onClickFunction = addSwitchModal;
      break;
    }
    case "Interface": {
      onClickFunction = addInterfacehModal;
      break;
    }
  }
  return (
    <>
      <Flex py={8} gap={4}>
        {/* TODO: Complete search functionality */}
        {/* <InputGroup w={{ base: '100%', md: 'auto' }}>
          <InputLeftElement pointerEvents='none'>
            <Icon as={FaSearch} color='ui.dim' />
          </InputLeftElement>
          <Input type='text' placeholder='Search' fontSize={{ base: 'sm', md: 'inherit' }} borderRadius='8px' />
        </InputGroup> */}
        {
          type !== "Interface" ? (
            <Button
              variant="primary"
              gap={1}
              fontSize={{ base: "sm", md: "inherit" }}
              onClick={onClickFunction.onOpen}
            >
              <Icon as={FaPlus} /> Add {type}
            </Button>
          ) : (
            null
          )
        }
        <AddUser isOpen={addUserModal.isOpen} onClose={addUserModal.onClose} />
        <AddItem isOpen={addItemModal.isOpen} onClose={addItemModal.onClose} />
        <AddSwitch isOpen={addSwitchModal.isOpen} onClose={addSwitchModal.onClose} />
        <AddInterface isOpen={addInterfacehModal.isOpen} onClose={addInterfacehModal.onClose} />
      </Flex>
    </>
  )
}

export default Navbar
