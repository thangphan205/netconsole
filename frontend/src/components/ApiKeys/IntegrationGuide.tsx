import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Code,
  Flex,
  Heading,
  Icon,
  IconButton,
  ListItem,
  OrderedList,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useClipboard,
  useColorModeValue,
} from "@chakra-ui/react"
import {
  FiBookOpen,
  FiCheck,
  FiCopy,
  FiCpu,
  FiSettings,
  FiTerminal,
} from "react-icons/fi"

interface CodeBlockProps {
  code: string
  language: string
}

const CodeBlock = ({ code, language }: CodeBlockProps) => {
  const { hasCopied, onCopy } = useClipboard(code)
  return (
    <Box
      position="relative"
      mt={2}
      mb={4}
      borderRadius="md"
      overflow="hidden"
      border="1px solid"
      borderColor="ui.darkSlate"
    >
      <Flex
        justify="space-between"
        align="center"
        bg="ui.darkSlate"
        color="ui.light"
        px={4}
        py={1.5}
        fontSize="xs"
      >
        <Text fontWeight="semibold">{language}</Text>
        <IconButton
          aria-label="Copy code"
          icon={
            hasCopied ? (
              <Icon as={FiCheck} color="ui.success" />
            ) : (
              <Icon as={FiCopy} />
            )
          }
          size="xs"
          variant="ghost"
          onClick={onCopy}
          color="ui.light"
          _hover={{ bg: "whiteAlpha.200" }}
        />
      </Flex>
      <Box
        as="pre"
        p={4}
        bg="ui.dark"
        color="ui.light"
        fontSize="sm"
        overflowX="auto"
        fontFamily="mono"
      >
        <code>{code}</code>
      </Box>
    </Box>
  )
}

export const IntegrationGuide = () => {
  const bgColor = useColorModeValue("ui.light", "ui.dark")
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")
  const textColor = useColorModeValue("ui.dark", "ui.light")
  const mutedColor = useColorModeValue("gray.600", "gray.400")

  const mcpSetupCode = `cd mcp_server
uv sync   # or: pip install -e .`

  const claudeDesktopCode = `{
  "mcpServers": {
    "netconsole": {
      "command": "uv",
      "args": [
        "--directory",
        "/absolute/path/to/netconsole/mcp_server",
        "run",
        "python",
        "-m",
        "netconsole_mcp"
      ],
      "env": {
        "NETCONSOLE_API_URL": "http://localhost/api/v1",
        "NETCONSOLE_API_KEY": "your_api_key_here"
      }
    }
  }
}`

  const claudeCodeEnv = "export NETCONSOLE_API_KEY=your_api_key_here"

  const geminiCode = `{
  "mcpServers": {
    "netconsole": {
      "command": "uv",
      "args": [
        "--directory",
        "/absolute/path/to/netconsole/mcp_server",
        "run",
        "python",
        "-m",
        "netconsole_mcp"
      ],
      "env": {
        "NETCONSOLE_API_URL": "http://localhost/api/v1",
        "NETCONSOLE_API_KEY": "your_api_key_here"
      }
    }
  }
}`

  return (
    <Card
      mt={8}
      bg={bgColor}
      border="1px solid"
      borderColor={secBgColor}
      borderRadius="lg"
      shadow="md"
    >
      <CardHeader borderBottom="1px solid" borderColor={secBgColor} py={4}>
        <Flex align="center" gap={2}>
          <Icon as={FiBookOpen} color="ui.main" boxSize={5} />
          <Heading size="md" color={textColor}>
            Claude & Gemini MCP Integration Guide
          </Heading>
        </Flex>
        <Text fontSize="sm" color={mutedColor} mt={1}>
          Learn how to integrate your NetConsole API Keys with AI agents using
          the Model Context Protocol (MCP) server.
        </Text>
      </CardHeader>
      <CardBody>
        <Tabs variant="enclosed" colorScheme="teal">
          <TabList>
            <Tab fontWeight="semibold">
              <Icon as={FiSettings} mr={2} />
              1. Setup MCP
            </Tab>
            <Tab fontWeight="semibold">
              <Icon as={FiCpu} mr={2} />
              Claude Desktop
            </Tab>
            <Tab fontWeight="semibold">
              <Icon as={FiTerminal} mr={2} />
              Claude Code
            </Tab>
            <Tab fontWeight="semibold">
              <Icon as={FiTerminal} mr={2} />
              Gemini CLI
            </Tab>
          </TabList>

          <TabPanels>
            {/* Tab 1: Setup MCP */}
            <TabPanel px={0} pt={4}>
              <Stack spacing={4}>
                <Text fontSize="sm" color={textColor}>
                  To use NetConsole tools inside Claude or Gemini, you first
                  need to configure the MCP server local files.
                </Text>
                <OrderedList spacing={3} fontSize="sm" color={textColor} pl={4}>
                  <ListItem>
                    <strong>Prepare dependencies:</strong> Open your terminal,
                    navigate to the <Code>mcp_server</Code> folder, and sync
                    environment dependencies.
                    <CodeBlock code={mcpSetupCode} language="bash" />
                  </ListItem>
                  <ListItem>
                    <strong>Mint an API Key:</strong> Click the{" "}
                    <strong>Add ApiKey</strong> button above, give it a name
                    (e.g. <Code>claude-mcp</Code>), choose a role (
                    <Code>Read-write</Code> is required for pushing configs),
                    and copy the key.
                  </ListItem>
                </OrderedList>
              </Stack>
            </TabPanel>

            {/* Tab 2: Claude Desktop */}
            <TabPanel px={0} pt={4}>
              <Stack spacing={4}>
                <Text fontSize="sm" color={textColor}>
                  Configure Claude Desktop to load NetConsole tools locally.
                </Text>
                <OrderedList spacing={3} fontSize="sm" color={textColor} pl={4}>
                  <ListItem>
                    Open your Claude Desktop configuration file:
                    <Stack spacing={1} mt={1} pl={4}>
                      <Text>
                        • <strong>macOS:</strong>{" "}
                        <Code fontSize="xs">
                          ~/Library/Application
                          Support/Claude/claude_desktop_config.json
                        </Code>
                      </Text>
                      <Text>
                        • <strong>Windows:</strong>{" "}
                        <Code fontSize="xs">
                          %APPDATA%\Claude\claude_desktop_config.json
                        </Code>
                      </Text>
                    </Stack>
                  </ListItem>
                  <ListItem>
                    Add the <Code>netconsole</Code> configuration. Replace{" "}
                    <Code>your_api_key_here</Code> with the API key generated
                    above and update{" "}
                    <Code>/absolute/path/to/netconsole/mcp_server</Code> with
                    your actual project path:
                    <CodeBlock code={claudeDesktopCode} language="json" />
                  </ListItem>
                  <ListItem>
                    Restart your <strong>Claude Desktop</strong> app. You should
                    see the tool hammer icon representing the netconsole
                    commands.
                  </ListItem>
                </OrderedList>
              </Stack>
            </TabPanel>

            {/* Tab 3: Claude Code */}
            <TabPanel px={0} pt={4}>
              <Stack spacing={4}>
                <Text fontSize="sm" color={textColor}>
                  Claude Code is configured via the project-level{" "}
                  <Code>.mcp.json</Code> file already included in the workspace
                  root.
                </Text>
                <OrderedList spacing={3} fontSize="sm" color={textColor} pl={4}>
                  <ListItem>
                    Before launching Claude Code, export the API key environment
                    variable in your terminal:
                    <CodeBlock code={claudeCodeEnv} language="bash" />
                  </ListItem>
                  <ListItem>
                    Start Claude Code using:
                    <Code
                      fontSize="xs"
                      display="block"
                      my={2}
                      p={2}
                      bg={secBgColor}
                      borderRadius="sm"
                    >
                      claude
                    </Code>
                  </ListItem>
                  <ListItem>
                    The client will read <Code>NETCONSOLE_API_KEY</Code> and
                    automatically connect to your local NetConsole MCP server.
                  </ListItem>
                </OrderedList>
              </Stack>
            </TabPanel>

            {/* Tab 4: Gemini CLI */}
            <TabPanel px={0} pt={4}>
              <Stack spacing={4}>
                <Text fontSize="sm" color={textColor}>
                  Gemini CLI supports MCP clients natively.
                </Text>
                <OrderedList spacing={3} fontSize="sm" color={textColor} pl={4}>
                  <ListItem>
                    Create or edit the settings file:
                    <Stack spacing={1} mt={1} pl={4}>
                      <Text>
                        • <strong>Project-level:</strong>{" "}
                        <Code fontSize="xs">.gemini/settings.json</Code>
                      </Text>
                      <Text>
                        • <strong>Global-level:</strong>{" "}
                        <Code fontSize="xs">~/.gemini/settings.json</Code>
                      </Text>
                    </Stack>
                  </ListItem>
                  <ListItem>
                    Add the server configuration. Replace{" "}
                    <Code>your_api_key_here</Code> with the API key and update
                    the directory argument with the absolute path to your{" "}
                    <Code>mcp_server</Code>:
                    <CodeBlock code={geminiCode} language="json" />
                  </ListItem>
                  <ListItem>
                    Restart Gemini CLI. The tools will load automatically.
                  </ListItem>
                </OrderedList>
              </Stack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </CardBody>
    </Card>
  )
}
