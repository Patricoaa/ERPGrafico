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
    FormField,
} from "@/components/ui/form"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import { LabeledInput } from "@/components/shared"

const formSchema = z.object({
    username: z.string().min(2, {
        message: "El nombre de usuario debe tener al menos 2 caracteres.",
    }),
    password: z.string().min(1, {
        message: "La contraseña es obligatoria"
    }),
})

export function LoginForm() {
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
                const data = (await response.json()) as { access: string; refresh?: string }
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
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-sm relative z-10"
        >
            {/* Mobile-only brand header */}
            <div className="lg:hidden mb-10 text-center">
                <div
                    className="w-12 h-12 rounded-md flex items-center justify-center text-xl font-black mx-auto mb-4 shadow-md border border-primary/20 bg-primary"
                >
                    <span className="text-primary-foreground">ES</span>
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
                        render={({ field, fieldState }) => (
                            <LabeledInput
                                label="Usuario"
                                placeholder="nombre de usuario"
                                autoComplete="username"
                                autoFocus
                                error={fieldState.error?.message}
                                {...field}
                            />
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field, fieldState }) => (
                            <LabeledInput
                                type="password"
                                label="Contraseña"
                                placeholder="••••••••"
                                autoComplete="current-password"
                                error={fieldState.error?.message}
                                {...field}
                            />
                        )}
                    />

                    {/* Error message */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-2 p-3 rounded-sm bg-destructive/10 border border-destructive/20"
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
                            "w-full h-10 font-heading font-black uppercase tracking-widest text-xs rounded-sm",
                            "transition-all duration-300",
                            "hover:shadow-md hover:shadow-primary/20 hover:scale-[1.01]",
                            "active:scale-[0.99]"
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
    )
}
