"use client"

import React, { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface Option {
    id: string | number
    label: string
    description?: string
    icon?: React.ReactNode
}

interface ModalSelectorProps {
    options: Option[]
    value: string | number | null
    onChange: (value: any) => void
    title: string
    placeholder?: string
    triggerClassName?: string
    disabled?: boolean
}

export function ModalSelector({
    options,
    value,
    onChange,
    title,
    placeholder = "Seleccionar opción...",
    triggerClassName,
    disabled = false
}: ModalSelectorProps) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")

    const selectedOption = options.find(o => o.id.toString() === value?.toString())

    const filteredOptions = options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        o.description?.toLowerCase().includes(search.toLowerCase())
    )

    const handleSelect = (option: Option) => {
        onChange(option.id)
        setOpen(false)
        setSearch("")
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        "w-full justify-between h-12 px-4 rounded-xl text-left font-medium bg-background border-2 border-muted hover:border-primary/50 transition-all",
                        triggerClassName
                    )}
                >
                    <span className="truncate">
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md w-[95vw] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-6 bg-primary text-primary-foreground">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight">
                        {title}
                    </DialogTitle>
                </DialogHeader>

                <div className="p-4 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 h-10 rounded-xl"
                        />
                    </div>

                    <ScrollArea className="h-[40vh] -mx-2 px-2">
                        <div className="grid grid-cols-1 gap-2 pb-4">
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map((option) => {
                                    const isSelected = option.id.toString() === value?.toString()
                                    return (
                                        <button
                                            key={option.id}
                                            onClick={() => handleSelect(option)}
                                            className={cn(
                                                "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all w-full text-left",
                                                isSelected
                                                    ? "border-primary bg-primary/5 shadow-sm"
                                                    : "border-muted bg-card hover:bg-muted/30"
                                            )}
                                        >
                                            {option.icon && (
                                                <div className="p-2 rounded-lg bg-background border">
                                                    {option.icon}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-sm">
                                                    {option.label}
                                                </div>
                                                {option.description && (
                                                    <div className="text-[10px] text-muted-foreground truncate">
                                                        {option.description}
                                                    </div>
                                                )}
                                            </div>
                                            {isSelected && (
                                                <Check className="h-5 w-5 text-primary" />
                                            )}
                                        </button>
                                    )
                                })
                            ) : (
                                <div className="text-center py-12 text-muted-foreground">
                                    No se encontraron resultados
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    )
}
