import { Button } from "@chakra-ui/react"
import { startAuthentication } from "@simplewebauthn/browser"
import { useNavigate } from "@tanstack/react-router"
import useCustomToast from "../../hooks/useCustomToast"

const API = import.meta.env.VITE_API_URL ?? ""

export default function PasskeyLogin() {
  const navigate = useNavigate()
  const showToast = useCustomToast()

  const handlePasskeyLogin = async () => {
    try {
      const beginRes = await fetch(`${API}/api/v1/auth/passkey/login/begin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      })
      if (!beginRes.ok) throw new Error("Failed to start passkey login")
      const options = await beginRes.json()

      const assertion = await startAuthentication({ optionsJSON: options })

      const completeRes = await fetch(`${API}/api/v1/auth/passkey/login/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(assertion),
      })
      if (!completeRes.ok) {
        const err = await completeRes.json().catch(() => ({}))
        throw new Error(err?.detail ?? "Passkey authentication failed")
      }

      const { access_token } = await completeRes.json()
      localStorage.setItem("access_token", access_token)
      navigate({ to: "/" })
    } catch (err: any) {
      if (err?.name === "NotAllowedError") return // user cancelled
      showToast("Passkey login failed", err?.message ?? "Unknown error", "error")
    }
  }

  return (
    <Button variant="outline" w="full" onClick={handlePasskeyLogin}>
      Sign in with a Passkey
    </Button>
  )
}
