"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Loader2, type LucideIcon } from "lucide-react";

export interface ActionSlideButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'destructive' | 'success' | 'cmyk';
    /** Show loading spinner and disable interaction */
    loading?: boolean;
    /** Leading icon (Lucide component or instance) */
    icon?: React.ReactNode | LucideIcon;
}

/**
 * ActionSlideButton
 *
 * Primary kinetic interaction component: a bordered button whose background
 * slides in from left on hover, revealing a filled state.
 *
 * Usage:
 * - Primary processes: confirm order, save, submit
 * - Destructive: cancel, delete (with `variant="destructive"`)
 * - Success: complete, finalize (with `variant="success"`)
 *
 * Supports `loading` (spinner + disabled) and `icon` (leading Lucide icon).
 */
export const ActionSlideButton = React.forwardRef<HTMLButtonElement, ActionSlideButtonProps>(
    ({ className, variant = 'cmyk', loading = false, icon, disabled, children, ...props }, ref) => {
        const isPrimary = variant === 'primary';
        const isDestructive = variant === 'destructive';
        const isSuccess = variant === 'success';
        const isCmyk = variant === 'cmyk';
        const isDisabled = disabled || loading;

        return (
            <button
                ref={ref}
                disabled={isDisabled}
                className={cn(
                    "relative flex items-center justify-center overflow-hidden transition-all duration-300 ease-out cursor-pointer",
                    "h-9 px-4 text-[10px] font-black tracking-widest uppercase rounded-sm shadow-card",
                    "border",
                    isPrimary && "text-primary hover:text-primary-foreground bg-primary/5 border-primary",
                    isDestructive && "border-destructive text-destructive hover:text-destructive-foreground bg-destructive/5",
                    isSuccess && "border-success text-success hover:text-success-foreground bg-success/5",
                    isCmyk && "border-border/50 text-foreground hover:text-white bg-transparent",
                    isDisabled && "opacity-50 cursor-not-allowed pointer-events-none",
                    "group",
                    className
                )}
                {...props}
            >
                {/*
                  Slide background: Starts at -100% X offset, slides to 0% on hover.
                  Uses slightly more than 100% (-101%) to prevent subpixel bleeding lines.
                */}
                <div
                    className={cn(
                        "absolute inset-0 transition-transform duration-300 ease-out transform -translate-x-[100%]",
                        "group-hover:translate-x-0 group-focus-visible:translate-x-0 group-active:translate-x-0",
                        isPrimary && "bg-primary",
                        isDestructive && "bg-destructive",
                        isSuccess && "bg-success"
                    )}
                    {...(isCmyk ? { style: { background: 'var(--gradient-cmyk)' } as React.CSSProperties } : {})}
                />

                {/* Content wrapper to ensure text stays above the animated background */}
                <span className="relative z-10 flex items-center justify-center gap-2">
                    {loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        (() => {
                            if (!icon) return null;
                            if (typeof icon === 'function' || (typeof icon === 'object' && 'render' in icon)) {
                                const Icon = icon as React.ComponentType<{ className?: string }>;
                                return <Icon className="h-3.5 w-3.5" />;
                            }
                            return icon;
                        })()
                    )}
                    {children}
                </span>
            </button>
        );
    }
);

ActionSlideButton.displayName = "ActionSlideButton";
