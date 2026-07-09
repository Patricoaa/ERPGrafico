"use client"

import Image from "next/image"
import Link from "next/link"
import { useBranding } from "@/contexts/BrandingProvider"
import { PrepressPanel } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Home } from "lucide-react"

export default function NotFound() {
    const { logo, company } = useBranding()
    const companyName = company?.trade_name || company?.name
    const initials = companyName?.substring(0, 2).toUpperCase() || "ERP"

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background selection:bg-primary/20 relative overflow-hidden p-4">
            <div className="absolute -bottom-20 -right-20 opacity-[0.04] pointer-events-none">
                <div
                    className="h-[400px] w-[400px] rounded-full"
                    style={{
                        background:
                            "conic-gradient(from 0deg, var(--color-cyan) 0deg 90deg, var(--color-magenta) 90deg 180deg, var(--color-yellow) 180deg 270deg, var(--color-black) 270deg 360deg)",
                    }}
                />
            </div>
            <div className="w-full max-w-sm relative z-10 mx-6 animate-in fade-in slide-in-from-bottom-3 ease-premium fill-mode-both duration-[600ms]">
                <PrepressPanel className="rounded-xl border bg-card shadow-card p-8">
                    <div className="mb-8 flex flex-col items-center">
                        {logo ? (
                            <div className="relative h-14 w-40 mb-3">
                                <Image
                                    src={logo}
                                    alt={companyName || "Logo"}
                                    fill
                                    className="object-contain"
                                />
                            </div>
                        ) : (
                            <div className="w-14 h-14 rounded-md flex items-center justify-center bg-primary text-primary-foreground font-black text-lg mb-3">
                                {initials}
                            </div>
                        )}
                        {companyName && (
                            <h1 className="font-bold text-sm uppercase tracking-tighter text-muted-foreground">
                                {companyName}
                            </h1>
                        )}
                    </div>

                    <div className="flex flex-col items-center gap-4 text-center">
                        <h2 className="text-7xl font-black tracking-tighter leading-none">404</h2>
                        <p className="text-sm text-muted-foreground">Página no encontrada</p>
                    </div>

                    <div className="mt-8 pt-6 border-t border-border/40">
                        <Button asChild variant="default" className="w-full">
                            <Link href="/">
                                <Home className="mr-2 h-4 w-4" />
                                Volver al inicio
                            </Link>
                        </Button>
                    </div>
                </PrepressPanel>
            </div>
        </div>
    )
}
