"use client"

import * as React from "react"
import { Check, PlusCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"

interface FacetedFilterProps {
    title?: string
    options: {
        label: string
        value: string
        icon?: React.ComponentType<{ className?: string }>
    }[]
    selectedValues: string[]
    onSelect: (values: string[]) => void
}

export function FacetedFilter({
    title,
    options,
    selectedValues,
    onSelect,
}: FacetedFilterProps) {
    const selectedSet = new Set(selectedValues)

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" className="h-9 px-3 rounded-none text-[10px] uppercase font-bold tracking-widest hover:bg-muted/50 transition-all border-0 ring-0 focus-visible:ring-0">
                    <PlusCircle className="mr-2 h-3.5 w-3.5 opacity-50" />
                    <span>{title}</span>
                    {selectedSet.size > 0 && (
                        <>
                            <Separator orientation="vertical" className="mx-2 h-4" />
                            <Badge
                                variant="secondary"
                                className="rounded-sm px-1 font-bold text-[10px] lg:hidden bg-primary text-primary-foreground"
                            >
                                {selectedSet.size}
                            </Badge>
                            <div className="hidden space-x-1 lg:flex">
                                {selectedSet.size > 2 ? (
                                    <Badge
                                        variant="secondary"
                                        className="rounded-sm px-1 font-bold text-[10px] bg-primary text-primary-foreground tracking-tighter"
                                    >
                                        {selectedSet.size}
                                    </Badge>
                                ) : (
                                    options
                                        .filter((option) => selectedSet.has(option.value))
                                        .map((option) => (
                                            <Badge
                                                variant="secondary"
                                                key={option.value}
                                                className="rounded-sm px-1 font-bold text-[10px] bg-primary/10 text-primary tracking-tighter"
                                            >
                                                {option.label}
                                            </Badge>
                                        ))
                                )}
                            </div>
                        </>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0 rounded-md border-border/80 overflow-hidden shadow-xl" align="start">
                <div className="flex flex-col p-1">
                    {options.map((option) => {
                        const isSelected = selectedSet.has(option.value)
                        return (
                            <div
                                key={option.value}
                                className={cn(
                                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-[10px] uppercase font-bold tracking-tight outline-none hover:bg-accent hover:text-accent-foreground transition-colors",
                                    isSelected ? "bg-accent/50 text-primary" : "text-muted-foreground"
                                )}
                                onClick={() => {
                                    const newSelected = new Set(selectedValues)
                                    if (isSelected) {
                                        newSelected.delete(option.value)
                                    } else {
                                        newSelected.add(option.value)
                                    }
                                    onSelect(Array.from(newSelected))
                                }}
                            >
                                <div
                                    className={cn(
                                        "mr-2 flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-primary/50 transition-all",
                                        isSelected
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "opacity-50 [&_svg]:invisible"
                                    )}
                                >
                                    <Check className={cn("h-3 w-3")} />
                                </div>
                                {option.icon && (
                                    <option.icon className="mr-2 h-3.5 w-3.5 opacity-70" />
                                )}
                                <span className={cn(isSelected && "text-primary")}>{option.label}</span>
                            </div>
                        )
                    })}
                </div>
                {selectedSet.size > 0 && (
                    <>
                        <Separator className="opacity-50" />
                        <div className="p-1">
                            <Button
                                variant="ghost"
                                className="w-full justify-center text-[10px] font-bold uppercase tracking-widest h-8 hover:bg-destructive/10 hover:text-destructive rounded-sm"
                                onClick={() => onSelect([])}
                            >
                                Limpiar filtros
                            </Button>
                        </div>
                    </>
                )}
            </PopoverContent>
        </Popover>
    )
}
