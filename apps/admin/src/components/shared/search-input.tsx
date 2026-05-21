import { SearchIcon, XIcon } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@repo/ui/components/input-group";

type SearchInputProps = {
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  ref?: React.Ref<HTMLInputElement>;
  clear: () => void;
};

/**
 * A search input built on InputGroup with a leading search icon and a
 * trailing × clear button that appears only when the input has a value.
 *
 * Spread the object returned by useDebouncedInput directly:
 *
 *   const searchInput = useDebouncedInput(search, (v) => setFilter("search", v));
 *   <SearchInput placeholder="Search…" {...searchInput} />
 */
export function SearchInput({
  placeholder,
  "aria-label": ariaLabel,
  className = "w-64",
  clear,
  ...inputProps
}: SearchInputProps) {
  return (
    <InputGroup className={className}>
      <InputGroupAddon align="inline-start">
        <InputGroupText>
          <SearchIcon />
        </InputGroupText>
      </InputGroupAddon>

      <InputGroupInput
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        {...inputProps}
      />

      {inputProps.value && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            onClick={clear}
            aria-label="Clear search"
            tabIndex={-1}
          >
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
