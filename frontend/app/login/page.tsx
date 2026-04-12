"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { motion } from "framer-motion"
import { Loader2, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"

const formSchema = z.object({
    username: z.string().min(2, {
        message: "El nombre de usuario debe tener al menos 2 caracteres.",
    }),
    password: z.string().min(1, {
        message: "La contraseña es obligatoria"
    }),
})

export default function LoginPage() {
    const router = useRouter()
    const { login } = useAuth()
    const [error, setError] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            username: "",
            password: "",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setError("")
        setIsLoading(true)
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/token/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            })

            if (response.ok) {
                const data = await response.json()
                await login(data.access)
                if (data.refresh) {
                    localStorage.setItem('refresh_token', data.refresh)
                }
                router.push('/')
            } else {
                setError("Credenciales inválidas")
            }
        } catch (err) {
            setError("No se pudo conectar con el servidor. Intente nuevamente.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen w-full">
            {/* Left Panel — Brand Identity */}
            <div
                className="hidden lg:flex lg:w-[45%] xl:w-[50%] relative overflow-hidden items-end p-12"
                style={{ backgroundColor: 'oklch(0.10 0.02 240)' }}
            >
                {/* Ambient gradient glows */}
                <div
                    className="absolute inset-0 opacity-30"
                    style={{
                        backgroundImage: `
                            radial-gradient(ellipse 600px 400px at 20% 80%, oklch(0.62 0.24 301 / 0.4), transparent),
                            radial-gradient(ellipse 400px 600px at 80% 20%, oklch(0.62 0.24 301 / 0.15), transparent)
                        `
                    }}
                />

                {/* Noise texture overlay */}
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`
                    }}
                />

                {/* Decorative grid lines */}
                <div className="absolute inset-0 opacity-[0.04]"
                    style={{
                        backgroundImage: `
                            linear-gradient(to right, white 1px, transparent 1px),
                            linear-gradient(to bottom, white 1px, transparent 1px)
                        `,
                        backgroundSize: '80px 80px'
                    }}
                />

                {/* Corner marks — industrial precision feel */}
                <div className="absolute top-8 left-8 w-8 h-8 border-t-2 border-l-2 border-white/10" />
                <div className="absolute top-8 right-8 w-8 h-8 border-t-2 border-r-2 border-white/10" />
                <div className="absolute bottom-8 left-8 w-8 h-8 border-b-2 border-l-2 border-white/10" />
                <div className="absolute bottom-8 right-8 w-8 h-8 border-b-2 border-r-2 border-white/10" />

                {/* Brand content */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="relative z-10 max-w-lg"
                >
                    {/* Logo mark */}
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-black mb-10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-white/10"
                        style={{ backgroundColor: 'oklch(0.62 0.24 301)' }}
                    >
                        <span style={{ color: 'oklch(0.99 0.01 310)' }}>ES</span>
                    </div>

                    <h1
                        className="font-heading font-black text-5xl xl:text-6xl uppercase tracking-tighter leading-[0.9] mb-6"
                        style={{ color: 'oklch(0.95 0.02 240)' }}
                    >
                        Gestión<br />
                        <span style={{ color: 'oklch(0.62 0.24 301)' }}>industrial</span><br />
                        inteligente
                    </h1>

                    <p
                        className="text-sm leading-relaxed max-w-sm mb-10"
                        style={{ color: 'oklch(0.55 0.02 240)' }}
                    >
                        Contabilidad, inventario, producción y ventas integrados
                        en una sola plataforma. Creado para imprentas y manufactura.
                    </p>

                    {/* Feature pills */}
                    <div className="flex flex-wrap gap-2">
                        {['Contabilidad', 'Inventario', 'Producción', 'Tesorería', 'POS'].map((module, i) => (
                            <motion.span
                                key={module}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 + i * 0.08, duration: 0.5 }}
                                className="px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest border"
                                style={{
                                    borderColor: 'oklch(1 0 0 / 0.08)',
                                    color: 'oklch(0.60 0.02 240)',
                                    backgroundColor: 'oklch(1 0 0 / 0.03)',
                                }}
                            >
                                {module}
                            </motion.span>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Right Panel — Login Form */}
            <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background relative">
                {/* Subtle noise on form side too */}
                <div
                    className="absolute inset-0 opacity-[0.015] pointer-events-none"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`
                    }}
                />

                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full max-w-sm relative z-10"
                >
                    {/* Mobile-only brand header */}
                    <div className="lg:hidden mb-10 text-center">
                        <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black mx-auto mb-4 shadow-lg border border-primary/20"
                            style={{ backgroundColor: 'oklch(0.62 0.24 301)' }}
                        >
                            <span style={{ color: 'oklch(0.99 0.01 310)' }}>ES</span>
                        </div>
                        <h1 className="font-heading font-black text-2xl uppercase tracking-tighter text-foreground">
                            ERPGrafico
                        </h1>
                    </div>

                    {/* Form header */}
                    <div className="mb-8">
                        <h2 className="font-heading font-black text-2xl uppercase tracking-tighter text-foreground mb-2">
                            Iniciar sesión
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Ingresa tus credenciales para acceder al sistema.
                        </p>
                    </div>

                    {/* Form */}
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            <FormField
                                control={form.control}
                                name="username"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className={FORM_STYLES.label}>Usuario</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="nombre de usuario"
                                                className={cn(FORM_STYLES.input, "h-12")}
                                                autoComplete="username"
                                                autoFocus
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className={FORM_STYLES.label}>Contraseña</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="password"
                                                placeholder="••••••••"
                                                className={cn(FORM_STYLES.input, "h-12")}
                                                autoComplete="current-password"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Error message */}
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20"
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                                    <p className="text-xs font-medium text-destructive">{error}</p>
                                </motion.div>
                            )}

                            {/* Submit */}
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className={cn(
                                    "w-full h-12 font-heading font-black uppercase tracking-widest text-xs",
                                    "transition-all duration-300",
                                    "hover:shadow-lg hover:shadow-primary/20 hover:scale-[1.02]",
                                    "active:scale-[0.98]"
                                )}
                            >
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        Ingresar
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </form>
                    </Form>

                    {/* Footer */}
                    <div className="mt-12 pt-6 border-t border-border/40">
                        <p className="text-[10px] text-muted-foreground/50 text-center font-medium uppercase tracking-widest">
                            ERPGrafico &middot; Sistema de gestión empresarial
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
