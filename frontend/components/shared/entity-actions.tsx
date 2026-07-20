import { type ReactNode } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import type { LucideIcon } from "lucide-react"
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
        /** Override icon from registry (for module-specific icons not in ROW_ACTIONS). */
        icon?: LucideIcon
        /** Semantic color token for the icon (e.g. "text-success", "text-destructive"). */
        iconColor?: string
        /** Extra CSS class applied to the action button. */
        className?: string
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
 * Uses the same components as DataTable for consistent behavior:
 * - 0 visible → null
 * - 1 visible → `DataCell.ActionSingle` — ArrowRight, hidden by default, revealed on hover
 * - 2+ visible → `DataCell.ActionMenu` — kebab (`MoreVertical`) always visible
 *
 * Parent must have the `group` class for `ActionSingle` hover-reveal to work.
 */
export function renderActions(
    structuredActions: StructuredAction[],
): ReactNode {
    const visible = structuredActions.filter(
        (a) => !('visible' in a) || a.visible !== false,
    )
    if (visible.length === 0) return null

    if (visible.length === 1 && 'action' in visible[0]) {
        const a = visible[0]
        return (
            <DataCell.ActionSingle
                onClick={a.onClick}
                title={'label' in a ? a.label : undefined}
            />
        )
    }

    return (
        <DataCell.ActionMenu
            items={toMenuItems(structuredActions)}
        />
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
                icon: a.icon,
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
export type EntityActionsReturn<T, Ctx> = {
    column: (ctx: Ctx, headerLabel?: string) => ColumnDef<T>
    auto: (ctx: Ctx, headerLabel?: string) => ColumnDef<T>
    render: (item: T, ctx: Ctx) => ReactNode
    single: (ctx: Ctx) => ColumnDef<T>
    defaultAction: (ctx: Ctx) => ((item: T) => ((e: React.MouseEvent) => void) | null)
}

export function createEntityActions<T, Ctx = object>(
    render: (item: T, ctx: Ctx) => ReactNode | StructuredAction[],
): EntityActionsReturn<T, Ctx> {
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

        /**
         * Returns the onClick handler of the first visible action for a given item,
         * or null if there are 0 or 2+ visible actions.
         *
         * Use with DataTable `defaultAction` or EntityCard `defaultAction` to make
         * row/card clicks execute the primary action directly.
         *
         * Usage:
         * ```tsx
         * const da = myActions.defaultAction(ctx)
         *
         * // DataTable
         * <DataTable defaultAction={(row) => da(row)} ... />
         *
         * // EntityCard
         * <EntityCard defaultAction={(e) => da(emp)?.(e)} ... />
         * ```
         */
        defaultAction: (ctx: Ctx) => {
            return (item: T) => {
                const result = render(item, ctx)
                if (!isStructured(result)) return null
                const visible = (result as StructuredAction[]).filter(
                    (a) => !('visible' in a) || a.visible !== false,
                )
                if (visible.length === 1 && 'action' in visible[0]) {
                    return visible[0].onClick as (e: React.MouseEvent) => void
                }
                return null
            }
        },
    }
}
