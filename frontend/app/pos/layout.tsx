import AuthGuard from "@/components/auth/AuthGuard"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { Toaster } from "@/components/ui/sonner"

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
                        {children}
                    </main>
                    <Toaster />
                </div>
            </ErrorBoundary>
        </AuthGuard>
    )
}
