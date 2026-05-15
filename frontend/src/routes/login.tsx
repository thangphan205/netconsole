import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons"
import {
  Button,
  Center,
  Container,
  Divider,
  FormControl,
  FormErrorMessage,
  HStack,
  Icon,
  Image,
  Input,
  InputGroup,
  InputRightElement,
  Link,
  Text,
  VStack,
  useBoolean,
} from "@chakra-ui/react"
import {
  Link as RouterLink,
  createFileRoute,
  redirect,
} from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { type SubmitHandler, useForm } from "react-hook-form"
import { FcGoogle } from "react-icons/fc"
import { BsMicrosoft } from "react-icons/bs"
import { FaKey } from "react-icons/fa"

import Logo from "/assets/images/netconsole-logo.svg"
import type { Body_login_login_access_token as AccessToken } from "../client"
import useAuth, { isLoggedIn } from "../hooks/useAuth"
import { emailPattern } from "../utils"
import PasskeyLogin from "../components/Auth/PasskeyLogin"

const API = import.meta.env.VITE_API_URL ?? ""

const PROVIDER_ICONS: Record<string, React.ReactElement> = {
  google: <FcGoogle />,
  microsoft: <BsMicrosoft />,
  keycloak: <FaKey />,
}

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  microsoft: "Microsoft",
  keycloak: "Keycloak",
}

export const Route = createFileRoute("/login")({
  component: Login,
  beforeLoad: async () => {
    if (isLoggedIn()) {
      throw redirect({
        to: "/",
      })
    }
  },
})

function Login() {
  const [show, setShow] = useBoolean()
  const { loginMutation, error, resetError } = useAuth()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AccessToken>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      username: "",
      password: "",
    },
  })

  const { data: providersData } = useQuery<{ providers: string[] }>({
    queryKey: ["auth-providers"],
    queryFn: async () => {
      const res = await fetch(`${API}/api/v1/auth/providers`)
      return res.json()
    },
    staleTime: 60_000,
  })
  const providers = providersData?.providers ?? []

  const onSubmit: SubmitHandler<AccessToken> = async (data) => {
    if (isSubmitting) return
    resetError()
    try {
      await loginMutation.mutateAsync(data)
    } catch {
      // error is handled by useAuth hook
    }
  }

  return (
    <>
      <Container
        as="form"
        onSubmit={handleSubmit(onSubmit)}
        h="100vh"
        maxW="sm"
        alignItems="stretch"
        justifyContent="center"
        gap={4}
        centerContent
      >
        <Image
          src={Logo}
          alt="FastAPI logo"
          height="auto"
          maxW="2xs"
          alignSelf="center"
          mb={4}
        />
        <FormControl id="username" isInvalid={!!errors.username || !!error}>
          <Input
            id="username"
            {...register("username", {
              pattern: emailPattern,
            })}
            placeholder="Email"
            type="email"
            required
          />
          {errors.username && (
            <FormErrorMessage>{errors.username.message}</FormErrorMessage>
          )}
        </FormControl>
        <FormControl id="password" isInvalid={!!error}>
          <InputGroup>
            <Input
              {...register("password")}
              type={show ? "text" : "password"}
              placeholder="Password"
              required
            />
            <InputRightElement
              color="ui.dim"
              _hover={{
                cursor: "pointer",
              }}
            >
              <Icon
                onClick={setShow.toggle}
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <ViewOffIcon /> : <ViewIcon />}
              </Icon>
            </InputRightElement>
          </InputGroup>
          {error && <FormErrorMessage>{error}</FormErrorMessage>}
        </FormControl>
        <Center>
          <Link as={RouterLink} to="/recover-password" color="blue.500">
            Forgot password?
          </Link>
        </Center>
        <Button variant="primary" type="submit" isLoading={isSubmitting}>
          Log In
        </Button>

        {(providers.length > 0) && (
          <>
            <HStack>
              <Divider />
              <Text fontSize="sm" color="gray.500" whiteSpace="nowrap" px={2}>
                or continue with
              </Text>
              <Divider />
            </HStack>
            <VStack gap={2}>
              {providers.map((provider) => (
                <Button
                  key={provider}
                  variant="outline"
                  w="full"
                  leftIcon={PROVIDER_ICONS[provider]}
                  onClick={() => {
                    window.location.href = `${API}/api/v1/auth/${provider}/login`
                  }}
                >
                  {PROVIDER_LABELS[provider] ?? provider}
                </Button>
              ))}
            </VStack>
          </>
        )}

        <HStack>
          <Divider />
          <Text fontSize="sm" color="gray.500" whiteSpace="nowrap" px={2}>
            or
          </Text>
          <Divider />
        </HStack>
        <PasskeyLogin />
      </Container>
    </>
  )
}
