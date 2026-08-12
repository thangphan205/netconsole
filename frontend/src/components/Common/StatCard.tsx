import {
  Box,
  Skeleton,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
} from "@chakra-ui/react"
import type { ReactNode } from "react"

interface StatCardProps {
  label: string
  count: ReactNode
  isLoading?: boolean
  helpText?: ReactNode
  colorScheme?: string
}

/**
 * Compact metric tile. `count` accepts a node so callers can render a score
 * with a suffix or a badge row instead of a plain number.
 */
function StatCard({
  label,
  count,
  isLoading = false,
  helpText,
  colorScheme,
}: StatCardProps) {
  return (
    <Box borderWidth="1px" borderRadius="md" p={3}>
      <Stat>
        <StatLabel fontSize="xs" color="gray.500">
          {label}
        </StatLabel>
        <Skeleton isLoaded={!isLoading} mt={0.5}>
          <StatNumber
            fontSize="xl"
            color={colorScheme ? `${colorScheme}.500` : undefined}
          >
            {count ?? 0}
          </StatNumber>
        </Skeleton>
        {helpText && (
          <StatHelpText fontSize="xs" mb={0}>
            {helpText}
          </StatHelpText>
        )}
      </Stat>
    </Box>
  )
}

export default StatCard
