import { type ReactNode } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { createActionsColumn, DataCell, type ActionMenuItem } from "./DataTableCells"
import type { RowActionKey } from "@/lib/row-actions"

// ─── Structured Action Types ────────────────────────────────────────────────

/**
 * A single action in structured form — used by `auto()` for automatic
 * ActionSingle / ActionMenu detection based on visible count.
 *
 * Separators are only meaningful inside ActionMenu (2+ visible actions).
 */
export type StructuredAction =
    | {
        action: RowActionKey
        onClick: (e: React.MouseEvent) => void
        /** Whether this action is visible (default: true). Filtered before counting. */
        visible?: boolean
        /** Whether this action is visually disabled (dimmed, pointer-events-none). */
        disabled?: boolean
        /** Override label from registry. */
        label?: string
    }
    | { separator: true }

/**
 * Function returning structured actions for an entity.
 * Used by `createEntityActions` to enable the `auto()` method.
 */
export type StructuredActions<T, Ctx> = (item: T, ctx: Ctx) => StructuredAction[]

// ─── renderActions utility ──────────────────────────────────────────────────

/**
 * Converts structured actions to JSX for card surfaces (EntityCard, Kanban).
 *
 * - 0 visible → null
 * - 1 visible → single `DataCell.Action` icon
 * - 2+ visible → `CardActions` with `CardActions.Item` for each action
 *
 * Disabled actions render with dimmed CSS (`text-muted-foreground/30 pointer-events-none`).
 */
export function renderActions<T, Ctx>(
    structuredActions: StructuredAction[],
): ReactNode {
    const visible = structuredActions.filter(
        (a) => !('visible' in a) || a.visible !== false,
    )
    if (visible.length === 0) return null

    if (visible.length === 1 && 'action' in visible[0]) {
        const a = visible[0]
        return (
            <DataCell.Action
                action={a.action}
                onClick={a.onClick}
                className={a.disabled ? "text-muted-foreground/30 pointer-events-none" : undefined}
            />
        )
    }

    return (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {visible.map((a, i) => {
                if ('separator' in a && a.separator) return null
                if ('action' in a) {
                    return (
                        <DataCell.Action
                            key={`${a.action}-${i}`}
                            action={a.action}
                            onClick={a.onClick}
                            className={a.disabled ? "text-muted-foreground/30 pointer-events-none" : undefined}
                        />
                    )
                }
                return null
            })}
        </div>
    )
}

// ─── Structured → ActionMenuItem[] converter ────────────────────────────────

/**
 * Converts structured actions to `ActionMenuItem[]` for `DataCell.ActionMenu`.
 * Filters out separators when there are < 2 visible actions.
 */
export function toMenuItems(actions: StructuredAction[]): ActionMenuItem[] {
    return actions
        .filter((a) => !('visible' in a) || a.visible !== false)
        .map((a) => {
            if (!('action' in a)) return { separator: true as const }
            return {
                action: a.action,
                onClick: a.onClick,
                disabled: a.disabled,
                label: a.label,
            }
        })
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * createEntityActions — Generic factory for entity actions shared between
 * DataTable (createActionsColumn) and EntityCard (actions prop).
 *
 * Supports two patterns:
 *
 * **1. Structured data (preferred for new code):**
 * ```tsx
 * export const myActions = createEntityActions<MyEntity, MyActionsCtx>(
 *   (item, ctx) => [
 *     { action: "edit", onClick: () => ctx.onEdit(item.id) },
 *     ...(!item.is_default ? [{ action: "delete", onClick: () => ctx.onDelete(item) }] : []),
 *   ]
 * )
 *
 * // DataTable — auto-detects ActionSingle (1 visible) vs ActionMenu (2+)
 * const columns = [ myActions.auto(ctx) ]
 *
 * // EntityCard — converts structured data → JSX
 * <EntityCard actions={myActions.render(item, ctx)} />
 * ```
 *
 * **2. JSX (legacy, still supported):**
 * ```tsx
 * export const myActions = createEntityActions<MyEntity, MyActionsCtx>(
 *   (item, ctx) => (
 *     <DataCell.Action action="edit" onClick={() => ctx.onEdit(item.id)} />
 *   )
 * )
 * const columns = [ myActions.column(ctx) ]
 * ```
 */
export function createEntityActions<T, Ctx = object>(
    render: (item: T, ctx: Ctx) => ReactNode | StructuredAction[],
) {
    /** Detect if render returns structured data (array) or JSX (ReactNode). */
    const isStructured = (result: unknown): result is StructuredAction[] =>
        Array.isArray(result)

    return {
        /**
         * Column definition for DataTable — JSX pattern.
         * Pass context and optional header label.
         */
        column: (ctx: Ctx, headerLabel?: string): ColumnDef<T> =>
            createActionsColumn({
                headerLabel,
                renderActions: (item) => render(item, ctx) as ReactNode,
            }),

        /**
         * Auto-detect column for DataTable — structured data pattern.
         * Counts visible actions at runtime:
         * - 0 visible → empty cell
         * - 1 visible → ActionSingle (ArrowRight on hover)
         * - 2+ visible → ActionMenu (kebab)
         *
         * Falls back to `.column()` if render returns JSX (legacy).
         */
        auto: (ctx: Ctx, headerLabel?: string): ColumnDef<T> =>
            createActionsColumn({
                headerLabel,
                renderActions: (item) => {
                    const result = render(item, ctx)
                    if (!isStructured(result)) return result as ReactNode

                    const visible = result.filter(
                        (a) => !('visible' in a) || a.visible !== false,
                    )
                    if (visible.length === 0) return null
                    if (visible.length === 1 && 'action' in visible[0]) {
                        return (
                            <DataCell.ActionSingle
                                onClick={visible[0].onClick}
                            />
                        )
                    }
                    return (
                        <DataCell.ActionMenu
                            items={toMenuItems(result)}
                        />
                    )
                },
            }),

        /**
         * Render actions for EntityCard / Kanban.
         * Converts structured data → JSX, or passes through JSX directly.
         */
        render: (item: T, ctx: Ctx) => {
            const result = render(item, ctx)
            if (isStructured(result)) return renderActions(result)
            return result
        },

        /**
         * Single-action variant for DataTable.
         * Renders ArrowRight on row hover (no header, minimal column width).
         * Use when the entity has only one action.
         */
        single: (ctx: Ctx): ColumnDef<T> =>
            createActionsColumn({
                renderActions: (item) => render(item, ctx) as ReactNode,
            }),
    }
}
