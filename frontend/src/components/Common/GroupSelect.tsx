import { Box } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { type OptionBase, Select, type SingleValue } from "chakra-react-select"

import { GroupsService } from "../../client"

export interface GroupOption extends OptionBase {
  label: string
  value: string
}

interface GroupSelectProps {
  value: string
  onChange: (groupName: string) => void
  placeholder?: string
  width?: string
  size?: "sm" | "md"
}

/**
 * Group picker backed by the shared ["groups"] query. Emits the group *name*,
 * which is what the compliance and group-config APIs key on.
 */
function GroupSelect({
  value,
  onChange,
  placeholder = "All groups",
  width = "220px",
  size = "sm",
}: GroupSelectProps) {
  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: () => GroupsService.readGroups({}),
  })

  const options: GroupOption[] = (groups?.data ?? []).map((group) => ({
    value: group.name,
    label: group.site ? `${group.name} — ${group.site}` : group.name,
  }))

  return (
    <Box width={width}>
      <Select<GroupOption>
        size={size}
        options={options}
        placeholder={placeholder}
        isClearable
        value={value ? options.find((opt) => opt.value === value) : null}
        onChange={(newValue: SingleValue<GroupOption>) =>
          onChange(newValue ? newValue.value : "")
        }
      />
    </Box>
  )
}

export default GroupSelect
