"use client"

import React from "react"
import { HubSkeleton } from "@/components/shared/LayoutSkeletons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CollapsibleSheet, Chip } from "@/components/shared"
import type { MyProfile } from "@/types/profile"
import { Mail, Building2, Phone, User } from "lucide-react"

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
                fullWidth={360}
            >
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-6">
                    <HubSkeleton />
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
            fullWidth={360}
        >
            <div className="flex-1 overflow-y-auto overflow-x-hidden text-foreground">
                {/* Header / Avatar Area */}
                <div className="flex flex-col items-center justify-center py-10 px-6 gap-5 border-b border-white/5 relative overflow-hidden">
                    <Avatar className="h-24 w-24 border-2 border-primary/20 shadow-xl ring-4 ring-background relative z-10">
                        <AvatarImage src="" alt={user.username} />
                        <AvatarFallback className="text-2xl font-black text-white bg-muted">
                            {initials}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex flex-col items-center gap-1 text-center relative z-10">
                        <h2 className="text-lg font-black tracking-tight leading-none text-white">
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
                    <div className="space-y-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                            Datos de Usuario
                        </span>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm">
                                <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider leading-none mb-1">Rol Principal</span>
                                    <span className="truncate font-medium leading-none">{primaryRole}</span>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 text-sm">
                                <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider leading-none mb-1.5">Equipos Funcionales</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {functionalGroups.length > 0 ? functionalGroups.map(g => (
                                            <Chip key={g} size="xs" intent="neutral" className="border-white/10 bg-white/5">{g}</Chip>
                                        )) : (
                                            <span className="text-xs text-muted-foreground italic leading-none">Sin equipos asignados</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-white/5 w-full" />

                    {/* Sección Información de Contacto */}
                    <div className="space-y-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                            Información de Contacto
                        </span>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm">
                                <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <span className="truncate font-medium">{email || "Sin email"}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <span className="truncate font-medium">{phone}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </CollapsibleSheet>
    )
}
