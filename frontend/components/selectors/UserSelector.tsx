"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Search, Loader2, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/shared/EmptyState"
import { useDebounce } from "@/hooks/use-debounce"
import { useUserSearch } from "@/features/users/hooks/useUserSearch"
import { CardSkeleton } from "@/components/shared"
import type { AppUser } from "@/types/entities"

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
    const { users, singleUser, loading: searchLoading, fetchUsers, fetchSingleUser } = useUserSearch()
    const [searchTerm, setSearchTerm] = useState("")
    const debouncedSearch = useDebounce(searchTerm, 500)
    const [selectedUser, setSelectedUser] = useState<AppUser | null>(null)

    // Fetch initial selected user if missing
    useEffect(() => {
        if (value && !selectedUser && value.toString() !== singleUser?.id.toString()) {
            fetchSingleUser(value.toString())
        } else if (!value) {
            requestAnimationFrame(() => setSelectedUser(null))
        }
    }, [value, selectedUser, singleUser, fetchSingleUser])

    // Sync fetched single user to local state
    useEffect(() => {
        if (singleUser && singleUser.id === value) {
            requestAnimationFrame(() => setSelectedUser(singleUser))
        }
    }, [singleUser, value])

    // Fetch users on search
    useEffect(() => {
        if (open) {
            fetchUsers(debouncedSearch)
        }
    }, [debouncedSearch, open, fetchUsers])

    const handleSelect = (user: AppUser) => {
        setSelectedUser(user)
        onChange(user.id)
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
                    {selectedUser ? (
                        <div className="flex items-center gap-2 truncate text-left w-[calc(100%-20px)]">
                            <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
                                <User className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col items-start truncate leading-tight overflow-hidden w-full">
                                <span className="font-medium text-sm truncate w-full">{selectedUser.username}</span>
                                <span className="text-[10px] text-muted-foreground truncate w-full">{selectedUser.email}</span>
                            </div>
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
                            placeholder="Buscar usuario..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto space-y-1">
                        {searchLoading ? (
                            <CardSkeleton count={3} variant="compact" />
                        ) : users.length === 0 ? (
                            <EmptyState context="users" variant="compact" title="No se encontraron usuarios" />
                        ) : (
                            users.map((u) => (
                                <div
                                    key={u.id}
                                    className={cn(
                                        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                        selectedUser?.id === u.id && "bg-accent"
                                    )}
                                    onClick={() => handleSelect(u)}
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium">{u.username}</span>
                                        <span className="text-[10px] text-muted-foreground">{u.email}</span>
                                    </div>
                                    {selectedUser?.id === u.id && (
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
