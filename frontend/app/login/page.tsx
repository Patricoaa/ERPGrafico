"use client"

import Image from "next/image"
import { LoginForm } from "@/features/auth"
import { GuestGuard } from "@/components/auth"
import { useBranding } from "@/contexts/BrandingProvider"
import { getFrontendVersion } from "@/lib/version"

export default function LoginPage() {
    const { logo, company } = useBranding()
    const companyName = company?.trade_name || company?.name
    const initials = companyName?.substring(0, 2).toUpperCase() || "ERP"

    return (
        <GuestGuard>
            <div className="min-h-screen w-full flex items-center justify-center bg-background selection:bg-primary/20 relative overflow-hidden">
                <div
                    className="w-full max-w-sm relative z-10 mx-6 animate-in fade-in slide-in-from-bottom-3 ease-premium fill-mode-both duration-[600ms]"
                >
                    <div className="rounded-xl border bg-card shadow-card p-8 canvas-prepress">
                        {/* Logo */}
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
                                <h1 className="font-heading font-bold text-sm uppercase tracking-widest text-muted-foreground">
                                    {companyName}
                                </h1>
                            )}
                        </div>

                        {/* Login form */}
                        <LoginForm />

                        {/* Version footer */}
                        <div className="mt-10 pt-6 border-t border-border/40">
                            <p className="text-[10px] text-muted-foreground/50 text-center font-mono uppercase tracking-widest">
                                v{getFrontendVersion()}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </GuestGuard>
    )
}
