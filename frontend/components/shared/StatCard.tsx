"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import React from "react"

type Accent = "primary" | "info" | "success" | "warning" | "destructive" | "accent" | "muted"
type Variant = "default" | "compact" | "minimal"
type ValueSize = "sm" | "md" | "lg" | "xl"

interface StatCardProps {
  label: string
  value: React.ReactNode
  icon?: LucideIcon
  subtext?: string
  trend?: { direction: "up" | "down"; value: string; label?: string }
  accent?: Accent
  variant?: Variant
  valueSize?: ValueSize
  href?: string
  onClick?: () => void
  active?: boolean
  loading?: boolean
  children?: React.ReactNode
  className?: string
}

const accentBorder = {
  primary: "border-l-primary",
  info: "border-l-info",
  success: "border-l-success",
  warning: "border-l-warning",
  destructive: "border-l-destructive",
  accent: "border-l-accent",
  muted: "border-l-muted",
} as const

const accentBg = {
  primary: "bg-primary/5 border-primary/10",
  info: "bg-info/5 border-info/10",
  success: "bg-success/5 border-success/10",
  warning: "bg-warning/5 border-warning/10",
  destructive: "bg-destructive/5 border-destructive/10",
  accent: "bg-accent/5 border-accent/10",
  muted: "bg-muted/30 border-border/40",
} as const

const accentText = {
  primary: "text-primary",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  accent: "text-accent",
  muted: "text-muted-foreground",
} as const

const accentIconBg = {
  primary: "bg-primary/10 text-primary border-primary/20",
  info: "bg-info/10 text-info border-info/20",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
  accent: "bg-accent/10 text-accent border-accent/20",
  muted: "bg-muted/30 text-muted-foreground border-border/40",
} as const

const activeRing = {
  primary: "ring-2 ring-primary ring-offset-2",
  info: "ring-2 ring-info ring-offset-2",
  success: "ring-2 ring-success ring-offset-2",
  warning: "ring-2 ring-warning ring-offset-2",
  destructive: "ring-2 ring-destructive ring-offset-2",
  accent: "ring-2 ring-accent ring-offset-2",
  muted: "ring-2 ring-muted-foreground ring-offset-2",
} as const

const valueSizeMap: Record<ValueSize, string> = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-3xl",
}

export function StatCard({
  label,
  value,
  icon: Icon,
  subtext,
  trend,
  accent = "primary",
  variant = "default",
  valueSize = "lg",
  href,
  onClick,
  active = false,
  loading = false,
  children,
  className,
}: StatCardProps) {
  const trendIcon = trend?.direction === "up" ? TrendingUp : TrendingDown
  const trendColor = trend?.direction === "up" ? "text-success" : "text-destructive"

  if (loading) {
    return (
      <div className={cn("rounded-lg border p-4 space-y-3 bg-card", className)} role="status" aria-label="Cargando">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    )
  }

  const wrapperClass =
    variant === "minimal"
      ? cn(
          "rounded-lg p-3",
          accentBg[accent],
          active && activeRing[accent],
          href && "block",
          className,
        )
      : undefined

  const Wrapper = variant === "minimal" ? React.Fragment : React.Fragment
  const Container = variant === "minimal" ? "div" : Card

  const containerProps =
    variant === "minimal"
      ? {
          className: wrapperClass,
          onClick,
          role: onClick ? "button" as const : undefined,
          tabIndex: onClick ? 0 : undefined,
          onKeyDown: onClick ? (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick() } } : undefined,
        }
      : {
          className: cn(
            "shadow-sm transition-shadow",
            variant === "default" && cn(accentBorder[accent], "border-l-4"),
            variant === "compact" && cn("border", accentBg[accent]),
            variant === "default" && !accent.startsWith("muted") && "hover:shadow-md",
            onClick && "cursor-pointer hover:border-primary/20",
            active && activeRing[accent],
            className,
          ),
          onClick,
          role: onClick ? "button" as const : undefined,
          tabIndex: onClick ? 0 : undefined,
          onKeyDown: onClick ? (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick() } } : undefined,
        }

  function renderArrowIcon() {
    if (!Icon) return null

    if (variant === "compact") {
      return (
        <div className={cn("p-1.5 rounded-md border", accentIconBg[accent])}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      )
    }

    if (variant === "default") {
      return <Icon className={cn("h-4 w-4", accentText[accent])} />
    }

    return null
  }

  function renderValue() {
    return (
      <div
        className={cn(
          valueSizeMap[valueSize],
          "font-black font-heading tracking-tighter",
          variant === "minimal" ? accentText[accent] : "text-foreground",
        )}
      >
        {value}
      </div>
    )
  }

  function renderSubtext() {
    if (trend) {
      const TrendIcon = trendIcon
      return (
        <div className={cn("flex items-center gap-1 mt-1", trendColor)}>
          <TrendIcon className="h-3 w-3" />
          <span className="text-xs font-bold">{trend.value}</span>
          {trend.label && <span className="text-xs text-muted-foreground">{trend.label}</span>}
        </div>
      )
    }

    if (subtext) {
      return <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
    }

    return null
  }

  let inner: React.ReactNode

  if (variant === "minimal") {
    inner = (
      <>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
          {label}
        </p>
        {renderValue()}
        {renderSubtext()}
        {children}
      </>
    )
  } else if (variant === "compact") {
    inner = (
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {renderArrowIcon()}
        </div>
        {renderValue()}
        {renderSubtext()}
        {children}
      </CardContent>
    )
  } else {
    inner = (
      <>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{label}</CardTitle>
          {renderArrowIcon()}
        </CardHeader>
        <CardContent>
          {renderValue()}
          {renderSubtext()}
          {children}
        </CardContent>
      </>
    )
  }

  const content = <Container {...containerProps}>{inner}</Container>

  if (href) {
    return (
      <Link href={href} className={cn("block outline-none", variant !== "minimal" && className)}>
        {content}
      </Link>
    )
  }

  return content
}
