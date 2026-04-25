
"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Search, Loader2, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { useDebounce } from "@/hooks/use-debounce"
import { EmptyState } from "@/components/shared/EmptyState"
import { useGroupSearch } from "@/features/users/hooks/useGroupSearch"
import { AppGroup as Group } from "@/types/entities"

interface GroupSelectorProps {
    value?: string | null // Group name
    onChange: (value: string | null) => void
    placeholder?: string
    disabled?: boolean
    label?: string
    error?: string
}

export function GroupSelector({ value, onChange, placeholder = "Seleccionar grupo...", disabled = false, label, error }: GroupSelectorProps) {
    const { groups, loading: searchLoading, fetchGroups } = useGroupSearch()
    const [open, setOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const debouncedSearch = useDebounce(searchTerm, 500)

    // In this case, value is the NAME of the group, not ID, as per our plan to store name in assigned_group
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)

    // Handle fetching and syncing selected group
    useEffect(() => {
        if (open) {
            fetchGroups(debouncedSearch)
        }
    }, [debouncedSearch, open, fetchGroups])

    useEffect(() => {
        if (value && !selectedGroup) {
            // Fetch once if we need to map name to object (e.g. initial render)
            fetchGroups()
        } else if (!value) {
            requestAnimationFrame(() => setSelectedGroup(null))
        }
    }, [value])

    useEffect(() => {
        if (value && groups.length > 0) {
            const found = groups.find(g => g.name === value)
            if (found) {
                requestAnimationFrame(() => setSelectedGroup(found))
            }
        }
    }, [value, groups])

    const handleSelect = (group: Group) => {
        setSelectedGroup(group)
        onChange(group.name)
        setOpen(false)
        setSearchTerm("")
    }

    return (
        <div className="relative w-full flex flex-col group">
            <fieldset 
                className={cn(
                    "notched-field w-full group transition-all",
                    open && "focused",
                    error && "error",
                    disabled && "opacity-50 cursor-not-allowed bg-muted/10"
                )}
            >
                {label && (
                    <legend className={cn("notched-legend", error && "text-destructive", disabled && "text-muted-foreground/50")}>
                        {label}
                    </legend>
                )}
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between overflow-hidden h-auto py-2 px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent"
                    disabled={disabled}
                >
                    {selectedGroup ? (
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <Users className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <span className="font-medium text-sm truncate">{selectedGroup.name}</span>
                        </div>
                    ) : value ? (
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <Users className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <span className="font-medium text-sm truncate">{value}</span>
                        </div>
                    ) : (
                        <span className="text-muted-foreground truncate">{placeholder}</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <div className="p-2">
                    <div className="flex items-center px-3 border rounded-md mb-2 bg-background">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <input
                            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                            placeholder="Buscar grupo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto space-y-1">
                        {searchLoading ? (
                            <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                        ) : groups.length === 0 ? (
                            <EmptyState context="users" variant="compact" title="No se encontraron grupos" />
                        ) : (
                            groups.map((g) => (
                                <div
                                    key={g.id}
                                    className={cn(
                                        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                        selectedGroup?.id === g.id && "bg-accent"
                                    )}
                                    onClick={() => handleSelect(g)}
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium">{g.name}</span>
                                    </div>
                                    {selectedGroup?.id === g.id && (
                                        <Check className="ml-auto h-4 w-4 opacity-100" />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
        </fieldset>
            {error && (
                <p className="mt-1.5 text-[11px] font-medium text-destructive animate-in fade-in slide-in-from-top-1 w-full text-left px-1">
                    {error}
                </p>
            )}
        </div>
    )
}
