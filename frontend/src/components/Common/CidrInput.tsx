import {
  Box,
  Input,
  Tag,
  TagCloseButton,
  TagLabel,
  Wrap,
  WrapItem,
} from "@chakra-ui/react"
import {
  type ClipboardEvent,
  type KeyboardEvent,
  useRef,
  useState,
} from "react"

interface CidrInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  isInvalid?: boolean
}

export function parseCidrInput(input: string): string[] {
  // split by comma, space, semicolon or newlines
  const rawParts = input.split(/[\s,;\n]+/)
  const parsed: string[] = []

  for (let part of rawParts) {
    part = part.trim()
    if (!part) continue

    // Check if it already has a slash
    if (part.includes("/")) {
      parsed.push(part)
    } else {
      // Check if it looks like IPv4 or IPv6
      if (/^(\d{1,3}\.){3}\d{1,3}$/.test(part)) {
        parsed.push(`${part}/32`)
      } else if (/^[0-9a-fA-F:]+$/.test(part) && part.includes(":")) {
        parsed.push(`${part}/128`)
      } else {
        parsed.push(part)
      }
    }
  }
  return parsed
}

export const CidrInput = ({
  value,
  onChange,
  placeholder,
  isInvalid,
}: CidrInputProps) => {
  const [inputValue, setInputValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  // Convert comma-separated string to array
  const cidrs = value
    ? value
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
    : []

  const updateCidrs = (newCidrs: string[]) => {
    // deduplicate
    const unique = Array.from(new Set(newCidrs))
    onChange(unique.join(","))
  }

  const addCidrs = (rawInput: string) => {
    const parsed = parseCidrInput(rawInput)
    if (parsed.length > 0) {
      updateCidrs([...cidrs, ...parsed])
      setInputValue("")
    }
  }

  const removeCidr = (indexToRemove: number) => {
    const updated = cidrs.filter((_, idx) => idx !== indexToRemove)
    updateCidrs(updated)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addCidrs(inputValue)
    } else if (e.key === "Backspace" && !inputValue && cidrs.length > 0) {
      removeCidr(cidrs.length - 1)
    }
  }

  const handleBlur = () => {
    if (inputValue.trim()) {
      addCidrs(inputValue)
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData("text")
    addCidrs(pastedText)
  }

  const handleContainerClick = () => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  return (
    <Box
      border="1px solid"
      borderColor={isInvalid ? "red.500" : "gray.300"}
      borderRadius="md"
      p={2}
      minH="40px"
      bg="white"
      _hover={{ borderColor: isInvalid ? "red.600" : "gray.400" }}
      _focusWithin={{
        borderColor: isInvalid ? "red.500" : "ui.main",
        boxShadow: isInvalid ? "0 0 0 1px #e53e3e" : "0 0 0 1px #009688",
      }}
      cursor="text"
      onClick={handleContainerClick}
    >
      <Wrap spacing={2} align="center">
        {cidrs.map((cidr, index) => (
          <WrapItem key={`${cidr}-${index}`}>
            <Tag
              size="sm"
              borderRadius="full"
              variant="solid"
              colorScheme="teal"
              backgroundColor="ui.main"
              color="white"
            >
              <TagLabel>{cidr}</TagLabel>
              <TagCloseButton
                onClick={(e) => {
                  e.stopPropagation()
                  removeCidr(index)
                }}
              />
            </Tag>
          </WrapItem>
        ))}
        <WrapItem flexGrow={1}>
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onPaste={handlePaste}
            placeholder={cidrs.length === 0 ? placeholder : ""}
            size="sm"
            variant="unstyled"
            minW="120px"
            p={0}
            _focus={{ border: "none" }}
          />
        </WrapItem>
      </Wrap>
    </Box>
  )
}
