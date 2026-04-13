"use client"

import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { DynamicIcon } from "@/components/ui/dynamic-icon"
import { LucideIcon, Loader2, Check, CloudUpload, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"

export type PageHeaderStatusType = 'synced' | 'saving' | 'error' | 'warning' | 'info'

export interface PageHeaderStatus {
    label: string
    type?: PageHeaderStatusType
    icon?: LucideIcon
    iconName?: string
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
    /** Right-side action area for buttons and controls */
    children?: React.ReactNode
    /** 
     * Optional URL for a configuration page. 
     * If provided, a settings gear icon will appear in titleActions.
     */
    configHref?: string
    /** Additional CSS classes for the container */
    className?: string
}

/**
 * Reusable Page Header component for consistent titles and descriptions.
 * Supports loading states, status indicators, and right-side actions.
 */
import { useHeader } from "@/components/providers/HeaderProvider"
import { useEffect } from "react"

export function PageHeader({ 
    title, 
    description, 
    icon: Icon, 
    iconName, 
    titleActions, 
    isLoading,
    status,
    variant = 'default',
    configHref,
    children, 
    className 
}: PageHeaderProps) {
    const { setHeader, clearHeader } = useHeader()

    // Sync header config to global provider
    useEffect(() => {
        // Defer update to next tick to avoid React warnings about state updates during mount/hydration
        // especially when parent is a Server Component and children are lazy-loaded
        const timer = setTimeout(() => {
            setHeader({
                title,
                description,
                iconName,
                titleActions,
                isLoading,
                status,
                configHref,
                children
            })
        }, 0)

        return () => {
            clearTimeout(timer)
            // Optional: only clear if we are still the active header
            // But since PageHeader usually defines the entire page's identity, clearing is fine.
        }
    }, [
        title, 
        description, 
        iconName, 
        titleActions, 
        isLoading, 
        status, 
        configHref, 
        children, 
        setHeader
    ])

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
    const button = (
        <Button
            className={cn(
                "transition-all duration-300",
                circular
                    ? "rounded-full aspect-square p-0 w-10 h-10 shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-105 active:scale-95" 
                    : "rounded-[0.25rem] px-4",
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
