import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Code,
  HStack,
  Icon,
  IconButton,
  Text,
  Tooltip,
  VStack,
  useClipboard,
  useColorModeValue,
} from "@chakra-ui/react"
import { FiCheck, FiCopy } from "react-icons/fi"

import type { RemediationCommandBlock } from "../../client"

function CopyButton({ value, label }: { value: string; label: string }) {
  const { hasCopied, onCopy } = useClipboard(value)
  return (
    <Tooltip label={hasCopied ? "Copied" : label}>
      <IconButton
        aria-label={label}
        size="xs"
        variant="ghost"
        icon={<Icon as={hasCopied ? FiCheck : FiCopy} />}
        onClick={onCopy}
      />
    </Tooltip>
  )
}

export function CommandBlock({
  commands,
  label,
}: {
  commands: string
  label?: string
}) {
  const bg = useColorModeValue("gray.50", "gray.900")
  const headerBg = useColorModeValue("gray.100", "gray.700")
  return (
    <Box borderWidth="1px" borderRadius="md" overflow="hidden">
      <HStack justify="space-between" px={3} py={1} bg={headerBg}>
        <Text fontSize="xs" fontWeight="medium" color="gray.500">
          {label ?? "Commands"}
        </Text>
        <CopyButton value={commands} label="Copy commands" />
      </HStack>
      <Code
        display="block"
        whiteSpace="pre"
        overflowX="auto"
        p={3}
        bg={bg}
        fontSize="xs"
        borderRadius={0}
      >
        {commands}
      </Code>
    </Box>
  )
}

interface RemediationPreviewProps {
  commands: string
  blocks?: RemediationCommandBlock[]
  caveats?: string
  /** Shown above the commands. Group and device pushes warn about different things. */
  warning?: string
}

/**
 * The shared "here is exactly what will be pushed" panel. Per-rule blocks are
 * display-only: `commands` is still the text the sha256 confirm token is
 * computed over, so the two can never disagree about what gets sent.
 */
function RemediationPreview({
  commands,
  blocks,
  caveats,
  warning,
}: RemediationPreviewProps) {
  return (
    <VStack align="stretch" spacing={3}>
      {warning && (
        <Alert status="warning" borderRadius="md" fontSize="sm">
          <AlertIcon />
          {warning}
        </Alert>
      )}
      {caveats && (
        <Alert status="info" borderRadius="md" fontSize="sm">
          <AlertIcon />
          {caveats}
        </Alert>
      )}

      {blocks && blocks.length > 0 ? (
        <VStack align="stretch" spacing={2}>
          {blocks.map((block) => (
            <Box key={block.rule_id}>
              <HStack mb={1} spacing={2}>
                <Badge colorScheme="orange" variant="subtle" fontSize="2xs">
                  {block.rule_id}
                </Badge>
                <Text fontSize="xs" color="gray.500">
                  {block.title}
                </Text>
              </HStack>
              <CommandBlock
                commands={block.commands}
                label={`${block.rule_id} commands`}
              />
            </Box>
          ))}
        </VStack>
      ) : (
        <CommandBlock commands={commands} />
      )}
    </VStack>
  )
}

export default RemediationPreview
