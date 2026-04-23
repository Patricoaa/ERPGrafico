import { AuthGuard } from "@/components/auth"
import { DashboardShell } from "@/components/layout/DashboardShell"
import { ErrorBoundary } from "@/components/ui/error-boundary"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <AuthGuard>
            <ErrorBoundary>
                <DashboardShell>
                    {children}
                </DashboardShell>
            </ErrorBoundary>
        </AuthGuard>
    )
}
