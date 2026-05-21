import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

/**
 * Manages a controlled text input that debounces URL navigation.
 *
 * Returns a props object you can spread directly onto an <input> element:
 *
 *   const searchInput = useDebouncedInput(search, (v) => setFilter("search", v));
 *   <Input {...searchInput} />
 *
 * Behaviour:
 *  - `value`     — reflects every keystroke immediately (no lag).
 *  - `onChange`  — debounces the navigation call by `delay` ms.
 *  - `onKeyDown` — pressing Escape clears the input instantly (no debounce),
 *                  fires `onChange("")`, and keeps focus on the input.
 *  - `ref`       — attached to the <input> so focus is managed internally.
 *
 * The local state stays in sync with `urlValue` so browser back/forward
 * navigation (which changes the URL without a remount) updates the input.
 *
 * @param urlValue  The current value from the URL search param (may be undefined).
 * @param onChange  Called with the debounced string — usually `setFilter(key, value)`.
 * @param delay     Debounce delay in milliseconds (default: 300).
 */
export function useDebouncedInput(
  urlValue: string | undefined,
  onChange: (value: string) => void,
  delay = 300
) {
  const [value, setValue] = useState(urlValue ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the latest onChange without resetting the debounce timer.
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Sync the input when the URL param changes externally (back/forward nav).
  useEffect(() => {
    setValue(urlValue ?? "");
  }, [urlValue]);

  // Cancel any pending timer on unmount.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setValue("");
    onChangeRef.current("");
  }, []);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setValue(v);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onChangeRef.current(v), delay);
    },
    [delay]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        clear();
        inputRef.current?.focus();
      }
    },
    [clear]
  );

  return {
    ref: inputRef,
    value,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    clear,
  } as const;
}
