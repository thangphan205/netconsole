import {
  Button,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useDisclosure,
} from "@chakra-ui/react"
import { FiEdit, FiTrash, FiSlash, FiPlayCircle } from "react-icons/fi"

import { type ApiError, InterfacesService, type InterfacePublic } from "../../client"
import EditInterface from "../Interfaces/EditInterface"
import Delete from "./DeleteAlert"
import { ChevronDownIcon } from "@chakra-ui/icons"
import { useQueryClient, useMutation } from "@tanstack/react-query"
import useCustomToast from "../../hooks/useCustomToast"

interface ActionsMenuProps {
  type: string
  name: string
  value: InterfacePublic
  disabled?: boolean
}

const ActionsMenu = ({ type, name, value }: ActionsMenuProps) => {
  const editUserModal = useDisclosure()
  const deleteModal = useDisclosure()

  let onEditFunction = null;
  switch (type) {
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

  }
  const { isOpen, onOpen, onClose } = useDisclosure()

  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const mutation_update_metadata = useMutation({
    mutationFn: (set_status: number) =>
      InterfacesService.updateInterfaceStatus({ id: value.id, setStatus: set_status }),
    onSuccess: () => {
      showToast("Success!", "Set Config Done.", "success")
    },
    onError: (err: ApiError) => {
      const errDetail = (err.body as any)?.detail
      showToast("Something went wrong.", `${errDetail}`, "error")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["switches"] })
    },
  })
  const handleSetConfigStatus = async (set_status: number) => {
    showToast("Success!", "Set Config. Please wait!", "success")
    onClose();
    mutation_update_metadata.mutate(set_status)
  }
  return (
    <>
      <Menu>
        <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
          Actions
        </MenuButton>
        <MenuList>
          {
            type == "Interface" ? (
              <MenuItem
                onClick={editUserModal.onOpen}
                icon={<FiEdit fontSize="16px" />}
              >
                Edit {type}
              </MenuItem>
            ) : null
          }
          <MenuItem
            onClick={onOpen}
            icon={<FiSlash fontSize="16px" />}
            color="ui.danger"
          >
            Shutdown
          </MenuItem>
          <MenuItem
            onClick={() => handleSetConfigStatus(1)}
            icon={<FiPlayCircle fontSize="16px" />}
            color='ui.success'
          >
            No Shutdown
          </MenuItem>
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
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Confirm shutdown port {name}</ModalHeader>
          <ModalCloseButton />
          <ModalFooter>
            <Button onClick={onClose} mr={3}>
              Cancel
            </Button>
            <Button colorScheme='red' onClick={() => handleSetConfigStatus(0)}>Shutdown</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}

export default ActionsMenu
