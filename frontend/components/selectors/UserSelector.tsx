"use client"

import { useState, useEffect, useCallback } from "react"
import { Check } from "lucide-react"
import { getEntityIcon } from "@/lib/entity-registry"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"

import { useDebounce } from "@/hooks/useDebounce"
import { useUserSearch, useSingleUser } from "@/features/users/hooks/useUserSearch"
import { LabeledContainer, SearchablePopover } from '@/components/shared'
import type { AppUser } from "@/types/entities"

const UserIcon = getEntityIcon('core.user')

interface UserSelectorProps {
    value?: number | null
    onChange: (value: number | null) => void
    placeholder?: string
    disabled?: boolean
    label?: string
    error?: string
}

export function UserSelector({ value, onChange, placeholder = "Seleccionar usuario...", disabled = false, label, error }: UserSelectorProps) {
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

    return (
        <LabeledContainer label={label} error={error} disabled={disabled}>
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
                    <>
                        <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-medium">{user.username}</span>
                            <span className="text-[10px] text-muted-foreground">{user.email}</span>
                        </div>
                        {selectedUser?.id === user.id && (
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
                        {selectedUser ? (
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <UserIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                                <span className="font-medium text-sm truncate">{selectedUser.username}</span>
                                <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">{selectedUser.email}</span>
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
