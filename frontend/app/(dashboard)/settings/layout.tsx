import { Metadata } from "next"
import { PageContainer } from "@/components/shared"
import { SettingsHeader } from "./SettingsHeader"

export const metadata: Metadata = {
    title: "Configuración Global | ERPGrafico",
    description: "Panel de administración y parámetros transversales del sistema.",
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    return (
        <PageContainer>
            <SettingsHeader />
            <div className="pt-2">
                {children}
            </div>
        </PageContainer>
    )
}
