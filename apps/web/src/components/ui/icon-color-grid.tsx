import { BoxiconPreview } from "@/components/ui/boxicon-preview"
import { iconColorOptions } from "@/lib/icon-colors"
import { cn } from "@/lib/utils"

export function IconColorGrid({
  className,
  columns = 5,
  content,
  label,
  onSelect,
  previewSize = 24,
  viewBox = "0 0 24 24",
}: {
  className?: string
  columns?: number
  content: string
  label?: string
  onSelect: (colorValue: string) => void
  previewSize?: number
  viewBox?: string
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? (
        <p className="px-0.5 text-xs text-muted-foreground">Choose a color</p>
      ) : null}
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {iconColorOptions.map((color) => (
          <button
            aria-label={
              label ? `${label} in ${color.name}` : `Icon in ${color.name}`
            }
            className={cn(
              "flex aspect-square items-center justify-center rounded-md border border-transparent transition-colors hover:border-border hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none",
              color.colorClass,
            )}
            key={color.value}
            onClick={() => onSelect(color.value)}
            title={color.name}
            type="button"
          >
            <BoxiconPreview
              content={content}
              size={previewSize}
              viewBox={viewBox}
            />
          </button>
        ))}
      </div>
    </div>
  )
}