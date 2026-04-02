"use client"

import { IndustrialCard } from "@/components/shared/IndustrialCard"
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingCart, Users, Play, ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/shared/PageHeader"
import { motion } from "framer-motion"
import { LAYOUT_TOKENS } from "@/lib/styles"

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
}

const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
}

export default function SalesPage() {
    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Ventas"
                description="Gestión integral de ingresos, puntos de venta y flujo de caja operativo."
                iconName="shopping-cart"
            />

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            >
                <motion.div variants={item}>
                    <Link href="/pos" target="_blank">
                        <IndustrialCard variant="industrial" className="group transition-all cursor-pointer relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ArrowUpRight className="h-5 w-5 text-primary" />
                            </div>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                                <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Punto de Venta (POS)</CardTitle>
                                <div className="p-2 rounded-lg bg-primary/5 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                    <ShoppingCart className="h-4 w-4" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black font-heading mb-1">REALIZAR VENTA</div>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-tight">Ingreso rápido de pedidos y facturación</p>
                            </CardContent>
                        </IndustrialCard>
                    </Link>
                </motion.div>

                {/* Additional placeholder cards to show grid */}
                <motion.div variants={item}>
                    <Link href="/sales/orders">
                        <IndustrialCard variant="industrial" className="group transition-all cursor-pointer relative overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                                <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Notas de Venta</CardTitle>
                                <div className="p-2 rounded-lg bg-muted/20 text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                    <Play className="h-4 w-4" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black font-heading mb-1">HISTORIAL</div>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-tight">Seguimiento de pedidos pendientes</p>
                            </CardContent>
                        </IndustrialCard>
                    </Link>
                </motion.div>
            </motion.div>
        </div>
    )
}

