import { colorTokens } from "@/packages/editor/components/editor/toolbar-data"

const ICON_THEME_COLOR_CLASS: Record<string, string> = {
  default: "text-foreground",
  gray: "text-event-gray",
  brown: "text-event-brown",
  orange: "text-event-orange",
  yellow: "text-event-yellow",
  green: "text-event-green",
  blue: "text-event-blue",
  purple: "text-event-purple",
  pink: "text-event-pink",
  red: "text-event-red",
}

export const iconColorOptions = colorTokens.map((token) => {
  const value = token.value ?? "default"

  return {
    name: token.name,
    value,
    colorClass: getIconColorClassName(value),
    textClass: token.textClass,
    backgroundClass: token.backgroundClass,
  }
})

export function getIconColorClassName(colorValue?: string | null) {
  return ICON_THEME_COLOR_CLASS[colorValue ?? "default"] ?? "text-foreground"
}

export function getEventTextColorValue(colorValue?: string | null) {
  if (!colorValue || colorValue === "default") {
    return null
  }

  return `var(--event-${colorValue})`
}

export function resolveEventTextColorValue(stored?: string | null) {
  if (!stored) {
    return null
  }

  if (stored.startsWith("var(--event-")) {
    return stored
  }

  if (ICON_THEME_COLOR_CLASS[stored]) {
    return getEventTextColorValue(stored)
  }

  return stored
}

export function isEventTextColorActive(
  stored: string | null | undefined,
  tokenValue: string | null
) {
  if (!tokenValue) {
    return !stored
  }

  if (!stored) {
    return false
  }

  const expected = getEventTextColorValue(tokenValue)

  if (stored === expected || resolveEventTextColorValue(stored) === expected) {
    return true
  }

  return stored.toLowerCase() === tokenValue.toLowerCase()
}