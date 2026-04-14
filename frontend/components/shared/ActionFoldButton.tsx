"use client";

import React from "react";
import { Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface ActionFoldButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon?: React.ReactNode;
}

export const ActionFoldButton = React.forwardRef<HTMLButtonElement, ActionFoldButtonProps>(
    ({ className, icon, ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "relative group flex justify-center items-center overflow-hidden border-2 border-primary/40 bg-card transition-all duration-300",
                    "w-10 h-10 rounded-none",
                    className
                )}
                {...props}
            >
                {/* The animated fold/triangle */}
                <div 
                    className={cn(
                        "absolute top-0 right-0 w-0 h-0 transition-all duration-300 ease-in-out z-0",
                        "border-solid border-transparent border-r-primary",
                        "border-t-0 border-l-0",
                        "border-r-[16px] border-b-[16px]",
                        "group-hover:border-r-[80px] group-hover:border-b-[80px]",
                        "group-focus-visible:border-r-[80px] group-focus-visible:border-b-[80px]"
                    )}
                />
                
                {/* The icon */}
                <div className="z-10 text-primary transition-all duration-300 ease-in-out group-hover:text-primary-foreground group-hover:rotate-180 group-focus-visible:text-primary-foreground group-focus-visible:rotate-180 flex items-center justify-center w-full h-full">
                    {icon || <Plus weight="bold" className="w-6 h-6" />}
                </div>
            </button>
        );
    }
);
ActionFoldButton.displayName = "ActionFoldButton";
