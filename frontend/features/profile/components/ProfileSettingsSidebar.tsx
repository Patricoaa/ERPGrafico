"use client"

import {
    BadgeCheck,
    BriefcaseBusiness,
    FileText,
    ShieldCheck,
    SlidersHorizontal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { MyProfile } from "@/types/profile"

interface ProfileSettingsSidebarProps {
    profile: MyProfile | null
    activeSection: string
    onSectionChange: (section: string) => void
}

const navigationSections = [
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
            { label: "Liquidaciones y pagos", value: "payrolls", icon: FileText },
        ],
    },
]

export function ProfileSettingsSidebar({ profile, activeSection, onSectionChange }: ProfileSettingsSidebarProps) {
    const contact = profile?.contact_detail || profile?.employee?.contact_detail
    const sections = contact?.is_partner
        ? [...navigationSections, {
            label: "Sociedad",
            items: [{ label: "Participación", value: "partner", icon: BriefcaseBusiness }],
        }]
        : navigationSections

    return (
        <div className="flex h-full min-h-0 flex-col bg-background px-1.5 py-5 sm:px-4">
            <nav aria-label="Secciones del perfil" className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto custom-scrollbar">
                {sections.map((section) => (
                    <section key={section.label} className="flex flex-col gap-0.5">
                        <h2 className="hidden px-2 pb-1.5 text-xs font-semibold text-foreground sm:block">
                            {section.label}
                        </h2>
                        {section.items.map(({ label, value, icon: Icon }) => {
                            const isActive = activeSection === value
                            return (
                                <Button
                                    type="button"
                                    key={value}
                                    variant="ghost"
                                    aria-label={label}
                                    aria-current={isActive ? "page" : undefined}
                                    title={label}
                                    onClick={() => onSectionChange(value)}
                                    className={cn(
                                        "h-9 w-full justify-center rounded-none border-l-2 px-2 text-left text-xs font-normal sm:justify-start",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset",
                                        isActive
                                            ? "border-primary bg-foreground/5 font-medium text-foreground"
                                            : "border-transparent text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                                    )}
                                >
                                    <Icon className="h-4 w-4 shrink-0 sm:hidden" aria-hidden="true" />
                                    <span className="hidden truncate sm:inline">{label}</span>
                                </Button>
                            )
                        })}
                    </section>
                ))}
            </nav>
        </div>
    )
}
