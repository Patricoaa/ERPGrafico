import * as React from "react"

import { cn } from "@/lib/utils"

interface InputProps extends React.ComponentProps<"input"> {
  icon?: string | React.ReactNode
  allowNegative?: boolean
}

function Input({ className, type, icon, allowNegative, onKeyDown, onPaste, ...props }: InputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent minus sign if it's a number and negatives aren't allowed
    if (type === "number" && !allowNegative && (e.key === "-" || e.key === "e")) {
      e.preventDefault()
    }
    if (onKeyDown) onKeyDown(e)
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (type === "number" && !allowNegative) {
      const pasteData = e.clipboardData.getData('text')
      if (pasteData.includes('-')) {
        e.preventDefault()
      }
    }
    if (onPaste) onPaste(e)
  }

  const inputEl = (
    <input
      type={type}
      data-slot="input"
      min={type === "number" && !allowNegative ? 0 : props.min}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        icon && "pl-8",
        className
      )}
      {...props}
    />
  )

  if (icon) {
    return (
      <div className="relative w-full">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
          {icon}
        </div>
        {inputEl}
      </div>
    )
  }

  return inputEl
}

export { Input }
