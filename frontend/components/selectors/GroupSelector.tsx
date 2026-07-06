"use client"

import { useState, useEffect, useCallback } from "react"
import { Check, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"

import { useDebounce } from "@/hooks/useDebounce"
import { LabeledContainer, SearchablePopover } from '@/components/shared'
import { useGroupSearch } from "@/features/users/hooks/useGroupSearch"
import { type AppGroup as Group } from "@/types/entities"

interface GroupSelectorProps {
    value?: string | null // Group name
    onChange: (value: string | null) => void
    placeholder?: string
    disabled?: boolean
    label?: string
    error?: string
}

export function GroupSelector({ value, onChange, placeholder = "Seleccionar grupo...", disabled = false, label, error }: GroupSelectorProps) {
    const [open, setOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const debouncedSearch = useDebounce(searchTerm, 500)

    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)

    const shouldFetch = open || (!!value && !selectedGroup)
    const { groups, loading: searchLoading } = useGroupSearch(debouncedSearch, shouldFetch)

    useEffect(() => {
        if (!value) {
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

    const handleSelect = useCallback((group: Group) => {
        setSelectedGroup(group)
        onChange(group.name)
        setOpen(false)
        setSearchTerm("")
    }, [onChange])

    return (
        <LabeledContainer label={label} error={error} disabled={disabled}>
            <SearchablePopover
                open={open}
                onOpenChange={setOpen}
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                searchPlaceholder="Buscar grupo..."
                items={groups}
                isLoading={searchLoading}
                selectedId={selectedGroup?.id ?? null}
                getId={(g) => g.id}
                onSelect={handleSelect}
                renderItem={(group) => (
                    <>
                        <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-medium">{group.name}</span>
                        </div>
                        {selectedGroup?.id === group.id && (
                            <Check className="ml-auto h-4 w-4 shrink-0 opacity-100" />
                        )}
                    </>
                )}
                trigger={
                    <Button
                        variant="ghost"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between overflow-hidden h-[1.5rem] py-0 px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent"
                        disabled={disabled}
                    >
                        {(selectedGroup || value) ? (
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <Users className="h-3.5 w-3.5 shrink-0 text-primary" />
                                <span className="font-medium text-sm truncate">{selectedGroup?.name || value}</span>
                            </div>
                        ) : (
                            <span className="text-muted-foreground truncate">{placeholder}</span>
                        )}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                }
            />
        </LabeledContainer>
    )
}
