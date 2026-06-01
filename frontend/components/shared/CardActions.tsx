"use client"

import { ReactNode, HTMLAttributes } from "react"
import { cn } from "@/lib/utils"
import { DataCell, type ActionMenuItem } from "./DataTableCells"
import type { RowActionKey } from "@/lib/row-actions"
import type { LucideIcon } from "lucide-react"

// ─── Root container ──────────────────────────────────────────────────────────

interface CardActionsRootProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode
    /** Layout: 'horizontal' (default) for footers, 'vertical' for sidebar-style stacks */
    orientation?: "horizontal" | "vertical"
}

function CardActionsRoot({ children, className, orientation = "horizontal", ...props }: CardActionsRootProps) {
    return (
        <div
            className={cn(
                "flex items-center gap-1.5",
                orientation === "vertical" && "flex-col",
                className,
            )}
            onClick={(e) => e.stopPropagation()}
            {...props}
        >
            {children}
        </div>
    )
}

// ─── Single action item ──────────────────────────────────────────────────────

interface CardActionsItemProps {
    /** Registry key — preferred form */
    action?: RowActionKey
    /** Override or set when action is module-specific */
    icon?: LucideIcon
    /** Override or set when action is module-specific */
    title?: string
    onClick?: (e: React.MouseEvent) => void
    className?: string
    color?: string
    variant?: "ghost" | "outline" | "default" | "secondary"
    disabled?: boolean
}

function CardActionsItem(props: CardActionsItemProps) {
    return <DataCell.Action {...props} />
}

// ─── Overflow menu ───────────────────────────────────────────────────────────

interface CardActionsMenuProps {
    items: ActionMenuItem[]
    title?: string
    className?: string
    align?: "start" | "center" | "end"
}

function CardActionsMenu(props: CardActionsMenuProps) {
    return <DataCell.ActionMenu {...props} />
}

// ─── Composite export ────────────────────────────────────────────────────────

export const CardActions = Object.assign(CardActionsRoot, {
    Item: CardActionsItem,
    Menu: CardActionsMenu,
})

export type { CardActionsRootProps, CardActionsItemProps, CardActionsMenuProps }
