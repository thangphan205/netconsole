import {
  Skeleton,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react"

interface SkeletonRowsProps {
  columns: string[]
  rows?: number
}

/** Table-shaped loading placeholder, so the layout doesn't jump on load. */
function SkeletonRows({ columns, rows = 5 }: SkeletonRowsProps) {
  return (
    <TableContainer>
      <Table size="sm">
        <Thead>
          <Tr>
            {columns.map((header) => (
              <Th key={header}>{header}</Th>
            ))}
          </Tr>
        </Thead>
        <Tbody>
          {new Array(rows).fill(null).map((_, rowIndex) => (
            <Tr key={rowIndex}>
              {columns.map((header) => (
                <Td key={header}>
                  <Skeleton height="16px" />
                </Td>
              ))}
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableContainer>
  )
}

export default SkeletonRows
