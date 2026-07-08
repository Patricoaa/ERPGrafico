"use client"

import { type ReactNode } from "react"
import { type LucideIcon } from "lucide-react"

interface StepHeaderProps {
    title: string
    description?: string
    icon?: LucideIcon
    rightContent?: ReactNode
}

export function StepHeader({ title, description, icon: Icon, rightContent }: StepHeaderProps) {
    return (
        <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex flex-col gap-1">
                <h3 className="font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
                    {Icon && <Icon className="h-5 w-5 text-primary shrink-0" />}
                    {title}
                </h3>
                {description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {description}
                    </p>
                )}
            </div>
            {rightContent && (
                <div className="shrink-0 flex items-center">
                    {rightContent}
                </div>
            )}
        </div>
    )
}
