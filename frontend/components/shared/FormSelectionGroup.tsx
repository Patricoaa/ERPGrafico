"use client"

import * as React from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { CardSurface } from "./CardSurface"
import { CmykRing } from "./CmykRing"

export type FormSelectionValue = string | number

export interface FormSelectionOption {
    value: FormSelectionValue
    label: string
    title?: string
    eyebrow?: React.ReactNode
    description?: React.ReactNode
    icon?: React.ReactNode
    suffix?: React.ReactNode
    disabled?: boolean
}

interface FormSelectionGroupCommonProps {
    label: string
    items: FormSelectionOption[]
    icon: React.ReactNode
    disabled?: boolean
    error?: string
    hint?: React.ReactNode
    suffix?: React.ReactNode
    footer?: React.ReactNode
    columns?: 1 | 2 | 3
    maxHeight?: string
    isLoading?: boolean
    loadingLabel?: string
    emptyLabel?: string
    className?: string
    containerClassName?: string
}

export interface FormSingleSelectionGroupProps extends FormSelectionGroupCommonProps {
    mode: "single"
    value: FormSelectionValue | null
    onChange: (value: FormSelectionValue) => void
    selectAll?: never
}

export interface FormMultipleSelectionGroupProps extends FormSelectionGroupCommonProps {
    mode: "multiple"
    value: FormSelectionValue[]
    onChange: (value: FormSelectionValue[]) => void
    selectAll?: boolean
    selectAllLabel?: string
}

export type FormSelectionGroupProps = FormSingleSelectionGroupProps | FormMultipleSelectionGroupProps

export function FormSelectionGroup(props: FormSelectionGroupProps) {
    const {
        label,
        items,
        icon,
        disabled = false,
        error,
        hint,
        suffix,
        footer,
        columns = 1,
        maxHeight,
        isLoading = false,
        loadingLabel = "Cargando opciones…",
        emptyLabel = "No hay opciones disponibles.",
        className,
        containerClassName,
    } = props
    const groupRef = React.useRef<HTMLDivElement>(null)
    const groupId = React.useId()
    const isMultiple = props.mode === "multiple"
    const values = isMultiple ? props.value : props.value === null ? [] : [props.value]
    const enabledItems = items.filter((item) => !item.disabled)
    const allSelected = isMultiple && enabledItems.length > 0 && enabledItems.every((item) => values.includes(item.value))
    const someSelected = isMultiple && !allSelected && enabledItems.some((item) => values.includes(item.value))

    const toggleOption = (option: FormSelectionOption) => {
        if (disabled || option.disabled) return
        if (props.mode === "single") {
            props.onChange(option.value)
            return
        }
        props.onChange(
            values.includes(option.value)
                ? values.filter((value) => value !== option.value)
                : [...values, option.value],
        )
    }

    const toggleAll = () => {
        if (props.mode !== "multiple" || disabled) return
        if (allSelected) {
            props.onChange(values.filter((value) => !enabledItems.some((item) => item.value === value)))
            return
        }
        props.onChange([...values, ...enabledItems.filter((item) => !values.includes(item.value)).map((item) => item.value)])
    }

    const handleRadioKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (props.mode !== "single" || !groupRef.current) return
        const direction = event.key === "ArrowRight" || event.key === "ArrowDown"
            ? 1
            : event.key === "ArrowLeft" || event.key === "ArrowUp"
                ? -1
                : 0
        if (!direction) return

        const options = Array.from(groupRef.current.querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"])'))
        const currentIndex = options.indexOf(document.activeElement as HTMLElement)
        if (options.length === 0 || currentIndex < 0) return

        event.preventDefault()
        const next = options[(currentIndex + direction + options.length) % options.length]
        next.focus()
        next.click()
    }

    const groupRole = isMultiple ? "group" : "radiogroup"
    const columnsClass = columns === 1 ? "grid-cols-1" : columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"

    return (
        <div className={cn("space-y-3", containerClassName, className)}>
            <div className="flex items-center gap-3 pl-1 text-muted-foreground/70">
                {icon && <span className="shrink-0" aria-hidden="true">{icon}</span>}
                <h4 id={`${groupId}-label`} className="text-2xs font-bold uppercase tracking-looser">
                    {label}
                </h4>
                {suffix && <span className="ml-auto shrink-0">{suffix}</span>}
            </div>

            <div className="w-full space-y-2">
                {props.mode === "multiple" && props.selectAll && items.length > 0 && (
                    <div className="flex w-full items-center justify-between gap-3 rounded-sm px-2 py-1.5">
                        <span className="flex items-center gap-2">
                            <Checkbox
                                id={`${groupId}-select-all`}
                                checked={someSelected ? "indeterminate" : allSelected}
                                onCheckedChange={toggleAll}
                                disabled={disabled}
                                aria-label={props.selectAllLabel ?? "Seleccionar todas"}
                            />
                            <label htmlFor={`${groupId}-select-all`} className={cn("text-sm font-semibold", !disabled && "cursor-pointer")}>
                                {props.selectAllLabel ?? "Seleccionar todas"}
                            </label>
                        </span>
                        <span className="text-2xs font-mono font-semibold text-muted-foreground">{items.length}</span>
                    </div>
                )}

                {isLoading ? (
                    <p role="status" className="px-2 py-3 text-sm text-muted-foreground">{loadingLabel}</p>
                ) : items.length === 0 ? (
                    <p role="status" className="px-2 py-3 text-sm text-muted-foreground">{emptyLabel}</p>
                ) : (
                    <div
                        ref={groupRef}
                        role={groupRole}
                        aria-labelledby={`${groupId}-label`}
                        aria-invalid={!!error || undefined}
                        aria-describedby={error ? `${groupId}-error` : hint ? `${groupId}-hint` : undefined}
                        onKeyDown={handleRadioKeyDown}
                        className={cn("grid w-full gap-2", columnsClass)}
                        style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}
                    >
                        {items.map((item, index) => {
                            const selected = values.includes(item.value)
                            const unavailable = disabled || !!item.disabled
                            const role = isMultiple ? "checkbox" : "radio"
                            const selectedIndex = props.mode === "single"
                                ? items.findIndex((option) => option.value === props.value)
                                : -1
                            const selectedIsEnabled = selectedIndex >= 0 && !items[selectedIndex].disabled
                            const firstEnabledIndex = items.findIndex((option) => !option.disabled)
                            const rovingIndex = selectedIsEnabled ? selectedIndex : firstEnabledIndex
                            const tabIndex = isMultiple
                                ? 0
                                : index === rovingIndex
                                    ? 0
                                    : -1
                            const descriptionId = `${groupId}-option-${index}-description`

                            return (
                                <CardSurface
                                    key={String(item.value)}
                                    role={role}
                                    aria-label={item.label}
                                    aria-describedby={item.description ? descriptionId : undefined}
                                    title={item.title}
                                    selected={selected}
                                    unavailable={unavailable}
                                    onClick={() => toggleOption(item)}
                                    tabIndex={tabIndex}
                                    kind="item"
                                    layout="inline"
                                    className={cn(
                                        "min-h-14 w-full items-center gap-3 p-3 text-left transition-colors before:hidden",
                                        selected ? "bg-primary/5 ring-primary/20" : "hover:bg-muted/30",
                                        unavailable && "cursor-default",
                                    )}
                                >
                                    <span className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40">
                                        {selected && <CmykRing size="xs" className="absolute inset-0 m-auto" />}
                                    </span>
                                    {item.icon && <span className="flex shrink-0 items-center justify-center text-muted-foreground">{item.icon}</span>}
                                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        {item.eyebrow && (
                                            <span className="text-3xs font-bold uppercase tracking-loose text-muted-foreground">
                                                {item.eyebrow}
                                            </span>
                                        )}
                                        <span className={cn("text-sm font-semibold leading-snug", selected ? "text-foreground" : "text-muted-foreground")}>
                                            {item.label}
                                        </span>
                                        {item.description && (
                                            <span id={descriptionId} className="text-2xs leading-relaxed text-muted-foreground">
                                                {item.description}
                                            </span>
                                        )}
                                    </span>
                                    {item.suffix && (
                                        <span
                                            className="flex shrink-0 items-center"
                                            onClick={(event) => event.stopPropagation()}
                                            onKeyDown={(event) => event.stopPropagation()}
                                        >
                                            {item.suffix}
                                        </span>
                                    )}
                                </CardSurface>
                            )
                        })}
                    </div>
                )}
                {footer && <div className="border-t border-border/40 px-2 pt-2">{footer}</div>}
            </div>

            {(error || hint) && (
                <div className="px-1 space-y-0.5">
                    {error ? (
                        <p id={`${groupId}-error`} role="alert" className="text-3xs font-medium text-destructive">
                            {error}
                        </p>
                    ) : hint ? (
                        <p id={`${groupId}-hint`} className="text-3xs text-muted-foreground">{hint}</p>
                    ) : null}
                </div>
            )}
        </div>
    )
}
