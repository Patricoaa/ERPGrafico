"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
    title: string
    description?: string
    icon?: LucideIcon
    titleActions?: React.ReactNode // For buttons next to the title
    children?: React.ReactNode // For actions/buttons on the right
    className?: string
}

/**
 * Reusable Page Header component for consistent titles and descriptions.
 * Supports an optional action area on the right and actions next to the title.
 */
import { motion } from "framer-motion"

export function PageHeader({ title, description, icon: Icon, titleActions, children, className }: PageHeaderProps) {
    return (
        <div className={cn("flex flex-col md:flex-row md:items-end justify-between gap-6 py-8 pb-12 border-b border-border/40 mb-8 relative overflow-hidden", className)}>
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 opacity-[0.03] pointer-events-none select-none">
                <div className="text-[200px] font-black tracking-tighter leading-none uppercase font-heading">
                    {title}
                </div>
            </div>

            <div className="space-y-4 relative z-10">
                <div className="flex flex-col gap-2">
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="flex items-center gap-4"
                    >
                        {Icon && (
                            <div className="p-3 rounded-2xl bg-primary/10 text-primary shadow-sm border border-primary/5">
                                <Icon className="h-6 w-6" />
                            </div>
                        )}
                        <h1 className="text-4xl md:text-6xl font-black tracking-[-0.04em] leading-[0.9] font-heading">
                            {title}
                        </h1>
                    </motion.div>

                    {titleActions && (
                        <motion.div
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="flex items-center"
                        >
                            {titleActions}
                        </motion.div>
                    )}
                </div>

                {description && (
                    <motion.p
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="text-muted-foreground text-sm md:text-lg max-w-2xl font-medium tracking-tight leading-relaxed"
                    >
                        {description}
                    </motion.p>
                )}

                {/* Decoration line */}
                <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.4, duration: 0.8 }}
                    className="h-[2px] w-24 bg-accent origin-left"
                />
            </div>

            {children && (
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center gap-3 relative z-10"
                >
                    {children}
                </motion.div>
            )}
        </div>
    )
}

interface PageHeaderButtonProps extends React.ComponentProps<typeof Button> {
    icon?: LucideIcon
    label?: string
    circular?: boolean
}

/**
 * A consistent button for the PageHeader.
 * Supports a "circular" variant for icon-only buttons.
 */
export function PageHeaderButton({ icon: Icon, label, circular, className, ...props }: PageHeaderButtonProps) {
    return (
        <Button
            className={cn(
                circular ? "rounded-full aspect-square p-0 w-10 h-10" : "rounded-lg px-4",
                className
            )}
            {...props}
        >
            {Icon && <Icon className={cn("h-4 w-4", label ? "mr-2" : "")} />}
            {label && <span>{label}</span>}
        </Button>
    )
}
