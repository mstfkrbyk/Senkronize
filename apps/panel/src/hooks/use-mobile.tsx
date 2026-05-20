import * as React from "react"

const MOBILE_BREAKPOINT = 768
const DESKTOP_BREAKPOINT = 1024

function readWidth(): number {
  if (typeof window === "undefined") {
    return DESKTOP_BREAKPOINT
  }
  return window.innerWidth
}

function readIsMobile(): boolean {
  return readWidth() < MOBILE_BREAKPOINT
}

function readIsTablet(): boolean {
  const width = readWidth()
  return width >= MOBILE_BREAKPOINT && width < DESKTOP_BREAKPOINT
}

function readIsDesktop(): boolean {
  return readWidth() >= DESKTOP_BREAKPOINT
}

function useMediaQuery(query: string, read: () => boolean): boolean {
  const [matches, setMatches] = React.useState<boolean>(read)

  React.useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (): void => {
      setMatches(read())
    }
    mql.addEventListener("change", onChange)
    setMatches(read())
    return () => mql.removeEventListener("change", onChange)
  }, [query, read])

  return matches
}

export function useIsMobile(): boolean {
  return useMediaQuery(
    `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
    readIsMobile,
  )
}

export function useIsTablet(): boolean {
  return useMediaQuery(
    `(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${DESKTOP_BREAKPOINT - 1}px)`,
    readIsTablet,
  )
}

export function useIsDesktop(): boolean {
  return useMediaQuery(
    `(min-width: ${DESKTOP_BREAKPOINT}px)`,
    readIsDesktop,
  )
}
