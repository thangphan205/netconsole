import { Alert, AlertIcon, Button, Center, Spinner, Text, VStack } from "@chakra-ui/react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"

export const Route = createFileRoute("/oauth-callback")({
  component: OAuthCallback,
})

function OAuthCallback() {
  const navigate = useNavigate()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get("token")
    const error = params.get("error")

    if (token) {
      localStorage.setItem("access_token", token)
      // Strip token from URL before navigating
      history.replaceState({}, "", "/oauth-callback")
      navigate({ to: "/" })
    } else if (error) {
      setErrorMsg(error.replace(/_/g, " "))
    } else {
      setErrorMsg("Unknown error during login")
    }
  }, [navigate])

  if (errorMsg) {
    return (
      <Center h="100vh">
        <VStack gap={4}>
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <Text>Login failed: {errorMsg}</Text>
          </Alert>
          <Button onClick={() => navigate({ to: "/login" })}>Back to Login</Button>
        </VStack>
      </Center>
    )
  }

  return (
    <Center h="100vh">
      <Spinner size="xl" />
    </Center>
  )
}
