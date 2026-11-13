import * as React from "react"
import { AlertTriangle, CheckCircle2 } from "lucide-react"

import { cn } from "@/lib/utils"

export interface SectionNoteProps {
    children: React.ReactNode
    /** `warning` (default) para advertencias; `success` para efectos o logros confirmados. */
    tone?: "warning" | "success"
}

/** Nota con icono de estado dentro de una `Section`. */
export function SectionNote({ children, tone = "warning" }: SectionNoteProps) {
    const Icon = tone === "success" ? CheckCircle2 : AlertTriangle
    return (
        <li className="flex items-start gap-3 py-2.5 text-sm text-muted-foreground">
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone === "success" ? "text-success" : "text-warning")} aria-hidden />
            <span>{children}</span>
        </li>
    )
}
