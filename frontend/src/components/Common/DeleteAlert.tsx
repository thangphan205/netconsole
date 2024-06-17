import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useForm } from "react-hook-form"

import { ItemsService, UsersService, SwitchesService, InterfacesService, ArpsService, IpInterfacesService, MacAddressesService, GroupsService, } from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

interface DeleteProps {
  type: string
  id: number
  name: string
  isOpen: boolean
  onClose: () => void
}

const Delete = ({ type, id, name, isOpen, onClose }: DeleteProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const cancelRef = React.useRef<HTMLButtonElement | null>(null)
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useForm()

  let query_key = "switches";
  switch (type) {
    case "User": {
      query_key = "users";
      break;
    }
    case "Item": {
      query_key = "items";
      break;
    }
    case "Switch": {
      query_key = "switches";
      break;
    }
    case "Interface": {
      query_key = "interfaces";
      break;
    }
    case "Arp": {
      query_key = "arps";
      break;
    }
    case "MacAddress": {
      query_key = "mac_addresses";
      break;
    }
    case "IpInterface": {
      query_key = "ip_interfaces";
      break;
    }
    case "Group": {
      query_key = "groups";
      break;
    }
    default:
      throw new Error(`Unexpected type: ${type}`)
  }

  const deleteEntity = async (id: number) => {
    switch (type) {
      case "User": {
        await UsersService.deleteUser({ userId: id })
        break;
      }

      case "Item": {
        await ItemsService.deleteItem({ id: id })
        break;
      }
      case "Switch": {
        await SwitchesService.deleteSwitch({ id: id })
        break;
      }
      case "Interface": {
        await InterfacesService.deleteInterface({ id: id })
        break;
      }
      case "Arp": {
        await ArpsService.deleteArp({ id: id })
        break;
      }
      case "MacAddress": {
        await MacAddressesService.deleteMacAddress({ id: id })
        break;
      }
      case "IpInterface": {
        await IpInterfacesService.deleteIpInterface({ id: id })
        break;
      }
      case "Group": {
        await GroupsService.deleteGroup({ id: id })
        break;
      }
      default:
        throw new Error(`Unexpected type: ${type}`)
    }
  }

  const mutation = useMutation({
    mutationFn: deleteEntity,
    onSuccess: () => {
      showToast(
        "Success",
        `The ${type.toLowerCase()} was deleted successfully.`,
        "success",
      )
      onClose()
    },
    onError: () => {
      showToast(
        "An error occurred.",
        `An error occurred while deleting the ${type.toLowerCase()}.`,
        "error",
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [query_key],
      })
    },
  })

  const onSubmit = async () => {
    mutation.mutate(id)
  }

  return (
    <>
      <AlertDialog
        isOpen={isOpen}
        onClose={onClose}
        leastDestructiveRef={cancelRef}
        size={{ base: "sm", md: "md" }}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent as="form" onSubmit={handleSubmit(onSubmit)}>
            <AlertDialogHeader>Delete {type} <strong>{name}</strong></AlertDialogHeader>

            <AlertDialogBody>
              {type === "User" && (
                <span>
                  All items associated with this user will also be{" "}
                  <strong>permantly deleted. </strong>
                </span>
              )}
              {type === "Switch" && (
                <span>
                  All Interfaces, MACs, ARPs, IP Interfaces associated with this switch will also be{" "}
                  <strong>permantly deleted. </strong>
                </span>
              )}
              Are you sure? You will not be able to undo this action.
            </AlertDialogBody>

            <AlertDialogFooter gap={3}>
              <Button variant="danger" type="submit" isLoading={isSubmitting}>
                Delete
              </Button>
              <Button
                ref={cancelRef}
                onClick={onClose}
                isDisabled={isSubmitting}
              >
                Cancel
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  )
}

export default Delete
