"use client"

import Image from "next/image"
import Link from "next/link"
import { useBranding } from "@/contexts/BrandingProvider"
import { CmykRing } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { LayoutDashboard } from "lucide-react"

export default function DashboardNotFound() {
    const { logo, company } = useBranding()
    const companyName = company?.trade_name || company?.name
    const initials = companyName?.substring(0, 2).toUpperCase() || "ERP"

    return (
        <div className="flex h-full w-full items-center justify-center p-6">
            <Card className="w-full max-w-md border-border/50 bg-card shadow-card ribbon-cmyk">
                <CardContent className="flex flex-col items-center gap-5 pt-10 pb-4 text-center">
                    {logo ? (
                        <div className="relative h-10 w-32">
                            <Image
                                src={logo}
                                alt={companyName || "Logo"}
                                fill
                                className="object-contain"
                            />
                        </div>
                    ) : (
                        <div className="w-12 h-12 rounded-md flex items-center justify-center bg-primary text-primary-foreground font-black text-base">
                            {initials}
                        </div>
                    )}

                    <CmykRing size="lg" className="opacity-50" />

                    <div>
                        <h2 className="text-4xl font-black tracking-tighter">404</h2>
                        <p className="text-sm text-muted-foreground mt-1">Página no encontrada</p>
                    </div>
                </CardContent>
                <CardFooter className="justify-center pb-6">
                    <Button asChild variant="outline" className="border-border/50">
                        <Link href="/">
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            Volver al dashboard
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
