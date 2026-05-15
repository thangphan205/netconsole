import {
  Badge,
  Box,
  Button,
  HStack,
  Heading,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react"
import { startRegistration } from "@simplewebauthn/browser"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { DeleteIcon } from "@chakra-ui/icons"
import useCustomToast from "../../hooks/useCustomToast"
import { OpenAPI } from "../../client"

const getHeaders = async () => {
  const tokenResolver = OpenAPI.TOKEN
  const token =
    typeof tokenResolver === "function"
      ? await tokenResolver({ url: "" } as any)
      : (tokenResolver ?? "")
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }
}

const API = import.meta.env.VITE_API_URL ?? ""

interface PasskeyInfo {
  id: number
  name: string | null
  device_type: string | null
  backed_up: boolean
  aaguid: string | null
  created_at: string
  last_used_at: string | null
}

async function fetchCredentials(): Promise<PasskeyInfo[]> {
  const headers = await getHeaders()
  const res = await fetch(`${API}/api/v1/auth/passkey/credentials`, { headers })
  if (!res.ok) throw new Error("Failed to load passkeys")
  return res.json()
}

async function deleteCredential(id: number): Promise<void> {
  const headers = await getHeaders()
  const res = await fetch(`${API}/api/v1/auth/passkey/credentials/${id}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) throw new Error("Failed to delete passkey")
}

export default function PasskeyManager() {
  const showToast = useCustomToast()
  const queryClient = useQueryClient()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [passkeyName, setPasskeyName] = useState("")
  const nameRef = useRef<HTMLInputElement>(null)

  const { data: credentials, isLoading } = useQuery({
    queryKey: ["passkey-credentials"],
    queryFn: fetchCredentials,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCredential,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["passkey-credentials"] })
      showToast("Passkey removed", "", "success")
    },
    onError: (err: Error) => showToast("Delete failed", err.message, "error"),
  })

  const registerPasskey = async () => {
    try {
      const headers = await getHeaders()
      const beginRes = await fetch(`${API}/api/v1/auth/passkey/register/begin`, {
        method: "POST",
        headers,
        credentials: "include",
      })
      if (!beginRes.ok) throw new Error("Failed to start registration")
      const options = await beginRes.json()

      const attestation = await startRegistration({ optionsJSON: options })

      const completeRes = await fetch(`${API}/api/v1/auth/passkey/register/complete`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          credential: attestation,
          name: passkeyName || null,
        }),
      })
      if (!completeRes.ok) {
        const err = await completeRes.json().catch(() => ({}))
        throw new Error(err?.detail ?? "Registration failed")
      }

      queryClient.invalidateQueries({ queryKey: ["passkey-credentials"] })
      showToast("Passkey added", "You can now sign in with this passkey.", "success")
      setPasskeyName("")
      onClose()
    } catch (err: any) {
      if (err?.name === "NotAllowedError") return // user cancelled
      showToast("Registration failed", err?.message ?? "Unknown error", "error")
    }
  }

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString() : "Never"

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Heading size="sm">Passkeys</Heading>
        <Button size="sm" onClick={onOpen}>
          Add Passkey
        </Button>
      </HStack>

      {isLoading && <Spinner />}

      {!isLoading && credentials?.length === 0 && (
        <Text color="gray.500" fontSize="sm">
          No passkeys registered. Add one to sign in without a password.
        </Text>
      )}

      <VStack align="stretch" gap={2}>
        {credentials?.map((cred) => (
          <HStack
            key={cred.id}
            p={3}
            border="1px"
            borderColor="gray.200"
            borderRadius="md"
            justify="space-between"
          >
            <VStack align="start" gap={0}>
              <HStack>
                <Text fontWeight="medium" fontSize="sm">
                  {cred.name ?? "Unnamed passkey"}
                </Text>
                {cred.backed_up && (
                  <Badge colorScheme="green" fontSize="xs">
                    Synced
                  </Badge>
                )}
              </HStack>
              <Text fontSize="xs" color="gray.500">
                Added {formatDate(cred.created_at)} · Last used{" "}
                {formatDate(cred.last_used_at)}
              </Text>
            </VStack>
            <IconButton
              aria-label="Remove passkey"
              icon={<DeleteIcon />}
              size="sm"
              variant="ghost"
              colorScheme="red"
              isLoading={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(cred.id)}
            />
          </HStack>
        ))}
      </VStack>

      <Modal isOpen={isOpen} onClose={onClose} initialFocusRef={nameRef}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add Passkey</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" mb={3}>
              Give this passkey a name so you can identify it later (optional).
            </Text>
            <Input
              ref={nameRef}
              placeholder="e.g. MacBook Touch ID"
              value={passkeyName}
              onChange={(e) => setPasskeyName(e.target.value)}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={registerPasskey}>Register Passkey</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}
