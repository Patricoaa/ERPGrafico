"use client"

import { useMemo, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { PageContainer, PageHeader } from '@/components/shared'
import { ProfileProvider, useProfile, ProfileSidePanel } from "@/features/profile"

export function ProfileLayoutClient({ children }: { children: ReactNode }) {
    const { data: profile, isLoading, isError } = useProfile()
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
                <div className="h-full flex flex-col">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <p className="text-muted-foreground text-sm">Cargando perfil...</p>
                        </div>
                    ) : isError || !profile ? (
                        <div className="p-8 text-center text-muted-foreground">
                            Error al cargar el perfil. Intente nuevamente.
                        </div>
                    ) : (
                        <ProfileProvider profile={profile}>
                            {children}
                        </ProfileProvider>
                    )}
                </div>
            </PageContainer>
            <ProfileSidePanel profile={profile ?? null} open={panelOpen} onOpenChange={setPanelOpen} />
        </>
    )
}
