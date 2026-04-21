"use client"

import { motion } from "framer-motion"
import { LoginForm } from "@/features/auth"

export default function LoginPage() {
    return (
        <div className="min-h-screen w-full flex bg-background selection:bg-primary/20">
            {/* Left Panel: Brand & Decorative (Industrial Dark) */}
            <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 bg-sidebar overflow-hidden">
                {/* Decorative Grid Background */}
                <div className="absolute inset-0 bleed-guides opacity-20 pointer-events-none" />
                
                {/* Registration Marks (CSS Class based) */}
                <div className="absolute inset-8 registration-marks pointer-events-none opacity-40" />

                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="relative z-10"
                >
                    <div className="flex items-center gap-3 mb-12">
                        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black shadow-lg shadow-primary/20">
                            <span>ES</span>
                        </div>
                        <span className="font-heading font-black text-xl uppercase tracking-tighter text-sidebar-foreground">
                            ERPGrafico
                        </span>
                    </div>

                    <h1 className="font-heading font-black text-6xl xl:text-7xl uppercase tracking-tighter leading-[0.9] text-sidebar-foreground mb-6">
                        Impulsando la <br />
                        <span className="text-primary">Producción</span> <br />
                        Gráfica.
                    </h1>
                    <p className="max-w-md text-sidebar-foreground/60 text-lg font-medium leading-relaxed">
                        La plataforma modular definitiva para la gestión de imprentas y talleres de artes gráficas.
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    transition={{ delay: 1, duration: 1 }}
                    className="relative z-10 flex flex-wrap gap-4"
                >
                    {["Producción", "Ventas", "Finanzas", "RRHH"].map((feature) => (
                        <div
                            key={feature}
                            className="px-4 py-1.5 rounded-md border border-sidebar-border bg-sidebar-accent text-[10px] font-black uppercase tracking-widest text-sidebar-foreground"
                        >
                            {feature}
                        </div>
                    ))}
                </motion.div>

                {/* Industrial bottom mark */}
                <div className="absolute bottom-12 right-12 opacity-10 select-none pointer-events-none">
                    <span className="font-mono text-[120px] font-black leading-none uppercase tracking-tighter">
                        ERP-GR
                    </span>
                </div>
            </div>

            {/* Right Panel: Auth Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-background relative overflow-hidden">
                {/* Subtle background marks for light side */}
                <div className="absolute top-12 right-12 w-24 h-24 border-r border-t border-border/40 opacity-50" />
                <div className="absolute bottom-12 left-12 w-24 h-24 border-l border-b border-border/40 opacity-50" />
                
                <LoginForm />
            </div>
        </div>
    )
}
