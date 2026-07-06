"use client"

import * as React from "react"
import { Check, Minus } from "lucide-react"
import { CmykRing } from "@/components/shared"
import { cn } from "@/lib/utils"

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "checked"> {
    checked?: boolean | "indeterminate"
    onCheckedChange?: (checked: boolean) => void
    variant?: "default" | "circle"
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, checked, onCheckedChange, variant = "default", ...props }, ref) => {
        const inputRef = React.useRef<HTMLInputElement>(null)
        React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

        const isIndeterminate = checked === "indeterminate"
        const isCircle = variant === "circle"

        React.useEffect(() => {
            if (inputRef.current) {
                inputRef.current.indeterminate = isIndeterminate
            }
        }, [isIndeterminate])

        return (
            <div className="relative flex items-center">
                <input
                    type="checkbox"
                    ref={inputRef}
                    checked={checked === true}
                    className={cn(
                        "h-4 w-4 shrink-0 border ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none bg-transparent",
                        isCircle
                            ? "rounded-full border-muted-foreground/30 checked:bg-transparent"
                            : "rounded-sm border-primary checked:bg-primary",
                        isIndeterminate && "bg-primary",
                        className
                    )}
                    onChange={(e) => onCheckedChange?.(e.target.checked)}
                    {...props}
                />
                {isCircle ? (
                    checked === true ? (
                        <CmykRing size="sm" className="absolute inset-0 m-auto pointer-events-none" />
                    ) : isIndeterminate ? (
                        <Minus className="absolute h-3 w-3 text-muted-foreground pointer-events-none inset-0 m-auto" />
                    ) : null
                ) : (
                    <>
                        <Minus className={cn(
                            "absolute h-3 w-3 text-primary-foreground pointer-events-none left-0.5",
                            isIndeterminate ? "opacity-100" : "opacity-0"
                        )} />
                        <Check className={cn(
                            "absolute h-3 w-3 text-primary-foreground pointer-events-none left-0.5",
                            checked === true ? "opacity-100" : "opacity-0"
                        )} />
                    </>
                )}
            </div>
        )
    }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
