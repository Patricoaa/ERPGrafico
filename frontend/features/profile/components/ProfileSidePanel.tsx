"use client"

import React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CollapsibleSheet, Chip, SkeletonShell } from "@/components/shared"
import type { MyProfile } from "@/types/profile"
import { User } from "lucide-react"

export interface ProfileSidePanelProps {
    profile: MyProfile | null
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function ProfileSidePanel({ profile, open = true, onOpenChange }: ProfileSidePanelProps) {
    const handleOpenChange = (newOpen: boolean) => {
        onOpenChange?.(newOpen)
    }

             if (!profile) {
        return (
            <CollapsibleSheet
                sheetId="profile-side-panel"
                open={open}
                onOpenChange={handleOpenChange}
                tabLabel="Perfil"
                tabIcon={User}
                fullWidth={320}
            >
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-6">
                    <SkeletonShell isLoading={true} ariaLabel="Cargando perfil">
                        <div className="flex-1 h-full">
                            <div className="flex flex-col items-center justify-center py-12 gap-4 border-b border-border">
                                <div className="h-20 w-20 rounded-full border-2 border-primary/10" />
                                <div className="flex flex-col items-center gap-2">
                                    <div className="h-4 w-32" />
                                    <div className="h-2 w-24 opacity-40" />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="p-4 rounded-md border border-border/50 bg-card/50 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <div className="h-5 w-40" />
                                        <div className="h-5 w-5 rounded-full" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-3 w-full opacity-60" />
                                        <div className="h-3 w-2/3 opacity-40" />
                                    </div>
                                    <div className="pt-2 border-t border-border/20 flex justify-end">
                                        <div className="h-8 w-24 rounded" />
                                    </div>
                                </div>
                                <div className="p-4 rounded-md border border-border/50 bg-card/50 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <div className="h-5 w-40" />
                                        <div className="h-5 w-5 rounded-full" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-3 w-full opacity-60" />
                                        <div className="h-3 w-2/3 opacity-40" />
                                    </div>
                                    <div className="pt-2 border-t border-border/20 flex justify-end">
                                        <div className="h-8 w-24 rounded" />
                                    </div>
                                </div>
                                <div className="p-4 rounded-md border border-border/50 bg-card/50 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <div className="h-5 w-40" />
                                        <div className="h-5 w-5 rounded-full" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-3 w-full opacity-60" />
                                        <div className="h-3 w-2/3 opacity-40" />
                                    </div>
                                    <div className="pt-2 border-t border-border/20 flex justify-end">
                                        <div className="h-8 w-24 rounded" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </SkeletonShell>
                </div>
            </CollapsibleSheet>
        )
    }

    const { user, employee, contact_detail } = profile

    // Determine Role
    const systemRoles = ['ADMIN', 'MANAGER', 'OPERATOR', 'READ_ONLY']
    const primaryRole = user.groups?.find(g => systemRoles.includes(g)) || 'Sin Rol'

    // Get Initials
    const firstName = user.first_name || ""
    const lastName = user.last_name || ""
    const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || user.username.substring(0, 2).toUpperCase()

    // Contact info priority: contact_detail -> user
    const email = contact_detail?.email || user.email
    const phone = contact_detail?.phone || "—"

    // Position/Department priority: employee -> direct info (if it existed)
    const position = employee?.position || "—"

    const functionalGroups = user.groups?.filter(g => !systemRoles.includes(g)) || []

    return (
        <CollapsibleSheet
            sheetId="profile-side-panel"
            open={open}
            onOpenChange={handleOpenChange}
            tabLabel="Perfil"
            tabIcon={User}
            fullWidth={320}
        >
            <div className="flex-1 overflow-y-auto overflow-x-hidden text-foreground ">
                {/* Header / Avatar Area */}
                <div className="flex flex-col items-center justify-center py-10 px-6 gap-5 border-border/10 relative overflow-hidden">
                    <Avatar className="h-24 w-24 border-2 border-primary/20 shadow-xl ring-4 ring-background relative z-10">
                        <AvatarImage src="" alt={user.username} />
                        <AvatarFallback className="text-2xl font-black text-foreground bg-muted">
                            {initials}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex flex-col items-center gap-1 text-center relative z-10">
                        <h2 className="text-lg font-black tracking-tight leading-none text-foreground">
                            {`${firstName} ${lastName}`.trim() || user.username}
                        </h2>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">
                            {position}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 relative z-10 mt-1">
                        <Chip intent={user.is_active ? "success" : "destructive"}>{user.is_active ? "Activo" : "Inactivo"}</Chip>
                    </div>
                </div>

                <div className="p-6 space-y-8">
                    {/* Sección Datos de Usuario */}
                    <div className="space-y-6 flex flex-col items-center w-full">
                        <div className="flex items-center gap-2 w-full pt-2">
                            <div className="flex-1 h-px bg-border/50" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap">
                                Datos de Usuario
                            </span>
                            <div className="flex-1 h-px bg-border/50" />
                        </div>

                        <div className="space-y-6 flex flex-col items-center w-full">
                            {/* Rol Principal */}
                            <div className="flex flex-col items-center text-center space-y-1.5">
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider leading-none mb-1">Rol Principal</span>
                                    <span className="font-semibold text-sm leading-none">{primaryRole}</span>
                                </div>
                            </div>

                            {/* Equipos Funcionales */}
                            <div className="flex flex-col items-center text-center space-y-1.5">
                                <div className="flex flex-col items-center min-w-0">
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider leading-none mb-1.5">Equipos Funcionales</span>
                                    <div className="flex flex-wrap justify-center gap-1.5">
                                        {functionalGroups.length > 0 ? functionalGroups.map(g => (
                                            <Chip key={g} size="xs" intent="neutral" className="border-border/10 bg-muted">{g}</Chip>
                                        )) : (
                                            <span className="text-xs text-muted-foreground italic leading-none">Sin equipos asignados</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sección Información de Contacto */}
                    <div className="space-y-6 flex flex-col items-center w-full">
                        <div className="flex items-center gap-2 w-full pt-2">
                            <div className="flex-1 h-px bg-border/50" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap">
                                Información de Contacto
                            </span>
                            <div className="flex-1 h-px bg-border/50" />
                        </div>

                        <div className="space-y-6 flex flex-col items-center w-full">
                            {/* Email */}
                            <div className="flex flex-col items-center text-center space-y-1.5">
                                <div className="flex flex-col items-center min-w-0">
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider leading-none mb-1">Email</span>
                                    <span className="font-semibold text-sm truncate max-w-[280px]">{email || "Sin email"}</span>
                                </div>
                            </div>

                            {/* Teléfono */}
                            <div className="flex flex-col items-center text-center space-y-1.5">
                                <div className="flex flex-col items-center min-w-0">
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider leading-none mb-1">Teléfono</span>
                                    <span className="font-semibold text-sm truncate">{phone}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </CollapsibleSheet>
    )
}
