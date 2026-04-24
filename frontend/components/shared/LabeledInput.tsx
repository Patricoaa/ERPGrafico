"use client"

import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface LabeledInputBaseProps {
    /** Label text rendered inside the fieldset legend (notched border). */
    label: string
    /** Shows a red asterisk * after the label. Does NOT add HTML required attr (use `required` in inputProps). */
    required?: boolean
    /** Error message — turns border red and shows text below the field. */
    error?: string
    /** Helper hint shown below when there is no error. */
    hint?: string
    /** Additional classes for the outer wrapper `<div>`. */
    containerClassName?: string
    /** Icon or symbol shown as a prefix (inside the fieldset). */
    icon?: React.ReactNode
    /** Text or element shown as a suffix (inside the fieldset). */
    suffix?: React.ReactNode
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
        disabled,
        icon,
        suffix,
        ...rest
    } = props

    const hasError = !!error
    const isTextarea = "as" in props && props.as === "textarea"

    const sharedInputClass = cn(
        "text-sm text-foreground placeholder:text-muted-foreground/60",
        className
    )

    return (
        <div className={cn("space-y-1", containerClassName)}>
            <fieldset
                className="notched-field"
                data-error={hasError || undefined}
                data-disabled={disabled || undefined}
            >
                <legend>
                    {label}
                    {required && (
                        <span className="text-destructive ml-0.5" aria-hidden="true">
                            *
                        </span>
                    )}
                </legend>

                <div className="flex items-center w-full h-full px-1">
                    {icon && (
                        <div className="flex items-center justify-center pl-2 pr-1 text-muted-foreground/60 shrink-0 select-none">
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
                            className={cn(sharedInputClass, "px-2 h-full")}
                            {...(rest as InputHTMLAttributes<HTMLInputElement>)}
                        />
                    )}

                    {suffix && (
                        <div className="flex items-center justify-center pr-2 pl-1 text-muted-foreground/60 shrink-0 select-none">
                            {suffix}
                        </div>
                    )}
                </div>
            </fieldset>

            {hasError && (
                <p
                    role="alert"
                    className="text-[10px] font-medium text-destructive animate-in fade-in slide-in-from-top-1 duration-200 pl-1"
                >
                    {error}
                </p>
            )}

            {hint && !hasError && (
                <p className="text-[10px] text-muted-foreground pl-1">{hint}</p>
            )}
        </div>
    )
})

LabeledInput.displayName = "LabeledInput"
