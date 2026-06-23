import { ReactNode } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { createActionsColumn } from "./DataTableCells"

/**
 * createEntityActions — Generic factory for entity actions shared between
 * DataTable (createActionsColumn) and EntityCard (actions prop).
 *
 * Usage:
 * ```tsx
 * // 1. Define actions once per entity in a dedicated file
 * export interface MyActionsCtx { onEdit: (id: number) => void }
 * export const myActions = createEntityActions<MyEntity, MyActionsCtx>(
 *   (item, ctx) => (
 *     <DataCell.Action action="edit" onClick={() => ctx.onEdit(item.id)} />
 *   )
 * )
 *
 * // 2. Use in table columns
 * const columns = [ ..., myActions.column(ctx) ]
 *
 * // 3. Use in renderCard
 * <EntityCard actions={myActions.render(item, ctx)}>...</EntityCard>
 * ```
 */
export function createEntityActions<T, Ctx = object>(
    render: (item: T, ctx: Ctx) => ReactNode
) {
    return {
        /** Column definition for DataTable — pass context and optional header label */
        column: (ctx: Ctx, headerLabel?: string): ColumnDef<T> =>
            createActionsColumn({
                headerLabel,
                renderActions: (item) => render(item, ctx),
            }),
        /** Render the same actions for EntityCard.actions or EntityCard.Footer */
        render: (item: T, ctx: Ctx) => render(item, ctx),
    }
}
