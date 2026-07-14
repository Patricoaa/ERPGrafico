"use client"

import { useMemo, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { PageContainer, PageHeader, SkeletonShell, StaleDataBanner } from '@/components/shared'
import { ProfileProvider, useProfile, ProfileSidePanel } from "@/features/profile"

export function ProfileLayoutClient({ children }: { children: ReactNode }) {
    const { data: profile, isLoading, isError, refetch } = useProfile()
    const pathname = usePathname()
    const [panelOpen, setPanelOpen] = useState(true)

    const segments = pathname.split('/').filter(Boolean)
    const activeTab = segments[1] === 'partner' ? 'partner' : segments[1] === 'personal' ? 'personal' : 'account'
    const activeSubTab = segments[2] || (activeTab === 'account' ? 'preferences' : 'employee')

    const contactDetail = profile?.contact_detail || profile?.employee?.contact_detail
    const isPartner = !!contactDetail?.is_partner

    const tabs = useMemo(() => {
        const base = [
            {
                value: "account",
                label: "Cuenta",
                iconName: "user-cog",
                href: "/profile/account/preferences",
                subTabs: [
                    { value: "preferences", label: "Preferencias", iconName: "sliders", href: "/profile/account/preferences" },
                    { value: "security", label: "Seguridad", iconName: "shield-check", href: "/profile/account/security" },
                ]
            },
            {
                value: "personal",
                label: "Personal",
                iconName: "badge-check",
                href: "/profile/personal/employee",
                subTabs: [
                    { value: "employee", label: "Ficha de Empleado", iconName: "badge-check", href: "/profile/personal/employee" },
                    { value: "payrolls", label: "Liquidaciones", iconName: "file-text", href: "/profile/personal/payrolls" },
                    { value: "payments", label: "Pagos y Anticipos", iconName: "credit-card", href: "/profile/personal/payments" },
                ]
            },
        ]
        if (isPartner) {
            base.push({ value: "partner", label: "Socio", iconName: "briefcase", href: "/profile/partner", subTabs: [] })
        }
        return base
    }, [isPartner])

    const getHeaderConfig = () => {
        switch (activeTab) {
            case "account":
                return {
                    title: "Mi Cuenta",
                    description: "Gestione su información de usuario y credenciales de acceso al sistema.",
                    iconName: "user-cog"
                }
            case "personal":
                return {
                    title: "Mi Ficha Personal",
                    description: "Visualice su información como empleado, historial de liquidaciones y pagos.",
                    iconName: "badge-check"
                }
            case "partner":
                return {
                    title: "Mi Capital",
                    description: "Centro de control de participación societaria y estado de cuenta patrimonial.",
                    iconName: "briefcase"
                }
            default:
                return { title: "Mi Perfil", description: "", iconName: "user" }
        }
    }

    const { title, description, iconName } = getHeaderConfig()

    const navigation = {
        tabs,
        activeValue: activeTab,
        subActiveValue: (activeTab === "personal" || activeTab === "account") ? activeSubTab : undefined
    }

    return (
        <>
            <PageContainer className="flex flex-col">
                <PageHeader title={title} description={description} iconName={iconName} variant="minimal" navigation={navigation} />
                <div className="flex-1 min-h-0 flex flex-col">
                    <SkeletonShell isLoading={isLoading} ariaLabel="Cargando perfil">
                    {!profile ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-4">
                            <p className="text-muted-foreground text-sm">
                                Error al cargar el perfil. Intente nuevamente.
                            </p>
                            <button
                                onClick={() => refetch()}
                                className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
                            >
                                Reintentar
                            </button>
                        </div>
                    ) : (
                        <ProfileProvider profile={profile}>
                            {isError && <StaleDataBanner onRetry={() => refetch()} className="mx-4 mt-2" />}
                            {children}
                        </ProfileProvider>
                    )}
                    </SkeletonShell>
                </div>
            </PageContainer>
            <ProfileSidePanel profile={profile ?? null} open={panelOpen} onOpenChange={setPanelOpen} />
        </>
    )
}
