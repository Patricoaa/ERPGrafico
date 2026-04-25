"use client"

import { forwardRef } from "react"
import { cn } from "@/lib/utils"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { SelectProps } from "@radix-ui/react-select"

export interface LabeledSelectOption {
    value: string
    label: React.ReactNode
}

export interface LabeledSelectProps extends Omit<SelectProps, "value" | "onValueChange"> {
    /** Label text rendered inside the fieldset legend (notched border). Optional for table usage. */
    label?: React.ReactNode
    /** Options to render inside the select dropdown. */
    options: LabeledSelectOption[]
    /** Controlled value */
    value?: string
    /** Icon or symbol shown as a prefix (inside the fieldset). */
    icon?: React.ReactNode
    /** Callback when value changes */
    onChange?: (value: string) => void
    /** Placeholder when no value is selected */
    placeholder?: string
    /** Shows a red asterisk * after the label. */
    required?: boolean
    /** Error message — turns border red and shows text below the field. */
    error?: string
    /** Helper hint shown below when there is no error. */
    hint?: string
    /** Additional classes for the outer wrapper `<div>`. */
    containerClassName?: string
    /** Additional classes for the `SelectTrigger` button. */
    className?: string
}

/**
 * LabeledSelect — Notched/Fieldset select primitive.
 *
 * Wraps Shadcn UI `<Select>` inside a `<fieldset>` with a `<legend>` 
 * to provide the "Notched/Fieldset" aesthetic identical to `LabeledInput`.
 */
export const LabeledSelect = forwardRef<
    React.ElementRef<typeof SelectTrigger>,
    LabeledSelectProps
>((props, ref) => {
    const {
        label,
        options,
        value,
        onChange,
        placeholder,
        required,
        error,
        hint,
        containerClassName,
        className,
        disabled,
        open,
        onOpenChange,
        icon,
        ...rest
    } = props

    const hasError = !!error

    return (
        <div className={cn("relative w-full group", containerClassName)}>
            <fieldset
                className={cn(
                    "notched-field transition-all duration-200",
                    "group-focus-within:border-primary group-focus-within:ring-1 group-focus-within:ring-primary/20",
                    hasError && "border-destructive group-focus-within:border-destructive group-focus-within:ring-destructive/20",
                    disabled && "opacity-50 cursor-not-allowed bg-muted/10"
                )}
            >
                {label && (
                    <legend
                        className={cn(
                            "px-1.5 text-[10px] font-black uppercase tracking-[0.15em] transition-colors duration-200",
                            hasError ? "text-destructive" : "text-muted-foreground group-focus-within:text-primary",
                            disabled && "text-muted-foreground/50"
                        )}
                    >
                        {label}
                        {required && <span className="text-destructive ml-0.5">*</span>}
                    </legend>
                )}

                <div className="flex items-center w-full">
                    {icon && (
                        <div className="pl-3 flex items-center justify-center text-muted-foreground/60 group-focus-within:text-primary transition-colors shrink-0">
                            {icon}
                        </div>
                    )}

                    <Select
                        value={value}
                        onValueChange={onChange}
                        disabled={disabled}
                        open={open}
                        onOpenChange={onOpenChange}
                        {...rest}
                    >
                    <SelectTrigger
                        ref={ref}
                        className={cn(
                            "w-full border-0 shadow-none focus:ring-0 focus:ring-offset-0 bg-transparent px-2 !h-[1.5rem] !py-0",
                            !value && "text-muted-foreground font-normal",
                            className
                        )}
                    >
                        <SelectValue placeholder={placeholder} />
                    </SelectTrigger>
                    <SelectContent position="popper" align="start" className="w-[var(--radix-select-trigger-width)]">
                        {options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                </div>
            </fieldset>

            {/* Error or Hint Text */}
            {hasError ? (
                <p className="mt-1.5 text-[11px] font-medium text-destructive animate-in fade-in slide-in-from-top-1">
                    {error}
                </p>
            ) : hint ? (
                <p className="mt-1.5 text-[11px] font-medium text-muted-foreground/70">
                    {hint}
                </p>
            ) : null}
        </div>
    )
})

LabeledSelect.displayName = "LabeledSelect"
