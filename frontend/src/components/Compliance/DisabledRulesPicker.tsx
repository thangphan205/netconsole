import { Box, Text } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { type OptionBase, Select } from "chakra-react-select"

import { ComplianceService } from "../../client"

interface RuleOption extends OptionBase {
  label: string
  value: string
}

interface DisabledRulesPickerProps {
  /** Comma-separated rule ids, the shape the profile column stores. */
  value: string | null | undefined
  onChange: (value: string) => void
  placeholder?: string
}

export function parseRuleIds(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((rule) => rule.trim())
    .filter(Boolean)
}

/**
 * Multi-select for bypassed rules, fed by the live rule catalog. Replaces a
 * free-text comma list where a typo silently disabled nothing.
 */
function DisabledRulesPicker({
  value,
  onChange,
  placeholder = "No rules bypassed",
}: DisabledRulesPickerProps) {
  const { data: rules, isLoading } = useQuery({
    queryKey: ["compliance-rules"],
    queryFn: () => ComplianceService.readRules(),
    staleTime: Number.POSITIVE_INFINITY,
  })

  const options: RuleOption[] = (rules?.data ?? []).map((rule) => ({
    value: rule.id,
    label: `${rule.id} — ${rule.title}`,
  }))

  const selectedIds = parseRuleIds(value)
  const selected = selectedIds.map(
    (id) =>
      options.find((option) => option.value === id) ?? { value: id, label: id },
  )

  return (
    <Box>
      <Select<RuleOption, true>
        isMulti
        size="sm"
        isLoading={isLoading}
        options={options}
        placeholder={placeholder}
        value={selected}
        onChange={(next) =>
          onChange(next.map((option) => option.value).join(","))
        }
        closeMenuOnSelect={false}
      />
      <Text fontSize="xs" color="gray.500" mt={1}>
        Bypassed rules report NOT_APPLICABLE with evidence “Rule disabled in
        compliance profile”.
      </Text>
    </Box>
  )
}

export default DisabledRulesPicker
