"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useState } from "react"
import { ArrowRight } from "lucide-react"

import { useAuthLogin } from '../hooks/useAuthLogin'

import {
    Form,
    FormField,
} from "@/components/ui/form"
import { Banner, LabeledInput, SubmitButton, fadeInClass } from '@/components/shared'
import { cn } from "@/lib/utils"

const formSchema = z.object({
    username: z.string().min(2, {
        message: "El nombre de usuario debe tener al menos 2 caracteres.",
    }),
    password: z.string().min(1, {
        message: "La contraseña es obligatoria"
    }),
})

export function LoginForm() {
    const [error, setError] = useState("")

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            username: "",
            password: "",
        },
    })

    const { login } = useAuthLogin()

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setError("")
        try {
            await login(values)
        } catch (err: unknown) {
            const axiosErr = err as { response?: { status?: number } }
            if (axiosErr.response?.status === 401) {
                setError("Usuario o contraseña incorrectos")
            } else {
                setError("No se pudo conectar con el servidor. Intente nuevamente.")
            }
        }
    }

    return (
        <div
            className={cn("w-full max-w-sm relative z-10", fadeInClass({ from: "bottom", distance: 3, duration: 600, delay: 200, ease: "premium" }))}
        >
            {/* Form header */}
            <div className="mb-8 text-center">
                <h1 className=" font-black text-2xl uppercase tracking-tighter text-foreground mb-2">
                    Iniciar sesión
                </h1>
                <p className="text-sm text-muted-foreground">
                    Ingresa tus credenciales para acceder al sistema.
                </p>
            </div>

            {/* Form */}
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 pt-6">
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
                        <Banner tone="destructive" live="alert" className={fadeInClass({ from: "top", distance: 1, duration: 200 })}>
                            {error}
                        </Banner>
                    )}

                    {/* Submit */}
                    <SubmitButton
                        loading={form.formState.isSubmitting}
                        size="lg"
                        className="w-full"
                        icon={false}
                    >
                        Ingresar
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </SubmitButton>
                </form>
            </Form>

        </div>
    )
}
