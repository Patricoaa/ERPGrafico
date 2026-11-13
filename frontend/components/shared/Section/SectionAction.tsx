"use client"

import Link from "next/link"
import type * as React from "react"
import { type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export interface SectionActionProps {
    text: string
    icon?: LucideIcon
    /** Navegación (redirección); sin `href` actúa como botón. */
    href?: string
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
    /** `ghost` por defecto; `outline` para una acción que debe destacar. */
    variant?: "ghost" | "outline"
    disabled?: boolean
}

/** Acción compacta de una cabecera o fila de `Section`: botón o enlace, ghost por defecto, con icono opcional. */
export function SectionAction({ text, icon: Icon, href, onClick, variant = "ghost", disabled }: SectionActionProps) {
    const content = <>{Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}{text}</>
    const className = "h-7 shrink-0 gap-1 text-xs"
    if (href) {
        return (
            <Button variant={variant} size="sm" className={className} asChild>
                <Link href={href}>{content}</Link>
            </Button>
        )
    }
    return <Button type="button" variant={variant} size="sm" className={className} onClick={onClick} disabled={disabled}>{content}</Button>
}
