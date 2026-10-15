"use client"

import { Button } from "@/components/ui/button"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { cn } from "@/lib/utils"

/**
 * Enlace a la ficha de otro documento o entidad, apilada con "volver" (ADR-0083).
 * `mono` para códigos de documento; texto normal para nombres (producto, contacto).
 */
export function DocumentRefLink({ label, id, display, mono = true, className }: {
    label: string
    id: number
    display: string
    mono?: boolean
    className?: string
}) {
    const { openEntity } = useGlobalModals()
    return (
        <Button
            variant="link"
            size="sm"
            className={cn("h-auto p-0 text-left text-xs font-medium whitespace-normal", mono && "font-mono", className)}
            onClick={() => openEntity(label, id, undefined, undefined, { display })}
        >
            {display}
        </Button>
    )
}
