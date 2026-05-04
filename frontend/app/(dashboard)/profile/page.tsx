"use client"

import { ProfileView } from "@/features/profile"
import { PageHeader } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { useSearchParams } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { getMyProfile } from '@/features/profile/api/profileApi'
import { toast } from "sonner"
import type { MyProfile } from "@/types/profile"
import { Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

export default function ProfilePage() {
    const searchParams = useSearchParams()
    const activeTab = searchParams.get("tab") || "account"
    const [profile, setProfile] = useState<MyProfile | null>(null)
    const [loading, setLoading] = useState(true)

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
            <div className={LAYOUT_TOKENS.view}>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-md" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-48" />
                        </div>
                    </div>
                </div>
                <div className="flex gap-4 mb-4">
                    <Skeleton className="h-10 w-32 rounded-md" />
                    <Skeleton className="h-10 w-32 rounded-md" />
                </div>
                <div className="pt-4">
                    <ProfileView activeTab={activeTab} />
                </div>
            </div>
        )
    }

    const contactDetail = profile?.contact_detail || profile?.employee?.contact_detail
    const isPartner = contactDetail?.is_partner

    const tabs = [
        { value: "account", label: "Cuenta", iconName: "user-cog", href: "/profile?tab=account" },
        { value: "personal", label: "Personal", iconName: "badge-check", href: "/profile?tab=personal" },
    ]
    if (isPartner) {
        tabs.push({ value: "partner", label: "Socio", iconName: "briefcase", href: "/profile?tab=partner" })
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
        activeValue: activeTab
    }

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader title={title} description={description} iconName={iconName} variant="minimal" navigation={navigation} />
            
            <div className="pt-4">
                <ProfileView activeTab={activeTab} initialProfile={profile ?? undefined} />
            </div>
        </div>
    )
}
