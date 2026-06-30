"use client"

import * as React from "react"
import Link from "next/link"
import { Plus, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DynamicIcon } from '@/components/shared'
import { SEG_WRAPPER, SEG_TRIGGER } from './SegmentationBar/styles'
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

    const buttonContent = (
        <div className={SEG_WRAPPER}>
            <Button
                className={cn(
                    SEG_TRIGGER + " px-4 cursor-pointer",
                    className
                )}
                {...props}
            >
                {renderIcon()}
                {label}
            </Button>
        </div>
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
