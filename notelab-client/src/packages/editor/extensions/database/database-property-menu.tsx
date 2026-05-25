import {
  ArrowDownUp,
  ArrowLeftToLine,
  ArrowRightToLine,
  ChevronsUpDown,
  ChevronDown,
  Copy,
  EyeOff,
  Filter,
  Pin,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

import { getDatabasePropertyType } from "./constants"

export function DatabasePropertyMenu({
  name,
  type,
  onRename,
}: {
  name: string
  type: string
  onRename: (name: string) => void
}) {
  const propertyType = getDatabasePropertyType(type)
  const PropertyIcon = propertyType.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`${name} property options`}
          className="group flex h-8 w-full min-w-0 items-stretch gap-2 px-3 py-1 text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none data-[state=open]:text-foreground [&_svg]:size-4 [&_svg]:shrink-0"
          type="button"
        >
          <PropertyIcon className="self-center text-muted-foreground" />
          <span className="flex min-w-0 items-center truncate">{name}</span>
          <ChevronDown className="ml-auto self-center opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-72"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <div className="flex items-center gap-1.5 px-1.5 py-1">
          <PropertyIcon className="size-4 shrink-0 text-muted-foreground" />
          <Input
            aria-label="Property name"
            className="h-auto rounded-none border-0 bg-transparent px-0 py-0 text-sm font-medium shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
            defaultValue={name}
            onBlur={(event) => {
              const nextName = event.target.value.trim()

              if (nextName && nextName !== name) {
                onRename(nextName)
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur()
              }
            }}
          />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Settings2 />
            <span>Edit property</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem disabled>Property settings</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ChevronsUpDown />
            <span>Change type</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem disabled>
              <PropertyIcon />
              <span>{propertyType.label}</span>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sparkles />
            <span>AI Autofill</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem disabled>Configure autofill</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <Filter />
          <span>Filter</span>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ArrowDownUp />
            <span>Sort</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem disabled>Ascending</DropdownMenuItem>
            <DropdownMenuItem disabled>Descending</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem disabled>
          <Pin />
          <span>Freeze</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <EyeOff />
          <span>Hide</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <ArrowLeftToLine />
          <span>Insert left</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <ArrowRightToLine />
          <span>Insert right</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Copy />
          <span>Duplicate property</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled variant="destructive">
          <Trash2 />
          <span>Delete property</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
