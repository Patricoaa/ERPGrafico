"use client"

import React from "react"
import { DrawerLayout } from "./DrawerLayout"

export interface FormSplitLayoutProps {
    /** Main form content or the Form component itself */
    children: React.ReactNode
    /** Sidebar content (usually Audit/Activity information) */
    sidebar?: React.ReactNode
    /** Whether to show the sidebar (typically only in edit mode) */
    showSidebar?: boolean
    /** Optional width override, defaults to w-72 */
    sidebarWidth?: string
    /** Additional classes for the form container */
    className?: string
    /**
     * When true the sidebar gets a collapse toggle (matching the OT Wizard pattern).
     * The collapsed state is managed internally; use `defaultCollapsed` to set the initial value.
     */
    collapsible?: boolean
    /** Initial collapsed state when `collapsible` is true. Defaults to false (expanded). */
    defaultCollapsed?: boolean
    /**
     * localStorage key used to persist the collapsed preference across sessions.
     * Omit to disable persistence.
     */
    collapseStorageKey?: string
}

/**
 * Backward-compatibility adapter for FormSplitLayout.
 * Delegates layout, riel collapse, and workspace scrolling to DrawerLayout.
 */
export function FormSplitLayout({
    children,
    sidebar,
    showSidebar = false,
    sidebarWidth = "w-72",
    className,
    collapsible = false,
    defaultCollapsed = false,
    collapseStorageKey,
}: FormSplitLayoutProps) {
    return (
        <DrawerLayout
            rightRail={showSidebar && sidebar ? sidebar : undefined}
            rightRailWidth={sidebarWidth}
            rightRailCollapsible={collapsible}
            rightRailDefaultCollapsed={defaultCollapsed}
            rightRailStorageKey={collapseStorageKey}
            noPadding
            contentClassName={className}
        >
            {children}
        </DrawerLayout>
    )
}

