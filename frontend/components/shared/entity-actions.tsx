import { type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { DataCell, type ActionMenuItem } from "./DataTableCells"
import { ROW_ACTIONS, type RowActionKey } from "@/lib/row-actions"

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
        /** Why it is disabled; `toMenuItems` shows it under the label in the menu. */
        disabledReason?: string
        /** Override label from registry. */
        label?: string
        /** Override icon from registry (for module-specific icons not in ROW_ACTIONS). */
        icon?: LucideIcon
        /** Semantic color token for the icon (e.g. "text-success-text", "text-destructive"). */
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
 * The lone visible action, drawn as the hover arrow (`ActionSingle`), named by its label. A disabled one
 * goes to the menu instead: `ActionSingle` has no disabled state, so it would stay clickable.
 */
function singleAction(visible: StructuredAction[]): { onClick: (e: React.MouseEvent) => void; title: string } | null {
    const a = visible.length === 1 ? visible[0] : undefined
    if (!a || !('action' in a) || a.disabled) return null
    return { onClick: a.onClick, title: a.label ?? ROW_ACTIONS[a.action].label }
}

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

    const single = singleAction(visible)
    if (single) return <DataCell.ActionSingle onClick={single.onClick} title={single.title} />

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
                disabledReason: a.disabledReason,
                label: a.label,
                icon: a.icon,
            }
        })
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * createEntityActions — Generic factory for entity actions shared between
 * entity-view collections (`forCollection`) and EntityCard (`render`).
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
 * <Collection.Root actions={myActions.forCollection(ctx)}>
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
 * <Collection.Root actions={myActions.forCollection(ctx)}>
 * ```
 */
export type EntityActionsReturn<T, Ctx> = {
    /** entity-view `Collection.Root actions`: table cell (`.cell`) or card actions (`.render`) per surface (ADR-0087). */
    forCollection: (ctx: Ctx) => (item: T, surface: "table" | "card") => ReactNode
    render: (item: T, ctx: Ctx) => ReactNode
    defaultAction: (ctx: Ctx) => ((item: T) => ((e: React.MouseEvent) => void) | null)
}

export function createEntityActions<T, Ctx = object>(
    render: (item: T, ctx: Ctx) => ReactNode | StructuredAction[],
): EntityActionsReturn<T, Ctx> {
    /** Detect if render returns structured data (array) or JSX (ReactNode). */
    const isStructured = (result: unknown): result is StructuredAction[] =>
        Array.isArray(result)

    /**
     * Table cell for one row. Counts visible actions at runtime:
     * 0 → empty, 1 → ActionSingle (ArrowRight on hover), 2+ → ActionMenu (kebab).
     * JSX from `render` (legacy) passes through.
     */
    const tableCell = (item: T, ctx: Ctx): ReactNode => {
        const result = render(item, ctx)
        if (!isStructured(result)) return result as ReactNode
        const visible = result.filter((a) => !('visible' in a) || a.visible !== false)
        if (visible.length === 0) return null
        const single = singleAction(visible)
        if (single) return <DataCell.ActionSingle onClick={single.onClick} title={single.title} />
        return <DataCell.ActionMenu items={toMenuItems(result)} />
    }

    return {
        forCollection: (ctx: Ctx) => (item: T, surface: "table" | "card") => {
            if (surface === "table") return tableCell(item, ctx)
            const result = render(item, ctx)
            return isStructured(result) ? renderActions(result) : result
        },

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
