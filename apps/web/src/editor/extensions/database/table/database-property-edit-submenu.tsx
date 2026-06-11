import {
  ArrowDownUp,
  ArrowLeftRight,
  Bell,
  Calendar,
  Check,
  CircleUserRound,
  Flag,
  GripVertical,
  Hash,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react"
import { type ReactNode } from "react"

import {
  DropDrawerItem,
  DropDrawerLabel,
  DropDrawerSeparator,
  DropDrawerShortcut,
  DropDrawerSub,
  DropDrawerSubContent,
  DropDrawerSubTrigger,
} from "@/components/ui/dropdrawer"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useUpdateDatabaseProperty } from "@notelab/features/databases"
import {
  colorTokens,
  cyclingColorTokens,
  getColorTokenBadgeClassName,
  getColorTokenDotClassName,
  getColorTokenValue,
} from "@/packages/editor/components/editor/toolbar-data"

import { defaultStatusOptions } from "../constants"
import {
  dateFormatOptions,
  getDateFormatConfig,
  getTimeFormatConfig,
  timeFormatOptions,
  type DateFormatValue,
  type TimeFormatValue,
} from "./database-date-config"
import {
  getMergedPropertyConfig,
  getShowFullUrl,
  getStatusDefaultOptionId,
  type DatabasePropertyConfig,
  type DatabaseSelectOption,
} from "./database-column-config"

type StatusOption = DatabaseSelectOption & {
  group?: string
}

type FilesLimitValue = "one_file" | "no_limit"
type PersonDefaultValue = "no_default" | "created_by"
type PersonLimitValue = "one_person" | "no_limit"
type PersonNotificationsValue = "users_and_groups" | "users_only" | "none"
type SelectOptionSortValue = "manual" | "alphabetical" | "reverse_alphabetical"

export function DatabasePropertyEditSubmenu({
  children,
  config,
  databaseId,
  databasePropertyId,
  type,
}: {
  children: ReactNode
  config?: unknown
  databaseId: string
  databasePropertyId: string
  type: string
}) {
  return (
    <DropDrawerSub>
      <DropDrawerSubTrigger>{children}</DropDrawerSubTrigger>
      <DropDrawerSubContent
        className={getDatabasePropertyEditSubmenuContentClassName(type)}
      >
        <DatabasePropertyEditMenuItems
          config={config}
          databaseId={databaseId}
          databasePropertyId={databasePropertyId}
          type={type}
        />
      </DropDrawerSubContent>
    </DropDrawerSub>
  )
}

export function hasDatabasePropertyEditSettings(type: string) {
  return (
    type === "url" ||
    type === "status" ||
    type === "select" ||
    type === "multi_select" ||
    type === "person" ||
    type === "files" ||
    type === "date" ||
    type === "created_time" ||
    type === "edited_time"
  )
}

function DatabasePropertyEditMenuItems({
  config,
  databaseId,
  databasePropertyId,
  type,
}: {
  config?: unknown
  databaseId: string
  databasePropertyId: string
  type: string
}) {
  const updateProperty = useUpdateDatabaseProperty()
  const isStatusProperty = type === "status"
  const isSelectProperty = type === "select" || type === "multi_select"
  const isPersonProperty = type === "person"
  const isFilesProperty = type === "files"
  const isUrlProperty = type === "url"
  const isDateProperty =
    type === "date" || type === "created_time" || type === "edited_time"
  const showFullUrl = getShowFullUrl(config)
  const statusDefaultOptionId = getStatusDefaultOptionId(config)
  const statusOptions = getStatusOptions(config)
  const selectOptions = getSelectOptions(config)
  const updatePropertyConfig = (nextConfig: DatabasePropertyConfig) => {
    updateProperty.mutate({
      config: getMergedPropertyConfig(config, nextConfig),
      databaseId,
      databasePropertyId,
    })
  }

  if (isUrlProperty) {
    return (
      <DropDrawerItem
        aria-pressed={showFullUrl}
        onSelect={(event) => {
          event.preventDefault()
          updatePropertyConfig({ showFullUrl: !showFullUrl })
        }}
      >
        <ArrowLeftRight />
        <span>Show full URL</span>
        <Switch
          checked={showFullUrl}
          className="ml-auto pointer-events-none"
          size="sm"
          tabIndex={-1}
        />
      </DropDrawerItem>
    )
  }

  if (isStatusProperty) {
    return (
      <StatusPropertyOptions
        defaultOptionId={statusDefaultOptionId}
        onUpdateConfig={updatePropertyConfig}
        options={statusOptions}
      />
    )
  }

  if (isSelectProperty) {
    return (
      <SelectPropertyOptions
        onUpdateConfig={updatePropertyConfig}
        options={selectOptions}
        sort={getSelectOptionSort(config)}
      />
    )
  }

  if (isPersonProperty) {
    return (
      <PersonPropertyOptions
        config={getPersonConfig(config)}
        onUpdateConfig={updatePropertyConfig}
      />
    )
  }

  if (isFilesProperty) {
    return (
      <FilesPropertyOptions
        config={getFilesConfig(config)}
        onUpdateConfig={updatePropertyConfig}
      />
    )
  }

  if (isDateProperty) {
    return (
      <DatePropertyOptions
        dateFormat={getDateFormatConfig(config)}
        timeFormat={getTimeFormatConfig(config)}
        onUpdateConfig={updatePropertyConfig}
      />
    )
  }

  return <DropDrawerItem disabled>Property settings</DropDrawerItem>
}

function getDatabasePropertyEditSubmenuContentClassName(type: string) {
  return type === "status" ||
    type === "select" ||
    type === "multi_select" ||
    type === "person" ||
    type === "files" ||
    type === "date" ||
    type === "created_time" ||
    type === "edited_time"
    ? "w-72"
    : undefined
}

function DatePropertyOptions({
  dateFormat,
  onUpdateConfig,
  timeFormat,
}: {
  dateFormat: DateFormatValue
  onUpdateConfig: (config: DatabasePropertyConfig) => void
  timeFormat: TimeFormatValue
}) {
  return (
    <>
      <PropertySettingSubmenu
        icon={<Calendar />}
        label="Date format"
        onSelect={(nextDateFormat) => onUpdateConfig({ dateFormat: nextDateFormat })}
        options={dateFormatOptions}
        selectedValue={dateFormat}
      />
      <PropertySettingSubmenu
        icon={<Calendar />}
        label="Time format"
        onSelect={(nextTimeFormat) => onUpdateConfig({ timeFormat: nextTimeFormat })}
        options={timeFormatOptions}
        selectedValue={timeFormat}
      />
    </>
  )
}

function FilesPropertyOptions({
  config,
  onUpdateConfig,
}: {
  config: Required<Pick<DatabasePropertyConfig, "filesLimit">>
  onUpdateConfig: (config: DatabasePropertyConfig) => void
}) {
  return (
    <PropertySettingSubmenu
      icon={<Hash />}
      label="Limit"
      onSelect={(filesLimit) => onUpdateConfig({ filesLimit })}
      options={filesLimitOptions}
      selectedValue={config.filesLimit}
    />
  )
}

function PersonPropertyOptions({
  config,
  onUpdateConfig,
}: {
  config: Required<
    Pick<
      DatabasePropertyConfig,
      "personDefault" | "personLimit" | "personNotifications"
    >
  >
  onUpdateConfig: (config: DatabasePropertyConfig) => void
}) {
  return (
    <>
      <PropertySettingSubmenu
        icon={<Hash />}
        label="Limit"
        onSelect={(personLimit) => onUpdateConfig({ personLimit })}
        options={personLimitOptions}
        selectedValue={config.personLimit}
      />
      <PropertySettingSubmenu
        icon={<CircleUserRound />}
        label="Default"
        onSelect={(personDefault) => onUpdateConfig({ personDefault })}
        options={personDefaultOptions}
        selectedValue={config.personDefault}
      />
      <PropertySettingSubmenu
        icon={<Bell />}
        label="Notifications"
        onSelect={(personNotifications) =>
          onUpdateConfig({ personNotifications })
        }
        options={personNotificationsOptions}
        selectedValue={config.personNotifications}
      />
    </>
  )
}

function PropertySettingSubmenu<TValue extends string>({
  icon,
  label,
  onSelect,
  options,
  selectedValue,
}: {
  icon: ReactNode
  label: string
  onSelect: (value: TValue) => void
  options: {
    icon?: ReactNode
    label: string
    value: TValue
  }[]
  selectedValue: TValue
}) {
  const selectedOption =
    options.find((option) => option.value === selectedValue) ?? options[0]

  return (
    <DropDrawerSub>
      <DropDrawerSubTrigger>
        {icon}
        <span className="flex-1">{label}</span>
        <span className="text-muted-foreground">{selectedOption?.label}</span>
      </DropDrawerSubTrigger>
      <DropDrawerSubContent className="w-64">
        {options.map((option) => (
          <DropDrawerItem
            key={option.value}
            onSelect={(event) => {
              event.preventDefault()
              onSelect(option.value)
            }}
          >
            {option.icon ?? null}
            <span>{option.label}</span>
            {option.value === selectedValue ? <Check className="ml-auto" /> : null}
          </DropDrawerItem>
        ))}
      </DropDrawerSubContent>
    </DropDrawerSub>
  )
}

function SelectPropertyOptions({
  onUpdateConfig,
  options,
  sort,
}: {
  onUpdateConfig: (config: DatabasePropertyConfig) => void
  options: DatabaseSelectOption[]
  sort: SelectOptionSortValue
}) {
  const updateOption = (
    optionId: string,
    patch: Partial<DatabaseSelectOption>
  ) => {
    const nextOptions = options.map((option) =>
      option.id === optionId ? { ...option, ...patch } : option
    )

    onUpdateConfig({
      options: getSortedSelectOptions(nextOptions, sort),
    })
  }
  const addOption = () => {
    const optionName = getUniqueOptionName(options, "Option")
    const nextOptions = [
      ...options,
      {
        color: getNextOptionColor(options),
        id: crypto.randomUUID(),
        name: optionName,
      },
    ]

    onUpdateConfig({
      options: getSortedSelectOptions(nextOptions, sort),
    })
  }
  const updateSort = (selectOptionSort: SelectOptionSortValue) => {
    onUpdateConfig({
      options:
        selectOptionSort === "manual"
          ? options
          : getSortedSelectOptions(options, selectOptionSort),
      selectOptionSort,
    })
  }

  return (
    <>
      <PropertySettingSubmenu
        icon={<ArrowDownUp />}
        label="Sort"
        onSelect={updateSort}
        options={selectOptionSortOptions}
        selectedValue={sort}
      />
      <DropDrawerSeparator />
      <DropDrawerLabel className="flex items-center justify-between pr-1">
        <span>Options</span>
        <button
          aria-label="Add select option"
          className="-my-1 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={addOption}
          type="button"
        >
          <Plus className="size-4" />
        </button>
      </DropDrawerLabel>
      {options.length > 0 ? (
        options.map((option) => (
          <OptionEditorSubmenu
            key={option.id}
            onUpdateOption={updateOption}
            option={option}
          />
        ))
      ) : (
        <DropDrawerItem disabled>No options yet</DropDrawerItem>
      )}
    </>
  )
}

function StatusPropertyOptions({
  defaultOptionId,
  onUpdateConfig,
  options,
}: {
  defaultOptionId?: string
  onUpdateConfig: (config: DatabasePropertyConfig) => void
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
  const resolvedDefaultOptionId = defaultOptionId ?? options[0]?.id
  const updateOption = (optionId: string, patch: Partial<StatusOption>) => {
    onUpdateConfig({
      defaultOptionId: resolvedDefaultOptionId,
      options: options.map((option) =>
        option.id === optionId ? { ...option, ...patch } : option
      ),
    })
  }
  const setDefaultOption = (optionId: string) => {
    onUpdateConfig({
      defaultOptionId: optionId,
      options,
    })
  }

  return (
    <>
      {groups.map((group, groupIndex) => (
        <div key={group.name}>
          {groupIndex > 0 ? <DropDrawerSeparator /> : null}
          <DropDrawerLabel className="flex items-center justify-between pr-1">
            <span>{group.name}</span>
            <button
              aria-label={`Add ${group.name} status`}
              className="-my-1 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              type="button"
            >
              <Plus className="size-4" />
            </button>
          </DropDrawerLabel>
          {group.options.map((option) => (
            <OptionEditorSubmenu
              defaultOptionId={resolvedDefaultOptionId}
              key={option.id}
              onSetDefaultOption={setDefaultOption}
              onUpdateOption={updateOption}
              option={option}
              showDot
            />
          ))}
        </div>
      ))}
    </>
  )
}

function OptionEditorSubmenu({
  defaultOptionId,
  onSetDefaultOption,
  onUpdateOption,
  option,
  showDot = false,
}: {
  defaultOptionId?: string
  onSetDefaultOption?: (optionId: string) => void
  onUpdateOption: (
    optionId: string,
    patch: Partial<DatabaseSelectOption>
  ) => void
  option: DatabaseSelectOption
  showDot?: boolean
}) {
  return (
    <DropDrawerSub>
      <DropDrawerSubTrigger>
        <GripVertical />
        <span className={getColorTokenBadgeClassName(option.color)}>
          {showDot ? (
            <span
              aria-hidden="true"
              className={getColorTokenDotClassName(option.color)}
            />
          ) : null}
          {option.name}
        </span>
        {option.id === defaultOptionId ? (
          <DropDrawerShortcut>DEFAULT</DropDrawerShortcut>
        ) : null}
      </DropDrawerSubTrigger>
      <DropDrawerSubContent className="w-72">
        <div className="px-1.5 py-1">
          <Input
            aria-label={`${option.name} option name`}
            defaultValue={option.name}
            onBlur={(event) => {
              const nextName = event.target.value.trim()

              if (nextName && nextName !== option.name) {
                onUpdateOption(option.id, { name: nextName })
              }
            }}
            onKeyDown={(event) => {
              event.stopPropagation()

              if (event.key === "Enter") {
                event.currentTarget.blur()
              }
            }}
          />
        </div>
        <DropDrawerItem disabled>
          <Trash2 />
          <span>Delete</span>
        </DropDrawerItem>
        {onSetDefaultOption ? (
          <DropDrawerItem
            onSelect={(event) => {
              event.preventDefault()
              onSetDefaultOption(option.id)
            }}
          >
            <Flag />
            <span>Set as default</span>
            {option.id === defaultOptionId ? <Check className="ml-auto" /> : null}
          </DropDrawerItem>
        ) : null}
        <DropDrawerSeparator />
        <DropDrawerLabel>Colors</DropDrawerLabel>
        {statusColorOptions.map((color) => (
          <DropDrawerItem
            key={color.name}
            onSelect={(event) => {
              event.preventDefault()
              onUpdateOption(option.id, {
                color: color.value ?? "default",
              })
            }}
          >
            <span
              aria-hidden="true"
              className={`size-4 rounded-sm border border-foreground/10 ${color.backgroundClass}`}
            />
            <span>{color.name}</span>
            {getColorTokenValue(option.color) === (color.value ?? "default") ? (
              <Check className="ml-auto" />
            ) : null}
          </DropDrawerItem>
        ))}
      </DropDrawerSubContent>
    </DropDrawerSub>
  )
}

const statusColorOptions = colorTokens

const filesLimitOptions = [
  {
    label: "1 file",
    value: "one_file",
  },
  {
    label: "No limit",
    value: "no_limit",
  },
] satisfies {
  label: string
  value: FilesLimitValue
}[]

const personLimitOptions = [
  {
    label: "1 Person",
    value: "one_person",
  },
  {
    label: "No limit",
    value: "no_limit",
  },
] satisfies {
  label: string
  value: PersonLimitValue
}[]

const personDefaultOptions = [
  {
    label: "No default",
    value: "no_default",
  },
  {
    icon: <UserRound />,
    label: "Created by",
    value: "created_by",
  },
] satisfies {
  icon?: ReactNode
  label: string
  value: PersonDefaultValue
}[]

const personNotificationsOptions = [
  {
    label: "Users and groups",
    value: "users_and_groups",
  },
  {
    label: "Users only",
    value: "users_only",
  },
  {
    label: "None",
    value: "none",
  },
] satisfies {
  label: string
  value: PersonNotificationsValue
}[]

const selectOptionSortOptions = [
  {
    label: "Manual",
    value: "manual",
  },
  {
    label: "Alphabetical",
    value: "alphabetical",
  },
  {
    label: "Reverse alphabetical",
    value: "reverse_alphabetical",
  },
] satisfies {
  label: string
  value: SelectOptionSortValue
}[]

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

function getFilesConfig(config: unknown) {
  const parsedConfig =
    config && typeof config === "object"
      ? (config as DatabasePropertyConfig)
      : {}

  return {
    filesLimit: isFilesLimitValue(parsedConfig.filesLimit)
      ? parsedConfig.filesLimit
      : "no_limit",
  }
}

function isFilesLimitValue(value: unknown): value is FilesLimitValue {
  return value === "one_file" || value === "no_limit"
}

function getPersonConfig(config: unknown) {
  const parsedConfig =
    config && typeof config === "object"
      ? (config as DatabasePropertyConfig)
      : {}

  return {
    personDefault: isPersonDefaultValue(parsedConfig.personDefault)
      ? parsedConfig.personDefault
      : "no_default",
    personLimit: isPersonLimitValue(parsedConfig.personLimit)
      ? parsedConfig.personLimit
      : "no_limit",
    personNotifications: isPersonNotificationsValue(
      parsedConfig.personNotifications
    )
      ? parsedConfig.personNotifications
      : "users_only",
  }
}

function isPersonLimitValue(value: unknown): value is PersonLimitValue {
  return value === "one_person" || value === "no_limit"
}

function isPersonDefaultValue(value: unknown): value is PersonDefaultValue {
  return value === "no_default" || value === "created_by"
}

function isPersonNotificationsValue(
  value: unknown
): value is PersonNotificationsValue {
  return value === "users_and_groups" || value === "users_only" || value === "none"
}

function getSelectOptions(config: unknown) {
  const options =
    config && typeof config === "object" && "options" in config
      ? (config as DatabasePropertyConfig).options
      : null

  if (!Array.isArray(options)) {
    return []
  }

  return options.filter(
    (option): option is DatabaseSelectOption =>
      Boolean(option) &&
      typeof option === "object" &&
      typeof option.id === "string" &&
      typeof option.name === "string"
  )
}

function getSelectOptionSort(config: unknown): SelectOptionSortValue {
  if (
    !config ||
    typeof config !== "object" ||
    !("selectOptionSort" in config)
  ) {
    return "manual"
  }

  const selectOptionSort = (config as DatabasePropertyConfig).selectOptionSort

  return isSelectOptionSortValue(selectOptionSort) ? selectOptionSort : "manual"
}

function isSelectOptionSortValue(
  value: unknown
): value is SelectOptionSortValue {
  return (
    value === "manual" ||
    value === "alphabetical" ||
    value === "reverse_alphabetical"
  )
}

function getSortedSelectOptions(
  options: DatabaseSelectOption[],
  sort: SelectOptionSortValue
) {
  if (sort === "manual") {
    return options
  }

  const sortedOptions = [...options].sort((firstOption, secondOption) =>
    firstOption.name.localeCompare(secondOption.name, undefined, {
      sensitivity: "base",
    })
  )

  return sort === "reverse_alphabetical"
    ? sortedOptions.reverse()
    : sortedOptions
}

function getNextOptionColor(options: DatabaseSelectOption[]) {
  return cyclingColorTokens[options.length % cyclingColorTokens.length]?.value ?? "default"
}

function getUniqueOptionName(
  options: DatabaseSelectOption[],
  baseName: string
) {
  const optionNames = new Set(options.map((option) => option.name))

  if (!optionNames.has(baseName)) {
    return baseName
  }

  let index = 2

  while (optionNames.has(`${baseName} ${index}`)) {
    index += 1
  }

  return `${baseName} ${index}`
}
