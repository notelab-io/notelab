import {
  ArrowDownUp,
  ArrowLeftToLine,
  ArrowRightToLine,
  ChevronsUpDown,
  ChevronDown,
  Copy,
  EyeOff,
  Filter,
  GripVertical,
  Pin,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react"

import {
  DropDrawer,
  DropDrawerContent,
  DropDrawerItem,
  DropDrawerSeparator,
  DropDrawerSub,
  DropDrawerSubContent,
  DropDrawerSubTrigger,
  DropDrawerTrigger,
} from "@/components/ui/dropdrawer"
import { Input } from "@/components/ui/input"

import { defaultStatusOptions, getDatabasePropertyType } from "./constants"

type StatusOption = {
  color?: string
  group?: string
  id: string
  name: string
}

type DatabasePropertyConfig = {
  options?: StatusOption[]
}

export function DatabasePropertyMenu({
  config,
  name,
  onRename,
  type,
}: {
  config?: unknown
  name: string
  onRename: (name: string) => void
  type: string
}) {
  const propertyType = getDatabasePropertyType(type)
  const PropertyIcon = propertyType.icon
  const isStatusProperty = type === "status"
  const statusOptions = getStatusOptions(config)

  return (
    <DropDrawer>
      <DropDrawerTrigger asChild>
        <button
          aria-label={`${name} property options`}
          className="group flex h-8 w-full min-w-0 items-stretch gap-2 px-3 py-1 text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none data-[state=open]:text-foreground [&_svg]:size-4 [&_svg]:shrink-0"
          type="button"
        >
          <PropertyIcon className="self-center text-muted-foreground" />
          <span className="flex min-w-0 items-center truncate">{name}</span>
          <ChevronDown className="ml-auto self-center opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      </DropDrawerTrigger>
      <DropDrawerContent
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
        <DropDrawerSeparator />
        <DropDrawerSub>
          <DropDrawerSubTrigger>
            <Settings2 />
            <span>Edit property</span>
          </DropDrawerSubTrigger>
          <DropDrawerSubContent
            className={isStatusProperty ? "w-100 p-4" : undefined}
          >
            {isStatusProperty ? (
              <StatusPropertyOptions options={statusOptions} />
            ) : (
              <DropDrawerItem disabled>Property settings</DropDrawerItem>
            )}
          </DropDrawerSubContent>
        </DropDrawerSub>
        <DropDrawerSub>
          <DropDrawerSubTrigger>
            <ChevronsUpDown />
            <span>Change type</span>
          </DropDrawerSubTrigger>
          <DropDrawerSubContent>
            <DropDrawerItem disabled>
              <PropertyIcon />
              <span>{propertyType.label}</span>
            </DropDrawerItem>
          </DropDrawerSubContent>
        </DropDrawerSub>
        <DropDrawerSub>
          <DropDrawerSubTrigger>
            <Sparkles />
            <span>AI Autofill</span>
          </DropDrawerSubTrigger>
          <DropDrawerSubContent>
            <DropDrawerItem disabled>Configure autofill</DropDrawerItem>
          </DropDrawerSubContent>
        </DropDrawerSub>
        <DropDrawerSeparator />
        <DropDrawerItem disabled>
          <Filter />
          <span>Filter</span>
        </DropDrawerItem>
        <DropDrawerSub>
          <DropDrawerSubTrigger>
            <ArrowDownUp />
            <span>Sort</span>
          </DropDrawerSubTrigger>
          <DropDrawerSubContent>
            <DropDrawerItem disabled>Ascending</DropDrawerItem>
            <DropDrawerItem disabled>Descending</DropDrawerItem>
          </DropDrawerSubContent>
        </DropDrawerSub>
        <DropDrawerItem disabled>
          <Pin />
          <span>Freeze</span>
        </DropDrawerItem>
        <DropDrawerItem disabled>
          <EyeOff />
          <span>Hide</span>
        </DropDrawerItem>
        <DropDrawerSeparator />
        <DropDrawerItem disabled>
          <ArrowLeftToLine />
          <span>Insert left</span>
        </DropDrawerItem>
        <DropDrawerItem disabled>
          <ArrowRightToLine />
          <span>Insert right</span>
        </DropDrawerItem>
        <DropDrawerItem disabled>
          <Copy />
          <span>Duplicate property</span>
        </DropDrawerItem>
        <DropDrawerItem disabled variant="destructive">
          <Trash2 />
          <span>Delete property</span>
        </DropDrawerItem>
      </DropDrawerContent>
    </DropDrawer>
  )
}

function StatusPropertyOptions({
  options,
}: {
  options: StatusOption[]
}) {
  const groups = [
    {
      name: "To-do",
      options: options.filter(
        (option) => getStatusOptionGroup(option) === "To-do"
      ),
    },
    {
      name: "In progress",
      options: options.filter(
        (option) => getStatusOptionGroup(option) === "In progress"
      ),
    },
    {
      name: "Complete",
      options: options.filter(
        (option) => getStatusOptionGroup(option) === "Complete"
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div className="space-y-2" key={group.name}>
          <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
            <span>{group.name}</span>
            <button
              aria-label={`Add ${group.name} status`}
              className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              type="button"
            >
              <Plus className="size-4" />
            </button>
          </div>
          {group.options.map((option) => (
            <button
              className="flex min-h-8 w-full items-center gap-2 rounded-md px-0 py-1 text-left text-sm text-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
              key={option.id}
              type="button"
            >
              <GripVertical className="size-4 shrink-0 text-muted-foreground" />
              <span
                className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2 py-0.5 leading-5 text-white"
                data-status-color={option.color}
              >
                <span className="size-1.5 shrink-0 rounded-full bg-white/50" />
                <span className="truncate">{option.name}</span>
              </span>
              {option.name === "Not started" ? (
                <span className="ml-auto text-xs font-medium text-muted-foreground">
                  DEFAULT
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

function getStatusOptionGroup(option: StatusOption) {
  return (
    option.group ??
    defaultStatusOptions.find(
      (defaultOption) => defaultOption.name === option.name
    )?.group ??
    "To-do"
  )
}

function getStatusOptions(config: unknown) {
  const options =
    config && typeof config === "object" && "options" in config
      ? (config as DatabasePropertyConfig).options
      : null

  if (!Array.isArray(options) || options.length === 0) {
    return defaultStatusOptions
  }

  const validOptions = options.filter(
    (option): option is StatusOption =>
      Boolean(option) &&
      typeof option === "object" &&
      typeof option.id === "string" &&
      typeof option.name === "string"
  )

  return validOptions.length > 0 ? validOptions : defaultStatusOptions
}
