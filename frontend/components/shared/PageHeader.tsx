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
    const isMinimal = variant === 'minimal'

    return (
        <div className={cn(
            "flex flex-col md:flex-row md:items-end justify-between gap-4 py-4 relative overflow-hidden transition-all duration-300",
            !isMinimal && "border-b border-border/40 mb-6",
            isMinimal && "mb-2",
            className
        )}>
            <div className="space-y-2 relative z-10 flex-1">
                <div className="flex flex-col gap-1">
                    <motion.div
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="flex items-center gap-3"
                    >
                        {/* Icon Slot with Loading Pulse */}
                        <div className={cn(
                            "relative p-2 rounded-lg bg-primary/10 text-primary shadow-sm border border-primary/5 shrink-0 transition-all duration-300",
                            isLoading && "animate-pulse"
                        )}>
                            {iconName ? (
                                <DynamicIcon name={iconName} className="h-5 w-5" />
                            ) : Icon ? (
                                <Icon className="h-5 w-5" />
                            ) : (
                                <div className="h-5 w-5" /> // Placeholder to keep layout
                            )}
                            
                            {isLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-lg">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                </div>
                            )}
                        </div>

                        {/* Title Slot */}
                        <div className="flex items-center gap-3">
                            {isLoading ? (
                                <Skeleton className="h-8 w-48 md:w-64" />
                            ) : (
                                <h1 className="text-2xl md:text-3xl font-black tracking-[-0.03em] leading-tight font-heading uppercase text-foreground">
                                    {title}
                                </h1>
                            )}

                            {/* Status Indicator */}
                            <AnimatePresence mode="wait">
                                {status && !isLoading && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        className={cn(
                                            "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-colors",
                                            status.type === 'synced' && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                                            status.type === 'saving' && "bg-primary/10 text-primary border-primary/20",
                                            status.type === 'error' && "bg-destructive/10 text-destructive border-destructive/20",
                                            status.type === 'warning' && "bg-amber-500/10 text-amber-600 border-amber-500/20",
                                            (status.type === 'info' || !status.type) && "bg-muted/50 text-muted-foreground border-border"
                                        )}
                                    >
                                        {status.type === 'synced' && <Check className="h-3 w-3" />}
                                        {status.type === 'saving' && <CloudUpload className="h-3 w-3 animate-pulse" />}
                                        {status.type === 'error' && <AlertCircle className="h-3 w-3" />}
                                        {status.icon && <status.icon className="h-3 w-3" />}
                                        {status.iconName && <DynamicIcon name={status.iconName} className="h-3 w-3" />}
                                        <span>{status.label}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>


                            {/* Title Actions Slot */}
                            {titleActions && !isLoading && (
                                <motion.div
                                    initial={{ x: -5, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                    className="flex items-center ml-2"
                                >
                                    {titleActions}
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                </div>

                {/* Description Slot */}
                {description && (
                    <motion.div
                        initial={{ y: 5, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1, duration: 0.4 }}
                    >
                        {isLoading ? (
                            <Skeleton className="h-4 w-full max-w-md mt-1" />
                        ) : (
                            <p className="text-muted-foreground text-xs md:text-sm max-w-2xl font-medium tracking-tight leading-snug">
                                {description}
                            </p>
                        )}
                    </motion.div>
                )}
            </div>

            {/* Right Side Actions Area */}
            {(children || configHref) && (
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center gap-2 relative z-10 shrink-0 self-center md:self-end"
                >
                    {children}
                    
                    {configHref && !isLoading && (
                        <div className="flex items-center ml-2 pl-2 border-l border-border/50">
                            <Link href={configHref}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all duration-300"
                                    title="Configuración de Módulo"
                                >
                                    <DynamicIcon name="settings" className="h-5 w-5" />
                                </Button>
                            </Link>
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    )
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
                    : "rounded-lg px-4",
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
