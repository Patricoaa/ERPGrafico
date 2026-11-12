"use client"

import { Button } from "@/components/ui/button"
import { ROW_ACTIONS } from "@/lib/row-actions"
import type { StructuredAction } from "@/components/shared"

/**
 * Acciones de una sección de la ficha, alineadas a la derecha bajo su contenido. Recibe las acciones ya
 * filtradas por `partnerActionsFor`: aquí no se decide visibilidad.
 */
export function PartnerPanelActions({ actions, label }: { actions: StructuredAction[]; label: string }) {
    const buttons = actions.flatMap((a, i) => ("action" in a ? [{ a, key: `${a.action}-${i}` }] : []))
    if (buttons.length === 0) return null
    return (
        <div role="toolbar" aria-label={label} className="flex flex-wrap items-center justify-end gap-2">
            {buttons.map(({ a, key }) => {
                const Icon = a.icon ?? ROW_ACTIONS[a.action].icon
                return (
                    <Button key={key} type="button" size="sm" variant="outline" disabled={a.disabled} onClick={a.onClick}>
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {a.label ?? ROW_ACTIONS[a.action].label}
                    </Button>
                )
            })}
        </div>
    )
}
