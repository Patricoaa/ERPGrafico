"use client"

import {
    BadgeCheck,
    BriefcaseBusiness,
    FileText,
    ShieldCheck,
    SlidersHorizontal,
} from "lucide-react"
import { RailNav, type RailNavSection } from "@/components/shared"
import type { MyProfile } from "@/types/profile"

interface ProfileSettingsSidebarProps {
    profile: MyProfile | null
    activeSection: string
    onSectionChange: (section: string) => void
}

const navigationSections: RailNavSection[] = [
    {
        label: "Cuenta",
        items: [
            { label: "Preferencias", value: "preferences", icon: SlidersHorizontal },
            { label: "Seguridad", value: "security", icon: ShieldCheck },
        ],
    },
    {
        label: "Personal",
        items: [
            { label: "Ficha de Personal", value: "employee", icon: BadgeCheck },
            { label: "Liquidaciones", value: "payrolls", icon: FileText },
        ],
    },
]

const partnerSection: RailNavSection = {
    label: "Sociedad",
    items: [{ label: "Participación", value: "partner", icon: BriefcaseBusiness }],
}

export function ProfileSettingsSidebar({ profile, activeSection, onSectionChange }: ProfileSettingsSidebarProps) {
    const contact = profile?.contact_detail || profile?.employee?.contact_detail
    const sections = contact?.is_partner ? [...navigationSections, partnerSection] : navigationSections

    return (
        <RailNav
            sections={sections}
            value={activeSection}
            onValueChange={onSectionChange}
            ariaLabel="Secciones del perfil"
        />
    )
}
