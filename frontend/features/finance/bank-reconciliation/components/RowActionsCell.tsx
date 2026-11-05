"use client"

import { DataCell, toMenuItems, type StructuredAction } from "@/components/shared"

/**
 * Celda de acciones de una fila de la mesa. Regla de kebab (component-row-actions.md):
 * 1 acción visible → botón de icono propio (no la flecha de `ActionSingle`);
 * 2+ → `DataCell.ActionMenu` (kebab siempre visible).
 */
export function RowActionsCell({ actions }: { actions: StructuredAction[] }) {
    const visible = actions.filter((a): a is Exclude<StructuredAction, { separator: true }> =>
        !("separator" in a) && a.visible !== false,
    )
    if (visible.length === 0) return null

    if (visible.length === 1) {
        const [action] = visible
        return (
            <DataCell.Action
                action={action.action}
                icon={action.icon}
                title={action.label}
                color={action.iconColor}
                className={action.className}
                onClick={action.onClick}
            />
        )
    }

    return <DataCell.ActionMenu items={toMenuItems(actions)} />
}
