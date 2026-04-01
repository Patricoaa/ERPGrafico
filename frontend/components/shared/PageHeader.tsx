"use client"

import React from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { DynamicIcon } from "@/components/ui/dynamic-icon"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
    title: string
    description?: string
    icon?: LucideIcon
    iconName?: string
    titleActions?: React.ReactNode // For buttons next to the title
    children?: React.ReactNode // For actions/buttons on the right
    className?: string
}

/**
 * Reusable Page Header component for consistent titles and descriptions.
 * Supports an optional action area on the right and actions next to the title.
 */

export function PageHeader({ title, description, icon: Icon, iconName, titleActions, children, className }: PageHeaderProps) {
    return (
        <div className={cn("flex flex-col md:flex-row md:items-end justify-between gap-4 py-4 border-b border-border/40 mb-6 relative overflow-hidden", className)}>
            <div className="space-y-2 relative z-10">
                <div className="flex flex-col gap-1">
                    <motion.div
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="flex items-center gap-3"
                    >
                        {iconName ? (
                            <div className="p-2 rounded-xl bg-primary/10 text-primary shadow-sm border border-primary/5">
                                <DynamicIcon name={iconName} className="h-5 w-5" />
                            </div>
                        ) : Icon && (
                            <div className="p-2 rounded-xl bg-primary/10 text-primary shadow-sm border border-primary/5">
                                <Icon className="h-5 w-5" />
                            </div>
                        )}
                        <h1 className="text-2xl md:text-3xl font-black tracking-[-0.03em] leading-tight font-heading uppercase">
                            {title}
                        </h1>

                        {titleActions && (
                            <motion.div
                                initial={{ x: -5, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="flex items-center ml-2"
                            >
                                {titleActions}
                            </motion.div>
                        )}
                    </motion.div>
                </div>

                {description && (
                    <motion.p
                        initial={{ y: 5, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1, duration: 0.4 }}
                        className="text-muted-foreground text-xs md:text-sm max-w-2xl font-medium tracking-tight leading-snug"
                    >
                        {description}
                    </motion.p>
                )}
            </div>

            {children && (
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center gap-2 relative z-10"
                >
                    {children}
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
}

/**
 * A consistent button for the PageHeader.
 * Supports a "circular" variant for icon-only buttons.
 */
export function PageHeaderButton({ icon: Icon, iconName, label, circular, className, ...props }: PageHeaderButtonProps) {
    return (
        <Button
            className={cn(
                circular ? "rounded-full aspect-square p-0 w-10 h-10" : "rounded-lg px-4",
                className
            )}
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
}
