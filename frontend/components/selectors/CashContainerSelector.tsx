"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Loader2, Vault, Wallet, Coins, Calculator } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import api from "@/lib/api"

interface CashContainer {
    id: number
    name: string
    container_type: string
    container_type_display: string
    current_balance: string
    is_active: boolean
}

interface CashContainerSelectorProps {
    value?: string | number | null
    onChange: (value: string | null) => void
    placeholder?: string
    type?: string // Filter by type
    disabled?: boolean
}

export function CashContainerSelector({ value, onChange, placeholder = "Seleccionar contenedor...", type, disabled }: CashContainerSelectorProps) {
    const [open, setOpen] = useState(false)
    const [containers, setContainers] = useState<CashContainer[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedContainer, setSelectedContainer] = useState<CashContainer | null>(null)

    useEffect(() => {
        const fetchContainers = async () => {
            setLoading(true)
            try {
                const res = await api.get('/treasury/cash-containers/?is_active=true')
                let results = res.data.results || res.data

                if (type) {
                    results = results.filter((c: any) => c.container_type === type)
                }

                setContainers(results)

                if (value) {
                    const found = results.find((c: any) => c.id.toString() === value.toString())
                    setSelectedContainer(found || null)
                } else {
                    setSelectedContainer(null)
                }
            } catch (error) {
                console.error("Error fetching cash containers", error)
            } finally {
                setLoading(false)
            }
        }

        if (open || value) {
            fetchContainers()
        }
    }, [open, type])

    // Sync if value changes externally
    useEffect(() => {
        if (value && containers.length > 0) {
            const found = containers.find((c: any) => c.id.toString() === value.toString())
            setSelectedContainer(found || null)
        } else if (!value) {
            setSelectedContainer(null)
        }
    }, [value, containers])

    const handleSelect = (container: CashContainer) => {
        setSelectedContainer(container || null)
        onChange(container ? container.id.toString() : null)
        setOpen(false)
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'SAFE': return <Vault className="h-4 w-4" />
            case 'PETTY_CASH': return <Wallet className="h-4 w-4" />
            case 'CHANGE_FUND': return <Coins className="h-4 w-4" />
            case 'TILL': return <Calculator className="h-4 w-4" />
            default: return <Wallet className="h-4 w-4" />
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                    disabled={disabled}
                >
                    {selectedContainer ? (
                        <div className="flex items-center gap-2 truncate">
                            {getIcon(selectedContainer.container_type)}
                            <span>{selectedContainer.name}</span>
                        </div>
                    ) : (
                        <span className="text-muted-foreground">{placeholder}</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <div className="p-2 max-h-[300px] overflow-y-auto space-y-1">
                    {loading && containers.length === 0 ? (
                        <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                    ) : containers.length === 0 ? (
                        <div className="p-4 text-sm text-center text-muted-foreground">No hay contenedores disponibles.</div>
                    ) : (
                        containers.map((c) => (
                            <div
                                key={c.id}
                                className={cn(
                                    "relative flex cursor-default select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                    selectedContainer?.id === c.id && "bg-accent"
                                )}
                                onClick={() => handleSelect(c)}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedContainer?.id === c.id ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        {getIcon(c.container_type)}
                                        <span className="font-medium">{c.name}</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">{c.container_type_display}</span>
                                </div>
                                <span className="ml-auto text-xs font-bold text-emerald-600">
                                    ${parseFloat(c.current_balance).toLocaleString()}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
