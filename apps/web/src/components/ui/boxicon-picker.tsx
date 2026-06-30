import * as React from "react"
import { Search } from "lucide-react"

import { BoxiconPreview } from "@/components/ui/boxicon-preview"
import { IconColorGrid } from "@/components/ui/icon-color-grid"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  buildColoredIconSvg,
  type BoxiconCatalogEntry,
} from "@/lib/workspace-icon-utils"

import boxiconsCatalog from "@/data/boxicons-filled-catalog.json"

const catalog = boxiconsCatalog as BoxiconCatalogEntry[]

type BoxiconPickerProps = {
  className?: string
  onIconSelect: (svg: string) => void
}

export function BoxiconPicker({ className, onIconSelect }: BoxiconPickerProps) {
  const [query, setQuery] = React.useState("")

  const filteredIcons = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return catalog
    }

    return catalog.filter(
      (icon) =>
        icon.name.includes(normalizedQuery) ||
        icon.label.toLowerCase().includes(normalizedQuery),
    )
  }, [query])

  return (
    <div
      className={cn(
        "isolate flex h-[342px] w-72 flex-col bg-popover text-popover-foreground",
        className,
      )}
    >
      <div className="relative mx-2 mt-2">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus
          className="h-8 w-full rounded-md border border-input bg-input/20 pr-2.5 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search icons..."
          type="search"
          value={query}
        />
      </div>
      <div className="relative flex-1 overflow-y-auto pb-2 outline-none">
        {filteredIcons.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            No icons found.
          </div>
        ) : (
          <div className="grid grid-cols-9 px-2 pt-2">
            {filteredIcons.map((icon) => (
              <DropdownMenu key={icon.name} modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label={icon.label}
                    className="flex aspect-square size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none data-[state=open]:bg-muted"
                    title={icon.label}
                    type="button"
                  >
                    <BoxiconPreview
                      content={icon.content}
                      size={18}
                      viewBox={icon.viewBox}
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-auto min-w-0 p-2"
                  side="right"
                  sideOffset={6}
                >
                  <IconColorGrid
                    content={icon.content}
                    label={icon.label}
                    onSelect={(colorValue) => {
                      onIconSelect(
                        buildColoredIconSvg({
                          viewBox: icon.viewBox,
                          content: icon.content,
                          color: colorValue,
                        }),
                      )
                    }}
                    viewBox={icon.viewBox}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
          </div>
        )}
      </div>
      <div className="flex h-10 items-center border-t px-3 text-xs text-muted-foreground">
        Select an icon
      </div>
    </div>
  )
}