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
import { Input } from "@/components/ui/input"
import api from "@/lib/api"
import { useDebounce } from "@/hooks/use-debounce"

interface User {
    id: number
    username: string
    email: string
}

interface UserSelectorProps {
    value?: number | null
    onChange: (value: number | null) => void
    placeholder?: string
}

export function UserSelector({ value, onChange, placeholder = "Seleccionar usuario..." }: UserSelectorProps) {
    const [open, setOpen] = useState(false)
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const debouncedSearch = useDebounce(searchTerm, 500)
    const [selectedUser, setSelectedUser] = useState<User | null>(null)

    // Fetch initial selected user
    useEffect(() => {
        const fetchSelected = async () => {
            if (value && !selectedUser) {
                try {
                    const res = await api.get(`/core/users/${value}/`)
                    setSelectedUser(res.data)
                } catch (e) {
                    console.error("Failed to fetch selected user", e)
                }
            } else if (!value) {
                setSelectedUser(null)
            }
        }
        fetchSelected()
    }, [value])

    // Fetch users on search
    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true)
            try {
                const params = new URLSearchParams()
                if (debouncedSearch) params.append('search', debouncedSearch)

                const res = await api.get(`/core/users/?${params.toString()}`)
                const list = Array.isArray(res.data) ? res.data : (res.data.results || [])
                setUsers(list)
            } catch (error) {
                console.error("Error searching users", error)
            } finally {
                setLoading(false)
            }
        }

        if (open) {
            fetchUsers()
        }
    }, [debouncedSearch, open])

    const handleSelect = (user: User) => {
        setSelectedUser(user)
        onChange(user.id)
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
                >
                    {selectedUser ? (
                        <span className="truncate">{selectedUser.username}</span>
                    ) : (
                        <span className="text-muted-foreground">{placeholder}</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
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
                        {loading ? (
                            <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                        ) : users.length === 0 ? (
                            <div className="p-4 text-sm text-center text-muted-foreground">
                                No se encontraron usuarios.
                            </div>
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
    )
}
