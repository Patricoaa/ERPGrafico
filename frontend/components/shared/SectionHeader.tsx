"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { MoneyDisplay } from "./MoneyDisplay"

interface SectionHeaderProps {
    icon: LucideIcon
    title: string
    count?: number
    countLabel?: string
    totalAmount?: number
    href?: string
    variant?: "card" | "list"
}

export function SectionHeader({
    icon: Icon,
    title,
    count,
    countLabel,
    totalAmount,
    href,
    variant = "card",
}: SectionHeaderProps) {
    const router = useRouter()

    const heading = (
        <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-1.5">
            <Icon className="h-3 w-3" />
            {title}
            {count != null && (
                <>
                    <span className="font-normal text-border/60 mx-1">·</span>
                    <span className="font-normal">
                        {count}
                        {countLabel && <span className="text-border/60 ml-0.5">{countLabel}</span>}
                    </span>
                </>
            )}
            {totalAmount != null && (
                <>
                    <span className="font-normal text-border/60 mx-1">·</span>
                    <MoneyDisplay amount={totalAmount} showColor={false} className="text-[11px]" />
                </>
            )}
        </h2>
    )

    if (href && variant === "card") {
        return (
            <Button
                onClick={() => router.push(href)}
                className="w-full flex items-center justify-between group mb-3"
            >
                {heading}
                <span className="text-[10px] font-medium text-muted-foreground/0 group-hover:text-muted-foreground transition-all flex items-center gap-0.5">
                    Ver todas <ArrowRight className="h-3 w-3" />
                </span>
            </Button>
        )
    }

    return (
        <div className="flex items-center justify-between mb-3">
            {heading}
            {href && (
                <Button
                    onClick={() => router.push(href)}
                    className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                    Ver todos →
                </Button>
            )}
        </div>
    )
}
