"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingCart, Users, Play, ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/shared/PageHeader"
import { motion } from "framer-motion"

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
        <div className="flex-1 space-y-8 p-8 pt-6 max-w-7xl mx-auto">
            <PageHeader
                title="Ventas"
                description="Gestión integral de ingresos, puntos de venta y flujo de caja operativo."
            />

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            >
                <motion.div variants={item}>
                    <Link href="/sales/pos">
                        <Card className="group hover:border-primary/50 transition-all cursor-pointer border-2 bg-card relative overflow-hidden shadow-none hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
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

                            {/* Industrial corner decoration */}
                            <div className="absolute bottom-0 left-0 w-8 h-8 opacity-5">
                                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-foreground" />
                                <div className="absolute bottom-0 left-0 w-[2px] h-full bg-foreground" />
                            </div>
                        </Card>
                    </Link>
                </motion.div>

                {/* Additional placeholder cards to show grid */}
                <motion.div variants={item}>
                    <Link href="/sales/orders">
                        <Card className="group hover:border-primary/50 transition-all cursor-pointer border-2 bg-card relative overflow-hidden shadow-none hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
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
                        </Card>
                    </Link>
                </motion.div>
            </motion.div>
        </div>
    )
}
