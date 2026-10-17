"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Campos de solo lectura de una sección de la ficha documental (ADR-0083,
 * component-document-sheet.md §2). Rejilla de 4 columnas (form-layout-architecture §1) con
 * etiqueta N2 y valor N3. Los valores vacíos se muestran como "—" para no saltar el layout.
 */
export interface DocumentField {
    label: string
    value: ReactNode
    /** Columnas que ocupa (1–4). Default 1. */
    span?: 1 | 2 | 3 | 4
    /** Oculta el campo (p. ej. no aplica a este documento). */
    hidden?: boolean
}

const SPAN: Record<NonNullable<DocumentField["span"]>, string> = {
    1: "col-span-2 sm:col-span-1",
    2: "col-span-2",
    3: "col-span-2 sm:col-span-3",
    4: "col-span-2 sm:col-span-4",
}

export function DocumentFieldGrid({ fields, className }: { fields: DocumentField[]; className?: string }) {
    const visible = fields.filter((f) => !f.hidden)
    if (visible.length === 0) return null
    return (
        <dl className={cn("grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4", className)}>
            {visible.map((field) => (
                <div key={field.label} className={cn("min-w-0", SPAN[field.span ?? 1])}>
                    <dt className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">{field.label}</dt>
                    <dd className="mt-0.5 text-xs font-medium break-words">
                        {isEmpty(field.value) ? <span className="text-muted-foreground">—</span> : field.value}
                    </dd>
                </div>
            ))}
        </dl>
    )
}

function isEmpty(value: ReactNode): boolean {
    return value === null || value === undefined || value === "" || value === false
}
