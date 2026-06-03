"use client"

import React, { useState, useMemo, useRef } from "react"
import { Check, ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { IconButton } from "@/components/shared"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"

export interface MultiSelectOption {
    label: string
    value: string
}

interface MultiSelectTagInputProps {
    label?: string
    placeholder?: string
    options: MultiSelectOption[]
    value: string[]
    onChange: (value: string[]) => void
    onCreateOption?: (value: string) => void
    error?: string
    required?: boolean
    containerClassName?: string
    disabled?: boolean
    hint?: string
}

/**
 * MultiSelectTagInput — A "notched fieldset" multi-select with dropdown.
 * Uses Radix Popover so the dropdown correctly layers above modals/scrollable containers.
 */
export function MultiSelectTagInput({
    label,
    placeholder = "Seleccionar...",
    options,
    value,
    onChange,
    onCreateOption,
    error,
    required,
    containerClassName,
    disabled = false,
    hint
}: MultiSelectTagInputProps) {
    const [open, setOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)
    const hasError = !!error

    const selectedOptions = useMemo(
        () => options.filter(opt => value.includes(opt.value)),
        [options, value],
    )

    const filteredOptions = useMemo(() => {
        if (!searchQuery) return options
        return options.filter(opt =>
            opt.label.toLowerCase().includes(searchQuery.toLowerCase())
        )
    }, [options, searchQuery])

    const toggleOption = (optionValue: string) => {
        const newValue = value.includes(optionValue)
            ? value.filter(v => v !== optionValue)
            : [...value, optionValue]
        onChange(newValue)
    }

    const removeOption = (e: React.MouseEvent, optionValue: string) => {
        e.stopPropagation()
        onChange(value.filter(v => v !== optionValue))
    }

    const exactMatch = options.find(opt => opt.label.toLowerCase() === searchQuery.toLowerCase())
    const showCreate = onCreateOption && searchQuery.trim() !== "" && !exactMatch

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && searchQuery.trim()) {
            e.preventDefault()
            if (exactMatch) {
                if (!value.includes(exactMatch.value)) {
                    onChange([...value, exactMatch.value])
                }
                setSearchQuery("")
            } else if (showCreate) {
                onCreateOption(searchQuery.trim())
                setSearchQuery("")
            }
        } else if (e.key === "Backspace" && !searchQuery && value.length > 0) {
            e.preventDefault()
            const newVals = [...value]
            newVals.pop()
            onChange(newVals)
        } else if (e.key === "Escape") {
            setOpen(false)
        }
    }

    return (
        <div className={cn("space-y-1 w-full group", containerClassName)}>
            <Popover open={open} onOpenChange={(o) => { if (!disabled) setOpen(o) }}>
                <PopoverAnchor asChild>
                    <fieldset
                        className={cn(
                            "notched-field transition-all duration-200 cursor-text min-h-[44px] pb-1.5 pt-1",
                            open ? "border-primary ring-1 ring-primary/20" : "group-hover:border-muted-foreground/50",
                            hasError && "border-destructive ring-destructive/20",
                            disabled && "opacity-50 cursor-not-allowed pointer-events-none"
                        )}
                        data-error={hasError || undefined}
                        data-disabled={disabled || undefined}
                        onClick={() => {
                            if (!disabled) {
                                setOpen(true)
                                inputRef.current?.focus()
                            }
                        }}
                    >
                        {label && (
                            <legend className={cn(
                                "px-1.5 text-[10px] font-black uppercase tracking-[0.15em] transition-colors duration-200",
                                hasError ? "text-destructive" : (open ? "text-primary" : "text-muted-foreground"),
                                disabled && "text-muted-foreground/50"
                            )}>
                                {label}
                                {required && (
                                    <span className="text-destructive ml-0.5" aria-hidden="true">*</span>
                                )}
                            </legend>
                        )}

                        <div className="flex items-center w-full px-1">
                            <div className="flex flex-wrap items-center gap-1.5 px-2 flex-1">
                                {selectedOptions.map((opt) => (
                                    <Badge
                                        key={opt.value}
                                        variant="secondary"
                                        className="flex items-center gap-1 px-2 py-0.5 h-6 text-[11px] font-bold border-secondary/50 animate-in zoom-in-95 duration-200"
                                    >
                                        {opt.label}
                                        <IconButton
                                            type="button"
                                            variant="ghost"
                                            className="h-3 w-3 p-0 hover:bg-transparent hover:text-destructive"
                                            onClick={(e) => removeOption(e, opt.value)}
                                        >
                                            <X className="h-2.5 w-2.5" />
                                        </IconButton>
                                    </Badge>
                                ))}
                                <input
                                    ref={inputRef}
                                    type="text"
                                    className="flex-1 bg-transparent border-none outline-none text-[11px] uppercase font-bold placeholder:text-muted-foreground/40 placeholder:normal-case placeholder:font-medium min-w-[80px] h-7"
                                    placeholder={selectedOptions.length === 0 ? placeholder : ""}
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value)
                                        if (!open) setOpen(true)
                                    }}
                                    onFocus={() => setOpen(true)}
                                    onKeyDown={handleKeyDown}
                                    disabled={disabled}
                                />
                            </div>

                            <div
                                className="flex items-center justify-center pr-2 pl-1 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0 select-none cursor-pointer"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    if (!disabled) setOpen(!open)
                                }}
                            >
                                <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} />
                            </div>
                        </div>
                    </fieldset>
                </PopoverAnchor>

                <PopoverContent
                    className="p-0 w-[var(--radix-popover-anchor-width)]"
                    align="start"
                    sideOffset={4}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onInteractOutside={() => setOpen(false)}
                >
                    <div className="flex flex-col">
                        <div className="max-h-[250px] overflow-y-auto p-1 custom-scrollbar">
                            {showCreate && (
                                <div
                                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-[10px] uppercase font-bold tracking-tight outline-none hover:bg-accent hover:text-accent-foreground transition-colors text-primary bg-primary/5"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        onCreateOption?.(searchQuery.trim())
                                        setSearchQuery("")
                                    }}
                                >
                                    <span className="flex-1">Crear &quot;{searchQuery.trim()}&quot;</span>
                                </div>
                            )}

                            {filteredOptions.length > 0 ? (
                                filteredOptions.map((option) => {
                                    const isSelected = value.includes(option.value)
                                    return (
                                        <div
                                            key={option.value}
                                            className={cn(
                                                "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-[10px] uppercase font-bold tracking-tight outline-none hover:bg-accent hover:text-accent-foreground transition-colors",
                                                isSelected ? "bg-primary/5 text-primary" : "text-muted-foreground"
                                            )}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => {
                                                toggleOption(option.value)
                                                inputRef.current?.focus()
                                            }}
                                        >
                                            <div className={cn(
                                                "mr-2 flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-primary/20 transition-all",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground border-primary"
                                                    : "bg-background"
                                            )}>
                                                {isSelected && <Check className="h-2.5 w-2.5" />}
                                            </div>
                                            <span className="flex-1">{option.label}</span>
                                        </div>
                                    )
                                })
                            ) : !showCreate && (
                                <div className="py-6 px-2 text-center text-[10px] font-bold uppercase text-muted-foreground/40 italic">
                                    No se encontraron resultados
                                </div>
                            )}
                        </div>

                        {value.length > 0 && (
                            <>
                                <Separator className="opacity-50" />
                                <div className="p-1">
                                    <div
                                        role="button"
                                        className="w-full flex items-center justify-center text-[9px] font-black uppercase tracking-[0.1em] h-8 hover:bg-destructive/10 hover:text-destructive transition-colors rounded-sm text-muted-foreground/60 cursor-pointer"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => onChange([])}
                                    >
                                        Limpiar Seleccion ({value.length})
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </PopoverContent>
            </Popover>

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
