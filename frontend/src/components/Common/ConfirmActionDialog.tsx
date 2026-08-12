import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
} from "@chakra-ui/react"
import React, { type ReactNode } from "react"

interface ConfirmActionDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  children: ReactNode
  confirmLabel?: string
  confirmColorScheme?: string
  isLoading?: boolean
}

/**
 * Generic "are you sure" gate for actions that touch live devices.
 * `DeleteAlert` covers entity deletion; this covers everything else, so a
 * config push can't happen on a single stray click.
 */
function ConfirmActionDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = "Confirm",
  confirmColorScheme = "red",
  isLoading = false,
}: ConfirmActionDialogProps) {
  const cancelRef = React.useRef<HTMLButtonElement | null>(null)

  return (
    <AlertDialog
      isOpen={isOpen}
      onClose={onClose}
      leastDestructiveRef={cancelRef}
      size={{ base: "sm", md: "md" }}
      isCentered
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader>{title}</AlertDialogHeader>
          <AlertDialogBody fontSize="sm">{children}</AlertDialogBody>
          <AlertDialogFooter gap={3}>
            <Button ref={cancelRef} onClick={onClose} isDisabled={isLoading}>
              Cancel
            </Button>
            <Button
              colorScheme={confirmColorScheme}
              onClick={onConfirm}
              isLoading={isLoading}
            >
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  )
}

export default ConfirmActionDialog
