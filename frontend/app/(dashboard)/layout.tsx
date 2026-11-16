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
                <div className="flex h-screen flex-col">
                    <DebugClockBanner />
                    <DashboardShell>
                        {children}
                    </DashboardShell>
                </div>
            </ErrorBoundary>
        </AuthGuard>
    )
}
