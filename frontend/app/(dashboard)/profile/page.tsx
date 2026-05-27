"use client"

import { ProfileView, ProfileSidePanel } from "@/features/profile"
import { PageHeader } from "@/components/shared/PageHeader"
import { PageContainer } from "@/components/shared"
import { useSearchParams } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { getMyProfile } from '@/features/profile/api/profileApi'
import { toast } from "sonner"
import type { MyProfile } from "@/types/profile"
import { SkeletonShell } from "@/components/shared"

export default function ProfilePage() {
    const searchParams = useSearchParams()
    const activeTab = searchParams.get("tab") || "account"
    const activeSubTab = searchParams.get("subtab") || (activeTab === "account" ? "preferences" : "employee")
    const [profile, setProfile] = useState<MyProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [panelOpen, setPanelOpen] = useState(true)

    const fetchProfile = useCallback(async () => {
        try {
            const data = await getMyProfile()
            setProfile(data)
        } catch {
            toast.error("Error al cargar perfil")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchProfile() }, [fetchProfile])

    if (loading) {
         return (
             <PageContainer>
                 <SkeletonShell isLoading={loading} ariaLabel="Cargando perfil de usuario">
                     <div className="mb-6 border-0 bg-transparent p-0" />
                     <div className="pt-0" />
                     <ProfileSidePanel profile={null} />
                 </SkeletonShell>
             </PageContainer>
         )
     }

    const contactDetail = profile?.contact_detail || profile?.employee?.contact_detail
    const isPartner = contactDetail?.is_partner

    const tabs = [
        { 
            value: "account", 
            label: "Cuenta", 
            iconName: "user-cog", 
            href: "/profile?tab=account&subtab=preferences",
            subTabs: [
                { value: "preferences", label: "Preferencias", iconName: "sliders", href: "/profile?tab=account&subtab=preferences" },
                { value: "security", label: "Seguridad", iconName: "shield-check", href: "/profile?tab=account&subtab=security" },
            ]
        },
        { 
            value: "personal", 
            label: "Personal", 
            iconName: "badge-check", 
            href: "/profile?tab=personal&subtab=employee",
            subTabs: [
                { value: "employee", label: "Ficha de Empleado", iconName: "badge-check", href: "/profile?tab=personal&subtab=employee" },
                { value: "payrolls", label: "Liquidaciones", iconName: "file-text", href: "/profile?tab=personal&subtab=payrolls" },
                { value: "payments", label: "Pagos y Anticipos", iconName: "credit-card", href: "/profile?tab=personal&subtab=payments" },
            ]
        },
    ]
    if (isPartner) {
        tabs.push({ value: "partner", label: "Socio", iconName: "briefcase", href: "/profile?tab=partner", subTabs: [] })
    }

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
            <PageContainer>
                <PageHeader title={title} description={description} iconName={iconName} variant="minimal" navigation={navigation} />

                <div className="pt-4">
                    <ProfileView activeTab={activeTab} activeSubTab={activeSubTab} initialProfile={profile ?? undefined} />
                </div>
            </PageContainer>

            <ProfileSidePanel profile={profile} open={panelOpen} onOpenChange={setPanelOpen} />
        </>
    )
}
