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
                <Button variant="outline" size="sm" className="h-9 border-dashed rounded-xl bg-background/50 backdrop-blur-sm">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {title}
                    {selectedSet.size > 0 && (
                        <>
                            <Separator orientation="vertical" className="mx-2 h-4" />
                            <Badge
                                variant="secondary"
                                className="rounded-sm px-1 font-normal lg:hidden"
                            >
                                {selectedSet.size}
                            </Badge>
                            <div className="hidden space-x-1 lg:flex">
                                {selectedSet.size > 2 ? (
                                    <Badge
                                        variant="secondary"
                                        className="rounded-sm px-1 font-normal"
                                    >
                                        {selectedSet.size} seleccionados
                                    </Badge>
                                ) : (
                                    options
                                        .filter((option) => selectedSet.has(option.value))
                                        .map((option) => (
                                            <Badge
                                                variant="secondary"
                                                key={option.value}
                                                className="rounded-sm px-1 font-normal"
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
            <PopoverContent className="w-[200px] p-0 rounded-xl border-sidebar-border/30 overflow-hidden shadow-2xl" align="start">
                <div className="flex flex-col p-1">
                    {options.map((option) => {
                        const isSelected = selectedSet.has(option.value)
                        return (
                            <div
                                key={option.value}
                                className={cn(
                                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                    isSelected ? "bg-accent/50" : ""
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
                                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                        isSelected
                                            ? "bg-primary text-primary-foreground"
                                            : "opacity-50 [&_svg]:invisible"
                                    )}
                                >
                                    <Check className={cn("h-4 w-4")} />
                                </div>
                                {option.icon && (
                                    <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                                )}
                                <span>{option.label}</span>
                            </div>
                        )
                    })}
                </div>
                {selectedSet.size > 0 && (
                    <>
                        <Separator />
                        <div className="p-1">
                            <Button
                                variant="ghost"
                                className="w-full justify-center text-xs"
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
