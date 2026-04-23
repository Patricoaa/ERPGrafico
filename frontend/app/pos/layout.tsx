import { AuthGuard } from "@/components/auth"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { Toaster } from "@/components/ui/sonner"
import { POSShell } from "@/features/pos"

export default function POSLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <AuthGuard>
            <ErrorBoundary>
                <div className="flex h-screen bg-background overflow-hidden font-sans">
                    <main className="flex-1 flex flex-col overflow-hidden">
                        <POSShell>
                            {children}
                        </POSShell>
                    </main>
                    <Toaster />
                </div>
            </ErrorBoundary>
        </AuthGuard>
    )
}

