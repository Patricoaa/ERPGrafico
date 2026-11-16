import { AuthGuard } from "@/components/auth"
import { DashboardShell } from "@/components/layout/DashboardShell"
import { DebugClockBanner, ErrorBoundary } from '@/components/shared'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <AuthGuard>
            <ErrorBoundary>
                <DebugClockBanner />
                <DashboardShell>
                    {children}
                </DashboardShell>
            </ErrorBoundary>
        </AuthGuard>
    )
}
