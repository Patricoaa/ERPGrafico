"use client"

import * as React from "react"
import { Check, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "checked"> {
    checked?: boolean | "indeterminate"
    onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, checked, onCheckedChange, ...props }, ref) => {
        const inputRef = React.useRef<HTMLInputElement>(null)
        React.useImperativeHandle(ref, () => inputRef.current!)

        const isIndeterminate = checked === "indeterminate"

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
                        "h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none bg-transparent checked:bg-primary",
                        isIndeterminate && "bg-primary",
                        className
                    )}
                    onChange={(e) => onCheckedChange?.(e.target.checked)}
                    {...props}
                />
                <Minus className={cn(
                    "absolute h-3 w-3 text-primary-foreground pointer-events-none left-0.5",
                    isIndeterminate ? "opacity-100" : "opacity-0"
                )} />
                <Check className={cn(
                    "absolute h-3 w-3 text-primary-foreground pointer-events-none left-0.5",
                    checked === true ? "opacity-100" : "opacity-0"
                )} />
            </div>
        )
    }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
