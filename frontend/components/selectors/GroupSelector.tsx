
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
import { useGroupSearch } from "@/features/users/hooks/useGroupSearch"
import { AppGroup as Group } from "@/types/entities"

interface GroupSelectorProps {
    value?: string | null // Group name
    onChange: (value: string | null) => void
    placeholder?: string
    disabled?: boolean
}

export function GroupSelector({ value, onChange, placeholder = "Seleccionar grupo...", disabled = false }: GroupSelectorProps) {
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
            setSelectedGroup(null)
        }
    }, [value])

    useEffect(() => {
        if (value && groups.length > 0) {
            const found = groups.find(g => g.name === value)
            if (found) setSelectedGroup(found)
        }
    }, [value, groups])

    const handleSelect = (group: Group) => {
        setSelectedGroup(group)
        onChange(group.name)
        setOpen(false)
        setSearchTerm("")
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between h-auto py-2 px-3"
                    disabled={disabled}
                >
                    {selectedGroup ? (
                        <div className="flex items-center gap-2 truncate text-left">
                            <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                                <Users className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col items-start truncate leading-tight">
                                <span className="font-medium text-sm truncate w-full">{selectedGroup.name}</span>
                                <span className="text-[10px] text-muted-foreground truncate w-full">Grupo de Trabajo</span>
                            </div>
                        </div>
                    ) : value ? (
                        <div className="flex items-center gap-2 truncate text-left">
                            <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                                <Users className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col items-start truncate leading-tight">
                                <span className="font-medium text-sm truncate w-full">{value}</span>
                                <span className="text-[10px] text-muted-foreground truncate w-full">Grupo de Trabajo</span>
                            </div>
                        </div>
                    ) : (
                        <span className="text-muted-foreground">{placeholder}</span>
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
                            <div className="p-4 text-sm text-center text-muted-foreground">
                                No se encontraron grupos.
                            </div>
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
    )
}
