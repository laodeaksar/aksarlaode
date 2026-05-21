import { XIcon } from "lucide-react";

import { Input } from "@repo/ui/components/input";

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
 * A search input with a built-in × clear button.
 *
 * The clear button appears only when the input has a value.
 * Clicking it calls `clear()` (from useDebouncedInput) which removes the
 * search from the URL immediately — no debounce wait.
 *
 * Spread the object returned by useDebouncedInput directly:
 *
 *   const searchInput = useDebouncedInput(search, (v) => setFilter("search", v));
 *   <SearchInput placeholder="Search…" {...searchInput} />
 */
export function SearchInput({
  placeholder,
  className = "w-64",
  clear,
  ...inputProps
}: SearchInputProps) {
  return (
    <div className="relative">
      <Input
        className={`${className} ${inputProps.value ? "pr-8" : ""}`}
        placeholder={placeholder}
        {...inputProps}
      />
      {inputProps.value && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          tabIndex={-1}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-sm transition-colors focus:outline-none"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}
