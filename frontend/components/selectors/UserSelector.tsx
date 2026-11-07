"use client"

import { useState, useEffect, useCallback } from "react"
import { getEntityIcon } from "@/lib/entity-registry"

import { useDebounce } from "@/hooks/useDebounce"
import { useUserSearch, useSingleUser } from "@/features/users/hooks/useUserSearch"
import { LabeledContainer, SearchablePopover, SelectorItem, SelectorTrigger, SELECTOR_VALUE_CLASS } from '@/components/shared'
import type { AppUser } from "@/types/entities"

const UserIcon = getEntityIcon('core.user')

interface UserSelectorProps {
    value?: number | null
    onChange: (value: number | null) => void
    placeholder?: string
    disabled?: boolean
    label?: string
    error?: string
    required?: boolean
    className?: string
    variant?: 'standalone' | 'inline'
}

export function UserSelector({
    value,
    onChange,
    placeholder = "Seleccionar...",
    disabled = false,
    label,
    error,
    required,
    className,
    variant = 'standalone'
}: UserSelectorProps) {
    const [open, setOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const debouncedSearch = useDebounce(searchTerm, 500)

    const { users, loading: searchLoading } = useUserSearch(debouncedSearch, open)
    const { user: singleUser } = useSingleUser(value || null)

    const [selectedUser, setSelectedUser] = useState<AppUser | null>(null)

    useEffect(() => {
        if (singleUser && singleUser.id === value) {
            requestAnimationFrame(() => setSelectedUser(singleUser))
        } else if (!value) {
            requestAnimationFrame(() => setSelectedUser(null))
        }
    }, [singleUser, value])

    const handleSelect = useCallback((user: AppUser) => {
        setSelectedUser(user)
        onChange(user.id)
        setOpen(false)
        setSearchTerm("")
    }, [onChange])

    const popover = (
        <SearchablePopover
            open={open}
            onOpenChange={setOpen}
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Buscar usuario..."
            items={users}
            isLoading={searchLoading}
            selectedId={value}
            getId={(u) => u.id}
            onSelect={handleSelect}
            renderItem={(user) => (
                <SelectorItem
                    icon={<UserIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                    title={user.username}
                    subtitle={user.email}
                    selected={selectedUser?.id === user.id}
                />
            )}
            trigger={
                <SelectorTrigger
                    hasValue={!!selectedUser}
                    placeholder={placeholder}
                    variant={variant}
                    icon={<UserIcon className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    open={open}
                    disabled={disabled}
                >
                    <span className={`${SELECTOR_VALUE_CLASS} truncate`}>{selectedUser?.username}</span>
                    <span className="text-3xs text-muted-foreground shrink-0 hidden sm:inline">{selectedUser?.email}</span>
                </SelectorTrigger>
            }
        />
    )

    if (variant === 'inline') return popover

    return (
        <LabeledContainer label={label} error={error} disabled={disabled} required={required} containerClassName={className}>
            {popover}
        </LabeledContainer>
    )
}
