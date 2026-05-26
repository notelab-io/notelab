import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"

export function DatabaseInputCell({
  label,
  onActivate,
  onChange,
  onCommit,
  onDeactivate,
  onInput,
  type,
  value,
}: {
  label: string
  onActivate: (element: HTMLTextAreaElement) => void
  onChange: (value: string) => void
  onCommit: () => void
  onDeactivate: () => void
  onInput: (event: FormEvent<HTMLTextAreaElement>) => void
  type: string
  value: string
}) {
  const isMobile = useIsMobile()
  const errorId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [popoverPosition, setPopoverPosition] = useState<CSSProperties | null>(
    null
  )
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const skipNextBlurCommitRef = useRef(false)
  const isNumberCell = type === "number"
  const hasNumberError = isNumberCell && value.trim() !== "" && !isValidNumber(value)
  const errorMessage = hasNumberError ? "Enter a valid number" : null

  const updatePopoverPosition = () => {
    const rect = wrapperRef.current?.getBoundingClientRect()

    if (!rect) {
      return
    }

    setPopoverPosition({
      "--database-input-cell-left": `${rect.left}px`,
      "--database-input-cell-top": `${rect.top}px`,
    } as CSSProperties)
  }

  const resizeTextarea = (element: HTMLTextAreaElement) => {
    element.style.height = "auto"
    element.style.height = `${element.scrollHeight}px`
  }

  const resetTextareaView = (element: HTMLTextAreaElement) => {
    element.style.height = ""
    element.scrollTop = 0
  }

  const commitAndClose = () => {
    onCommit()
    onDeactivate()
    setPopoverPosition(null)
    setIsOpen(false)
  }

  const textarea = (
    <div
      className="database-input-cell-wrap"
      ref={wrapperRef}
      style={popoverPosition ?? undefined}
    >
      <textarea
        aria-describedby={errorMessage ? errorId : undefined}
        aria-invalid={hasNumberError ? "true" : undefined}
        aria-label={`${label} value`}
        className="database-input-cell"
        data-database-cell-input
        onBlur={
          isMobile
            ? undefined
            : (event) => {
                if (skipNextBlurCommitRef.current) {
                  skipNextBlurCommitRef.current = false
                } else {
                  onCommit()
                }

                resetTextareaView(event.currentTarget)
                setPopoverPosition(null)
                onDeactivate()
              }
        }
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => {
          const element = event.currentTarget

          updatePopoverPosition()
          onActivate(element)

          requestAnimationFrame(() => resizeTextarea(element))
        }}
        onInput={onInput}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey) {
            return
          }

          event.preventDefault()
          resetTextareaView(event.currentTarget)
          commitAndClose()
          skipNextBlurCommitRef.current = true
          event.currentTarget.blur()
        }}
        ref={textareaRef}
        rows={1}
        value={value}
      />
      {errorMessage ? (
        <div className="database-input-cell-error" id={errorId}>
          {errorMessage}
        </div>
      ) : null}
    </div>
  )

  if (!isMobile) {
    return textarea
  }

  return (
    <Drawer
      open={isOpen}
      onOpenChange={(open) => {
        if (open) {
          setIsOpen(true)
          return
        }

        commitAndClose()
      }}
    >
      <DrawerTrigger asChild>
        <button
          aria-label={`${label} value`}
          className="database-input-cell-trigger"
          type="button"
        >
          {value || <span className="text-muted-foreground">Empty</span>}
        </button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[85vh] bg-popover px-1 pb-2 text-popover-foreground">
        <DrawerHeader className="flex-row items-center justify-between px-2 py-2 text-left">
          <DrawerTitle className="min-w-0 truncate text-sm font-medium">
            {label}
          </DrawerTitle>
          <Button
            className="h-8 px-2 text-xs"
            onClick={commitAndClose}
            type="button"
            variant="ghost"
          >
            Done
          </Button>
        </DrawerHeader>
        <div className="database-input-cell-drawer">{textarea}</div>
      </DrawerContent>
    </Drawer>
  )
}

function isValidNumber(value: string) {
  return /^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(value.trim())
}
