"use client"

import React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { DynamicIcon } from "@/components/ui/dynamic-icon"
import { cn } from "@/lib/utils"
import { FormSplitLayout } from "@/components/shared/FormSplitLayout"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"
import { getEntityMetadata, ENTITY_REGISTRY } from "@/lib/entity-registry"
import { Package } from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
    label: string
    href: string
}

export interface ActionItem {
    id: string
    label: string
    onClick: () => void
    variant?: "default" | "destructive" | "outline" | "ghost"
    icon?: string
    disabled?: boolean
}

type ActivityEntityType = React.ComponentProps<typeof ActivitySidebar>["entityType"]

export interface EntityDetailPageProps {
    /**
     * Entity type for the ActivitySidebar registry.
     * Must be one of the valid entity types defined in ActivitySidebar.
     */
    entityType: ActivityEntityType
    /** Display title of the entity (e.g., "Nota de Venta") */
    title: string
    /** Visible identifier string (e.g., "NV-001"). Optional. */
    displayId?: string
    /** Lucide icon name for the entity (e.g., "receipt-text") */
    icon: string
    /** Breadcrumb trail: [{label, href}, ...]. Last item is the current page. */
    breadcrumb: BreadcrumbItem[]
    /**
     * Instance ID for loading the ActivitySidebar history.
     * If undefined, sidebar is not shown (create mode).
     */
    instanceId?: number | string
    /**
     * Override the sidebar content. Defaults to <ActivitySidebar> when instanceId is present.
     * Pass `null` to explicitly disable the sidebar.
     */
    sidebar?: React.ReactNode | null
    /**
     * Extra footer actions (e.g., Confirm, Cancel, Anular).
     * Rendered inside the sticky footer. The consumer is responsible for
     * placing Cancel/Submit on the right and danger actions on the left.
     */
    footer?: React.ReactNode
    /**
     * Read-only mode for entities without an editable form
     * (StockMove, BankStatement, POSSession, Attachment).
     * Hides the footer, renders children as a read-only detail view.
     */
    readonly?: boolean
    /** Additional classes for the root container */
    className?: string
    /** Main content: form, editor, or read-only detail view */
    children: React.ReactNode
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * EntityDetailPage
 *
 * Shell for all `[id]/page.tsx` routes of entities registered in the
 * UniversalRegistry. Provides a sticky header (icon + displayId + breadcrumb),
 * a main split layout (form + optional ActivitySidebar), and an optional
 * sticky footer for actions.
 *
 * Convention: `/[module]/[entity-plural]/[id]`
 * See: docs/20-contracts/module-layout-navigation.md §7
 */

export function EntityDetailPage({
    entityType,
    title,
    displayId,
    icon,
    breadcrumb,
    instanceId,
    sidebar,
    footer,
    readonly = false,
    className,
    children,
}: EntityDetailPageProps) {
    const metadata = getEntityMetadata(entityType);
    
    // Resolve identity from registry if available
    const resolvedTitle = title || metadata?.title || "Detalle";
    const RegistryIcon = metadata?.icon;

    // Resolve sidebar: explicit override → auto ActivitySidebar → nothing
    const resolvedSidebar = React.useMemo(() => {
        if (sidebar !== undefined) return sidebar  // explicit (including null)
        if (instanceId !== undefined) {
            return (
                <ActivitySidebar
                    entityId={instanceId}
                    entityType={entityType}
                />
            )
        }
        return null
    }, [sidebar, instanceId, entityType])

    const showSidebar = resolvedSidebar !== null && resolvedSidebar !== undefined

    return (
        <div
            className={cn(
                "flex flex-col min-h-0 flex-1 bg-background",
                className
            )}
            data-testid="entity-detail-page"
        >
            {/* ── Sticky Header ── */}
            <header
                className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b shrink-0"
                data-testid="entity-detail-header"
            >
                <div className="flex items-center gap-3 px-6 py-3">
                    {/* Icon */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                        {RegistryIcon ? (
                            <RegistryIcon className="h-4 w-4 text-primary" />
                        ) : (
                            <DynamicIcon name={icon || 'package'} className="h-4 w-4 text-primary" />
                        )}
                    </div>

                    {/* Title block */}
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-baseline gap-2">
                            {displayId && (
                                <span className="font-mono text-xs text-muted-foreground">
                                    {displayId}
                                </span>
                            )}
                            <h1 className="text-sm font-semibold text-foreground truncate">
                                {resolvedTitle}
                            </h1>
                        </div>

                        {/* Breadcrumb */}
                        <nav
                            aria-label="Breadcrumb"
                            className="flex items-center gap-1 text-xs text-muted-foreground"
                        >
                            {breadcrumb.map((item, index) => (
                                <React.Fragment key={item.href}>
                                    {index > 0 && (
                                        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                                    )}
                                    <Link
                                        href={item.href}
                                        className="hover:text-foreground transition-colors truncate max-w-[120px]"
                                    >
                                        {item.label}
                                    </Link>
                                </React.Fragment>
                            ))}
                        </nav>
                    </div>

                    {/* Read-only badge */}
                    {readonly && (
                        <span
                            className="ml-auto text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium shrink-0"
                            data-testid="entity-detail-readonly-badge"
                        >
                            Solo lectura
                        </span>
                    )}
                </div>
            </header>

            {/* ── Main content with optional sidebar ── */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
                <FormSplitLayout
                    sidebar={resolvedSidebar ?? undefined}
                    showSidebar={showSidebar}
                    className={cn(
                        "px-6 py-4",
                        readonly && "opacity-100"  // no visual change, but semantically different
                    )}
                >
                    {children}
                </FormSplitLayout>
            </div>

            {/* ── Sticky Footer (only when not readonly and footer provided) ── */}
            {!readonly && footer && (
                <footer
                    className="sticky bottom-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t shrink-0 px-6 py-3"
                    data-testid="entity-detail-footer"
                >
                    {footer}
                </footer>
            )}
        </div>
    )
}
