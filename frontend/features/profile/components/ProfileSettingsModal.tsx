"use client"

import { useState } from "react"
import { Blobatar } from "@/components/ui/blobatar"
import { BaseModal, DrawerLayout, SkeletonShell, StaleDataBanner } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { ProfileProvider, useProfile } from "@/features/profile"
import { ProfileSettingsSidebar } from "./ProfileSettingsSidebar"
import { ProfileView } from "./ProfileView"

interface ProfileSettingsModalProps {
    onOpenChange: (open: boolean) => void
    initialSection?: string
}

export function ProfileSettingsModal({ onOpenChange, initialSection = "preferences" }: ProfileSettingsModalProps) {
    const { data: profile, isLoading, isError, refetch } = useProfile()
    const [activeSection, setActiveSection] = useState(initialSection)
    const user = profile?.user
    const displayName = user?.username || [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Usuario"

    return (
        <BaseModal
            open
            onOpenChange={onOpenChange}
            title={displayName}
            description="Configuración de cuenta"
            icon={<Blobatar name={displayName} className="h-10 w-10 shrink-0 rounded-full" />}
            size="full"
            variant="raw"
            hideScrollArea
            className="w-[calc(100vw-1rem)] max-w-[1600px] h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] rounded-md p-0 gap-0"
            contentClassName="p-0 overflow-hidden"
            headerClassName="border-b border-border/70 px-4 py-3 sm:px-6"
            titleClassName="text-base font-semibold tracking-tight"
        >
            <DrawerLayout
                leftRail={<ProfileSettingsSidebar profile={profile ?? null} activeSection={activeSection} onSectionChange={setActiveSection} />}
                leftRailWidth="w-14 sm:w-56"
                noPadding
                contentClassName="p-4 sm:p-8"
            >
                <div className="flex-1 min-h-0 min-w-0 flex flex-col">
                    <SkeletonShell isLoading={isLoading} ariaLabel="Cargando perfil">
                        {!profile ? (
                            <div className="flex flex-col items-center justify-center gap-4 py-16">
                                <p className="text-sm text-muted-foreground">
                                    No se pudo cargar el perfil. Intenta nuevamente.
                                </p>
                                <Button type="button" variant="outline" onClick={() => refetch()}>
                                    Reintentar
                                </Button>
                            </div>
                        ) : (
                            <ProfileProvider profile={profile}>
                                {isError && <StaleDataBanner onRetry={() => refetch()} className="mb-4" />}
                                <ProfileView activeSection={activeSection} initialProfile={profile} onSectionChange={setActiveSection} />
                            </ProfileProvider>
                        )}
                    </SkeletonShell>
                </div>
            </DrawerLayout>
        </BaseModal>
    )
}
