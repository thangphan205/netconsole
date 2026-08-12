import { Box, Icon, Text, VStack } from "@chakra-ui/react"
import type { ElementType, ReactNode } from "react"

interface EmptyStateProps {
  title: string
  description?: string
  icon?: ElementType
  action?: ReactNode
}

/**
 * The "nothing here" panel used when a query succeeded but returned no rows.
 * Distinct from an error state on purpose — an empty table and a failed fetch
 * looking identical is how users end up trusting stale data.
 */
function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <Box textAlign="center" py={12} px={4}>
      <VStack spacing={2}>
        {icon && <Icon as={icon} boxSize={7} color="gray.400" />}
        <Text fontWeight="medium" color="gray.500">
          {title}
        </Text>
        {description && (
          <Text fontSize="sm" color="gray.400" maxW="md">
            {description}
          </Text>
        )}
        {action && <Box pt={2}>{action}</Box>}
      </VStack>
    </Box>
  )
}

export default EmptyState
