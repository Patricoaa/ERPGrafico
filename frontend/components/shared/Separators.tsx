import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * FadedSeparator — A refined line that fades out at the edges.
 * Best used for Header and Footer boundaries.
 */
export function FadedSeparator({ className }: { className?: string }) {
    return (
        <div 
            className={cn(
                "h-px w-full bg-gradient-to-right from-transparent via-border/60 to-transparent my-4",
                className
            )} 
        />
    )
}

interface LabeledSeparatorProps {
    label: string
    icon?: React.ReactNode
    className?: string
}

/**
 * LabeledSeparator — A centered text label with lines on each side.
 * Best used for dividing sections within a form.
 */
export function LabeledSeparator({ label, icon, className }: LabeledSeparatorProps) {
    return (
        <div className={cn("flex items-center gap-2 pt-2 pb-2", className)}>
            <div className="flex-1 h-px bg-border/40" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 px-2">
                {icon}
                {label}
            </span>
            <div className="flex-1 h-px bg-border/40" />
        </div>
    )
}
