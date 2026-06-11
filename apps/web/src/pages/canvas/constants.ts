import type { LucideIcon } from "lucide-react"
import {
  ArrowRightIcon,
  CircleIcon,
  DiamondIcon,
  SquareIcon,
} from "lucide-react"

import type {
  CanvasNodeColorId,
  CanvasShape,
  CanvasStrokeStyle,
  CanvasStrokeWidth,
  CanvasTool,
} from "./types"

export const canvasColorOptions: Array<{
  fill: string
  id: CanvasNodeColorId
  label: string
  stroke: string
}> = [
  {
    id: "default",
    label: "Default",
    fill: "transparent",
    stroke: "var(--color-foreground)",
  },
  {
    id: "yellow",
    label: "Yellow",
    fill: "var(--color-event-yellow-bg)",
    stroke: "var(--color-event-yellow-border)",
  },
  {
    id: "red",
    label: "Red",
    fill: "var(--color-event-red-bg)",
    stroke: "var(--color-event-red-border)",
  },
  {
    id: "green",
    label: "Green",
    fill: "var(--color-event-green-bg)",
    stroke: "var(--color-event-green-border)",
  },
  {
    id: "blue",
    label: "Blue",
    fill: "var(--color-event-blue-bg)",
    stroke: "var(--color-event-blue-border)",
  },
  {
    id: "purple",
    label: "Purple",
    fill: "var(--color-event-purple-bg)",
    stroke: "var(--color-event-purple-border)",
  },
  {
    id: "orange",
    label: "Orange",
    fill: "var(--color-event-orange-bg)",
    stroke: "var(--color-event-orange-border)",
  },
  {
    id: "gray",
    label: "Gray",
    fill: "var(--color-event-gray-bg)",
    stroke: "var(--color-event-gray-border)",
  },
]

export const canvasStrokeWidthOptions: Array<{
  label: string
  value: CanvasStrokeWidth
}> = [
  { label: "Thin", value: 2 },
  { label: "Medium", value: 4 },
  { label: "Bold", value: 6 },
]

export const canvasStrokeStyleOptions: Array<{
  label: string
  value: CanvasStrokeStyle
}> = [
  { label: "Solid", value: "solid" },
  { label: "Dashed", value: "dashed" },
  { label: "Dotted", value: "dotted" },
]

export const defaultCanvasStrokeWidth: CanvasStrokeWidth = 4
export const defaultCanvasStrokeStyle: CanvasStrokeStyle = "solid"
export const defaultCanvasSloppiness = "artist"

export const canvasShapeOptions: Array<{
  icon: LucideIcon
  label: string
  shape: CanvasShape
}> = [
  { icon: CircleIcon, label: "Circle", shape: "circle" },
  { icon: SquareIcon, label: "Rectangle", shape: "rectangle" },
  { icon: DiamondIcon, label: "Diamond", shape: "diamond" },
]

export const canvasShapeDimensions: Record<
  CanvasShape,
  { height: number; width: number }
> = {
  circle: { height: 108, width: 108 },
  rectangle: { height: 80, width: 136 },
  diamond: { height: 120, width: 120 },
}

export const canvasToolOptions: Array<{
  icon: LucideIcon
  label: string
  tool: CanvasTool
}> = [
  ...canvasShapeOptions.map(({ icon, label, shape }) => ({
    icon,
    label,
    tool: shape,
  })),
  { icon: ArrowRightIcon, label: "Arrow", tool: "arrow" },
]

export function getCanvasColorOption(colorId: CanvasNodeColorId) {
  return (
    canvasColorOptions.find((option) => option.id === colorId) ??
    canvasColorOptions[0]
  )
}
