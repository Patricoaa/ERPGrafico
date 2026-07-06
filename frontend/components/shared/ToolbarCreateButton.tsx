"use client"

import * as React from "react"
import Link from "next/link"
import { Plus, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DynamicIcon } from '@/components/shared'
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
    size: _size,
    ...props
}: ToolbarCreateButtonProps) {
    const renderIcon = () => {
        if (iconName) return <DynamicIcon name={iconName} className="h-3.5 w-3.5 mr-2" />
        if (Icon) return <Icon className="h-3.5 w-3.5 mr-2" />
        return <Plus className="h-3.5 w-3.5 mr-2" />
    }

    const buttonContent = (
        <Button
            size="sm"
            className={cn(
                "px-4 font-semibold tracking-widest gap-1 rounded-sm shrink-0 cursor-pointer",
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
                {buttonContent}
            </Link>
        )
    }

    return buttonContent
}
