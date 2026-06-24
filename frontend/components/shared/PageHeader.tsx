"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { ActionFoldButton, DynamicIcon } from '@/components/shared'
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import type { NavigationConfig } from "@/components/providers/HeaderProvider"

export type PageHeaderStatusType = 'synced' | 'saving' | 'error' | 'warning' | 'info'

export interface PageHeaderStatus {
    label: string
    type?: PageHeaderStatusType
    icon?: LucideIcon
    iconName?: string
}

export interface SectionTab {
    value: string
    label: string
    href: string
}

interface PageHeaderProps {
    /** The main title of the page */
    title: string
    /** Optional description text below the title */
    description?: string
    /** Lucide icon component to display next to the title */
    icon?: LucideIcon
    /** Name of the icon to display via DynamicIcon */
    iconName?: string
    /** Actions to display immediately to the right of the title */
    titleActions?: React.ReactNode
    /** Global loading state for the header */
    isLoading?: boolean
    /** Status indicator (e.g., "Synced", "Saving") */
    status?: PageHeaderStatus
    /** 
     * Visual variant:
     * - 'default': Includes bottom border and standard margin (default)
     * - 'minimal': No border and reduced margin, ideal for integrated tabs
     */
    variant?: 'default' | 'minimal'
    /** Additional CSS classes for the container */
    className?: string
    /** Optional children rendered inside the header area */
    children?: React.ReactNode
    /** Navigation config for dropdown tabs in the header bar */
    navigation?: NavigationConfig
    /** Section tabs rendered as a TabBar below the header navigation */
    sectionTabs?: SectionTab[]
}

/**
 * Reusable Page Header component for consistent titles and descriptions.
 * Supports loading states, status indicators, and right-side actions.
 */
import { useHeader } from "@/components/providers/HeaderProvider"
import { useEffect } from "react"
import { TabBar } from '@/components/shared'

export function PageHeader({ 
    title, 
    description, 
    icon: Icon, 
    iconName, 
    titleActions, 
    isLoading,
    status,
    children, 
    className,
    navigation,
    sectionTabs 
}: PageHeaderProps) {
    const { setHeader, clearHeader } = useHeader()
    const pathname = usePathname()
    const router = useRouter()

    // Sync header config to global provider
    useEffect(() => {
        setHeader({
            title,
            description,
            icon: Icon,
            iconName,
            titleActions,
            isLoading,
            status,
            children,
            navigation
        })

        return () => {
            clearHeader()
        }
    }, [
        title, 
        description, 
        Icon,
        iconName, 
        titleActions, 
        isLoading, 
        status, 
        children, 
        navigation,
        setHeader,
        clearHeader
    ])

    // Section tabs rendered below the header navigation
    if (sectionTabs) {
        const activeTab = sectionTabs.find(
            t => pathname === t.href || pathname.startsWith(t.href + '/')
        )?.value || sectionTabs[0]?.value

        return (
            <div className="shrink-0 flex justify-start px-6 py-2 border-b border-border bg-background">
                <TabBar
                    items={sectionTabs.map(t => ({ value: t.value, label: t.label }))}
                    value={activeTab}
                    onValueChange={(value) => {
                        const tab = sectionTabs.find(t => t.value === value)
                        if (tab) router.push(tab.href)
                    }}
                    variant="toolbar"
                    className="w-auto flex-none"
                >
                    <div className="hidden" />
                </TabBar>
            </div>
        )
    }

    // This component now renders nothing in-place,
    // as the header is handled by DashboardShell
    return null
}

interface PageHeaderButtonProps extends React.ComponentProps<typeof Button> {
    icon?: LucideIcon
    iconName?: string
    label?: string
    circular?: boolean
    href?: string
}

/**
 * A consistent button for the PageHeader.
 * Supports a "circular" variant for icon-only buttons.
 */
export function PageHeaderButton({ icon: Icon, iconName, label, circular, href, className, title, ...props }: PageHeaderButtonProps) {
    if (circular) {
        const foldIcon = iconName ? (
            <DynamicIcon name={iconName} className="h-5 w-5" />
        ) : Icon ? (
            <Icon className="h-5 w-5" />
        ) : undefined;
        
        const btn = (
            <ActionFoldButton icon={foldIcon} className={className} title={title} {...props} />
        );
        return href ? <Link href={href} scroll={false}>{btn}</Link> : btn;
    }

    const button = (
        <Button
            className={cn(
                "transition-all duration-300 rounded-md px-4",
                className
            )}
            title={title}
            {...props}
        >
            {iconName ? (
                <DynamicIcon name={iconName} className={cn("h-4 w-4", label ? "mr-2" : "")} />
            ) : Icon && (
                <Icon className={cn("h-4 w-4", label ? "mr-2" : "")} />
            )}
            {label && <span>{label}</span>}
        </Button>
    )

    if (href) {
        return (
            <Link href={href} scroll={false}>
                {button}
            </Link>
        )
    }

    return button
}
