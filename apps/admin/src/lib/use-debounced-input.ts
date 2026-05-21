import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Manages a controlled text input that debounces URL navigation.
 *
 * - `inputValue`    — bind to the input's `value` prop (reflects typing immediately).
 * - `handleChange`  — call with the raw input value on every keystroke.
 *
 * The `onChange` callback (typically `setFilter`) is only called after the user
 * stops typing for `delay` ms, keeping URL updates smooth.
 *
 * The local state is kept in sync with `urlValue` so browser back/forward
 * navigation updates the input correctly.
 *
 * @param urlValue  The current value from the URL search param (may be undefined).
 * @param onChange  Called with the debounced value — usually `setFilter(key, value)`.
 * @param delay     Debounce delay in milliseconds (default: 300).
 */
export function useDebouncedInput(
  urlValue: string | undefined,
  onChange: (value: string) => void,
  delay = 300
): readonly [string, (value: string) => void] {
  const [inputValue, setInputValue] = useState(urlValue ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);

  // Always call the latest onChange without resetting the debounce timer.
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Sync the input when the URL param changes externally (back/forward nav).
  useEffect(() => {
    setInputValue(urlValue ?? "");
  }, [urlValue]);

  // Cancel any pending timer on unmount.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const handleChange = useCallback((value: string) => {
    setInputValue(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChangeRef.current(value), delay);
  }, [delay]);

  return [inputValue, handleChange] as const;
}
