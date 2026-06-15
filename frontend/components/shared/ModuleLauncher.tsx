"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { DynamicIcon } from "@/components/shared"
import { PermissionGuard } from "@/components/auth/PermissionGuard"
import { MODULE_REGISTRY, MODULE_ORDER, getModuleDefaultUrl, getModuleIconName } from "@/lib/module-registry"
import { motion, AnimatePresence } from "framer-motion"

interface ModuleLauncherProps {
    open: boolean
    onClose: () => void
}

const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
}

const gridVariants = {
    hidden: { opacity: 0, scale: 0.96 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: {
            delay: 0.05,
            staggerChildren: 0.04,
        },
    },
}

const cardVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0 },
}

export function ModuleLauncher({ open, onClose }: ModuleLauncherProps) {
    const pathname = usePathname()
    const segments = pathname.split('/').filter(Boolean)
    const currentModuleId = segments[0] || 'dashboard'

    useEffect(() => {
        if (!open) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [open, onClose])

    return createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    key="module-launcher-overlay"
                    variants={overlayVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/90 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        key="module-launcher-grid"
                        variants={gridVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        className="relative max-w-6xl w-full mx-2 md:mx-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={onClose}
                            className="absolute -top-12 right-0 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                            aria-label="Cerrar selector de módulos"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        <h2 className="text-xs font-bold tracking-tight text-muted-foreground uppercase mb-4 text-center">
                            Seleccionar Módulo
                        </h2>

                        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6">
                            {MODULE_ORDER.map((id) => {
                                const mod = MODULE_REGISTRY[id]
                                if (!mod) return null
                                const isActive = id === currentModuleId

                                return (
                                    <PermissionGuard permission={mod.permission ?? undefined} key={id}>
                                        <motion.div
                                            variants={cardVariants}
                                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                                        >
                                            <Link
                                                href={getModuleDefaultUrl(id)}
                                                onClick={onClose}
                                                className={cn(
                                                    "group relative flex flex-col items-center justify-center gap-3 p-6 md:p-8 rounded-xl border transition-all duration-200",
                                                    "hover:shadow-md hover:border-border/30",
                                                    isActive
                                                        ? "bg-primary/5 border-primary/20 shadow-sm"
                                                        : "bg-card border-border/10 hover:bg-muted/30"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-16 h-16 md:w-20 md:h-20 rounded-xl flex items-center justify-center transition-colors",
                                                    isActive
                                                        ? "bg-primary/10 text-primary"
                                                        : "bg-muted/50 text-muted-foreground group-hover:text-primary group-hover:bg-primary/5"
                                                )}>
                                                    <DynamicIcon name={getModuleIconName(id)} className="h-8 w-8 md:h-10 md:w-10" />
                                                </div>
                                                <span className={cn(
                                                    "text-sm font-bold tracking-tight text-center",
                                                    isActive ? "text-primary" : "text-foreground/80"
                                                )}>
                                                    {mod.label}
                                                </span>
                                                {isActive && (
                                                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                                                )}
                                            </Link>
                                        </motion.div>
                                    </PermissionGuard>
                                )
                            })}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    )
}
