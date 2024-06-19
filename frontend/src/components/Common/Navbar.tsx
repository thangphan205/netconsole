import {
  Button, Flex, Icon, Input, InputGroup, InputLeftElement, InputRightElement, useDisclosure,
} from "@chakra-ui/react"
import { FaPlus, FaSearch, FaRegTimesCircle } from "react-icons/fa"


import AddUser from "../Admin/AddUser"
import AddItem from "../Items/AddItem"
import AddSwitch from "../Switches/AddSwitch"
import AddInterface from "../Interfaces/AddInterface"
import AddGroup from "../Groups/AddGroup"
import AddCredential from "../Credentials/AddCredential"
import { useState } from "react"

interface NavbarProps {
  type: string
  onSearch: (searchTerm: string) => void;
}

const Navbar = ({ type, onSearch }: NavbarProps) => {
  const addUserModal = useDisclosure()
  const addItemModal = useDisclosure()
  const addSwitchModal = useDisclosure()
  const addInterfaceModal = useDisclosure()
  const addGroupModal = useDisclosure()
  const addCredentialModal = useDisclosure()
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e: any) => {
    if (e.code === "Enter") {
      console.log("searching....");
      onSearch(e.target.value);
    }
  };
  const handleClear = () => {
    setSearchTerm('');
    onSearch('');
  };
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
      onClickFunction = addInterfaceModal;
      break;
    }
    case "Group": {
      onClickFunction = addGroupModal;
      break;
    }
    case "Credential": {
      onClickFunction = addCredentialModal;
      break;
    }
  }
  return (
    <>
      <Flex py={8} gap={4}>
        {/* TODO: Complete search functionality */}
        <InputGroup w={{ base: '100%', md: 'auto' }}>
          <InputLeftElement pointerEvents='none'>
            <Icon as={FaSearch} color='ui.dim' />
          </InputLeftElement>
          <Input type='text' placeholder='Search' fontSize={{ base: 'sm', md: 'inherit' }} borderRadius='8px'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearch}
          />
          <InputRightElement >
            {searchTerm && (
              <Button onClick={handleClear} borderRadius='10px'>
                <Icon as={FaRegTimesCircle} />
              </Button>
            )}
          </InputRightElement>
        </InputGroup>
        {
          type === "Switch" || type === "User" || type === "Group" || type === "Credential" ? (
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
        <AddInterface isOpen={addInterfaceModal.isOpen} onClose={addInterfaceModal.onClose} />
        <AddGroup isOpen={addGroupModal.isOpen} onClose={addGroupModal.onClose} />
        <AddCredential isOpen={addCredentialModal.isOpen} onClose={addCredentialModal.onClose} />
      </Flex >
    </>
  )
}

export default Navbar
