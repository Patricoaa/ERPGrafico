"use client"

import React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Drawer } from "./Drawer"

export interface StatCardConfig {
    label: string
    value: React.ReactNode
    icon?: LucideIcon
    accent?: "primary" | "info" | "success" | "warning" | "destructive" | "accent" | "muted"
    subtext?: string
}

interface TimelineEvent {
    date: string
    label: string
    description?: string
    status?: "success" | "warning" | "destructive" | "neutral"
}

export interface Section {
    type: "cards" | "chart" | "timeline" | "table"
    title: string
    props: Record<string, unknown>
}

interface EntityStatsBottomSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description?: string
    icon?: LucideIcon
    sections: Section[]
}

function CardsGrid({ cards }: { cards: StatCardConfig[] }) {
    const accentBorder = {
        primary: "border-l-primary",
        info: "border-l-info",
        success: "border-l-success",
        warning: "border-l-warning",
        destructive: "border-l-destructive",
        accent: "border-l-accent",
        muted: "border-l-muted",
    } as const

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {cards.map((card, i) => {
                const Icon = card.icon
                return (
                    <div
                        key={i}
                        className={cn(
                            "rounded-lg border border-border/50 bg-card p-3 shadow-sm",
                            "border-l-4",
                            accentBorder[card.accent || "muted"],
                        )}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                {card.label}
                            </span>
                            {Icon && (
                                <div className={cn(
                                    "p-1 rounded-md",
                                    card.accent === "primary" && "bg-primary/10 text-primary",
                                    card.accent === "warning" && "bg-warning/10 text-warning-foreground",
                                    card.accent === "success" && "bg-success/10 text-success",
                                    card.accent === "destructive" && "bg-destructive/10 text-destructive",
                                    card.accent === "info" && "bg-info/10 text-info",
                                    card.accent === "accent" && "bg-accent/10 text-accent-foreground",
                                    (!card.accent || card.accent === "muted") && "bg-muted/30 text-muted-foreground",
                                )}>
                                    <Icon className="h-3.5 w-3.5" />
                                </div>
                            )}
                        </div>
                        <div className="text-lg font-black font-heading tracking-tighter text-foreground">
                            {card.value}
                        </div>
                        {card.subtext && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">{card.subtext}</p>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

function TimelineView({ events }: { events: TimelineEvent[] }) {
    if (!events.length) {
        return (
            <p className="text-sm text-muted-foreground italic py-4 text-center">
                Sin eventos próximos
            </p>
        )
    }

    const statusColor = {
        success: "bg-success border-success/30",
        warning: "bg-warning border-warning/30",
        destructive: "bg-destructive border-destructive/30",
        neutral: "bg-muted border-border",
    }

    return (
        <div className="space-y-0">
            {events.map((event, i) => (
                <div key={i} className="flex gap-3 pb-4 relative last:pb-0">
                    <div className="flex flex-col items-center">
                        <div className={cn(
                            "w-2.5 h-2.5 rounded-full border-2 mt-1.5 shrink-0",
                            statusColor[event.status || "neutral"],
                        )} />
                        {i < events.length - 1 && (
                            <div className="w-px flex-1 bg-border/50 mt-1" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">
                                {event.date}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                                {event.label}
                            </span>
                        </div>
                        {event.description && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                {event.description}
                            </p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}

function SummaryTable({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
    return (
        <div className="rounded-lg border border-border/50 overflow-hidden">
            {rows.map((row, i) => (
                <div
                    key={i}
                    className={cn(
                        "flex items-center justify-between px-4 py-2.5",
                        i % 2 === 0 ? "bg-card" : "bg-muted/20",
                    )}
                >
                    <span className="text-xs font-medium text-muted-foreground">
                        {row.label}
                    </span>
                    <span className="text-xs font-bold text-foreground">
                        {row.value}
                    </span>
                </div>
            ))}
        </div>
    )
}

export function EntityStatsBottomSheet({
    open,
    onOpenChange,
    title,
    description,
    icon,
    sections,
}: EntityStatsBottomSheetProps) {
    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            title={title}
            description={description}
            icon={icon}
            side="bottom"
            defaultSize="80vh"
            resizable
        >
            <div className="px-6 pb-6 space-y-6">
                {sections.map((section, i) => (
                    <div key={i}>
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3">
                            {section.title}
                        </h4>
                        {section.type === "cards" && (
                            <CardsGrid cards={section.props.cards as StatCardConfig[]} />
                        )}
                        {section.type === "chart" && (
                            <div className="rounded-lg border border-border/50 bg-card p-4">
                                {section.props.children as React.ReactNode}
                            </div>
                        )}
                        {section.type === "timeline" && (
                            <div className="rounded-lg border border-border/50 bg-card p-4">
                                <TimelineView events={section.props.events as TimelineEvent[]} />
                            </div>
                        )}
                        {section.type === "table" && (
                            <SummaryTable rows={section.props.rows as { label: string; value: React.ReactNode }[]} />
                        )}
                    </div>
                ))}
            </div>
        </Drawer>
    )
}
