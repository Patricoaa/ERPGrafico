"use client"

import React, { useState, useRef, KeyboardEvent } from "react"
import { X, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { IconButton } from "@/components/shared/ActionButtons"

interface MultiTagInputProps {
    label?: string
    placeholder?: string
    values: string[]
    onAdd: (value: string) => void
    onRemove: (value: string) => void
    error?: string
    required?: boolean
    containerClassName?: string
    disabled?: boolean
    hint?: React.ReactNode
    suffix?: React.ReactNode
}

/**
 * MultiTagInput — A "combobox-style" multi-select tag input.
 * Integrates with the notched fieldset aesthetic.
 */
export function MultiTagInput({
    label,
    placeholder,
    values,
    onAdd,
    onRemove,
    error,
    required,
    containerClassName,
    disabled = false,
    hint,
    suffix
}: MultiTagInputProps) {
    const [inputValue, setInputValue] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)
    const hasError = !!error

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault()
            const value = inputValue.trim()
            if (value && !values.includes(value)) {
                onAdd(value)
                setInputValue("")
            }
        } else if (e.key === "Backspace" && !inputValue && values.length > 0) {
            onRemove(values[values.length - 1])
        }
    }

    const handleContainerClick = () => {
        inputRef.current?.focus()
    }

    return (
        <div className={cn("space-y-1 relative w-full group", containerClassName)}>
            <fieldset
                onClick={handleContainerClick}
                className={cn(
                    "notched-field transition-all duration-200 cursor-text min-h-[44px] pb-1.5 pt-1",
                    "group-focus-within:border-primary group-focus-within:ring-1 group-focus-within:ring-primary/20",
                    hasError && "border-destructive group-focus-within:border-destructive group-focus-within:ring-destructive/20",
                    disabled && "opacity-50 cursor-not-allowed pointer-events-none"
                )}
                data-error={hasError || undefined}
                data-disabled={disabled || undefined}
            >
                {label && (
                    <legend className={cn(
                        "px-1.5 text-[10px] font-black uppercase tracking-[0.15em] transition-colors duration-200",
                        hasError ? "text-destructive" : "text-muted-foreground group-focus-within:text-primary",
                        disabled && "text-muted-foreground/50"
                    )}>
                        {label}
                        {required && (
                            <span className="text-destructive ml-0.5" aria-hidden="true">
                                *
                            </span>
                        )}
                    </legend>
                )}

                <div className="flex items-center w-full px-1">
                    <div className="flex flex-wrap items-center gap-1.5 px-2 flex-1">
                        {values.map((tag, index) => (
                            <Badge
                                key={`${tag}-${index}`}
                                variant="secondary"
                                className="flex items-center gap-1 px-2 py-0.5 h-6 text-[11px] font-bold border-secondary/50 animate-in zoom-in-95 duration-200"
                            >
                                {tag}
                                <IconButton
                                    type="button"
                                    variant="ghost"
                                    className="h-4 w-4 p-0 hover:bg-transparent hover:text-destructive"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onRemove(tag)
                                    }}
                                >
                                    <X className="h-3 w-3" />
                                </IconButton>
                            </Badge>
                        ))}
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={values.length === 0 ? placeholder : ""}
                            disabled={disabled}
                            className={cn(
                                "flex-1 min-w-[80px] bg-transparent border-none outline-none text-sm h-7",
                                "placeholder:text-muted-foreground/50"
                            )}
                        />
                    </div>

                    {suffix && (
                        <div className="flex items-center justify-center pr-2 pl-1 text-muted-foreground/60 group-focus-within:text-primary transition-colors shrink-0 select-none">
                            {suffix}
                        </div>
                    )}
                </div>
            </fieldset>

            {hasError && (
                <p role="alert" className="text-[10px] font-medium text-destructive animate-in fade-in slide-in-from-top-1 duration-200 pl-1">
                    {error}
                </p>
            )}

            {hint && !hasError && (
                <p className="text-[10px] text-muted-foreground pl-1">
                    {hint}
                </p>
            )}
        </div>
    )
}
