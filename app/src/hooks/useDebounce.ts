import * as React from 'react'

export function useDebouncedCallback<A extends unknown[]>(
  callback: (...args: A) => void,
  delay: number,
) {
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const cbRef = React.useRef(callback)
  cbRef.current = callback

  const debounced = React.useCallback(
    (...args: A) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => cbRef.current(...args), delay)
    },
    [delay],
  )

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  return debounced
}

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}
