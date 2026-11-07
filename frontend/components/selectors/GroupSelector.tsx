"use client"

import { useState, useEffect, useCallback } from "react"
import { Check, Users } from "lucide-react"
import { Button } from "@/components/ui/button"

import { useDebounce } from "@/hooks/useDebounce"
import { LabeledContainer, SearchablePopover, SelectorItem, SelectorTrigger, SELECTOR_VALUE_CLASS } from '@/components/shared'
import { useGroupSearch, useSingleGroup } from "@/features/users/hooks/useGroupSearch"
import { type AppGroup as Group } from "@/types/entities"

interface GroupSelectorProps {
    value?: string | number | null
    onChange: (value: string | number | null) => void
    valueMode?: "name" | "id"
    placeholder?: string
    disabled?: boolean
    label?: string
    error?: string
    required?: boolean
    className?: string
    allowNone?: boolean
    noneLabel?: string
    variant?: 'standalone' | 'inline'
}

export function GroupSelector({
    value,
    onChange,
    valueMode = "name",
    placeholder = "Seleccionar...",
    disabled = false,
    label,
    error,
    required,
    className,
    allowNone = false,
    noneLabel = "Ninguno",
    variant = 'standalone'
}: GroupSelectorProps) {
    const [open, setOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const debouncedSearch = useDebounce(searchTerm, 500)

    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)

    const shouldFetch = open || (!!value && !selectedGroup)
    const { groups, loading: searchLoading } = useGroupSearch(debouncedSearch, shouldFetch)
    const selectedGroupId = valueMode === "id" && typeof value === "number" ? value : null
    const { group: fetchedSelectedGroup } = useSingleGroup(selectedGroupId)

    useEffect(() => {
        if (fetchedSelectedGroup) {
            requestAnimationFrame(() => setSelectedGroup(fetchedSelectedGroup))
        }
    }, [fetchedSelectedGroup])

    useEffect(() => {
        if (!value) {
            requestAnimationFrame(() => setSelectedGroup(null))
        }
    }, [value])

    useEffect(() => {
        if (value && groups.length > 0) {
            const found = groups.find(g => valueMode === "id" ? g.id === value : g.name === value)
            if (found) {
                requestAnimationFrame(() => setSelectedGroup(found))
            }
        }
    }, [value, valueMode, groups])

    const handleSelect = useCallback((group: Group) => {
        setSelectedGroup(group)
        onChange(valueMode === "id" ? group.id : group.name)
        setOpen(false)
        setSearchTerm("")
    }, [onChange, valueMode])

    const popover = (
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
                <SelectorItem
                    icon={<Users className="h-3.5 w-3.5 text-muted-foreground" />}
                    title={group.name}
                    selected={selectedGroup?.id === group.id}
                />
            )}
            trigger={
                <SelectorTrigger
                    hasValue={!!selectedGroup}
                    placeholder={placeholder}
                    variant={variant}
                    icon={<Users className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    open={open}
                    disabled={disabled}
                >
                    <span className={`${SELECTOR_VALUE_CLASS} truncate`}>{selectedGroup?.name ?? String(value ?? '')}</span>
                </SelectorTrigger>
            }
            beforeItems={allowNone ? (
                <Button
                    variant="ghost"
                    className="w-full justify-start text-sm hover:bg-muted"
                    onClick={() => { onChange(null); setOpen(false); setSearchTerm("") }}
                >
                    <span className="text-muted-foreground">{noneLabel}</span>
                    {!value && <Check className="ml-auto h-4 w-4 shrink-0" />}
                </Button>
            ) : undefined}
        />
    )

    if (variant === 'inline') return popover

    return (
        <LabeledContainer label={label} error={error} disabled={disabled} required={required} containerClassName={className}>
            {popover}
        </LabeledContainer>
    )
}
