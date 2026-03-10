
"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Search, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import api from "@/lib/api"
import { useDebounce } from "@/hooks/use-debounce"

interface Group {
    id: number
    name: string
}

interface GroupSelectorProps {
    value?: string | null // Group name
    onChange: (value: string | null) => void
    placeholder?: string
    disabled?: boolean
}

export function GroupSelector({ value, onChange, placeholder = "Seleccionar grupo...", disabled = false }: GroupSelectorProps) {
    const [open, setOpen] = useState(false)
    const [groups, setGroups] = useState<Group[]>([])
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const debouncedSearch = useDebounce(searchTerm, 500)

    // In this case, value is the NAME of the group, not ID, as per our plan to store name in assigned_group
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)

    // Fetch initial selected group (by name match)
    // We fetch all or search by name to confirm validity? 
    // For now, if value is present, we might assume it's valid or try to find it in the list.
    // Ideally we should have an endpoint to get by name, but list is okay.

    const fetchGroups = async (search = "") => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (search) params.append('search', search)

            // Since we don't have search on the ViewSet (ReadOnlyModelViewSet default might not have search configured?),
            // we should double check if we added SearchFilter to GroupViewSet.
            // If not, we might get all groups. Groups are usually few, so getting all is fine.

            const res = await api.get(`/core/groups/`)
            // Standard ViewSet returns list or pagination. 
            // If we didn't set pagination, it might be list.
            const list = Array.isArray(res.data) ? res.data : (res.data.results || [])

            let filtered = list
            if (search) {
                // Client side filtering if backend doesn't support it yet
                const lower = search.toLowerCase()
                filtered = list.filter((g: Group) => g.name.toLowerCase().includes(lower))
            }

            setGroups(filtered)

            // Sync selected
            if (value && !selectedGroup) {
                const found = list.find((g: Group) => g.name === value)
                if (found) setSelectedGroup(found)
            }
        } catch (error) {
            console.error("Error fetching groups", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (open) {
            fetchGroups(debouncedSearch)
        }
    }, [debouncedSearch, open])

    // Also fetch on mount/value change to set label if possible?
    useEffect(() => {
        if (value && !selectedGroup) {
            // Need to fetch at least once to get the object with ID if we wanted ID,
            // but we have name. We need the object mainly for consistency in UI logic.
            fetchGroups()
        } else if (!value) {
            setSelectedGroup(null)
        }
    }, [value])

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
                    className="w-full justify-between h-10"
                    disabled={disabled}
                >
                    {selectedGroup ? (
                        <span className="truncate">{selectedGroup.name}</span>
                    ) : value ? (
                        <span className="truncate">{value}</span> // Fallback if object not found but value exists
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
                        {loading ? (
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
