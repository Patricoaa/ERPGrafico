"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Loader2, type LucideIcon } from "lucide-react";

export interface ActionSlideButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'destructive' | 'success';
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
    ({ className, variant = 'primary', loading = false, icon, disabled, children, ...props }, ref) => {
        const isPrimary = variant === 'primary';
        const isDestructive = variant === 'destructive';
        const isSuccess = variant === 'success';
        const isDisabled = disabled || loading;

        return (
            <button
                ref={ref}
                disabled={isDisabled}
                className={cn(
                    "relative inline-flex items-center justify-center overflow-hidden z-10 transition-all duration-300 ease-out",
                    "h-9 px-5 text-[10px] font-black tracking-widest uppercase rounded-md shadow-sm",
                    "border",
                    isPrimary && "border-primary text-primary hover:text-primary-foreground bg-primary/5",
                    isDestructive && "border-destructive text-destructive hover:text-destructive-foreground bg-destructive/5",
                    isSuccess && "border-success text-success hover:text-success-foreground bg-success/5",
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
                        "absolute inset-0 -z-10 transition-transform duration-300 ease-out transform -translate-x-[101%]",
                        "group-hover:translate-x-0 group-focus-visible:translate-x-0 group-active:translate-x-0",
                        isPrimary && "bg-primary",
                        isDestructive && "bg-destructive",
                        isSuccess && "bg-success"
                    )}
                />
                
                {/* Content wrapper to ensure text stays above the animated background */}
                <span className="flex items-center justify-center gap-2">
                    {loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        (() => {
                            if (!icon) return null;
                            if (typeof icon === 'function' || (typeof icon === 'object' && 'render' in (icon as any))) {
                                const Icon = icon as any;
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
