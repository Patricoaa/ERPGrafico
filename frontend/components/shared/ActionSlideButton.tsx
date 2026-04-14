"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface ActionSlideButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'destructive' | 'success';
}

export const ActionSlideButton = React.forwardRef<HTMLButtonElement, ActionSlideButtonProps>(
    ({ className, variant = 'primary', children, ...props }, ref) => {
        const isPrimary = variant === 'primary';
        const isDestructive = variant === 'destructive';
        const isSuccess = variant === 'success';

        return (
            <button
                ref={ref}
                className={cn(
                    "relative inline-flex items-center justify-center overflow-hidden z-10 transition-colors duration-300 ease-out",
                    "h-10 px-6 text-sm font-bold tracking-widest uppercase rounded-none",
                    "border-2",
                    isPrimary && "border-primary text-primary hover:text-primary-foreground",
                    isDestructive && "border-destructive text-destructive hover:text-destructive-foreground",
                    isSuccess && "border-success text-success hover:text-success-foreground",
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
                    {children}
                </span>
            </button>
        );
    }
);

ActionSlideButton.displayName = "ActionSlideButton";
