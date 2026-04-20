"use client"

import * as React from "react"
import Link from "next/link"
import { Plus, LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DynamicIcon } from "@/components/ui/dynamic-icon"
import { cn } from "@/lib/utils"

interface ToolbarCreateButtonProps extends Omit<React.ComponentProps<typeof Button>, "children"> {
    label: string
    icon?: LucideIcon
    iconName?: string
    href?: string
}

export function ToolbarCreateButton({
    label,
    icon: Icon,
    iconName,
    href,
    className,
    ...props
}: ToolbarCreateButtonProps) {
    const renderIcon = () => {
        if (iconName) return <DynamicIcon name={iconName} className="h-3.5 w-3.5 mr-2" />
        if (Icon) return <Icon className="h-3.5 w-3.5 mr-2" />
        return <Plus className="h-3.5 w-3.5 mr-2" />
    }

    const button = (
        <Button
            className={cn(
                "h-9 px-4 rounded-md text-[10px] font-bold uppercase tracking-widest shadow-sm",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                className
            )}
            {...props}
        >
            {renderIcon()}
            {label}
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
