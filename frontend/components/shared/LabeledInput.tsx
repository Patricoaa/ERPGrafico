"use client"

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { FieldLegend, fieldLegendClasses } from "./FieldLegend"
import { Eye, EyeOff } from "lucide-react"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface LabeledInputBaseProps {
    /** Label text rendered inside the fieldset legend (notched border). Optional for table usage. */
    label?: React.ReactNode
    /** Shows a red asterisk * after the label. Does NOT add HTML required attr (use `required` in inputProps). */
    required?: boolean
    /** Error message — turns border red and shows text below the field. */
    error?: string
    /** Helper hint shown below when there is no error. */
    hint?: React.ReactNode
    /** @deprecated Use FieldLegend (N2) instead. Legend typography is now centralized. */
    labelClassName?: string
    /** @deprecated Use FieldLegend (N2) instead. Legend typography is now centralized. */
    hintClassName?: string
    /** Additional classes for the outer wrapper `<div>`. */
    containerClassName?: string
    /** Icon or symbol shown as a prefix (inside the fieldset). */
    icon?: React.ReactNode
    /** Text or element shown as a suffix (inside the fieldset). */
    suffix?: React.ReactNode
    /** Tooltip text shown on hover of a small ℹ icon inline in the legend. */
    tooltip?: string
}

/** Props for a single-line input (`as` omitted or `as="input"`). */
export interface LabeledInputProps
    extends LabeledInputBaseProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, "required"> {
    as?: "input"
}

/** Props for a multi-line textarea (`as="textarea"`). */
export interface LabeledTextareaProps
    extends LabeledInputBaseProps,
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "required"> {
    as: "textarea"
    /** Minimum visible rows. Defaults to 3. */
    rows?: number
}

export type LabeledInputAllProps = LabeledInputProps | LabeledTextareaProps

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

/**
 * LabeledInput — Notched/Fieldset input primitive.
 *
 * Renders a `<fieldset>` with a `<legend>` so the label sits on the border
 * with zero JavaScript positioning. Supports `as="textarea"` for multiline.
 *
 * Usage with react-hook-form:
 * ```tsx
 * <FormField
 *   control={form.control}
 *   name="name"
 *   render={({ field, fieldState }) => (
 *     <FormItem>
 *       <FormControl>
 *         <LabeledInput
 *           label="Nombre"
 *           required
 *           error={fieldState.error?.message}
 *           {...field}
 *         />
 *       </FormControl>
 *     </FormItem>
 *   )}
 * />
 * ```
 *
 * Usage standalone (Label+Input pair, non-RHF context):
 * ```tsx
 * <LabeledInput
 *   label="Observaciones"
 *   as="textarea"
 *   rows={4}
 *   value={obs}
 *   onChange={(e) => setObs(e.target.value)}
 * />
 * ```
 */
export const LabeledInput = forwardRef<
    HTMLInputElement | HTMLTextAreaElement,
    LabeledInputAllProps
>((props, ref) => {
    const {
        label,
        required,
        error,
        hint,
        containerClassName,
        className,
        labelClassName,
        hintClassName,
        disabled,
        icon,
        suffix,
        tooltip,
        ...rest
    } = props

    const hasError = !!error
    const isTextarea = "as" in props && props.as === "textarea"
    const isPassword = !isTextarea && (rest as InputHTMLAttributes<HTMLInputElement>).type === "password"

    // Caps Lock detection for password fields
    const [isCapsLockOn, setIsCapsLockOn] = useState(false)

    useEffect(() => {
        if (!isPassword) return

        const handleKeyDown = (event: KeyboardEvent) => {
            setIsCapsLockOn(event.getModifierState("CapsLock"))
        }

        const handleKeyUp = (event: KeyboardEvent) => {
            setIsCapsLockOn(event.getModifierState("CapsLock"))
        }

        window.addEventListener("keydown", handleKeyDown)
        window.addEventListener("keyup", handleKeyUp)

        return () => {
            window.removeEventListener("keydown", handleKeyDown)
            window.removeEventListener("keyup", handleKeyUp)
        }
    }, [isPassword])

    const sharedInputClass = cn(
        "text-sm text-foreground placeholder:text-muted-foreground/60",
        className
    )

    // Password visibility toggle state
    const [showPassword, setShowPassword] = useState(false)
    const [inputValue, setInputValue] = useState("")
    const inputType = isPassword && !showPassword ? "password" : "text"

    // Get current value (handles both controlled and uncontrolled)
    const currentValue = String((rest as InputHTMLAttributes<HTMLInputElement>).value ?? inputValue)
    const hasContent = currentValue.length > 0

    // Track input value for eye icon visibility
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(event.target.value)
        ;(rest as InputHTMLAttributes<HTMLInputElement>).onChange?.(event as React.ChangeEvent<HTMLInputElement>)
    }

    return (
        <div className={cn("space-y-1 relative w-full group", containerClassName)}>
            <fieldset
                className={cn(
                    "notched-field transition-all duration-200",
                    "group-focus-within:border-primary group-focus-within:ring-1 group-focus-within:ring-primary/20",
                    hasError && "border-destructive group-focus-within:border-destructive group-focus-within:ring-destructive/20"
                )}
                data-error={hasError || undefined}
                data-disabled={disabled || undefined}
            >
                {label && (
                    <FieldLegend
                        label={label}
                        required={required}
                        hasError={hasError}
                        disabled={disabled}
                        className={labelClassName}
                        tooltip={tooltip}
                    />
                )}

                <div className="flex items-center w-full h-full px-1 relative">
                    {icon && (
                        <div className="flex items-center justify-center pl-2 pr-0 text-muted-foreground/60 group-focus-within:text-primary transition-colors shrink-0 select-none leading-none">
                            {icon}
                        </div>
                    )}

                    {isTextarea ? (
                        <textarea
                            ref={ref as React.ForwardedRef<HTMLTextAreaElement>}
                            rows={(rest as LabeledTextareaProps).rows ?? 3}
                            disabled={disabled}
                            className={cn(sharedInputClass, "px-2 py-1.5")}
                            {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
                        />
                    ) : (
                        <input
                            ref={ref as React.ForwardedRef<HTMLInputElement>}
                            disabled={disabled}
                            type={inputType}
                            className={cn(sharedInputClass, "flex-1 min-w-0 px-2 h-full pr-10")} /* Space for eye icon */
                            onChange={handleChange}
                            value={currentValue}
                            {...((({ type, ...rest }) => rest)(rest as InputHTMLAttributes<HTMLInputElement>))}
                        />
                    )}

                    {suffix && (
                        <div className="flex items-center justify-center pr-2 pl-1 text-muted-foreground/60 group-focus-within:text-primary transition-colors shrink-0 select-none">
                            {suffix}
                        </div>
                    )}

                    {/* Eye icon toggle for password fields - right side, only when has content */}
                    {isPassword && !disabled && hasContent && (
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            onMouseDown={(e) => e.preventDefault()}
                            className="flex items-center justify-center w-10 pr-2 text-muted-foreground/60 hover:text-primary transition-colors shrink-0 select-none absolute right-0 inset-y-0"
                            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                            aria-pressed={showPassword}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    )}
                </div>
            </fieldset>

            {hasError && (
                <div
                    role="alert"
                    className="text-2xs font-medium text-destructive animate-in fade-in slide-in-from-top-1 duration-200 pl-1"
                >
                    {error}
                </div>
            )}

            {/* Caps Lock hint for password fields - outside fieldset */}
            {isPassword && isCapsLockOn && !hasError && (
                <div className="text-2xs text-primary pl-1 animate-in fade-in slide-in-from-top-1 duration-200">
                    Mayúsculas activadas
                </div>
            )}

            {hint && !hasError && (
                <div className={cn("text-2xs text-muted-foreground pl-1", hintClassName)}>
                    {hint}
                </div>
            )}
        </div>
    )
})

LabeledInput.displayName = "LabeledInput"
