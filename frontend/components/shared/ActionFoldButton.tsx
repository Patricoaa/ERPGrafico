"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import React from "react";

export interface ActionFoldButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon?: React.ReactNode;
    text?: string;
}

export const ActionFoldButton = React.forwardRef<HTMLButtonElement, ActionFoldButtonProps>(
    ({ className, icon, text = "NUEVO", ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "group relative flex items-center justify-start overflow-hidden transition-all duration-300 ease-in-out",
                    "w-[40px] h-[40px] bg-primary border-none rounded-none cursor-pointer",
                    "hover:w-[125px]",
                    "active:translate-x-[2px] active:translate-y-[2px]",
                    className
                )}
                {...props}
            >
                {/* The icon sign */}
                <div className={cn(
                    "w-full h-full text-primary-foreground transition-all duration-300 ease-in-out flex items-center justify-center shrink-0",
                    "group-hover:w-[35%] group-hover:justify-center group-hover:pl-1"
                )}>
                    {icon || <Plus className="w-5 h-5" />}
                </div>

                {/* The text */}
                <div className={cn(
                    "absolute right-0 flex items-center h-full text-primary-foreground text-xs font-heading font-bold uppercase tracking-widest",
                    "transition-all duration-300 ease-in-out opacity-0 w-0",
                    "group-hover:opacity-100 group-hover:w-[65%] group-hover:pr-3"
                )}>
                    <span className="truncate">{text}</span>
                </div>
            </button>
        );
    }
);

ActionFoldButton.displayName = "ActionFoldButton";
