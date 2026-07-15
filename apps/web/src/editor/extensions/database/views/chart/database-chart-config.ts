import type { ColorTokenId } from "@/lib/color-tokens"

export type DatabaseChartType =
  | "bar"
  | "horizontal-bar"
  | "line"
  | "pie"
  | "radar"
  | "radial"
  | "count"

export type DatabaseChartColor = "auto" | ColorTokenId

export type DatabaseChartSettings = {
  color: DatabaseChartColor
  groupByPropertyId?: string
  measurePropertyId?: string
  omitZeroValues: boolean
  type: DatabaseChartType
  valueColors: Record<string, ColorTokenId>
}

export const databaseChartTypes: DatabaseChartType[] = [
  "bar",
  "horizontal-bar",
  "line",
  "pie",
  "radar",
  "radial",
  "count",
]

const chartColors: DatabaseChartColor[] = [
  "auto",
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
]

const valueColors = new Set(chartColors.filter((color) => color !== "auto"))

export const defaultDatabaseChartSettings: DatabaseChartSettings = {
  color: "auto",
  omitZeroValues: false,
  type: "bar",
  valueColors: {},
}

export function shouldSplitDatabaseChartSeries({
  axisPropertyId,
  splitPropertyId,
  type,
}: {
  axisPropertyId?: string
  splitPropertyId?: string
  type: DatabaseChartType
}) {
  return (
    Boolean(splitPropertyId) &&
    axisPropertyId !== splitPropertyId &&
    type !== "count" &&
    type !== "radial"
  )
}

export function getDatabaseChartSettings(config: unknown): DatabaseChartSettings {
  const chart =
    config && typeof config === "object" && !Array.isArray(config) && "chart" in config
      ? (config as { chart?: unknown }).chart
      : undefined

  if (!chart || typeof chart !== "object" || Array.isArray(chart)) {
    return defaultDatabaseChartSettings
  }

  const record = chart as Record<string, unknown>
  const type = databaseChartTypes.includes(record.type as DatabaseChartType)
    ? (record.type as DatabaseChartType)
    : defaultDatabaseChartSettings.type
  const color = chartColors.includes(record.color as DatabaseChartColor)
    ? (record.color as DatabaseChartColor)
    : defaultDatabaseChartSettings.color
  const storedValueColors =
    record.valueColors &&
    typeof record.valueColors === "object" &&
    !Array.isArray(record.valueColors)
      ? Object.fromEntries(
          Object.entries(record.valueColors).filter(
            (entry): entry is [string, ColorTokenId] =>
              typeof entry[1] === "string" && valueColors.has(entry[1] as ColorTokenId),
          ),
        )
      : {}

  return {
    color,
    ...(typeof record.groupByPropertyId === "string" && record.groupByPropertyId
      ? { groupByPropertyId: record.groupByPropertyId }
      : {}),
    ...(typeof record.measurePropertyId === "string" && record.measurePropertyId
      ? { measurePropertyId: record.measurePropertyId }
      : {}),
    omitZeroValues: record.omitZeroValues === true,
    type,
    valueColors: storedValueColors,
  }
}
